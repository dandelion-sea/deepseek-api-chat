import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import {
  buildIndexEntries,
  getQueryTerms,
  matchesIndexedMessage,
  type IndexedMessage,
} from './searchIndex.js'
import { toSessionSummary, type Session, type SessionSummary } from './types.js'

/** IndexedDB 存储结构版本；新增或调整存储、索引时递增。 */
const DB_VERSION = 12
/** 消息索引结构版本；分词规则变化时递增，下次启动重建。 */
const INDEX_VERSION = 1
const INDEX_META_KEY = 'messageIndexVersion'
const SEARCH_RESULT_LIMIT = 100

/** 文件原件按附件的本地 id 存储，所有引用同一 id 的消息共用一份；用于缩略图、打开查看，以及没有 serverId 时补传。 */
export type StoredFile = {
  id: string
  blob: Blob
}

/** 文件引用留在摘要中，删除会话时通过索引判断原件是否仍被引用。 */
type StoredSessionSummary = SessionSummary & { fileIds: string[] }

interface ChatDB extends DBSchema {
  /** 当前使用的会话，界面读写都在这里 */
  sessions: { key: string; value: Session }
  sessionSummaries: {
    key: string
    value: StoredSessionSummary
    indexes: { fileIds: string }
  }
  /** 当前使用的文件原件 */
  files: { key: string; value: StoredFile }
  /** 本地消息搜索索引：只收录当前分支，按会话批量替换。 */
  messageIndex: {
    key: string
    value: IndexedMessage
    indexes: { sessionId: string; terms: string }
  }
  /** 索引结构版本等元数据，使用独立键存储。 */
  meta: { key: string; value: number }
  /**
   * 历史导入的暂存：导入过程中会话与原件只写入这两个存储，`sessions` / `files` 保持不变；
   * 全部校验通过后在一个事务中替换正式数据并清空暂存，失败时只清空暂存。
   */
  sessionsStaging: { key: string; value: Session }
  filesStaging: { key: string; value: StoredFile }
}

let dbPromise: Promise<IDBPDatabase<ChatDB>> | null = null

const storedSummary = (session: Session): StoredSessionSummary => ({
  ...toSessionSummary(session),
  fileIds: [
    ...new Set(
      session.messages.flatMap((message) =>
        message.role === 'user' ? message.files.map((file) => file.id) : []
      )
    ),
  ],
})

const abortTransaction = (tx: { abort(): void }) => {
  try {
    tx.abort()
  } catch {
    // 事务已因请求失败中止。
  }
}

type MessageIndexStore = {
  put(value: IndexedMessage): Promise<unknown>
  delete(key: string): Promise<void>
  index(name: 'sessionId'): { getAllKeys(query: string): Promise<string[]> }
}

const putSessionIndex = async (store: MessageIndexStore, session: Session) => {
  for (const entry of buildIndexEntries(session)) {
    await store.put(entry)
  }
}

const deleteSessionIndex = async (store: MessageIndexStore, sessionId: string) => {
  const keys = await store.index('sessionId').getAllKeys(sessionId)
  for (const key of keys) {
    await store.delete(key)
  }
}

const replaceSessionIndex = async (store: MessageIndexStore, session: Session) => {
  await deleteSessionIndex(store, session.id)
  await putSessionIndex(store, session)
}

// 每个操作拿到连接后立即创建事务；IndexedDB 按创建顺序执行范围重叠的事务，读取总能看到之前发起的写入。
const getDB = () =>
  (dbPromise ??= openDB<ChatDB>('chat-demo', DB_VERSION, {
    upgrade(db, _oldVersion, _newVersion, tx) {
      // 初始化当前格式需要的存储与索引，不迁移旧消息。
      for (const name of ['sessions', 'files', 'sessionsStaging', 'filesStaging'] as const) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
      const summaries = db.objectStoreNames.contains('sessionSummaries')
        ? tx.objectStore('sessionSummaries')
        : db.createObjectStore('sessionSummaries', { keyPath: 'id' })
      if (!summaries.indexNames.contains('fileIds')) {
        summaries.createIndex('fileIds', 'fileIds', { multiEntry: true })
      }
      if (!db.objectStoreNames.contains('messageIndex')) {
        const messageIndex = db.createObjectStore('messageIndex', { keyPath: 'id' })
        messageIndex.createIndex('sessionId', 'sessionId')
        messageIndex.createIndex('terms', 'terms', { multiEntry: true })
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta')
      }
    },
  }).catch((error: unknown) => {
    // 打开失败后允许界面重试，避免一直复用已拒绝的 Promise。
    dbPromise = null
    throw error
  }))

export const loadSessionSummaries = async (): Promise<SessionSummary[]> =>
  (await (await getDB()).getAll('sessionSummaries')).map(toSessionSummary)

