<script setup lang="ts">
import { inject, nextTick, onUnmounted, ref, watch } from 'vue'

export type WidgetMenuItem = {
  key: string
  label: string
  danger?: boolean
}

const props = defineProps<{
  show: boolean
  x: number
  y: number
  items: WidgetMenuItem[]
}>()

const emit = defineEmits<{
  select: [key: string]
  close: []
}>()

const MENU_PADDING = 8

const menuRef = ref<HTMLElement | null>(null)
const position = ref({ x: 0, y: 0 })
const menuReady = ref(false)
const restorePetWindowSize = inject<(() => void) | undefined>('restorePetWindowSize')

function closeMenu() {
  if (!props.show) return
  emit('close')
}

function onSelect(key: string) {
  emit('select', key)
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node | null
  if (menuRef.value?.contains(target)) return
  closeMenu()
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMenu()
}

function bindDismissListeners() {
  document.addEventListener('pointerdown', onDocumentPointerDown, true)
  document.addEventListener('keydown', onDocumentKeyDown, true)
}

function unbindDismissListeners() {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
  document.removeEventListener('keydown', onDocumentKeyDown, true)
}

function layoutMenu() {
  const menuEl = menuRef.value
  if (!menuEl) return

  const rect = menuEl.getBoundingClientRect()
  const menuW = rect.width
  const menuH = rect.height
  const viewW = window.innerWidth
  const viewH = window.innerHeight

  let x = props.x
  let y = props.y

  if (x + menuW + MENU_PADDING > viewW) {
    x = props.x - menuW
  }
  if (y + menuH + MENU_PADDING > viewH) {
    y = props.y - menuH
  }

  x = Math.max(MENU_PADDING, Math.min(x, viewW - menuW - MENU_PADDING))
  y = Math.max(MENU_PADDING, Math.min(y, viewH - menuH - MENU_PADDING))

  position.value = { x, y }
  menuReady.value = true
}

watch(
  () => props.show,
  async (show, wasShow) => {
    if (!show) {
      menuReady.value = false
      unbindDismissListeners()
      if (wasShow) {
        await nextTick()
        restorePetWindowSize?.()
      }
      return
    }

    menuReady.value = false
    position.value = { x: props.x, y: props.y }
    await nextTick()
    layoutMenu()
    await nextTick()
    bindDismissListeners()
  }
)

onUnmounted(() => {
  unbindDismissListeners()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="widget-ctx-backdrop"
      @mousedown="closeMenu"
      @contextmenu.prevent="closeMenu"
    >
      <div
        ref="menuRef"
        class="widget-ctx-menu no-drag"
        :class="{ 'widget-ctx-menu--ready': menuReady }"
        :style="{ left: `${position.x}px`, top: `${position.y}px` }"
        @mousedown.stop
        @contextmenu.prevent
      >
        <button
          v-for="item in items"
          :key="item.key"
          type="button"
          class="widget-ctx-item"
          :class="{ 'widget-ctx-item--danger': item.danger }"
          @click="onSelect(item.key)"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.widget-ctx-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.001);
}

.widget-ctx-menu {
  position: fixed;
  width: max-content;
  min-width: 120px;
  max-width: min(220px, calc(100vw - 16px));
  padding: 4px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: linear-gradient(165deg, rgba(36, 32, 24, 0.98) 0%, rgba(18, 16, 14, 0.99) 100%);
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.42),
    0 0 0 1px rgba(232, 168, 56, 0.12);
  visibility: hidden;
  opacity: 0;
}

.widget-ctx-menu--ready {
  visibility: visible;
  opacity: 1;
  animation: widget-ctx-in 0.12s ease-out;
}

@keyframes widget-ctx-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.widget-ctx-item {
  display: block;
  width: 100%;
  margin: 0;
  padding: 8px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.widget-ctx-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.widget-ctx-item--danger {
  color: #f08a7a;
}

.widget-ctx-item--danger:hover {
  background: rgba(232, 106, 90, 0.18);
  color: #ffb4a8;
}
</style>
