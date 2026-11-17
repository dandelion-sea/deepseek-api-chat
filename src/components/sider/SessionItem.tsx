import clsx from 'clsx'
import { memo, useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import {
  IconCheckOutline16,
  IconEditOutline16,
  IconEllipsisOutline16,
  IconImageOutline16,
  IconPinOutline16,
  IconTrashOutline16,
} from '../base/icons.js'
import { renameSession, selectSession, setSessionPinned } from '../../services/chat/store.js'
import type { SessionSummary } from '../../services/chat/types.js'
import { IconButton } from '../base/IconButton.js'
import { Menu } from '../base/Menu.js'
import { openShareImage } from '../share/shareImageState.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './SessionItem.module.css'

export const SessionItem = memo(function SessionItem({
  session,
  active,
  onDelete,
  selectionMode = false,
  selected = false,
  onToggleSelected,
}: {
  session: SessionSummary
  active: boolean
  onDelete: () => void
  selectionMode?: boolean
  selected?: boolean
  onToggleSelected?: () => void
}) {
  const t = useTranslate()
  const [editing, setEditing] = useState(false)
  const displayTitle = session.title || t('untitledChat')

  if (editing) {
    const finish = (title: string) => {
      setEditing(false)
      if (title.trim() && title.trim() !== displayTitle) {
        renameSession(session.id, title.trim())
      }
    }
    return (
      <input
        className={styles.renameInput}
        defaultValue={displayTitle}
        autoFocus
        onFocus={(event) => event.target.select()}
        onBlur={(event) => finish(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            finish(event.currentTarget.value)
          } else if (event.key === 'Escape') {
            setEditing(false)
          }
        }}
      />
    )
  }

  const activate = () => {
    if (selectionMode) {
      onToggleSelected?.()
      return
    }
    selectSession(session.id)
    closeMobileSider()
  }

  return (
    <div
      className={clsx(
        styles.item,
        active && styles.active,
        selected && styles.selected,
        selectionMode && styles.selectable
      )}
      role={selectionMode ? 'checkbox' : undefined}
      aria-checked={selectionMode ? selected : undefined}
      tabIndex={selectionMode ? 0 : undefined}
      onClick={activate}
      onKeyDown={
        selectionMode
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onToggleSelected?.()
              }
            }
          : undefined
      }
    >
      {selectionMode ? (
        <span className={clsx(styles.checkbox, selected && styles.checkboxChecked)}>
          {selected ? <IconCheckOutline16 /> : null}
        </span>
      ) : null}
      <div className={styles.title}>
        {session.pinned ? (
          <span className={styles.pin} aria-hidden="true">
            <IconPinOutline16 />
          </span>
        ) : null}
        <span className={styles.titleText}>{displayTitle}</span>
      </div>
      {selectionMode ? null : (
        <div className={styles.action} onClick={(event) => event.stopPropagation()}>
          <Menu
            options={[
              {
                key: 'pin',
                label: t(session.pinned ? 'sessionUnpinAction' : 'sessionPinAction'),
                icon: <IconPinOutline16 />,
                onSelect: () => setSessionPinned(session.id, !session.pinned),
              },
              {
                key: 'rename',
                label: t('sessionItemMenuRenameOption'),
                icon: <IconEditOutline16 />,
                onSelect: () => setEditing(true),
              },
              {
                key: 'share',
                label: t('shareLongImage'),
                icon: <IconImageOutline16 />,
                onSelect: () => openShareImage({ sessionId: session.id }),
              },
              {
                key: 'delete',
                label: t('delete'),
                icon: <IconTrashOutline16 />,
                danger: true,
                onSelect: onDelete,
              },
            ]}
          >
            {({ toggle }) => (
              <IconButton icon={<IconEllipsisOutline16 />} aria-label={t('more')} onClick={toggle} />
            )}
          </Menu>
        </div>
      )}
    </div>
  )
})
