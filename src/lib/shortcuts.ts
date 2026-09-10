export type ShortcutActionId =
  | 'global.quickAdd'
  | 'global.newWidget'
  | 'app.search'
  | 'app.focusQuickAdd'
  | 'app.closeModal'
  | 'app.moveUp'
  | 'app.moveDown'
  | 'app.toggleItem'
  | 'app.deleteItem'

export interface ShortcutDefinition {
  id: ShortcutActionId
  label: string
  scope: 'global' | 'app'
}

export const SHORTCUT_DEFINITIONS: ShortcutDefinition[] = [
  { id: 'global.quickAdd', label: '全局快速添加', scope: 'global' },
  { id: 'global.newWidget', label: '新建桌面组件', scope: 'global' },
  { id: 'app.search', label: '搜索事项', scope: 'app' },
  { id: 'app.focusQuickAdd', label: '聚焦快速输入', scope: 'app' },
  { id: 'app.closeModal', label: '关闭弹窗', scope: 'app' },
  { id: 'app.moveUp', label: '选择上一条', scope: 'app' },
  { id: 'app.moveDown', label: '选择下一条', scope: 'app' },
  { id: 'app.toggleItem', label: '切换完成状态', scope: 'app' },
  { id: 'app.deleteItem', label: '删除选中事项', scope: 'app' }
]

export function getDefaultShortcuts(isMac: boolean): Record<ShortcutActionId, string> {
  return {
    'global.quickAdd': isMac ? 'Alt+Space' : 'Alt+Shift+Space',
    'global.newWidget': 'CommandOrControl+Shift+W',
    'app.search': 'CommandOrControl+K',
    'app.focusQuickAdd': 'CommandOrControl+N',
    'app.closeModal': 'Escape',
    'app.moveUp': 'ArrowUp',
    'app.moveDown': 'ArrowDown',
    'app.toggleItem': 'Enter',
    'app.deleteItem': isMac ? 'Backspace' : 'Delete'
  }
}

export function resolveShortcuts(
  overrides: Partial<Record<ShortcutActionId, string>> | undefined,
  isMac: boolean
): Record<ShortcutActionId, string> {
  const defaults = getDefaultShortcuts(isMac)
  const resolved = { ...defaults }
  if (!overrides) return resolved
  for (const def of SHORTCUT_DEFINITIONS) {
    const custom = overrides[def.id]
    if (custom?.trim()) {
      resolved[def.id] = normalizeAccelerator(custom.trim())
    }
  }
  return resolved
}

export function normalizeAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .join('+')
}

const DISPLAY_KEY_MAP: Record<string, string> = {
  CommandOrControl: 'Mod',
  Command: '⌘',
  Control: 'Ctrl',
  Alt: 'Alt',
  Option: '⌥',
  Shift: '⇧',
  Space: 'Space',
  Escape: 'Esc',
  Enter: 'Enter',
  Backspace: '⌫',
  Delete: 'Del',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
}

export function formatAcceleratorDisplay(accelerator: string, isMac: boolean): string[] {
  return accelerator.split('+').map((part) => {
    if (part === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl'
    return DISPLAY_KEY_MAP[part] ?? part.toUpperCase()
  })
}

function normalizeEventKey(key: string): string {
  if (key === ' ') return 'Space'
  if (key === 'Esc') return 'Escape'
  if (key.length === 1) return key.toUpperCase()
  return key
}

function parseAccelerator(accelerator: string, isMac: boolean) {
  const parts = normalizeAccelerator(accelerator).split('+')
  const key = parts[parts.length - 1] ?? ''
  const modifiers = parts.slice(0, -1)

  let commandOrControl = false
  let command = false
  let control = false
  let alt = false
  let shift = false

  for (const mod of modifiers) {
    switch (mod) {
      case 'CommandOrControl':
        commandOrControl = true
        break
      case 'Command':
      case 'Cmd':
        command = true
        break
      case 'Control':
      case 'Ctrl':
        control = true
        break
      case 'Alt':
      case 'Option':
        alt = true
        break
      case 'Shift':
        shift = true
        break
      default:
        break
    }
  }

  const needsMeta = command || (commandOrControl && isMac)
  const needsCtrl = control || (commandOrControl && !isMac)

  return {
    key: normalizeEventKey(key),
    needsMeta,
    needsCtrl,
    alt,
    shift
  }
}

export function matchKeyboardEvent(
  event: KeyboardEvent,
  accelerator: string,
  isMac: boolean
): boolean {
  const parsed = parseAccelerator(accelerator, isMac)
  if (event.metaKey !== parsed.needsMeta) return false
  if (event.ctrlKey !== parsed.needsCtrl) return false
  if (event.altKey !== parsed.alt) return false
  if (event.shiftKey !== parsed.shift) return false
  return normalizeEventKey(event.key) === parsed.key
}

export function keyboardEventToAccelerator(event: KeyboardEvent, isMac: boolean): string | null {
  if (['Control', 'Meta', 'Alt', 'Shift', 'OS'].includes(event.key)) return null

  const parts: string[] = []
  if (event.metaKey && event.ctrlKey) {
    parts.push('Command', 'Control')
  } else if (event.metaKey) {
    parts.push(isMac ? 'Command' : 'Command')
  } else if (event.ctrlKey) {
    parts.push(isMac ? 'Control' : 'CommandOrControl')
  }

  if (event.altKey) parts.push('Alt')
  if (event.shiftKey) parts.push('Shift')

  const key = normalizeEventKey(event.key)
  if (!key) return null

  parts.push(key)
  return normalizeAccelerator(parts.join('+'))
}

export function findDuplicateShortcut(
  shortcuts: Record<ShortcutActionId, string>,
  targetId: ShortcutActionId,
  accelerator: string
): ShortcutActionId | null {
  const normalized = normalizeAccelerator(accelerator)
  for (const def of SHORTCUT_DEFINITIONS) {
    if (def.id === targetId) continue
    if (normalizeAccelerator(shortcuts[def.id]) === normalized) {
      return def.id
    }
  }
  return null
}

/** @deprecated use SHORTCUT_DEFINITIONS */
export interface ShortcutItem {
  label: string
  keys: string[]
  scope: 'global' | 'app'
}

/** @deprecated use resolveShortcuts + formatAcceleratorDisplay */
export function getShortcutCatalog(isMac: boolean): ShortcutItem[] {
  const resolved = resolveShortcuts(undefined, isMac)
  return SHORTCUT_DEFINITIONS.map((def) => ({
    label: def.label,
    keys: formatAcceleratorDisplay(resolved[def.id], isMac),
    scope: def.scope
  }))
}
