<script setup lang="ts">
import { computed, h, ref } from 'vue'
import type { MenuGroupOption, MenuOption } from 'naive-ui'
import { NBadge, NButton, NDropdown, NEmpty, NLayoutSider, NMenu, NText } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import PlanDeskLogo from '@/components/PlanDeskLogo.vue'
import {
  Calendar,
  CheckOne,
  MoreOne,
  Plus,
  Setting,
  Time,
  renderMenuIcon
} from '@/ui/icons'
import { CALENDAR_MENU_KEY, isCalendarMenuKey } from '@/lib/menuKeys'
import { getStageMembers, isPetWidget } from '@/lib/widgetStage'
import type { AppStore } from '@/lib/types'

const props = defineProps<{
  store: AppStore
  selectedMenuKey: string | null
  expandedKeys: string[]
}>()

const emit = defineEmits<{
  'update:selectedMenuKey': [value: string | null]
  'update:expandedKeys': [value: string[]]
  openPlanForm: []
  openWidgetForm: []
  openSettings: []
  planContextSelect: [key: string, planId: string]
}>()

const planContextShow = ref(false)
const planContextX = ref(0)
const planContextY = ref(0)
const planContextPlanId = ref<string | null>(null)

function renderPlanDot(color: string) {
  return () =>
    h('span', {
      class: 'plan-menu-dot',
      style: { '--plan-dot-color': color }
    })
}

function getPlanMenuOptions(planId: string) {
  const doneCount = props.store.items.filter(
    (i) => i.projectId === planId && i.completed
  ).length

  return [
    { label: '编辑计划', key: 'rename' },
    { label: '笔记关联…', key: 'plan-notes' },
    { label: '清空已完成', key: 'clear-completed', disabled: doneCount === 0 },
    { type: 'divider', key: 'd1' },
    { label: '删除计划', key: 'delete' }
  ]
}

const menuOptions = computed<MenuOption[]>(() =>
  props.store.projects.map((plan) => {
    const planItems = props.store.items.filter((i) => i.projectId === plan.id)
    const activeCount = planItems.filter((i) => !i.completed).length
    const doneCount = planItems.filter((i) => i.completed).length

    return {
      label: plan.name,
      key: plan.id,
      icon: renderPlanDot(plan.color),
      extra: () =>
        h(
          NDropdown,
          {
            trigger: 'click',
            options: getPlanMenuOptions(plan.id),
            onSelect: (key: string) => emit('planContextSelect', key, plan.id)
          },
          {
            default: () =>
              h(
                NButton,
                {
                  quaternary: true,
                  size: 'tiny',
                  circle: true,
                  class: 'plan-more-btn',
                  onClick: (e: MouseEvent) => e.stopPropagation()
                },
                {
                  icon: () => h(AppIcon, { icon: MoreOne, size: 16 })
                }
              )
          }
        ),
      children: [
        {
          label: '进行中',
          key: `${plan.id}:active`,
          icon: renderMenuIcon(Time, 14),
          extra:
            activeCount > 0
              ? () =>
                  h(NBadge, {
                    value: activeCount,
                    bordered: false,
                    color: '#AEAEB2',
                    style: { color: '#fff', fontSize: '11px' }
                  })
              : undefined
        },
        {
          label: '已完成',
          key: `${plan.id}:completed`,
          icon: renderMenuIcon(CheckOne, 14),
          extra:
            doneCount > 0
              ? () =>
                  h(NBadge, {
                    value: doneCount,
                    bordered: false,
                    color: '#C7C7CC',
                    style: { color: '#fff', fontSize: '11px' }
                  })
              : undefined
        }
      ]
    }
  })
)

const planContextOptions = computed(() => {
  const planId = planContextPlanId.value
  if (!planId) return []
  return getPlanMenuOptions(planId)
})

const widgetSummary = computed(() => {
  const widgets = props.store.widgets
  let listCount = 0
  let petCount = 0
  const stage = widgets.find((w) => w.displayMode === 'pet-stage')
  if (stage) {
    petCount = getStageMembers(stage).length
  }
  for (const w of widgets) {
    if (w.displayMode === 'list') listCount++
    else if (w.displayMode === 'pet') petCount++
  }
  return { listCount, petCount, total: listCount + petCount }
})

