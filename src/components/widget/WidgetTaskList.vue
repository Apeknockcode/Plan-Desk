<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppIcon from '@/ui/AppIcon.vue'
import { Link } from '@/ui/icons'
import { openItemLink, pathExists } from '@/lib/itemLinks'
import type { PlanItem } from '@/lib/types'

const props = withDefaults(
  defineProps<{
    items: PlanItem[]
    variant?: 'default' | 'dialog'
  }>(),
  { variant: 'default' }
)

const emit = defineEmits<{
  toggle: [id: string]
}>()

const itemLinkVisible = ref<Record<string, boolean>>({})

async function refreshLinkVisibility(items: PlanItem[]) {
  const next: Record<string, boolean> = {}
  await Promise.all(
    items.map(async (item) => {
      const link = item.links?.[0]
      if (link) next[item.id] = await pathExists(link.path)
    })
  )
  itemLinkVisible.value = next
}

watch(
  () => props.items,
  (items) => {
    void refreshLinkVisibility(items)
  },
  { immediate: true, deep: true }
)

function hasValidLink(item: PlanItem): boolean {
  return Boolean(itemLinkVisible.value[item.id])
}

async function openFirstLink(item: PlanItem, event: MouseEvent) {
  event.stopPropagation()
  const link = item.links?.[0]
  if (!link) return
  if (!(await pathExists(link.path))) return
  await openItemLink(link)
}
</script>

<template>
  <section class="widget-list-wrap no-drag" :class="`widget-list-wrap--${variant}`">
    <div v-if="!items.length" class="widget-empty">全部完成</div>
    <ul v-else class="widget-list">
      <li v-for="item in items" :key="item.id" class="widget-row" @click="emit('toggle', item.id)">
        <span class="widget-dot" :class="{ pinned: item.pinned }" />
        <span class="widget-row-title" :title="item.title">{{ item.title }}</span>
        <button
          v-if="hasValidLink(item)"
          type="button"
          class="widget-link-btn no-drag"
          title="打开关联"
          @click="openFirstLink(item, $event)"
        >
          <AppIcon :icon="Link" :size="12" />
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.widget-list-wrap {
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  overflow: auto;
  padding: 6px 8px 10px;
}

.widget-list-wrap--dialog {
  padding: 0;
}

.widget-list-wrap--dialog .widget-list {
  padding: 0;
}

.widget-list-wrap--dialog .widget-row {
  padding: 7px 10px;
  gap: 8px;
  border-radius: 6px;
}

.widget-list-wrap--dialog .widget-dot {
  width: 6px;
  height: 6px;
}

.widget-list-wrap--dialog .widget-row-title {
  font-size: 12px;
  line-height: 1.35;
}

.widget-list-wrap--dialog .widget-row:hover {
  background: rgba(232, 168, 56, 0.1);
}

.widget-list-wrap--dialog .widget-row:active {
  background: rgba(232, 168, 56, 0.16);
}

.widget-empty {
  padding: 24px 12px;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.widget-list {
  list-style: none;
  margin: 0;
  padding: 0 4px;
}

.widget-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 8px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;
}

.widget-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.widget-row:active {
  background: rgba(232, 168, 56, 0.1);
}

.widget-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  transition: background 0.12s, transform 0.12s;
}

.widget-dot.pinned {
  background: #e8a838;
  box-shadow: 0 0 6px rgba(232, 168, 56, 0.5);
}

.widget-row:hover .widget-dot {
  background: #e8a838;
  transform: scale(1.15);
}

.widget-row-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.88);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.widget-link-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: rgba(232, 168, 56, 0.12);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s;
}

.widget-row:hover .widget-link-btn {
  opacity: 1;
}

.widget-link-btn:hover {
  background: rgba(232, 168, 56, 0.22);
  color: #fff;
}
</style>
