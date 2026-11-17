import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { getVisibleMessages } from '../../services/chat/branches.js'
import * as db from '../../services/chat/db.js'
import type { Message, Session } from '../../services/chat/types.js'
import { buildReplyView, type Source } from '../../services/chat/view.js'
import { useChatStore } from '../../services/chat/store.js'
import { downloadBlob, canShareFile, shareBlob } from '../../utils/exportFile.js'
import { exportNodeAsPng } from '../../utils/exportImage.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { Markdown } from '../markdown/Markdown.js'
import { closeShareImage, useShareImage, type ShareImageTarget } from './shareImageState.js'
import styles from './ShareImageDialog.module.css'

type ShareMessage =
  | { role: 'user'; content: string; files: string[] }
  | { role: 'assistant'; markdown: string; sources: Source[] }

const toShareMessages = (messages: Message[]): ShareMessage[] =>
  messages.flatMap<ShareMessage>((message) => {
    if (message.role === 'user') {
      const content = message.content.trim()
      if (!content && message.files.length === 0) {
        return []
      }
      return [{ role: 'user' as const, content, files: message.files.map((file) => file.name) }]
    }
    const view = buildReplyView(message, false)
    if (!view.answer?.markdown.trim()) {
      return []
    }
    return [{ role: 'assistant' as const, markdown: view.answer.markdown, sources: view.sources }]
  })

export const ShareImageDialog = () => {
  const target = useShareImage((state) => state.target)
  if (!target) {
    return null
  }
  return <ShareImageDialogContent key={`${target.sessionId}:${target.messageId ?? ''}`} target={target} />
}

const ShareImageDialogContent = ({ target }: { target: ShareImageTarget }) => {
  const t = useTranslate()
  const cached = useChatStore((state) =>
    Object.hasOwn(state.sessionCache, target.sessionId)
      ? state.sessionCache[target.sessionId]
      : undefined
  )
  const [loaded, setLoaded] = useState<Session | null>(null)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const shareSupported = useMemo(() => canShareFile(), [])
  const session = cached ?? loaded

  useEffect(() => {
    if (cached) {
      return
    }
    let cancelled = false
    void db.loadSession(target.sessionId).then(
      (stored) => {
        if (!cancelled) {
          if (stored) {
            setLoaded(stored)
          } else {
            setFailed(true)
          }
        }
      },
      () => {
        if (!cancelled) {
          setFailed(true)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [cached, target.sessionId])

  const messages = useMemo(() => {
    if (!session) {
      return []
    }
    const path = getVisibleMessages(session)
    if (!target.messageId) {
      return toShareMessages(path)
    }
    const index = path.findIndex((message) => message.id === target.messageId)
    if (index < 0 || path[index]?.role !== 'assistant') {
      return []
    }
    const question = path[index - 1]
    return toShareMessages([
      ...(question?.role === 'user' ? [question] : []),
      path[index],
    ])
  }, [session, target.messageId])

  const createBlob = async () => {
    if (!cardRef.current) {
      throw new Error('Share card is not ready')
    }
    return exportNodeAsPng(cardRef.current)
  }

  const downloadImage = async () => {
    if (busy || messages.length === 0) {
      return
    }
    setBusy(true)
    try {
      const blob = await createBlob()
      downloadBlob(blob, `deepseek-share-${Date.now()}.png`)
    } catch {
      showToast({ key: 'imageExportFailed', type: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const shareImage = async () => {
    if (busy || messages.length === 0) {
      return
    }
    setBusy(true)
    try {
      const blob = await createBlob()
      await shareBlob(blob, `deepseek-share-${Date.now()}.png`)
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        showToast({ key: 'imageExportFailed', type: 'error' })
      }
    } finally {
      setBusy(false)
    }
  }

  const unavailable = failed || (session !== null && messages.length === 0)
  return (
    <Modal
      title={target.messageId ? t('shareImageTitle') : t('shareLongImage')}
      closable
      className={styles.dialog}
      mainClassName={styles.main}
      onClose={closeShareImage}
      footer={
        <div className={styles.actions}>
          <Button variant="outlined" size="m" disabled={busy} onClick={closeShareImage}>
            {t('close')}
          </Button>
          {shareSupported ? (
            <Button
              variant="outlined"
              size="m"
              disabled={busy || unavailable}
              onClick={() => void shareImage()}
            >
              {t('shareImageShare')}
            </Button>
          ) : null}
          <Button size="m" disabled={busy || unavailable} onClick={() => void downloadImage()}>
            {busy ? t('shareImageGenerating') : t('shareImageDownload')}
          </Button>
        </div>
      }
    >
      <div className={styles.preview}>
        {unavailable ? (
          <div className={styles.empty}>{t('shareImageEmpty')}</div>
        ) : !session ? (
          <div className={styles.empty}>{t('sessionLoading')}</div>
        ) : (
          <div ref={cardRef} className={styles.card} data-share-image-card>
            <div className={styles.header}>
              <span className={styles.brand}>DeepSeek</span>
              <span className={styles.title}>{session.title || t('untitledChat')}</span>
            </div>
            <div className={styles.messages}>
              {messages.map((message, index) =>
                message.role === 'user' ? (
                  <div key={index} className={styles.userRow}>
                    <div className={styles.userBubble}>
                      {message.content ? (
                        <div className={styles.userText}>{message.content}</div>
                      ) : null}
                      {message.files.length > 0 ? (
                        <div className={styles.files}>
                          {message.files.map((name, fileIndex) => (
                            <span key={fileIndex} className={styles.file}>
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div key={index} className={styles.assistantRow}>
                    <Markdown
                      content={message.markdown}
                      loading={false}
                      cacheKey={`share-${index}`}
                      disableLink={false}
                      sources={message.sources}
                    />
                  </div>
                )
              )}
            </div>
            <div className={styles.footer}>
              <span>{t('contentCaveat')}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
