import type { CapacitorConfig } from '@capacitor/cli'

/** Android 壳配置：WebView 加载 dist/，页面源为 https://localhost */
const config: CapacitorConfig = {
  appId: 'com.example.chatdemo',
  appName: 'Chat Demo',
  webDir: 'dist',
}

// eslint-disable-next-line import/no-default-export
export default config
