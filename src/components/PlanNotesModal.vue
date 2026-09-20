<script setup lang="ts">
import { ref, watch } from 'vue'
import { NButton, NForm, NFormItem, NInput, NModal, NSpace, NText, useMessage } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import { FileAddition, FolderOpen } from '@/ui/icons'
import { linkBasename, pickItemLink } from '@/lib/itemLinks'
import { normalizeNotionUrl, normalizeObsidianPath } from '@/lib/planNotes'
import type { Project } from '@/lib/types'

const props = defineProps<{
  show: boolean
  plan: Project | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  save: [patch: { notionUrl: string | null; obsidianPath: string | null }]
}>()

const message = useMessage()
const notionUrl = ref('')
const obsidianPath = ref('')

watch(
  () => [props.show, props.plan] as const,
  ([visible, plan]) => {
    if (!visible || !plan) return
    notionUrl.value = plan.notionUrl ?? ''
    obsidianPath.value = plan.obsidianPath ?? ''
  },
  { immediate: true }
)

function close() {
  emit('update:show', false)
}

function save() {
  const notion = normalizeNotionUrl(notionUrl.value)
  if (notionUrl.value.trim() && !notion) {
    message.warning('Notion 链接需以 http:// 或 https:// 开头')
    return
  }
  emit('save', {
    notionUrl: notion,
    obsidianPath: normalizeObsidianPath(obsidianPath.value)
  })
  close()
}

async function pickObsidianTarget() {
  const picked = await pickItemLink('file')
  const path = picked?.path ?? (await pickItemLink('folder'))?.path
  if (!path) return
  obsidianPath.value = path
}

async function pickFolderOnly() {
  const picked = await pickItemLink('folder')
  if (picked) obsidianPath.value = picked.path
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="plan ? `计划笔记 · ${plan.name}` : '计划笔记'"
    style="width: 480px"
    @update:show="emit('update:show', $event)"
  >
    <NText depth="3" style="display: block; margin-bottom: 12px; font-size: 13px; line-height: 1.5">
      把 Notion 项目页或 Obsidian 里的计划笔记挂在这里，方便从计划页一键打开；事项里仍可单独添加 Notion 链接。
    </NText>

    <NForm label-placement="top">
      <NFormItem label="Notion 页面链接">
        <NInput
          v-model:value="notionUrl"
          placeholder="https://www.notion.so/..."
          clearable
        />
      </NFormItem>
      <NFormItem label="Obsidian 笔记或文件夹">
        <NSpace vertical :size="8" style="width: 100%">
          <NInput
            v-model:value="obsidianPath"
            placeholder="选择库内的 .md 或文件夹路径"
            clearable
          />
          <NSpace :size="8">
            <NButton size="tiny" secondary @click="pickObsidianTarget">
              <template #icon><AppIcon :icon="FileAddition" :size="14" /></template>
              选择笔记
            </NButton>
            <NButton size="tiny" secondary @click="pickFolderOnly">
              <template #icon><AppIcon :icon="FolderOpen" :size="14" /></template>
              选择文件夹
            </NButton>
          </NSpace>
          <NText v-if="obsidianPath.trim()" depth="3" style="font-size: 12px">
            {{ linkBasename(obsidianPath) }}
          </NText>
        </NSpace>
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">取消</NButton>
        <NButton type="primary" @click="save">保存</NButton>
      </NSpace>
    </template>
  </NModal>
</template>
