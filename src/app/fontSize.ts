import { useSettings, type FontSizePreference } from '../services/settings.js'

export const FONT_SIZE_SCALES: Record<FontSizePreference, number> = {
  small: 0.875,
  standard: 1,
  large: 1.125,
  xlarge: 1.25,
}

const applyFontSize = () => {
  const scale = FONT_SIZE_SCALES[useSettings.getState().fontSize]
  document.body.style.setProperty('--ds-chat-font-scale', String(scale))
}

export const setupChatFontSize = () => {
  applyFontSize()
  useSettings.subscribe(applyFontSize)
}
