<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue'
import { usePetAnimator } from '@/composables/usePetAnimator'
import { usePetdexEntry } from '@/composables/usePetdexEntry'
import { petdexPetRuntime } from '@/lib/petRuntime'
import { resolveLookIndex } from '@/lib/petAtlas'
import type { PetInteraction, PetState } from '@/lib/types'

const emit = defineEmits<{ ready: [] }>()

const props = defineProps<{
  state: PetState
  petdexSlug: string
  /** 看向的目标点（屏幕坐标，舞台模式由父级驱动） */
  lookAt?: { x: number; y: number } | null
  /** 舞台交互动画 */
  interaction?: PetInteraction
  /** 是否自行跟踪鼠标（舞台内由父级统一处理） */
  trackMouse?: boolean
}>()

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const mouseX = ref<number | null>(null)
const mouseY = ref<number | null>(null)

const stateRef = toRef(props, 'state')
const petdexSlugRef = computed(() => props.petdexSlug)
const { entry: petdexEntry } = usePetdexEntry(petdexSlugRef)

const runtime = computed(() => {
  if (!petdexEntry.value) return null
  return petdexPetRuntime(petdexEntry.value)
})

const lookIndex = computed(() => {
  if (!rootRef.value) return null
  const rect = rootRef.value.getBoundingClientRect()
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height * 0.42

  const trackMouse = props.trackMouse !== false
  if (trackMouse && mouseX.value !== null && mouseY.value !== null) {
    return resolveLookIndex(mouseX.value, mouseY.value, cx, cy)
  }
  if (props.lookAt) {
    return resolveLookIndex(props.lookAt.x, props.lookAt.y, cx, cy)
  }
  return null
})

const { start, stop } = usePetAnimator(canvasRef, imageRef, {
  state: stateRef,
  lookIndex,
  interaction: computed(() => props.interaction ?? null),
  manifest: computed(() => runtime.value?.manifest),
  scale: computed(() => runtime.value?.renderScale ?? 0.5),
  smooth: true
})

function onMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

function onMouseLeave() {
  mouseX.value = null
  mouseY.value = null
}

function loadSpritesheet(url: string) {
  const img = new Image()
  img.src = url
  img.onload = () => {
    imageRef.value = img
    start()
    emit('ready')
  }
}

const runtimeKey = computed(
  () => `${props.petdexSlug}:${runtime.value?.spritesheetUrl ?? ''}`
)

onMounted(() => {
  if (!runtime.value) return
  loadSpritesheet(runtime.value.spritesheetUrl)
  if (props.trackMouse !== false) {
    window.addEventListener('mousemove', onMouseMove)
  }
})

onUnmounted(() => {
  stop()
  if (props.trackMouse !== false) {
    window.removeEventListener('mousemove', onMouseMove)
  }
})

watch(runtimeKey, () => {
  if (!runtime.value) return
  stop()
  imageRef.value = null
  loadSpritesheet(runtime.value.spritesheetUrl)
})

watch(petdexEntry, (entry) => {
  if (!entry) return
  stop()
  imageRef.value = null
  loadSpritesheet(entry.spritesheetUrl)
})

watch(stateRef, () => {
  if (imageRef.value?.complete) start()
})
</script>

<template>
  <div ref="rootRef" class="sprite-pet" @mouseleave="onMouseLeave">
    <canvas ref="canvasRef" class="sprite-canvas" />
  </div>
</template>

<style scoped>
.sprite-pet {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0;
}

.sprite-canvas {
  display: block;
  pointer-events: none;
}
</style>
