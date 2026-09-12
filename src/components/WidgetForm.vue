<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  NAlert,
  NButton,
  NForm,
  NFormItem,
  NModal,
  NSelect,
  NSpace,
  NText,
  useMessage
} from 'naive-ui'
import PetdexPicker from '@/components/widget/PetdexPicker.vue'
import { usePlanStore } from '@/lib/store'
import { DEFAULT_PETDEX_SLUG } from '@/lib/petdex/client'
import { defaultWidgetSize } from '@/lib/widgetLayout'
import { getStageMembers } from '@/lib/widgetStage'
import type { Project, WidgetConfig } from '@/lib/types'

const props = defineProps<{
  show: boolean
  projects: Project[]
  widgets: WidgetConfig[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  created: []
}>()

const { addWidget, load } = usePlanStore()
const message = useMessage()

const isMac = window.planDesk.platform === 'darwin'

const projectId = ref<string | undefined>()
const petdexSlug = ref(DEFAULT_PETDEX_SLUG)

const usedProjectIds = computed(() => {
  const ids = new Set<string>()
  for (const widget of props.widgets) {
    for (const member of getStageMembers(widget)) {
      ids.add(member.projectId)
    }
  }
  return ids
})

const projectOptions = computed(() =>
  props.projects.map((p) => ({
    label: usedProjectIds.value.has(p.id) ? `${p.name}（已有组件）` : p.name,
    value: p.id,
    disabled: usedProjectIds.value.has(p.id)
  }))
)

const availableProjects = computed(() =>
  props.projects.filter((p) => !usedProjectIds.value.has(p.id))
)

const allPlansHaveWidget = computed(
  () => props.projects.length > 0 && availableProjects.value.length === 0
)

const selectedPlan = computed(() =>
  props.projects.find((p) => p.id === projectId.value)
)

const createLabel = computed(() =>
  selectedPlan.value ? `添加「${selectedPlan.value.name}」到桌面` : '添加到桌面'
)

watch(
  () => props.show,
  async (visible) => {
    if (!visible) return
    await load()
    petdexSlug.value = DEFAULT_PETDEX_SLUG
    const first = availableProjects.value[0]
    projectId.value = first?.id
  }
)

function defaultPlacement() {
  const { width, height } = defaultWidgetSize('pet-stage', false, 1)
  const margin = 24
  const top = isMac ? 48 : margin
  const x = Math.max(margin, window.screen.availWidth - width - margin)
  const y = top
  return { x, y, width, height }
}

function close() {
  emit('update:show', false)
}

async function create() {
  if (!projectId.value) return

  if (usedProjectIds.value.has(projectId.value)) {
    await window.planDesk.focusWidgetByProject?.(projectId.value)
    message.info('该计划已有桌面组件，已为你聚焦')
    close()
    return
  }

  const { x, y, width, height } = defaultPlacement()
  const plan = props.projects.find((p) => p.id === projectId.value)

  const config: Omit<WidgetConfig, 'id'> = {
    title: plan?.name || '计划组件',
    filter: 'project',
    projectId: projectId.value,
    displayMode: 'pet-stage',
    petdexSlug: petdexSlug.value,
    x,
    y,
    width,
    height
  }

  try {
    const { created } = await addWidget(config)
    if (created) {
      message.success('已添加到桌面')
      emit('created')
      close()
    } else {
      message.info('该计划已有桌面组件，已为你聚焦')
      close()
    }
  } catch (error) {
    console.error('create widget failed', error)
    message.error('创建桌面组件失败，请重试')
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    class="widget-form-modal"
    style="width: 440px"
    :bordered="false"
    :segmented="{ footer: 'soft' }"
    @update:show="emit('update:show', $event)"
  >
    <template #header>
      <div class="widget-form-modal__header">
        <span class="widget-form-modal__title">添加桌面组件</span>
        <NText depth="3" class="widget-form-modal__subtitle">
          点击桌宠可展开待办，每个计划仅一个组件
        </NText>
      </div>
    </template>

    <NAlert v-if="allPlansHaveWidget" type="info" :bordered="false" class="widget-form-modal__alert">
      所有计划都已有桌面组件，请先关闭现有组件再添加。
    </NAlert>

    <NForm label-placement="top" size="small" class="widget-form-modal__form">
      <NFormItem label="绑定计划" :show-feedback="false">
        <NSelect
          v-model:value="projectId"
          :options="projectOptions"
          placeholder="选择要显示在桌面的计划"
          :disabled="allPlansHaveWidget"
        />
        <NAlert v-if="!projects.length" type="warning" :bordered="false" style="margin-top: 8px">
          请先创建计划
        </NAlert>
      </NFormItem>

      <div class="widget-form-modal__pet-panel">
        <div class="widget-form-modal__pet-panel-head">
          <NText depth="2" class="widget-form-modal__pet-label">桌面伙伴</NText>
          <NText depth="3" class="widget-form-modal__pet-hint">内置 5 款 · 可搜索更多</NText>
        </div>
        <PetdexPicker
          embedded
          :model-value="petdexSlug"
          :disabled="allPlansHaveWidget"
          @select="petdexSlug = $event"
        />
      </div>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton quaternary @click="close">取消</NButton>
        <NButton
          type="primary"
          :disabled="!projectId || allPlansHaveWidget"
          @click="create"
        >
          {{ createLabel }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.widget-form-modal__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.widget-form-modal__title {
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
}

.widget-form-modal__subtitle {
  font-size: 12px;
  line-height: 1.45;
}

.widget-form-modal__alert {
  margin-bottom: 12px;
}

.widget-form-modal__form :deep(.n-form-item-label) {
  font-size: 12px;
  font-weight: 600;
  padding-bottom: 4px;
}

.widget-form-modal__form :deep(.n-form-item) {
  margin-bottom: 14px;
}

.widget-form-modal__pet-panel {
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--n-border-color);
  background: color-mix(in srgb, var(--n-text-color-1) 3%, var(--n-color-modal));
}

.widget-form-modal__pet-panel-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.widget-form-modal__pet-label {
  font-size: 12px;
  font-weight: 600;
}

.widget-form-modal__pet-hint {
  font-size: 11px;
}
</style>