const desktopWidgetPlans = computed(() => {
  const names = new Set<string>()
  for (const w of props.store.widgets) {
    if (w.displayMode === 'list' && w.projectId) {
      const plan = props.store.projects.find((p) => p.id === w.projectId)
      if (plan) names.add(plan.name)
    }
    if (isPetWidget(w.displayMode)) {
      for (const m of getStageMembers(w)) {
        const plan = props.store.projects.find((p) => p.id === m.projectId)
        if (plan) names.add(plan.name)
      }
    }
  }
  return [...names]
})

function menuNodeProps(node: MenuOption | MenuGroupOption) {
  const key = String(node.key ?? '')
  const isPlan = props.store.projects.some((p) => p.id === key)
  if (!isPlan) return {}

  return {
    onContextmenu: (e: MouseEvent) => openPlanContextMenu(e, key)
  }
}

function openPlanContextMenu(e: MouseEvent, planId: string) {
  e.preventDefault()
  e.stopPropagation()
  planContextPlanId.value = planId
  planContextX.value = e.clientX
  planContextY.value = e.clientY
  planContextShow.value = true
}

function handlePlanContextSelect(key: string) {
  planContextShow.value = false
  const planId = planContextPlanId.value
  if (!planId) return
  emit('planContextSelect', key, planId)
}

const planMenuValue = computed(() =>
  isCalendarMenuKey(props.selectedMenuKey) ? null : props.selectedMenuKey
)

function onMenuUpdate(key: string) {
  if (key.includes(':')) {
    emit('update:selectedMenuKey', key)
  } else {
    emit('update:selectedMenuKey', `${key}:active`)
  }
}

function openCalendar() {
  emit('update:selectedMenuKey', CALENDAR_MENU_KEY)
}
</script>

<template>
  <NLayoutSider
    bordered
    :width="228"
    :native-scrollbar="false"
    class="sider"
    content-style="display:flex;flex-direction:column;height:100%"
  >
    <div class="titlebar-safe drag-region" data-tauri-drag-region />

    <div class="sider-brand no-drag">
      <span class="brand-mark">
        <PlanDeskLogo :size="34" />
      </span>
      <div class="brand-text">
        <div class="brand-name">PlanDesk</div>
        <NText depth="3" class="brand-sub">桌面计划本</NText>
      </div>
    </div>

    <div class="sider-add no-drag">
      <NButton block type="primary" size="small" class="sider-add-btn" @click="emit('openPlanForm')">
        <template #icon><AppIcon :icon="Plus" :size="16" /></template>
        新建计划
      </NButton>
    </div>

    <div class="sider-calendar no-drag">
      <NButton
        block
        quaternary
        size="small"
        class="sider-calendar-btn"
        :class="{ 'sider-calendar-btn--active': isCalendarMenuKey(selectedMenuKey) }"
        @click="openCalendar"
      >
        <template #icon><AppIcon :icon="Calendar" :size="16" /></template>
        日历
      </NButton>
    </div>

    <NMenu
      v-if="menuOptions.length"
      :value="planMenuValue"
      :expanded-keys="expandedKeys"
      class="sider-menu no-drag"
      :options="menuOptions"
      :node-props="menuNodeProps"
      :indent="16"
      @update:value="onMenuUpdate"
      @update:expanded-keys="emit('update:expandedKeys', $event)"
    />

    <NEmpty v-else class="sider-empty no-drag" description="还没有计划" size="small" />

    <div class="sider-desktop no-drag">
      <div class="desktop-strip">
        <div class="desktop-strip__head">
          <span class="desktop-strip__title">桌面组件</span>
          <span v-if="widgetSummary.total" class="desktop-strip__count">{{ widgetSummary.total }}</span>
        </div>
        <p v-if="widgetSummary.total" class="desktop-strip__meta">
          <template v-if="widgetSummary.petCount">{{ widgetSummary.petCount }} 桌宠</template>
          <template v-if="widgetSummary.petCount && widgetSummary.listCount"> · </template>
          <template v-if="widgetSummary.listCount">{{ widgetSummary.listCount }} 列表</template>
        </p>
        <p v-else class="desktop-strip__meta desktop-strip__meta--empty">
          把计划钉到桌面，随时查看
        </p>
        <p v-if="desktopWidgetPlans.length" class="desktop-strip__plans">
          {{ desktopWidgetPlans.join('、') }}
        </p>
        <NButton
          block
          size="tiny"
          quaternary
          class="desktop-strip__btn"
          @click="emit('openWidgetForm')"
        >
          {{ widgetSummary.total ? '管理桌面组件' : '新建桌面组件' }}
        </NButton>
      </div>
    </div>

    <div class="sider-footer no-drag">
      <NButton block quaternary size="small" @click="emit('openSettings')">
        <template #icon><AppIcon :icon="Setting" :size="16" /></template>
        设置
      </NButton>
    </div>

    <div class="sider-spacer drag-region" data-tauri-drag-region />
  </NLayoutSider>

  <NDropdown
    trigger="manual"
    placement="bottom-start"
    :show="planContextShow"
    :x="planContextX"
    :y="planContextY"
    :options="planContextOptions"
    @clickoutside="planContextShow = false"
    @select="handlePlanContextSelect"
  />
