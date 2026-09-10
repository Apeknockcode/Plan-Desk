<script setup lang="ts">
import type { Component } from 'vue'
import { iconDefaults } from './icons'

withDefaults(
  defineProps<{
    icon: Component
    size?: number
    theme?: 'outline' | 'filled' | 'two-tone' | 'multi-color'
    fill?: string | string[]
  }>(),
  {
    size: 16,
    theme: 'outline'
  }
)
</script>

<template>
  <component
    :is="icon"
    :theme="theme"
    :size="size"
    :fill="fill ?? 'currentColor'"
    :stroke-width="iconDefaults.strokeWidth"
    :stroke-linejoin="iconDefaults.strokeLinejoin"
    :stroke-linecap="iconDefaults.strokeLinecap"
  />
</template>
