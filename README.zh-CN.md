# chat-demo

[English](README.md) | 简体中文

基于 DeepSeek API 的静态聊天示例。无需应用后端，浏览器直接请求配置的 API 服务。

点击 [在线体验](https://deepseek-ai.github.io/chat-demo/) 即可使用，也可以前往 [Releases](https://github.com/deepseek-ai/deepseek-chat-demo/releases) 下载压缩包，解压后双击 `index.html` 在本地使用，无需安装或构建。首次使用时，请在设置中填写 API Key。

## 运行

准备 Node.js 22.12+ 和 pnpm：

```sh
git clone https://github.com/deepseek-ai/chat-demo.git
cd chat-demo
pnpm install
pnpm dev
```

打开 http://localhost:8090 。

生成静态产物：

```sh
pnpm build
```

产物位于 `dist/`，可部署到静态服务器，也可直接打开 `dist/index.html`。直接打开时，浏览器和 API 服务需允许 `file://` 页面的存储与跨域请求。

## Android

Android 版用 [Capacitor](https://capacitorjs.com/) 把 `dist/` 装进系统 WebView，与网页版共用同一套代码。构建另需 JDK 21 和 Android SDK（Platform 36），并通过 `ANDROID_HOME` 或 `android/local.properties` 指定 SDK 位置：

```sh
pnpm android:debug     # 调试包，输出到 android/app/build/outputs/apk/debug/
pnpm android:release   # 发布包，输出到 android/app/build/outputs/apk/release/
```

- 版本号取自 `package.json`。发布包签名读取环境变量 `ANDROID_KEYSTORE_PATH`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`，未设置时产出未签名 APK。
- 推送 `v*` 标签时 [Android 工作流](.github/workflows/android.yml) 会构建发布包，并连同网页版 zip 发布到 GitHub Release；手动触发只上传构建产物（保留 90 天）。签名用的 keystore 以 Base64 存入 Secret `ANDROID_KEYSTORE_BASE64`，其余三项存入同名 Secret。
- App 页面源为 `https://localhost`，本地数据与浏览器版互不相通。下载、导出和打开附件会调起系统分享面板，外部链接在系统浏览器中打开。
- 包名 `com.example.chatdemo` 仅为示例，分发前请在 `capacitor.config.ts` 和 `android/app` 中改为自己的。

## 功能

- 多会话、自动标题、重命名与删除；编辑提问、重新生成和切换消息分支。
- 流式回答、深度思考、智能搜索、链接阅读与来源引用；支持停止和符合条件的继续生成。
- 附件上传、粘贴与拖拽，语音输入和回复朗读；移动端录音时输入框首行显示实时频谱。
- Markdown、代码高亮、KaTeX 公式和 Mermaid 图表。
- 简体中文与英文、浅色与深色主题、移动端布局、位置设置、历史导入导出。

## 数据

API Key 和设置保存在浏览器 localStorage，会话及附件原件保存在 IndexedDB，本地数据按浏览器用户配置和站点源（origin）隔离。发送对话、上传附件和使用语音功能时，相应内容会提交给配置的 API 服务。

设置中的历史导入导出使用 ZIP 格式。导入会在确认并校验成功后替换全部本地会话和附件；导出包含会话与本地可用的图片原件，不包含 API Key、设置或非图片附件原件。格式与保留范围见[历史导入导出](src/services/chat/history/README.md)。

设置 → 数据管理 → 删除所有对话，会在确认后清空全部本地会话、附件原件和未发送的草稿，停止正在生成的回复并回到新对话。API Key 和其他设置保留，已上传到 API 服务的文件不受影响。

## 开发

| 命令                 | 用途                                |
| -------------------- | ----------------------------------- |
| `pnpm dev`           | 启动开发服务器                      |
| `pnpm build`         | 构建到 `dist/`                      |
| `pnpm type`          | TypeScript 类型检查                 |
| `pnpm lint`          | oxlint 检查                         |
| `pnpm format`        | oxfmt 格式化                        |
| `pnpm android:debug` | 构建 Android 调试包                 |
| `pnpm android:open`  | 在 Android Studio 中打开 `android/` |

[rspack.config.ts](rspack.config.ts) 默认连接 `https://api.deepseek.com`。`createConfig({ apiOrigin, devServer })` 支持自定义 API 地址和开发服务器代理。

聊天默认使用 `deepseek-flash`，通过 Anthropic 兼容的 Messages / Files API 通信；语音使用 ASR / TTS 接口。请求使用搜索、链接阅读、标题和 `latest_reminder` 等扩展，接入服务需支持相应能力。附件实际支持的格式以服务端校验为准。

```text
src/
  app/                 应用布局、主题与全局样式
  components/          聊天、设置、Markdown 等界面组件
  i18n/                中英文文案
  services/
    api/               API 请求、SSE 与协议类型
    chat/              会话、消息分支、本地存储与历史导入导出
    markdown/          Markdown 解析、代码高亮与图表
    speech/            录音与朗读
  utils/               通用工具
```

## 许可证

[MIT](LICENSE)。构建会将许可证复制到 `dist/LICENSE`，分发时请一并保留；第三方依赖遵循各自的许可证。