export const loadSession = async (id: string): Promise<Session | undefined> =>
  (await getDB()).get('sessions', id)

export const saveSession = async (session: Session, files: StoredFile[] = []): Promise<void> => {
  const summary = storedSummary(session)
  const tx = (await getDB()).transaction(
    ['sessions', 'sessionSummaries', 'files', 'messageIndex'],
    'readwrite'
  )
  await Promise.all([
    (async () => {
      try {
        for (const file of files) {
          await tx.objectStore('files').put(file)
        }
        await tx.objectStore('sessions').put(session)
        await tx.objectStore('sessionSummaries').put(summary)
        await replaceSessionIndex(tx.objectStore('messageIndex'), session)
      } catch (error) {
        abortTransaction(tx)
        throw error
      }
    })(),
    tx.done,
  ])
}

/** 未打开的会话也可重命名，只读取该会话，原子更新详情和列表。 */
export const renameSession = async (id: string, title: string): Promise<void> => {
  const tx = (await getDB()).transaction(['sessions', 'sessionSummaries'], 'readwrite')
  await Promise.all([
    (async () => {
      try {
        const sessions = tx.objectStore('sessions')
        const session = await sessions.get(id)
        if (session) {
          session.title = title
          await sessions.put(session)
          await tx.objectStore('sessionSummaries').put(storedSummary(session))
        }
      } catch (error) {
        abortTransaction(tx)
        throw error
      }
    })(),
    tx.done,
  ])
}

/** 未打开的会话也可置顶，只读取该会话，原子更新详情和列表。 */
export const setSessionPinned = async (id: string, pinned: boolean): Promise<void> => {
  const tx = (await getDB()).transaction(['sessions', 'sessionSummaries'], 'readwrite')
  await Promise.all([
    (async () => {
      try {
        const sessions = tx.objectStore('sessions')
        const summaries = tx.objectStore('sessionSummaries')
        const session = await sessions.get(id)
        if (session) {
          session.pinned = pinned
          await sessions.put(session)
          await summaries.put(storedSummary(session))
          return
        }
        const summary = await summaries.get(id)
        if (summary) {
          summary.pinned = pinned
          await summaries.put(summary)
        }
      } catch (error) {
        abortTransaction(tx)
        throw error
      }
    })(),
    tx.done,
  ])
}

/** 删除会话，仅清理已无会话引用的本地原件；远端文件不删。 */
export const deleteSession = async (sessionId: string): Promise<void> => {
  const tx = (await getDB()).transaction(
    ['sessions', 'sessionSummaries', 'files', 'messageIndex'],
    'readwrite'
  )
  await Promise.all([
    (async () => {
      try {
        const summaries = tx.objectStore('sessionSummaries')
        const summary = await summaries.get(sessionId)
        await tx.objectStore('sessions').delete(sessionId)
        await summaries.delete(sessionId)
        await deleteSessionIndex(tx.objectStore('messageIndex'), sessionId)
        for (const id of summary?.fileIds ?? []) {
          if ((await summaries.index('fileIds').count(id)) === 0) {
            await tx.objectStore('files').delete(id)
          }
        }
      } catch (error) {
        abortTransaction(tx)
        throw error
      }
    })(),
    tx.done,
  ])
}

const putFiles = async (store: 'files' | 'filesStaging', files: StoredFile[]) => {
  const tx = (await getDB()).transaction(store, 'readwrite')
  await Promise.all([...files.map((file) => tx.store.put(file)), tx.done])
}

export const saveFiles = (files: StoredFile[]): Promise<void> => putFiles('files', files)

export const loadFile = async (id: string): Promise<Blob | undefined> =>
  (await (await getDB()).get('files', id))?.blob

/** 清空导入暂存：开始导入前清除上次中断（如关闭页面）遗留的数据，导入失败后清除本次写入。 */
export const clearStaging = async (): Promise<void> => {
  const tx = (await getDB()).transaction(['sessionsStaging', 'filesStaging'], 'readwrite')
  await Promise.all([
    tx.objectStore('sessionsStaging').clear(),
    tx.objectStore('filesStaging').clear(),
    tx.done,
  ])
}

export const addStagingSession = async (session: Session): Promise<void> => {
  await (await getDB()).add('sessionsStaging', session)
}

export const saveStagingFiles = (files: StoredFile[]): Promise<void> =>
  putFiles('filesStaging', files)

/** 图片位于会话 JSON 之后；全部读完后回填具体 MIME，保留归档给出的 isImage 标识。 */
export const updateStagingFileTypes = async (types: ReadonlyMap<string, string>): Promise<void> => {
  const tx = (await getDB()).transaction('sessionsStaging', 'readwrite')
  await Promise.all([
    (async () => {
      for (let cursor = await tx.store.openCursor(); cursor; cursor = await cursor.continue()) {
        const session = cursor.value
        let changed = false
        for (const message of session.messages) {
          if (message.role !== 'user') {
            continue
          }
          for (const file of message.files) {
            const type = types.get(file.id) ?? ''
            if (file.mimeType !== type) {
              file.mimeType = type
              changed = true
            }
          }
        }
        if (changed) {
          await cursor.update(session)
        }
      }
    })(),
    tx.done,
  ])
}

