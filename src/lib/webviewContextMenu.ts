import { LogicalPosition } from '@tauri-apps/api/dpi'
import { Menu, MenuItem } from '@tauri-apps/api/menu'
import { getCurrentWindow } from '@tauri-apps/api/window'

let menuReady: Promise<Menu> | null = null

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function getContextMenu(): Promise<Menu> {
  if (!menuReady) {
    menuReady = (async () => {
      return Menu.new({
        items: [
          await MenuItem.new({
            id: 'pd-reload',
            text: '重新加载',
            action: () => {
              window.location.reload()
            }
          })
        ]
      })
    })()
  }
  return menuReady
}

function shouldSkipNativeOverride(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  if (target.closest('[data-native-contextmenu]')) return true
  if (target.closest('input, textarea, select, [contenteditable="true"]')) return true
  return false
}

/**
 * 替换 WebView 默认英文右键菜单为中文「重新加载」。
 * 组件内已 @contextmenu.prevent 的区域（任务、计划等）不受影响。
 */
export function installWebviewContextMenu() {
  if (!isTauri()) return

  document.addEventListener(
    'contextmenu',
    (e) => {
      if (e.defaultPrevented || shouldSkipNativeOverride(e.target)) return

      e.preventDefault()
      void (async () => {
        const menu = await getContextMenu()
        const win = getCurrentWindow()
        await menu.popup(new LogicalPosition(e.clientX, e.clientY), win)
      })()
    },
    false
  )
}
