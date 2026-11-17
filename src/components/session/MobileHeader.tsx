import { IconMenuOutline20, IconNewChatOutline20 } from '../base/icons.js'
import { useTranslate } from '../../i18n/index.js'
import { newChat, useChatStore } from '../../services/chat/store.js'
import { IconButton } from '../base/IconButton.js'
import { showToast } from '../base/toastState.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import styles from './MobileHeader.module.css'

/** 已在新对话时只提示，与官方 App 一致 */
const startNewChat = () => {
  if (useChatStore.getState().activeId === null) {
    showToast({ key: 'alreadyInNewChat' })
  } else {
    newChat()
  }
}

/** 移动端顶栏：左侧菜单打开侧边栏，会话页显示标题，右侧始终显示开启新对话；搜索入口在侧边栏顶部 */
export const MobileHeader = ({ title }: { title?: string }) => {
  const t = useTranslate()
  return (
    <div className={styles.header}>
      <IconButton
        size="xl"
        tone="primary"
        icon={<IconMenuOutline20 />}
        aria-label={t('expandSiderbarButton')}
        onClick={openMobileSider}
      />
      <div className={styles.title}>{title ?? ''}</div>
      <div className={styles.actions}>
        <IconButton
          size="xl"
          tone="primary"
          icon={<IconNewChatOutline20 />}
          aria-label={t('newChat')}
          onClick={startNewChat}
        />
      </div>
    </div>
  )
}
