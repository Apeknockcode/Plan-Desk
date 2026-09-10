<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { NConfigProvider, NDialogProvider, NMessageProvider, darkTheme, lightTheme, zhCN, dateZhCN } from 'naive-ui'
import { useThemePreference } from '@/composables/useThemePreference'
import { buildThemeOverrides } from '@/lib/themeAccent'
import { setupIconPark } from './icons'

const { effectiveTheme, themeAccent } = useThemePreference()

const naiveTheme = computed(() => (effectiveTheme.value === 'dark' ? darkTheme : lightTheme))
const themeOverrides = computed(() =>
  buildThemeOverrides(themeAccent.value, effectiveTheme.value)
)

onMounted(() => setupIconPark())
</script>

<template>
  <NConfigProvider
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
    :locale="zhCN"
    :date-locale="dateZhCN"
  >
    <NMessageProvider>
      <NDialogProvider>
        <slot />
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>
