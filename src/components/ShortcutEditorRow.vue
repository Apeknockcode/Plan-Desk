<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { NButton, NSpace, NText } from 'naive-ui'
import { formatAcceleratorDisplay, keyboardEventToAccelerator } from '@/lib/shortcuts'

const props = defineProps<{
  label: string
  accelerator: string
  recording: boolean
  isMac: boolean
}>()

const emit = defineEmits<{
  startRecord: []
  cancelRecord: []
  save: [accelerator: string]
  reset: []
}>()

const preview = ref('')

const displayKeys = computed(() =>
  formatAcceleratorDisplay(props.recording && preview.value ? preview.value : props.accelerator, props.isMac)
)

function onKeyDown(event: KeyboardEvent) {
  if (!props.recording) return
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    emit('cancelRecord')
    return
  }

  const accelerator = keyboardEventToAccelerator(event, props.isMac)
  if (!accelerator) return
  preview.value = accelerator
  emit('save', accelerator)
}

watch(
  () => props.recording,
  (recording) => {
    preview.value = ''
    if (recording) {
      window.addEventListener('keydown', onKeyDown, true)
    } else {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }
)

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown, true)
})
</script>

<template>
  <div class="shortcut-row" :class="{ 'shortcut-row--recording': recording }">
    <span class="shortcut-label">{{ label }}</span>
    <div class="shortcut-actions">
      <span class="shortcut-keys">
        <kbd v-for="key in displayKeys" :key="key">{{ key }}</kbd>
      </span>
      <NText v-if="recording" depth="3" class="shortcut-recording-hint">按下新快捷键… Esc 取消</NText>
      <NSpace v-else :size="4">
        <NButton size="tiny" quaternary @click="emit('startRecord')">更改</NButton>
        <NButton size="tiny" quaternary @click="emit('reset')">恢复</NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.shortcut-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--pd-panel-bg, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.06));
}

.shortcut-row--recording {
  border-color: rgba(232, 168, 56, 0.45);
  box-shadow: 0 0 0 1px rgba(232, 168, 56, 0.12);
}

.shortcut-label {
  font-size: 13px;
  flex-shrink: 0;
}

.shortcut-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  min-width: 0;
}

.shortcut-keys {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.shortcut-recording-hint {
  font-size: 11px;
}

kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  padding: 2px 7px;
  border-radius: 6px;
  border: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.1));
  background: var(--pd-hover-bg, rgba(255, 255, 255, 0.06));
  font-family: inherit;
  font-size: 11px;
  line-height: 1.4;
}
</style>
