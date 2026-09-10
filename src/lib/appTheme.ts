import type { ThemePreference } from './types'

export function resolveEffectiveTheme(pref: ThemePreference): 'dark' | 'light' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref
}

export function applyDocumentTheme(effective: 'dark' | 'light'): void {
  document.documentElement.dataset.theme = effective
}
