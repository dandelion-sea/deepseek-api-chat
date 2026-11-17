# deepseek-api-chat

English | [简体中文](README.zh-CN.md)

A static chat demo powered by the DeepSeek API, forked from [deepseek-ai/chat-demo](https://github.com/deepseek-ai/chat-demo), with an Android app. No application backend is required: the browser connects directly to the configured API service.

Download the APK or the web archive from [Releases](https://github.com/dandelion-sea/deepseek-api-chat/releases). Extract the archive and double-click `index.html` to use it locally without installation or a build. Enter your API key in Settings before your first chat.

## Getting started

Install Node.js 22.12+ and pnpm, then run:

```sh
git clone https://github.com/dandelion-sea/deepseek-api-chat.git
cd deepseek-api-chat
pnpm install
pnpm dev
```

Open http://localhost:8090.

To build the static site:

```sh
pnpm build
```

The output is written to `dist/`. Deploy it to a static web server or open `dist/index.html` directly. Opening the file directly requires browser support for storage on `file://` pages and an API service that permits their cross-origin requests.

## Android

The Android app uses [Capacitor](https://capacitorjs.com/) to load `dist/` in the system WebView, sharing all code with the web version. Building it also requires JDK 21 and the Android SDK (Platform 36); point to the SDK with `ANDROID_HOME` or `android/local.properties`:

```sh
pnpm android:debug     # debug build in android/app/build/outputs/apk/debug/
pnpm android:release   # release build in android/app/build/outputs/apk/release/
```

- The version comes from `package.json`. Release signing reads `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`; without them the APK is unsigned.
- Pushing a `v*` tag runs the [Android workflow](.github/workflows/android.yml), which builds a release APK and publishes it with a zipped web build to GitHub Releases. Manual runs only upload a workflow artifact (kept for 90 days). Store the keystore as Base64 in the `ANDROID_KEYSTORE_BASE64` secret and the other three values in secrets with the same names.
- The app runs at the `https://localhost` origin, so its local data is separate from the browser version. Downloads, exports, and opening attachments go through the system share sheet; external links open in the system browser.
- The application ID is `io.github.dandelionsea.deepseekapichat`. Changing it makes Android treat the app as a different one, so installed copies cannot be upgraded.

## Features

- Multiple conversations with automatic titles, renaming, and deletion; edit prompts, regenerate replies, and switch between message branches.
- Streaming replies, deep thinking, smart search, link reading, and source citations; stop generation or continue eligible replies.
- Upload, paste, or drag and drop attachments; use voice input and read replies aloud. A live audio spectrum appears in the first row of the input area while recording on mobile.
- Markdown, syntax highlighting, KaTeX math, and Mermaid diagrams.
- Simplified Chinese and English, light and dark themes, mobile layouts, location settings, and chat history import and export.

## Data and storage

Your API key and settings are stored in the browser's localStorage. Conversations and original attachments are stored in IndexedDB. Local data is isolated by browser profile and site origin. Sending messages, uploading attachments, and using speech features sends the relevant content to the configured API service.

History import and export in Settings use ZIP archives. After confirmation and successful validation, importing replaces all local conversations and attachments. Exports include conversations and locally available original images, but exclude API keys, settings, and original non-image attachments. See the [history import/export documentation (Chinese)](src/services/chat/history/README.md) for the archive format and preservation details.

Settings → Data → Delete all chats clears all local conversations, original attachments, and unsent drafts after confirmation. It stops ongoing replies and returns to a new chat. Your API key and settings are preserved; files already uploaded to the API service are not deleted.

## Development

| Command              | Description                       |
| -------------------- | --------------------------------- |
| `pnpm dev`           | Start the development server      |
| `pnpm build`         | Build into `dist/`                |
| `pnpm type`          | Run TypeScript type checks        |
| `pnpm lint`          | Lint with oxlint                  |
| `pnpm format`        | Format with oxfmt                 |
| `pnpm android:debug` | Build an Android debug APK        |
| `pnpm android:open`  | Open `android/` in Android Studio |

[rspack.config.ts](rspack.config.ts) uses `https://api.deepseek.com` by default. Use `createConfig({ apiOrigin, devServer })` to customize the API origin and development server proxy.

Chat uses `deepseek-flash` by default through Anthropic-compatible Messages / Files APIs. Speech features use ASR / TTS endpoints. Requests include extensions for search, link reading, titles, and `latest_reminder`, so the configured service must support the corresponding capabilities. Supported attachment formats are determined by server-side validation.

```text
src/
  app/                 Application layout, themes, and global styles
  components/          Chat, settings, Markdown, and other UI components
  i18n/                English and Chinese translations
  services/
    api/               API requests, SSE, and protocol types
    chat/              Conversations, message branches, storage, and history import/export
    markdown/          Markdown parsing, syntax highlighting, and diagrams
    speech/            Audio recording and read-aloud playback
  utils/               Shared utilities
```

## License

[MIT](LICENSE). The build copies the license to `dist/LICENSE`; include it when distributing the app. Third-party dependencies are subject to their own licenses.
