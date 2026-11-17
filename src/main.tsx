import { createRoot } from 'react-dom/client'
import { App } from './app/App.js'
import { setupBackButton } from './app/backButton.js'
import { setupChatFontSize } from './app/fontSize.js'
import { setupTheme } from './app/theme.js'
import { ensureKatex } from './services/markdown/katex.js'
import './app/theme.css'
import './app/global.css'

ensureKatex()
setupTheme()
setupChatFontSize()
setupBackButton()

createRoot(document.getElementById('root') as HTMLElement).render(<App />)
