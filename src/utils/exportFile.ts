import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { isNative } from './platform.js'

// Android WebView 不支持 a[download]、新窗口打开 blob 和 Web Share 文件，原生端统一走系统分享面板

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

/** 写入应用缓存目录后调起系统分享面板，由用户选择保存位置或打开方式 */
const shareNative = async (blob: Blob, filename: string) => {
  const { uri } = await Filesystem.writeFile({
    path: filename,
    data: await toBase64(blob),
    directory: Directory.Cache,
  })
  try {
    await Share.share({ files: [uri] })
  } catch (error) {
    // 用户关闭分享面板不算失败
    if (!(error instanceof Error && error.message === 'Share canceled')) {
      throw error
    }
  }
}

export const downloadBlob = async (blob: Blob, filename: string) => {
  if (isNative) {
    return shareNative(blob, filename)
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export const downloadText = (text: string, filename: string, type: string) =>
  downloadBlob(new Blob([text], { type }), filename)

/** 打开本地 blob 地址：浏览器开新标签，Android 壳内交给系统分享面板 */
export const openObjectUrl = async (url: string, filename: string) => {
  if (!isNative) {
    window.open(url, '_blank', 'noreferrer')
    return
  }
  const response = await fetch(url)
  await shareNative(await response.blob(), filename)
}

export const canShareFile = (type = 'image/png') => {
  if (isNative) {
    return true
  }
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.canShare !== 'function' ||
    typeof navigator.share !== 'function'
  ) {
    return false
  }
  try {
    return navigator.canShare({ files: [new File([], 'share', { type })] })
  } catch {
    return false
  }
}

export const shareBlob = async (blob: Blob, filename: string) => {
  if (isNative) {
    return shareNative(blob, filename)
  }
  const file = new File([blob], filename, { type: blob.type })
  await navigator.share({ files: [file] })
}
