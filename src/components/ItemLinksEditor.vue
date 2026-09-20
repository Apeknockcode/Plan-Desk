<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NInput, NModal, NSpace, NText, NTooltip, useMessage } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import { Close, FileAddition, FolderOpen, Link } from '@/ui/icons'
import { usePlanStore } from '@/lib/store'
import {
  findMissingLinkPaths,
  isHttpUrl,
  linkDisplayName,
  openItemLink,
  pickItemLink,
  revealInFolderLabel,
  showItemInFolder
} from '@/lib/itemLinks'
import type { ItemLink } from '@/lib/types'

const links = defineModel<ItemLink[]>({ default: () => [] })

const message = useMessage()
const { store } = usePlanStore()
const missingPaths = ref<Set<string>>(new Set())
const revealLabel = revealInFolderLabel()
const showUrlModal = ref(false)
const urlDraft = ref('')
const urlLabelDraft = ref('')

const preferObsidian = () => store.value.prefs.openMarkdownInObsidian !== false

async function refreshMissingPaths() {
  missingPaths.value = await findMissingLinkPaths(links.value)
}

watch(links, refreshMissingPaths, { deep: true, immediate: true })

async function addLink(kind: ItemLink['kind']) {
  if (kind === 'url') {
    urlDraft.value = ''
    urlLabelDraft.value = ''
    showUrlModal.value = true
    return
  }
  const picked = await pickItemLink(kind)
  if (!picked) return
  if (links.value.some((l) => l.path === picked.path)) {
    message.info('该路径已关联')
    return
  }
  links.value = [...links.value, picked]
}

function confirmUrl() {
  const path = urlDraft.value.trim()
  if (!isHttpUrl(path)) {
    message.warning('请输入以 http:// 或 https:// 开头的链接')
    return
  }
  if (links.value.some((l) => l.path === path)) {
    message.info('该链接已关联')
    return
  }
  const label = urlLabelDraft.value.trim()
  links.value = [
    ...links.value,
    { path, kind: 'url', label: label || undefined }
  ]
  showUrlModal.value = false
}

function removeLink(index: number) {
  links.value = links.value.filter((_, i) => i !== index)
}

async function openLink(link: ItemLink) {
  if (link.kind === 'url') {
    const ok = await openItemLink(link)
    if (!ok) message.warning('无法打开链接')
    return
  }
  if (missingPaths.value.has(link.path)) {
    message.warning('路径已失效，请重新选择')
    return
  }
  const ok = await openItemLink(link, { preferObsidian: preferObsidian() })
  if (!ok) {
    message.warning('无法打开，文件或文件夹可能已被移动')
    await refreshMissingPaths()
  }
}

async function revealLink(link: ItemLink) {
  if (link.kind === 'url') return
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
  if (!current || current.kind === 'url') return
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
              :class="{ 'link-chip--missing': link.kind !== 'url' && missingPaths.has(link.path) }"
              @click="openLink(link)"
            >
              <AppIcon
                :icon="link.kind === 'url' ? Link : link.kind === 'folder' ? FolderOpen : FileAddition"
                :size="14"
              />
              <span class="link-name">{{ linkDisplayName(link) }}</span>
              <span
                v-if="link.kind !== 'url' && missingPaths.has(link.path)"
                class="link-missing-badge"
              >
                已失效
              </span>
            </button>
          </template>
          {{ link.path }}
        </NTooltip>

        <NTooltip v-if="link.kind !== 'url'">
          <template #trigger>
            <NButton quaternary circle size="tiny" @click="revealLink(link)">
              <template #icon><AppIcon :icon="FolderOpen" :size="12" /></template>
            </NButton>
          </template>
          {{ revealLabel }}
        </NTooltip>

        <NButton
          v-if="link.kind !== 'url' && missingPaths.has(link.path)"
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

    <NText v-else depth="3" class="links-empty">未关联文件、文件夹或网页</NText>

    <NSpace :size="8" style="margin-top: 10px">
      <NButton size="tiny" secondary @click="addLink('file')">
        <template #icon><AppIcon :icon="FileAddition" :size="14" /></template>
        添加文件
      </NButton>
      <NButton size="tiny" secondary @click="addLink('folder')">
        <template #icon><AppIcon :icon="FolderOpen" :size="14" /></template>
        添加文件夹
      </NButton>
      <NButton size="tiny" secondary @click="addLink('url')">
        <template #icon><AppIcon :icon="Link" :size="14" /></template>
        Notion / 网页
      </NButton>
    </NSpace>
  </div>

  <NModal v-model:show="showUrlModal" preset="dialog" title="添加网页链接">
    <NSpace vertical :size="12" style="width: 100%">
      <NInput v-model:value="urlDraft" placeholder="https://www.notion.so/..." />
      <NInput v-model:value="urlLabelDraft" placeholder="显示名称（可选，如「项目文档」）" />
    </NSpace>
    <template #action>
      <NButton @click="showUrlModal = false">取消</NButton>
      <NButton type="primary" @click="confirmUrl">添加</NButton>
    </template>
  </NModal>
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
  color: var(--pd-body-fg);
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
