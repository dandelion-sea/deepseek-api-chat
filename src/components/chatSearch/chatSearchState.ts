import { create } from 'zustand'

export type ChatSearchFocus = { sessionId: string; messageId: string }

type ChatSearchState = {
  open: boolean
  focus: ChatSearchFocus | null
}

export const useChatSearch = create<ChatSearchState>(() => ({ open: false, focus: null }))

export const openChatSearch = () => useChatSearch.setState({ open: true, focus: null })

export const closeChatSearch = () => useChatSearch.setState({ open: false, focus: null })

export const focusChatMessage = (sessionId: string, messageId: string) =>
  useChatSearch.setState({ focus: { sessionId, messageId } })

export const clearChatSearchFocus = () => useChatSearch.setState({ focus: null })
