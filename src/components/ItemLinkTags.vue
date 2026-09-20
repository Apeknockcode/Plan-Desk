<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NDropdown, NTag, NTooltip, useMessage } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import { FileAddition, FolderOpen, Link } from '@/ui/icons'
import { usePlanStore } from '@/lib/store'
import {
  findMissingLinkPaths,
  linkDisplayName,
  openItemLink,
  revealInFolderLabel,
  showItemInFolder
} from '@/lib/itemLinks'
import type { ItemLink } from '@/lib/types'

const props = defineProps<{
  links: ItemLink[]
  compact?: boolean
}>()

const message = useMessage()
const { store } = usePlanStore()
const missingPaths = ref<Set<string>>(new Set())
const revealLabel = revealInFolderLabel()

const preferObsidian = () => store.value.prefs.openMarkdownInObsidian !== false

const visibleLinks = computed(() => props.links ?? [])

const dropdownOptions = computed(() =>
  visibleLinks.value.map((link, index) => ({
    key: String(index),
    label: linkDisplayName(link)
  }))
)

async function refreshMissingPaths() {
  missingPaths.value = await findMissingLinkPaths(visibleLinks.value)
}

watch(() => props.links, refreshMissingPaths, { deep: true })
onMounted(() => {
  void refreshMissingPaths()
})

function linkMenuOptions(link: ItemLink) {
  const opts = [{ label: '打开', key: 'open' }]
  if (link.kind !== 'url') {
    opts.push({ label: revealLabel, key: 'reveal' })
  }
  return opts
}

async function openLink(link: ItemLink, event?: Event) {
  event?.stopPropagation()
  if (link.kind !== 'url' && missingPaths.value.has(link.path)) {
    message.warning('路径已失效，请在编辑事项中重新选择')
    return
  }
  const ok = await openItemLink(link, { preferObsidian: preferObsidian() })
  if (!ok) {
    message.warning(link.kind === 'url' ? '无法打开链接' : '无法打开，文件或文件夹可能已被移动')
    await refreshMissingPaths()
  }
}

async function revealLink(link: ItemLink) {
  if (missingPaths.value.has(link.path)) {
    message.warning('路径已失效，请在编辑事项中重新选择')
    return
  }
  const ok = await showItemInFolder(link)
  if (!ok) {
    message.warning('无法在文件夹中显示，路径可能已被移动')
    await refreshMissingPaths()
  }
}

async function onLinkMenuSelect(key: string, link: ItemLink) {
  if (key === 'open') await openLink(link)
  if (key === 'reveal') await revealLink(link)
}

async function openByIndex(key: string) {
  const link = visibleLinks.value[Number(key)]
  if (link) await openLink(link)
}

function onTagClick(event: Event) {
  event.stopPropagation()
}
</script>

<template>
  <div v-if="visibleLinks.length" class="item-links" @click.stop>
    <template v-if="compact && visibleLinks.length > 1">
      <NDropdown trigger="click" :options="dropdownOptions" @select="openByIndex">
        <NTooltip>
          <template #trigger>
            <button type="button" class="link-btn" @click="onTagClick">
              <AppIcon :icon="Link" :size="13" />
              <span>{{ visibleLinks.length }}</span>
            </button>
          </template>
          打开关联文件
        </NTooltip>
      </NDropdown>
    </template>

    <template v-else>
      <NDropdown
        v-for="(link, index) in visibleLinks"
        :key="`${link.path}-${index}`"
        trigger="contextmenu"
        :options="linkMenuOptions(link)"
        @select="(key) => onLinkMenuSelect(String(key), link)"
      >
        <NTooltip>
          <template #trigger>
            <NTag
              size="small"
              :bordered="false"
              class="link-tag"
              :class="{ 'link-tag--missing': missingPaths.has(link.path) }"
              @click="openLink(link, $event)"
            >
              <span class="link-tag-inner">
                <AppIcon
                  :icon="
                    link.kind === 'url'
                      ? Link
                      : link.kind === 'folder'
                        ? FolderOpen
                        : FileAddition
                  "
                  :size="12"
                />
                {{ linkDisplayName(link) }}
              </span>
            </NTag>
          </template>
          {{ missingPaths.has(link.path) ? '路径已失效 · ' : '' }}{{ link.path }}
        </NTooltip>
      </NDropdown>
    </template>
  </div>
</template>

<style scoped>
.item-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
  padding-left: 28px;
}

.link-tag {
  cursor: pointer;
  background: rgba(232, 168, 56, 0.1) !important;
  color: rgba(255, 255, 255, 0.8) !important;
}

.link-tag:hover {
  background: rgba(232, 168, 56, 0.18) !important;
}

.link-tag--missing {
  background: rgba(232, 106, 90, 0.15) !important;
  color: rgba(255, 190, 180, 0.9) !important;
}

.link-tag-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  border-radius: 6px;
  background: rgba(232, 168, 56, 0.12);
  color: rgba(255, 255, 255, 0.75);
  font-size: 11px;
  cursor: pointer;
}

.link-btn:hover {
  background: rgba(232, 168, 56, 0.2);
}
</style>
