<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NButton,
  NDatePicker,
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
  /** 新建时默认计划日期 */
  defaultDueDate?: string | null
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
const dueDate = ref<string | null>(null)
const links = ref<ItemLink[]>([])

const isEditing = computed(() => Boolean(props.item?.id))

const projectOptions = computed(() => [
  { label: '无', value: null as string | null },
  ...props.projects.map((p) => ({ label: p.name, value: p.id }))
])

const editPlanOptions = computed(() =>
  props.projects.map((p) => ({ label: p.name, value: p.id }))
)

const showPlanSelect = computed(
  () =>
    (isEditing.value && editPlanOptions.value.length > 1) ||
    (!props.planId && !isEditing.value)
)

watch(
  () => [props.item, props.planId, props.defaultDueDate] as const,
  ([item, planId, defaultDueDate]) => {
    if (item) {
      title.value = item.title
      notes.value = item.notes
      projectId.value = item.projectId
      pinned.value = item.pinned
      dueDate.value = item.dueDate?.slice(0, 10) ?? null
      links.value = [...(item.links ?? [])]
    } else {
      title.value = ''
      notes.value = ''
      projectId.value = planId ?? null
      pinned.value = false
      dueDate.value = defaultDueDate?.slice(0, 10) ?? null
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
    dueDate: dueDate.value,
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
        pinned: data.pinned,
        dueDate: data.dueDate
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
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="item?.id ? '编辑事项' : '新建事项'"
    class="item-form-modal"
    style="width: 440px"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="top" size="small" class="item-form" :show-feedback="false">
      <NFormItem label="标题">
        <NInput
          v-model:value="title"
          placeholder="要做什么？"
          autofocus
          @keydown.enter="save"
        />
      </NFormItem>

      <NFormItem label="备注">
        <NInput v-model:value="notes" type="textarea" placeholder="可选" :rows="2" />
      </NFormItem>

      <NFormItem label="关联文件 / 链接">
        <ItemLinksEditor v-model="links" />
      </NFormItem>

      <div class="item-form__meta">
        <NFormItem v-if="showPlanSelect" label="所属计划" class="item-form__meta-col">
          <NSelect
            v-model:value="projectId"
            :options="isEditing ? editPlanOptions : projectOptions"
            :clearable="!isEditing"
          />
        </NFormItem>
        <NFormItem label="计划日期" class="item-form__meta-col">
          <NDatePicker
            v-model:formatted-value="dueDate"
            type="date"
            clearable
            value-format="yyyy-MM-dd"
            style="width: 100%"
          />
        </NFormItem>
      </div>

      <NFormItem label="置顶" class="item-form__pin">
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

<style scoped>
.item-form :deep(.n-form-item) {
  margin-bottom: 14px;
}

.item-form :deep(.n-form-item:last-child) {
  margin-bottom: 0;
}

.item-form__meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.item-form__meta-col {
  margin-bottom: 0 !important;
  min-width: 0;
}

.item-form__meta:has(.item-form__meta-col:only-child) {
  grid-template-columns: 1fr;
}

.item-form__pin :deep(.n-form-item-blank) {
  min-height: auto;
}

.item-form__pin {
  margin-bottom: 0 !important;
}
</style>
