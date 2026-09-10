<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
  }>(),
  { size: 24 }
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    class="plan-desk-logo"
  >
    <defs>
      <linearGradient id="pd-logo-bg" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
        <stop stop-color="#6E6E73" />
        <stop offset="1" stop-color="#3A3A3C" />
      </linearGradient>
    </defs>
    <!-- 圆角底 -->
    <rect x="1.5" y="1.5" width="21" height="21" rx="5.5" fill="url(#pd-logo-bg)" />
    <!-- 字母 P（与菜单栏图标同造型） -->
    <rect x="8.25" y="7" width="2.2" height="10.5" rx="0.55" fill="#FAFAFA" />
    <rect x="8.25" y="7" width="7.8" height="2.2" rx="0.55" fill="#FAFAFA" />
    <rect x="14.8" y="7" width="2.2" height="5.5" rx="0.55" fill="#FAFAFA" />
    <rect x="8.25" y="12.5" width="6.5" height="2.1" rx="0.55" fill="#FAFAFA" />
    <rect x="10.2" y="9" width="4.5" height="3.2" rx="0.8" fill="url(#pd-logo-bg)" />
  </svg>
</template>

<style scoped>
.plan-desk-logo {
  display: block;
  flex-shrink: 0;
}
</style>
