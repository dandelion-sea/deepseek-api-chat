import { getVisibleMessages } from './branches.js'
import type { Message, Session } from './types.js'

export type IndexedMessage = {
  id: string
  sessionId: string
  messageId: string
  role: 'user' | 'assistant'
  text: string
  searchText: string
  terms: string[]
  createdAt: number
  sessionUpdatedAt: number
}

const CJK_CHAR = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/
const CJK_SEGMENT = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+|[^\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g
const WORD_RUN = /[\p{L}\p{N}]+/gu

export const normalizeSearchText = (text: string): string =>
  text.normalize('NFC').toLowerCase()

const addTerms = (terms: Set<string>, text: string, query: boolean) => {
  for (const match of normalizeSearchText(text).matchAll(WORD_RUN)) {
    const token = match[0]
    for (const segment of token.match(CJK_SEGMENT) ?? []) {
      const chars = [...segment]
      if (CJK_CHAR.test(chars[0] ?? '')) {
        if (chars.length === 1) {
          terms.add(chars[0])
          continue
        }
        for (let index = 0; index + 1 < chars.length; index++) {
          terms.add(chars[index] + chars[index + 1])
        }
        if (!query) {
          for (const char of chars) {
            terms.add(char)
          }
        }
      } else if (segment.length >= 2) {
        terms.add(segment)
      }
    }
  }
}

export const getIndexTerms = (text: string): string[] => {
  const terms = new Set<string>()
  addTerms(terms, text, false)
  return [...terms]
}

export const getQueryTerms = (query: string): string[] => {
  const terms = new Set<string>()
  addTerms(terms, query, true)
  return [...terms]
}

export const getQueryWords = (query: string): string[] =>
  normalizeSearchText(query).match(WORD_RUN) ?? []

export const matchesSearchText = (text: string, query: string): boolean => {
  const words = getQueryWords(query)
  if (words.length === 0) {
    return false
  }
  const searchText = normalizeSearchText(text)
  return words.every((word) => searchText.includes(word))
}

export const matchesIndexedMessage = (entry: IndexedMessage, query: string): boolean =>
  matchesSearchText(entry.searchText, query)

const getMessageText = (message: Message): string => {
  if (message.role === 'user') {
    return message.content
  }
  return message.blocks
    .flatMap((block) =>
      block.type === 'text' && !block.isTemplate ? [block.text] : []
    )
    .join('\n')
}

export const buildIndexEntries = (session: Session): IndexedMessage[] => {
  const entries: IndexedMessage[] = []
  for (const message of getVisibleMessages(session)) {
    const text = getMessageText(message).trim()
    if (!text) {
      continue
    }
    entries.push({
      id: `${session.id}:${message.id}`,
      sessionId: session.id,
      messageId: message.id,
      role: message.role,
      text,
      searchText: normalizeSearchText(text),
      terms: getIndexTerms(text),
      createdAt: message.createdAt,
      sessionUpdatedAt: session.updatedAt,
    })
  }
  return entries
}

export const createSnippet = (text: string, query: string, radius = 48): string => {
  const normalized = normalizeSearchText(text)
  const needle = getQueryWords(query).sort((a, b) => b.length - a.length)[0] ?? ''
  const index = needle ? normalized.indexOf(needle) : 0
  const at = index < 0 ? 0 : index
  const start = Math.max(0, at - radius)
  const end = Math.min(text.length, at + needle.length + radius)
  const snippet = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${snippet}${end < text.length ? '…' : ''}`
}
