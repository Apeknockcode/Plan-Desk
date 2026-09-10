import type { Ref } from 'vue'
import { matchKeyboardEvent, type ShortcutActionId } from '@/lib/shortcuts'

export interface KeyboardShortcutHandlers {
  openSearch: () => void
  focusQuickAdd: () => void
  closeAllModals: () => void
  moveSelection: (delta: number) => void
  toggleSelectedItem: () => void
  deleteSelectedItem: () => void
  isModalOpen: () => boolean
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable
}

export function useKeyboardShortcuts(
  selectedItemId: Ref<string | null>,
  handlers: KeyboardShortcutHandlers,
  getAccelerators: () => Record<ShortcutActionId, string>,
  isMac: boolean
) {
  function onGlobalKeydown(e: KeyboardEvent) {
    const acc = getAccelerators()

    if (matchKeyboardEvent(e, acc['app.search'], isMac)) {
      e.preventDefault()
      handlers.openSearch()
      return
    }

    if (matchKeyboardEvent(e, acc['app.focusQuickAdd'], isMac)) {
      e.preventDefault()
      if (handlers.isModalOpen()) return
      handlers.focusQuickAdd()
      return
    }

    if (matchKeyboardEvent(e, acc['app.closeModal'], isMac)) {
      if (handlers.isModalOpen()) {
        e.preventDefault()
        handlers.closeAllModals()
      }
      return
    }

    if (isTypingTarget(e.target) || handlers.isModalOpen()) return

    if (matchKeyboardEvent(e, acc['app.moveDown'], isMac)) {
      e.preventDefault()
      handlers.moveSelection(1)
      return
    }

    if (matchKeyboardEvent(e, acc['app.moveUp'], isMac)) {
      e.preventDefault()
      handlers.moveSelection(-1)
      return
    }

    if (matchKeyboardEvent(e, acc['app.toggleItem'], isMac) && selectedItemId.value) {
      e.preventDefault()
      handlers.toggleSelectedItem()
      return
    }

    if (matchKeyboardEvent(e, acc['app.deleteItem'], isMac) && selectedItemId.value) {
      e.preventDefault()
      handlers.deleteSelectedItem()
    }
  }

  function attach() {
    window.addEventListener('keydown', onGlobalKeydown)
  }

  function detach() {
    window.removeEventListener('keydown', onGlobalKeydown)
  }

  return { attach, detach }
}
