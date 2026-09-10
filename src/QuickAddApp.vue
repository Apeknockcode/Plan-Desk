<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { NButton, NInput, NSelect, NSpace } from 'naive-ui'
import { usePlanStore } from '@/lib/store'
import type { Project } from '@/lib/types'

const { store, load, addItem } = usePlanStore()

const title = ref('')
const planId = ref<string | null>(null)
const titleInputRef = ref<{ focus: () => void } | null>(null)

const planOptions = computed(() =>
  store.value.projects.map((p: Project) => ({ label: p.name, value: p.id }))
)

function resetForm() {
  title.value = ''
  const defaultId = store.value.prefs.defaultPlanId
  planId.value =
    defaultId && store.value.projects.some((p) => p.id === defaultId)
      ? defaultId
      : (store.value.projects[0]?.id ?? null)
}

async function submit() {
  const t = title.value.trim()
  if (!t || !planId.value) return

  await addItem({
    title: t,
    notes: '',
    category: 'todo',
    priority: 'normal',
    dueDate: null,
    projectId: planId.value,
    pinned: false,
    completed: false
  })
  resetForm()
  titleInputRef.value?.focus()
}

function closeWindow() {
  window.planDesk.closeQuickAdd?.()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    closeWindow()
  }
}

let unsubStore: (() => void) | undefined
let unsubFocus: (() => void) | undefined

onMounted(async () => {
  await load()
  resetForm()
  titleInputRef.value?.focus()
  window.addEventListener('keydown', onKeydown)
  unsubStore = window.planDesk.onStoreUpdated(() => {
    void load().then(resetForm)
  })
  unsubFocus = window.planDesk.onQuickAddFocus?.(() => {
    resetForm()
    titleInputRef.value?.focus()
  })
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  unsubStore?.()
  unsubFocus?.()
})
</script>

<template>
  <div class="quick-add-shell">
    <div class="quick-add-drag drag-region" data-tauri-drag-region />
    <div class="quick-add-body">
      <div class="quick-add-title">快速添加</div>
      <NSpace vertical :size="10">
        <NSelect
          v-model:value="planId"
          :options="planOptions"
          placeholder="选择计划"
          size="small"
        />
        <NInput
          ref="titleInputRef"
          v-model:value="title"
          placeholder="要做什么？回车添加"
          size="medium"
          autofocus
          @keydown.enter.prevent="submit"
        />
      </NSpace>
      <div class="quick-add-actions">
        <NButton size="small" quaternary @click="closeWindow">关闭</NButton>
        <NButton size="small" type="primary" :disabled="!title.trim() || !planId" @click="submit">
          添加
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.quick-add-shell {
  height: 100vh;
  background: linear-gradient(180deg, #1e1a14 0%, #141210 100%);
  border: 1px solid rgba(232, 168, 56, 0.25);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
}

.quick-add-drag {
  height: 28px;
}

.quick-add-body {
  padding: 0 16px 16px;
}

.quick-add-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 12px;
  color: rgba(255, 255, 255, 0.85);
}

.quick-add-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}
</style>