</template>

<style scoped>
.sider {
  background: var(--pd-sider-bg) !important;
  border-right-color: var(--pd-sider-border) !important;
  color: var(--pd-sider-fg);
}

.sider-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 18px 18px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.brand-sub {
  font-size: 11px;
  line-height: 1.3;
  color: var(--pd-sider-muted) !important;
}

.brand-mark {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.sider-add {
  padding: 0 14px 10px;
}

.sider-calendar {
  padding: 0 14px 12px;
}

.sider-calendar-btn {
  justify-content: flex-start;
  font-weight: 500;
}

.sider-calendar-btn--active {
  background: var(--pd-menu-active-bg) !important;
  font-weight: 600;
}

.sider-add-btn {
  font-weight: 600;
}

.sider-add :deep(.n-button) {
  background: var(--pd-sider-btn-bg) !important;
  color: var(--pd-sider-btn-fg) !important;
  border: none !important;
  box-shadow: none !important;
}

.sider-add :deep(.n-button:hover) {
  filter: brightness(1.06);
}

.sider-menu {
  flex: 1;
  overflow: auto;
  padding: 0 6px;
}

:deep(.plan-menu-dot) {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--plan-dot-color, #e8a838);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--plan-dot-color, #e8a838) 22%, transparent);
  flex-shrink: 0;
}

:deep(.plan-more-btn) {
  opacity: 0;
  transition: opacity 0.12s;
}

:deep(.n-menu-item:hover .plan-more-btn) {
  opacity: 1;
}

:deep(.n-menu .n-menu-item-content) {
  border-radius: 8px;
}

:deep(.n-menu-item-content-header) {
  color: var(--pd-sider-fg) !important;
}

:deep(.n-menu-item-content-header .n-menu-item-content-header__extra) {
  color: inherit;
}

:deep(.n-menu-item-content:hover) {
  background: var(--pd-menu-hover-bg) !important;
}

:deep(.n-menu-item-content--selected) {
  background: var(--pd-menu-active-bg) !important;
}

:deep(.n-menu-item-content--selected .n-menu-item-content-header) {
  font-weight: 600;
  color: var(--pd-sider-fg) !important;
}

:deep(.n-menu-item-content--selected .n-menu-item-content__icon) {
  color: var(--pd-sider-fg) !important;
}

.sider-empty {
  padding: 24px 12px;
  flex: 1;
}

.sider-desktop {
  padding: 0 14px 10px;
}

.desktop-strip {
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--pd-strip-bg);
  border: 1px solid var(--pd-strip-border);
}

.desktop-strip__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.desktop-strip__title {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--pd-muted-fg);
}

.desktop-strip__count {
  font-size: 11px;
  font-weight: 700;
  color: var(--pd-sider-fg);
  background: var(--pd-hover-bg);
  padding: 1px 7px;
  border-radius: 999px;
}

.desktop-strip__meta {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.45;
  color: var(--pd-muted-fg);
}

.desktop-strip__meta--empty {
  font-size: 11px;
}

.desktop-strip__plans {
  margin: 4px 0 0;
  font-size: 11px;
  line-height: 1.4;
  color: var(--pd-muted-fg);
  opacity: 0.85;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.desktop-strip__btn {
  margin-top: 8px;
  font-size: 12px;
}

.sider-footer {
  padding: 0 14px 8px;
}

.sider-spacer {
  flex-shrink: 0;
  height: 12px;
}
</style>
