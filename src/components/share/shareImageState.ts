import { create } from 'zustand'

export type ShareImageTarget = {
  sessionId: string
  /** 省略时分享整段会话长图，指定时为该条回答的摘录图。 */
  messageId?: string
}

type ShareImageState = { target: ShareImageTarget | null }

export const useShareImage = create<ShareImageState>(() => ({ target: null }))

export const openShareImage = (target: ShareImageTarget) =>
  useShareImage.setState({ target })

export const closeShareImage = () => useShareImage.setState({ target: null })
