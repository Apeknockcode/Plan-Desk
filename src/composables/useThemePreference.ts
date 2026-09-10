import { computed, onMounted, onUnmounted, ref } from 'vue'
import { applyDocumentTheme, resolveEffectiveTheme } from '@/lib/appTheme'
import {
  applyThemeAccent,
  DEFAULT_THEME_ACCENT,
  type ThemeAccentId
} from '@/lib/themeAccent'
import type { ThemePreference } from '@/lib/types'

export const themePreference = ref<ThemePreference>('dark')
export const themeAccent = ref<ThemeAccentId>(DEFAULT_THEME_ACCENT)

export const effectiveTheme = computed(() => resolveEffectiveTheme(themePreference.value))

export function applyThemeState(): void {
  const effective = resolveEffectiveTheme(themePreference.value)
  applyDocumentTheme(effective)
  applyThemeAccent(themeAccent.value, effective)
}

export function setThemePreference(pref: ThemePreference): void {
  themePreference.value = pref
  applyThemeState()
}

/** @deprecated 强调色已固定为中性灰，保留 API 兼容 */
export function setThemeAccent(_accent: ThemeAccentId): void {
  themeAccent.value = DEFAULT_THEME_ACCENT
  applyThemeState()
}

export function initThemeFromPrefs(prefs: {
  theme?: ThemePreference
  themeAccent?: ThemeAccentId
}): void {
  themePreference.value = prefs.theme ?? 'system'
  themeAccent.value = DEFAULT_THEME_ACCENT
  applyThemeState()
}

let systemListener: ((event: MediaQueryListEvent) => void) | null = null

function bindSystemThemeListener(): void {
  if (systemListener) return
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  systemListener = () => {
    if (themePreference.value === 'system') {
      applyThemeState()
    }
  }
  mql.addEventListener('change', systemListener)
}

function unbindSystemThemeListener(): void {
  if (!systemListener) return
  window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', systemListener)
  systemListener = null
}

export function useThemePreference() {
  onMounted(bindSystemThemeListener)
  onUnmounted(unbindSystemThemeListener)
  return {
    themePreference,
    themeAccent,
    effectiveTheme,
    setThemePreference,
    setThemeAccent,
    initThemeFromPrefs,
    applyThemeState
  }
}
