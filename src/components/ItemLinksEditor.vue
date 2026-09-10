<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NSpace, NText, NTooltip, useMessage } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import { Close, FileAddition, FolderOpen } from '@/ui/icons'
import {
  findMissingLinkPaths,
  linkBasename,
  openItemLink,
  pickItemLink,
  revealInFolderLabel,
  showItemInFolder
} from '@/lib/itemLinks'
import type { ItemLink } from '@/lib/types'

const links = defineModel<ItemLink[]>({ default: () => [] })

const message = useMessage()
const missingPaths = ref<Set<string>>(new Set())
const revealLabel = revealInFolderLabel()

async function refreshMissingPaths() {
  missingPaths.value = await findMissingLinkPaths(links.value)
}

watch(links, refreshMissingPaths, { deep: true, immediate: true })

async function addLink(kind: ItemLink['kind']) {
  const picked = await pickItemLink(kind)
  if (!picked) return
  if (links.value.some((l) => l.path === picked.path)) {
    message.info('该路径已关联')
    return
  }
  links.value = [...links.value, picked]
}

function removeLink(index: number) {
  links.value = links.value.filter((_, i) => i !== index)
}

async function openLink(link: ItemLink) {
  if (missingPaths.value.has(link.path)) {
    message.warning('路径已失效，请重新选择')
    return
  }
  const ok = await openItemLink(link)
  if (!ok) {
    message.warning('无法打开，文件或文件夹可能已被移动')
    await refreshMissingPaths()
  }
}

async function revealLink(link: ItemLink) {
  if (missingPaths.value.has(link.path)) {
    message.warning('路径已失效，请重新选择')
    return
  }
  const ok = await showItemInFolder(link)
  if (!ok) {
    message.warning('无法在文件夹中显示，路径可能已被移动')
    await refreshMissingPaths()
  }
}

async function replaceLink(index: number) {
  const current = links.value[index]
  if (!current) return
  const picked = await pickItemLink(current.kind)
  if (!picked) return
  const next = [...links.value]
  next[index] = picked
  links.value = next
}
</script>

<template>
  <div class="links-editor">
    <div v-if="links.length" class="links-list">
      <div v-for="(link, index) in links" :key="`${link.path}-${index}`" class="link-row">
        <NTooltip>
          <template #trigger>
            <button
              type="button"
              class="link-chip"
              :class="{ 'link-chip--missing': missingPaths.has(link.path) }"
              @click="openLink(link)"
            >
              <AppIcon
                :icon="link.kind === 'folder' ? FolderOpen : FileAddition"
                :size="14"
              />
              <span class="link-name">{{ linkBasename(link.path) }}</span>
              <span v-if="missingPaths.has(link.path)" class="link-missing-badge">已失效</span>
            </button>
          </template>
          {{ link.path }}
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <NButton quaternary circle size="tiny" @click="revealLink(link)">
              <template #icon><AppIcon :icon="FolderOpen" :size="12" /></template>
            </NButton>
          </template>
          {{ revealLabel }}
        </NTooltip>

        <NButton
          v-if="missingPaths.has(link.path)"
          size="tiny"
          secondary
          @click="replaceLink(index)"
        >
          重新选择
        </NButton>

        <NButton quaternary circle size="tiny" @click="removeLink(index)">
          <template #icon><AppIcon :icon="Close" :size="12" /></template>
        </NButton>
      </div>
    </div>

    <NText v-else depth="3" class="links-empty">未关联文件或文件夹</NText>

    <NSpace :size="8" style="margin-top: 10px">
      <NButton size="tiny" secondary @click="addLink('file')">
        <template #icon><AppIcon :icon="FileAddition" :size="14" /></template>
        添加文件
      </NButton>
      <NButton size="tiny" secondary @click="addLink('folder')">
        <template #icon><AppIcon :icon="FolderOpen" :size="14" /></template>
        添加文件夹
      </NButton>
    </NSpace>
  </div>
</template>

<style scoped>
.links-editor {
  width: 100%;
}

.links-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.link-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.link-chip {
  flex: 1;
  min-width: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, border-color 0.12s;
}

.link-chip:hover {
  background: rgba(232, 168, 56, 0.08);
  border-color: rgba(232, 168, 56, 0.25);
}

.link-chip--missing {
  border-color: rgba(232, 106, 90, 0.45);
  background: rgba(232, 106, 90, 0.08);
  color: rgba(255, 200, 190, 0.9);
}

.link-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.link-missing-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(232, 106, 90, 0.25);
  color: #ffb4a8;
}

.links-empty {
  display: block;
  font-size: 12px;
}
</style>
