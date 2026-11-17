import { Capacitor } from '@capacitor/core'

/** 运行在 Android 壳内（Capacitor WebView） */
export const isNative = Capacitor.isNativePlatform()
