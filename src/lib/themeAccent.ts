import type { GlobalThemeOverrides } from 'naive-ui'

/** @deprecated 保留类型兼容旧 prefs */
export type ThemeAccentId =
  | 'ocean'
  | 'neutral'
  | 'slate'
  | 'sage'
  | 'teal'
  | 'violet'
  | 'rose'
  | 'coral'
  | 'amber'

export const DEFAULT_THEME_ACCENT: ThemeAccentId = 'neutral'

/** iOS/macOS 风格中性配色 */
export function applyThemeAccent(_accentId: ThemeAccentId, mode: 'dark' | 'light'): void {
  const root = document.documentElement
  root.dataset.accent = 'neutral'
  /* CSS 变量已在 theme.css 定义，此处仅同步 Naive 可能读取的动态项 */
  if (mode === 'light') {
    root.style.setProperty('--pd-sider-bg', '#f2f2f7')
    root.style.setProperty('--pd-main-bg', '#ffffff')
    root.style.setProperty('--pd-menu-active-bg', '#e5e5ea')
  } else {
    root.style.setProperty('--pd-sider-bg', '#1c1c1e')
    root.style.setProperty('--pd-main-bg', '#000000')
    root.style.setProperty('--pd-menu-active-bg', '#2c2c2e')
  }
}

export function buildThemeOverrides(
  _accentId: ThemeAccentId,
  mode: 'dark' | 'light'
): GlobalThemeOverrides {
  const fontFamily =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', sans-serif"

  if (mode === 'dark') {
    return {
      common: {
        primaryColor: '#F5F5F7FF',
        primaryColorHover: '#FFFFFFFF',
        primaryColorPressed: '#D1D1D6FF',
        primaryColorSuppl: '#F5F5F7FF',
        borderRadius: '8px',
        fontFamily
      },
      Layout: {
        color: '#000000FF',
        siderColor: '#1C1C1EFF',
        headerBorderColor: 'rgba(255, 255, 255, 0.08)',
        footerBorderColor: 'rgba(255, 255, 255, 0.08)'
      },
      Menu: {
        itemTextColor: '#EBEBF0FF',
        itemTextColorHover: '#F5F5F7FF',
        itemTextColorActive: '#F5F5F7FF',
        itemIconColor: 'rgba(235, 235, 240, 0.55)',
        itemIconColorHover: '#F5F5F7FF',
        itemIconColorActive: '#F5F5F7FF',
        itemColorActive: '#2C2C2EFF',
        itemColorActiveHover: '#3A3A3CFF',
        itemColorHover: 'rgba(255, 255, 255, 0.06)'
      },
      Badge: {
        color: '#48484AFF',
        textColor: '#F5F5F7FF'
      },
      Card: {
        color: '#1C1C1EFF',
        borderColor: 'rgba(255, 255, 255, 0.08)'
      }
    }
  }

  return {
    common: {
      primaryColor: '#1C1C1EFF',
      primaryColorHover: '#000000FF',
      primaryColorPressed: '#3A3A3CFF',
      primaryColorSuppl: '#1C1C1EFF',
      borderRadius: '8px',
      fontFamily
    },
    Layout: {
      color: '#FFFFFFFF',
      siderColor: '#F2F2F7FF',
      headerBorderColor: 'rgba(0, 0, 0, 0.06)',
      footerBorderColor: 'rgba(0, 0, 0, 0.06)'
    },
    Menu: {
      itemTextColor: '#3A3A3CFF',
      itemTextColorHover: '#1C1C1EFF',
      itemTextColorActive: '#1C1C1EFF',
      itemIconColor: 'rgba(60, 60, 67, 0.55)',
      itemIconColorHover: '#1C1C1EFF',
      itemIconColorActive: '#1C1C1EFF',
      itemColorActive: '#E5E5EAFF',
      itemColorActiveHover: '#D1D1D6FF',
      itemColorHover: 'rgba(0, 0, 0, 0.04)'
    },
    Badge: {
      color: '#AEAEB2FF',
      textColor: '#FFFFFFFF'
    },
    Card: {
      color: '#FFFFFFFF',
      borderColor: 'rgba(0, 0, 0, 0.06)'
    }
  }
}

export const darkThemeOverrides = buildThemeOverrides('neutral', 'dark')
export const lightThemeOverrides = buildThemeOverrides('neutral', 'light')