/**
 * 导入完成后用暂存替换正式数据：同一事务中替换会话、摘要和原件，并清空暂存。
 * 逐条游标复制，同一时间只读取一条记录；事务失败时整体回滚，正式数据不变。
 */
export const commitStaging = async (): Promise<SessionSummary[]> => {
  const summaries: SessionSummary[] = []
  const tx = (await getDB()).transaction(
    [
      'sessions',
      'sessionSummaries',
      'files',
      'sessionsStaging',
      'filesStaging',
      'messageIndex',
      'meta',
    ],
    'readwrite'
  )
  const move = async (from: 'sessionsStaging' | 'filesStaging', to: 'sessions' | 'files') => {
    try {
      const target = tx.objectStore(to)
      await target.clear()
      if (to === 'sessions') {
        await tx.objectStore('sessionSummaries').clear()
        await tx.objectStore('messageIndex').clear()
      }
      for (
        let cursor = await tx.objectStore(from).openCursor();
        cursor;
        cursor = await cursor.continue()
      ) {
        await target.put(cursor.value)
        if (to === 'sessions') {
          const session = cursor.value as Session
          const summary = storedSummary(session)
          await tx.objectStore('sessionSummaries').put(summary)
          await putSessionIndex(tx.objectStore('messageIndex'), session)
          summaries.push(toSessionSummary(summary))
        }
      }
      if (to === 'sessions') {
        await tx.objectStore('meta').put(INDEX_VERSION, INDEX_META_KEY)
      }
      await tx.objectStore(from).clear()
    } catch (error) {
      // 同步抛出的错误不会让事务自动回滚，需显式中止，避免只提交清空和部分移入。
      abortTransaction(tx)
      throw error
    }
  }
  await Promise.all([move('sessionsStaging', 'sessions'), move('filesStaging', 'files'), tx.done])
  // 直接返回本次提交的列表，调用方无需在替换成功后再发起可能失败的读取。
  return summaries
}

let indexReady: Promise<void> | null = null

export const ensureMessageIndex = (): Promise<void> => {
  if (indexReady) {
    return indexReady
  }
  indexReady = (async () => {
    const database = await getDB()
    const tx = database.transaction(['meta', 'sessions', 'messageIndex'], 'readwrite')
    const version = await tx.objectStore('meta').get(INDEX_META_KEY)
    if (version === INDEX_VERSION) {
      await tx.done
      return
    }
    const index = tx.objectStore('messageIndex')
    await index.clear()
    for (
      let cursor = await tx.objectStore('sessions').openCursor();
      cursor;
      cursor = await cursor.continue()
    ) {
      await putSessionIndex(index, cursor.value)
    }
    await tx.objectStore('meta').put(INDEX_VERSION, INDEX_META_KEY)
    await tx.done
  })().catch((error: unknown) => {
    indexReady = null
    throw error
  })
  return indexReady
}

export const searchLocalMessages = async (
  query: string
): Promise<{ entries: IndexedMessage[]; total: number }> => {
  await ensureMessageIndex()
  const database = await getDB()
  const terms = getQueryTerms(query)
  let candidates: IndexedMessage[]
  if (terms.length === 0) {
    candidates = await database.getAll('messageIndex')
  } else {
    let bestTerm = terms[0]
    let bestCount = await database.countFromIndex('messageIndex', 'terms', bestTerm)
    for (const term of terms.slice(1)) {
      if (bestCount === 0) {
        break
      }
      const count = await database.countFromIndex('messageIndex', 'terms', term)
      if (count < bestCount) {
        bestTerm = term
        bestCount = count
      }
    }
    if (bestCount === 0) {
      return { entries: [], total: 0 }
    }
    candidates = (await database.getAllFromIndex('messageIndex', 'terms', bestTerm)).filter((entry) =>
      terms.every((term) => entry.terms.includes(term))
    )
  }
  const entries = candidates.filter((entry) => matchesIndexedMessage(entry, query))
  entries.sort(
    (a, b) => b.sessionUpdatedAt - a.sessionUpdatedAt || b.createdAt - a.createdAt
  )
  return { entries: entries.slice(0, SEARCH_RESULT_LIMIT), total: entries.length }
}

/** 本地存储失败不打断对话，只在控制台留痕 */
export const reportStorageError = (action: string) => (error: unknown) => {
  // eslint-disable-next-line no-console
  console.error(`[storage] ${action} failed`, error)
}
