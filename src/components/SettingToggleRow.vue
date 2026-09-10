<script setup lang="ts">
import { NSwitch, NText } from 'naive-ui'

defineProps<{
  label: string
  hint?: string
  value: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:value': [value: boolean] }>()
</script>

<template>
  <div class="setting-toggle-row" :class="{ 'setting-toggle-row--disabled': disabled }">
    <div class="setting-toggle-row__text">
      <span class="setting-toggle-row__label">{{ label }}</span>
      <NText v-if="hint" depth="3" class="setting-toggle-row__hint">{{ hint }}</NText>
    </div>
    <NSwitch
      :value="value"
      :disabled="disabled"
      @update:value="emit('update:value', $event)"
    />
  </div>
</template>

<style scoped>
.setting-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--pd-panel-bg, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.06));
}

.setting-toggle-row--disabled {
  opacity: 0.55;
}

.setting-toggle-row__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.setting-toggle-row__label {
  font-size: 13px;
  font-weight: 500;
}

.setting-toggle-row__hint {
  font-size: 11px;
  line-height: 1.4;
}
</style>
