<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NSwitch
} from 'naive-ui'
import { usePlanStore } from '@/lib/store'
import ItemLinksEditor from '@/components/ItemLinksEditor.vue'
import type { ItemLink, PlanItem, Project } from '@/lib/types'

const props = defineProps<{
  show: boolean
  item: PlanItem | null
  projects: Project[]
  /** 锁定到当前计划时隐藏计划选择（新建时） */
  planId?: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  saved: []
  moved: [projectId: string]
}>()

const { addItem, updateItem, moveItemToPlan } = usePlanStore()

const title = ref('')
const notes = ref('')
const projectId = ref<string | null>(null)
const pinned = ref(false)
const links = ref<ItemLink[]>([])

const isEditing = computed(() => Boolean(props.item?.id))

const projectOptions = computed(() => [
  { label: '无', value: null as string | null },
  ...props.projects.map((p) => ({ label: p.name, value: p.id }))
])

const moveOptions = computed(() =>
  props.projects
    .filter((p) => p.id !== props.item?.projectId)
    .map((p) => ({ label: p.name, value: p.id }))
)

watch(
  () => [props.item, props.planId] as const,
  ([item, planId]) => {
    if (item) {
      title.value = item.title
      notes.value = item.notes
      projectId.value = planId ?? item.projectId
      pinned.value = item.pinned
      links.value = [...(item.links ?? [])]
    } else {
      title.value = ''
      notes.value = ''
      projectId.value = planId ?? null
      pinned.value = false
      links.value = []
    }
  },
  { immediate: true }
)

function close() {
  emit('update:show', false)
}

async function save() {
  const t = title.value.trim()
  if (!t) return

  const data = {
    title: t,
    notes: notes.value.trim(),
    links: links.value,
    category: props.item?.category ?? 'todo',
    priority: props.item?.priority ?? 'normal',
    dueDate: props.item?.dueDate ?? null,
    projectId: projectId.value,
    pinned: pinned.value,
    completed: props.item?.completed ?? false
  }

  if (props.item?.id) {
    const targetPlan = projectId.value
    if (targetPlan && targetPlan !== props.item.projectId) {
      await moveItemToPlan(props.item.id, targetPlan)
      await updateItem(props.item.id, {
        title: data.title,
        notes: data.notes,
        links: data.links,
        pinned: data.pinned
      })
      emit('moved', targetPlan)
    } else {
      await updateItem(props.item.id, data)
    }
  } else {
    await addItem(data)
  }
  emit('saved')
}

async function moveTo(planId: string) {
  if (!props.item?.id || planId === props.item.projectId) return
  await moveItemToPlan(props.item.id, planId)
  projectId.value = planId
  emit('moved', planId)
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="item?.id ? '编辑事项' : '新建事项'"
    style="width: 460px"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top" size="small">
      <NFormItem label="标题">
        <NInput
          v-model:value="title"
          placeholder="要做什么？"
          autofocus
          @keydown.enter="save"
        />
      </NFormItem>

      <NFormItem label="备注">
        <NInput v-model:value="notes" type="textarea" placeholder="补充说明（可选）" :rows="3" />
      </NFormItem>

      <NFormItem label="关联文件（可选）">
        <ItemLinksEditor v-model="links" />
      </NFormItem>

      <NFormItem v-if="!planId && !isEditing" label="所属计划">
        <NSelect v-model:value="projectId" :options="projectOptions" clearable />
      </NFormItem>

      <NFormItem v-if="isEditing && moveOptions.length" label="移动到">
        <NSelect
          :value="projectId"
          :options="moveOptions"
          placeholder="选择目标计划"
          @update:value="moveTo"
        />
      </NFormItem>

      <NFormItem label="置顶显示">
        <NSwitch v-model:value="pinned" />
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="close">取消</NButton>
        <NButton type="primary" :disabled="!title.trim()" @click="save">
          {{ item?.id ? '保存' : '创建' }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>
