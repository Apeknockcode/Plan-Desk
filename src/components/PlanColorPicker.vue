<script setup lang="ts">
import { computed } from 'vue'
import { PLAN_COLOR_PALETTE } from '@/lib/planColors'
import type { Project } from '@/lib/types'

const props = defineProps<{
  value: string
  projects: Project[]
  /** 编辑计划时排除自身，允许保留当前颜色 */
  excludePlanId?: string | null
}>()

const emit = defineEmits<{ 'update:value': [value: string] }>()

const options = computed(() =>
  PLAN_COLOR_PALETTE.map((color) => {
    const owner = props.projects.find(
      (p) =>
        p.id !== props.excludePlanId &&
        p.color.toLowerCase() === color.toLowerCase()
    )
    return { color, taken: Boolean(owner), ownerName: owner?.name }
  })
)

function select(color: string, taken: boolean) {
  if (taken) return
  emit('update:value', color)
}
</script>

<template>
  <div class="plan-color-picker">
    <span class="plan-color-picker__label">标识颜色</span>
    <div class="plan-color-picker__grid">
      <button
        v-for="opt in options"
        :key="opt.color"
        type="button"
        class="plan-color-swatch"
        :class="{
          'plan-color-swatch--active': value.toLowerCase() === opt.color.toLowerCase(),
          'plan-color-swatch--taken': opt.taken
        }"
        :title="opt.taken ? `已被「${opt.ownerName}」使用` : opt.color"
        :disabled="opt.taken"
        @click="select(opt.color, opt.taken)"
      >
        <span class="plan-color-swatch__dot" :style="{ background: opt.color }" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.plan-color-picker {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plan-color-picker__label {
  font-size: 12px;
  color: var(--pd-muted-fg, rgba(255, 255, 255, 0.45));
}

.plan-color-picker__grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.plan-color-swatch {
  width: 32px;
  height: 32px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color 0.12s, transform 0.12s;
}

.plan-color-swatch:hover:not(:disabled) {
  transform: scale(1.06);
}

.plan-color-swatch--active {
  border-color: var(--n-text-color-1);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--n-text-color-1) 15%, transparent);
}

.plan-color-swatch--taken {
  cursor: not-allowed;
  opacity: 0.38;
}

.plan-color-swatch__dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  box-shadow: inset 0 -2px 4px rgba(0, 0, 0, 0.12);
}
</style>
