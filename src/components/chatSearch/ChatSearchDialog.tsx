import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { searchLocalMessages } from '../../services/chat/db.js'
import {
  createSnippet,
  getQueryWords,
  matchesSearchText,
  type IndexedMessage,
} from '../../services/chat/searchIndex.js'
import { selectSession, useChatStore } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconCloseOutline16, IconSearchOutline16 } from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import {
  closeChatSearch,
  focusChatMessage,
  useChatSearch,
} from './chatSearchState.js'
import styles from './ChatSearchDialog.module.css'

type Status = 'idle' | 'loading' | 'error'

export const ChatSearchDialog = () => {
  const open = useChatSearch((state) => state.open)
  return open ? <SearchDialog /> : null
}

const SearchDialog = () => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [messages, setMessages] = useState<IndexedMessage[]>([])
  const [total, setTotal] = useState(0)
  const requestRef = useRef(0)
  const trimmed = query.trim()

  const titleMatches = useMemo(
    () =>
      trimmed
        ? sessions
            .filter((session) => session.title && matchesSearchText(session.title, trimmed))
            .slice(0, 20)
        : [],
    [sessions, trimmed]
  )

  useEffect(() => {
    const request = ++requestRef.current
    if (!trimmed) {
      setStatus('idle')
      setMessages([])
      setTotal(0)
      return
    }
    setStatus('loading')
    setMessages([])
    setTotal(0)
    const timer = window.setTimeout(() => {
      void searchLocalMessages(trimmed).then(
        (result) => {
          if (requestRef.current !== request) {
            return
          }
          setMessages(result.entries)
          setTotal(result.total)
          setStatus('idle')
        },
        () => {
          if (requestRef.current !== request) {
            return
          }
          setStatus('error')
        }
      )
    }, 150)
    return () => {
      window.clearTimeout(timer)
      requestRef.current += 1
    }
  }, [trimmed])

  const sessionMap = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [
    sessions,
  ])

  const openMessage = (entry: IndexedMessage) => {
    closeChatSearch()
    selectSession(entry.sessionId)
    focusChatMessage(entry.sessionId, entry.messageId)
  }

  const openSession = (session: SessionSummary) => {
    closeChatSearch()
    selectSession(session.id)
  }

  const firstResult = messages[0]
  const firstTitle = titleMatches[0]
  const count = titleMatches.length + total

  return (
    <Modal
      title={t('chatSearchTitle')}
      closable
      className={styles.dialog}
      mainClassName={styles.main}
      onClose={closeChatSearch}
    >
      <div className={styles.field}>
        <IconSearchOutline16 />
        <input
          className={styles.input}
          aria-label={t('chatSearchTitle')}
          autoFocus
          value={query}
          placeholder={t('chatSearchPlaceholder')}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              if (firstResult) {
                event.preventDefault()
                openMessage(firstResult)
              } else if (firstTitle) {
                event.preventDefault()
                openSession(firstTitle)
              }
            }
          }}
        />
        {query ? (
          <button
            type="button"
            className={styles.clear}
            aria-label={t('chatSearchClear')}
            onClick={() => setQuery('')}
          >
            <IconCloseOutline16 />
          </button>
        ) : null}
      </div>
      {trimmed ? (
        <div className={styles.meta} role="status">
          {status === 'loading'
            ? t('chatSearching')
            : status === 'idle'
              ? t('chatSearchResultCount', { count })
              : null}
        </div>
      ) : null}
      <div className={styles.results}>
        {!trimmed ? (
          <div className={styles.empty}>{t('chatSearchHint')}</div>
        ) : status === 'error' ? (
          <div className={styles.empty}>{t('chatSearchFailed')}</div>
        ) : status === 'idle' && count === 0 ? (
          <div className={styles.empty}>{t('chatSearchNoResults')}</div>
        ) : (
          <>
            {titleMatches.length > 0 ? (
              <>
                <div className={styles.sectionTitle}>{t('chatSearchSessions')}</div>
                {titleMatches.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={styles.result}
                    onClick={() => openSession(session)}
                  >
                    <div className={styles.resultTitle}>{session.title}</div>
                  </button>
                ))}
              </>
            ) : null}
            {messages.length > 0 ? (
              <>
                <div className={styles.sectionTitle}>{t('chatSearchMessages')}</div>
                {messages.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    className={styles.result}
                    onClick={() => openMessage(entry)}
                  >
                    <div className={styles.resultTop}>
                      <span className={styles.resultTitle}>
                        {sessionMap.get(entry.sessionId)?.title || t('untitledChat')}
                      </span>
                      <span className={styles.role}>
                        {t(entry.role === 'user' ? 'chatSearchUser' : 'chatSearchAssistant')}
                      </span>
                    </div>
                    <div className={styles.snippet}>
                      {highlightText(createSnippet(entry.text, trimmed), trimmed)}
                    </div>
                  </button>
                ))}
              </>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  )
}

const highlightText = (text: string, query: string) => {
  const needle = getQueryWords(query).sort((a, b) => b.length - a.length)[0]
  if (!needle) {
    return text
  }
  const index = text.toLowerCase().indexOf(needle)
  if (index < 0) {
    return text
  }
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  )
}
