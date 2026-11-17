import { App } from '@capacitor/app'
import { useEffect, useRef } from 'react'
import { isNative } from '../utils/platform.js'

/** 打开中的浮层，后打开的在末尾 */
const closers: { current: () => void }[] = []

/** 浮层打开期间登记关闭方法，Android 返回键先关闭最上层 */
export const useBackClose = (open: boolean, onClose: () => void) => {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  useEffect(() => {
    if (!open) {
      return
    }
    closers.push(onCloseRef)
    return () => {
      closers.splice(closers.indexOf(onCloseRef), 1)
    }
  }, [open])
}

/** 返回键关闭最上层浮层；没有浮层时退到后台，保留当前状态 */
export const setupBackButton = () => {
  if (!isNative) {
    return
  }
  void App.addListener('backButton', () => {
    const top = closers.at(-1)
    if (top) {
      top.current()
    } else {
      void App.minimizeApp()
    }
  })
}
