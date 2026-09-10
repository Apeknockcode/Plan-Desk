<script setup lang="ts">
import { computed } from 'vue'
import { getPetdexPreviewStyle } from '@/lib/petPreview'
import type { PetdexEntry } from '@/lib/petdex/types'

const props = withDefaults(
  defineProps<{
    entry: PetdexEntry
    compact?: boolean
  }>(),
  { compact: false }
)

const boxSize = computed(() =>
  props.compact ? { width: 56, height: 60 } : { width: 64, height: 68 }
)

const frameStyle = computed(() => getPetdexPreviewStyle(props.entry, boxSize.value))
</script>

<template>
  <span
    class="petdex-thumb"
    :class="{ 'petdex-thumb--compact': compact }"
    :style="{ height: `${boxSize.height}px` }"
  >
    <span class="petdex-thumb__frame" :style="frameStyle" />
  </span>
</template>

<style scoped>
.petdex-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border-radius: 8px;
  background: color-mix(in srgb, var(--n-text-color-1) 4%, transparent);
}

.petdex-thumb--compact {
  border-radius: 6px;
}

.petdex-thumb__frame {
  display: block;
  flex-shrink: 0;
}
</style>
