import clsx from 'clsx'
import { useEffect, useMemo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconPanelLeftOutline16,
  IconSearchOutline16,
  IconSelectOutline16,
  IconSettingsOutline16,
  NewChatIcon,
} from '../base/icons.js'
import { setSiderCollapsed } from '../../services/settings.js'
import { groupSessions } from '../../services/chat/sessionGroups.js'
import {
  newChat,
  removeSession,
  setSessionsPinned,
  useChatStore,
} from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { Button } from '../base/Button.js'
import { IconButton } from '../base/IconButton.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openChatSearch } from '../chatSearch/chatSearchState.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { closeMobileSider, useMobileSider } from './mobileSiderState.js'
import { SessionItem } from './SessionItem.js'
import styles from './Sider.module.css'

/** 展开的侧边栏：名称与收起按钮、开启新对话、按时间分组的会话列表、底部设置；移动端放在抽屉里，收起按钮关闭抽屉 */
export const Sider = ({ mobile = false }: { mobile?: boolean }) => {
  const t = useTranslate()
  const sessions = useChatStore((state) => state.sessions)
  const activeId = useChatStore((state) => state.activeId)
  const [now, setNow] = useState(Date.now)
  const groups = useMemo(() => groupSessions(sessions, now, t), [sessions, now, t])
  const [deleting, setDeleting] = useState<SessionSummary | null>(null)
  const [deletePending, setDeletePending] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const [batchDeleting, setBatchDeleting] = useState(false)
  const selectedIds = [...selected].filter((id) => sessions.some((session) => session.id === id))
  const selectedCount = selectedIds.length
  const allSelected = sessions.length > 0 && sessions.every((session) => selected.has(session.id))

  const exitSelection = () => {
    setSelecting(false)
    setSelected(new Set())
    setBatchDeleteOpen(false)
  }

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(sessions.map((session) => session.id)))
  }

  const pinSelected = (pinned: boolean) => {
    if (selectedCount === 0) {
      return
    }
    setSessionsPinned(selectedIds, pinned)
    showToast({
      key: pinned ? 'sessionsPinned' : 'sessionsUnpinned',
      params: { count: selectedCount },
    })
    exitSelection()
  }

  const confirmBatchDelete = async () => {
    if (batchDeleting || selectedCount === 0) {
      return
    }
    const ids = selectedIds
    setBatchDeleting(true)
    try {
      const results = await Promise.all(ids.map((id) => removeSession(id)))
      const failed = ids.filter((_, index) => !results[index])
      if (failed.length === 0) {
        showToast({ key: 'sessionsDeleted', params: { count: ids.length } })
        exitSelection()
      } else {
        setSelected(new Set(failed))
        setBatchDeleteOpen(false)
        showToast({ key: 'sessionDeleteFailed', type: 'error' })
      }
    } finally {
      setBatchDeleting(false)
    }
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      const time = Date.now()
      setNow(time)
      const midnight = new Date(time).setHours(24, 0, 0, 0)
      timer = setTimeout(refresh, midnight - time)
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }
    refresh()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return (
    <div className={clsx(styles.sider, mobile && styles.mobile)}>
      <div className={styles.top}>
        <div className={styles.appName}>{t('appName')}</div>
        <div className={styles.topActions}>
          <IconButton
            size="m"
            icon={<IconSearchOutline16 />}
            tooltip={t('chatSearchTitle')}
            tooltipPlacement="bottom"
            onClick={openChatSearch}
          />
          <IconButton
            size="m"
            icon={<IconPanelLeftOutline16 />}
            tooltip={t('collapseSiderbarButton')}
            tooltipPlacement="bottom"
            onClick={() => (mobile ? closeMobileSider() : setSiderCollapsed(true))}
          />
        </div>
      </div>
      {selecting ? (
        <div className={styles.selectionBar}>
          <span className={styles.selectionCount}>
            {t('selectedSessions', { count: selectedCount })}
          </span>
          <span className={styles.selectionButtons}>
            <button type="button" className={styles.selectAll} onClick={toggleSelectAll}>
              {t(allSelected ? 'deselectAllSessions' : 'selectAllSessions')}
            </button>
            <button type="button" className={styles.selectAll} onClick={exitSelection}>
              {t('cancelSelection')}
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          className={styles.newChat}
          onClick={() => {
            newChat()
            closeMobileSider()
          }}
        >
          <span className={styles.newChatIcon}>
            <NewChatIcon />
          </span>
          {t('newChat')}
        </button>
      )}
      <div className={styles.listWrap}>
        <div className={styles.list}>
          {groups.map((group) => (
            <div key={group.key} className={styles.section}>
              <div className={styles.sectionHeader}>{group.label}</div>
              {group.sessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeId}
                  selectionMode={selecting}
                  selected={selected.has(session.id)}
                  onToggleSelected={() => toggleSelected(session.id)}
                  onDelete={() => setDeleting(session)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.bottom}>
        {selecting ? (
          <div className={styles.batchBar}>
            <button
              type="button"
              className={styles.batchAction}
              disabled={selectedCount === 0}
              onClick={() => pinSelected(true)}
            >
              {t('sessionPinAction')}
            </button>
            <button
              type="button"
              className={styles.batchAction}
              disabled={selectedCount === 0}
              onClick={() => pinSelected(false)}
            >
              {t('sessionUnpinAction')}
            </button>
            <button
              type="button"
              className={clsx(styles.batchAction, styles.batchDanger)}
              disabled={selectedCount === 0}
              onClick={() => setBatchDeleteOpen(true)}
            >
              {t('delete')}
            </button>
          </div>
        ) : (
          <div className={styles.bottomRow}>
            <button
              type="button"
              className={styles.settings}
              onClick={() => openSettings('general')}
            >
              <span className={styles.settingsIcon}>
                <IconSettingsOutline16 />
              </span>
              <span className={styles.settingsLabel}>{t('settings')}</span>
            </button>
            <IconButton
              size="m"
              icon={<IconSelectOutline16 />}
              tooltip={t('selectChats')}
              tooltipPlacement="top"
              onClick={() => setSelecting(true)}
            />
          </div>
        )}
      </div>
      {deleting ? (
        <Modal
          title={t('deleteSessionModalContentTitle')}
          onClose={() => {
            if (!deletePending) {
              setDeleting(null)
            }
          }}
          footer={
            <>
              <Button variant="outlined" disabled={deletePending} onClick={() => setDeleting(null)}>
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={deletePending}
                onClick={async () => {
                  setDeletePending(true)
                  try {
                    if (await removeSession(deleting.id)) {
                      setDeleting(null)
                    } else {
                      showToast({ key: 'sessionDeleteFailed', type: 'error' })
                    }
                  } finally {
                    setDeletePending(false)
                  }
                }}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionWithFilesDescription')}
        </Modal>
      ) : null}
      {batchDeleteOpen ? (
        <Modal
          title={t('deleteSessionsModalTitle')}
          onClose={() => {
            if (!batchDeleting) {
              setBatchDeleteOpen(false)
            }
          }}
          footer={
            <>
              <Button
                variant="outlined"
                disabled={batchDeleting}
                onClick={() => setBatchDeleteOpen(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="danger"
                disabled={batchDeleting || selectedCount === 0}
                onClick={() => void confirmBatchDelete()}
              >
                {t('delete')}
              </Button>
            </>
          }
        >
          {t('deleteSessionsModalDescription', { count: selectedCount })}
        </Modal>
      ) : null}
    </div>
  )
}

/** 移动端抽屉：浮在页面上方，点空白区域关闭。 */
export const MobileSider = () => {
  const open = useMobileSider((state) => state.open)
  if (!open) {
    return null
  }
  return (
    <>
      <div className={styles.drawerMask} onClick={closeMobileSider} />
      <div className={styles.drawer}>
        <Sider mobile />
      </div>
    </>
  )
}
