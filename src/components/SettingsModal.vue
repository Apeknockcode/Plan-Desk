<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { NButton, NModal, NSelect, NSpace, NText, useMessage } from 'naive-ui'
import AppIcon from '@/ui/AppIcon.vue'
import SettingToggleRow from '@/components/SettingToggleRow.vue'
import ShortcutEditorRow from '@/components/ShortcutEditorRow.vue'
import { setThemePreference } from '@/composables/useThemePreference'
import {
  findDuplicateShortcut,
  resolveShortcuts,
  SHORTCUT_DEFINITIONS
} from '@/lib/shortcuts'
import { usePlanStore } from '@/lib/store'
import PlanDeskLogo from '@/components/PlanDeskLogo.vue'
import { Close, Download, FolderOpen, Setting, Upload } from '@/ui/icons'
import type { Project, ShortcutActionId, ThemePreference } from '@/lib/types'

const props = defineProps<{
  show: boolean
  projects: Project[]
}>()

const emit = defineEmits<{ 'update:show': [value: boolean]; imported: [] }>()

type SettingsTab = 'general' | 'appearance' | 'shortcuts' | 'data'

const message = useMessage()
const { load, savePrefs, store } = usePlanStore()

const activeTab = ref<SettingsTab>('general')
const launchAtLogin = ref(false)
const menuBarEnabled = ref(true)
const hideDockIcon = ref(false)
const theme = ref<ThemePreference>('system')
const defaultPlanId = ref<string | null>(null)
const dataDir = ref('')
const busy = ref(false)
const isMac = window.planDesk.platform === 'darwin'

const navItems: { key: SettingsTab; label: string; desc: string }[] = [
  { key: 'general', label: '通用', desc: '计划与启动' },
  { key: 'appearance', label: '外观', desc: '深浅模式' },
  { key: 'shortcuts', label: '快捷键', desc: '键盘操作' },
  { key: 'data', label: '数据', desc: '备份恢复' }
]

const themeOptions = computed(() => {
  const systemHint = isMac ? '随 macOS 切换' : '随 Windows 切换'
  return [
    { value: 'light' as ThemePreference, label: '浅色', hint: '明亮清爽', mock: 'light' },
    { value: 'dark' as ThemePreference, label: '深色', hint: '夜间护眼', mock: 'dark' },
    { value: 'system' as ThemePreference, label: '跟随系统', hint: systemHint, mock: 'system' }
  ]
})

const launchAtLoginHint = computed(() =>
  isMac ? '登录 macOS 后自动启动 PlanDesk' : '登录 Windows 后自动启动 PlanDesk'
)

const planOptions = computed(() =>
  props.projects.map((project) => ({ label: project.name, value: project.id }))
)

const activeNav = computed(() => navItems.find((item) => item.key === activeTab.value))

const recordingShortcutId = ref<ShortcutActionId | null>(null)

const resolvedShortcuts = computed(() =>
  resolveShortcuts(store.value.prefs.shortcuts, isMac)
)

const globalShortcutDefs = computed(() =>
  SHORTCUT_DEFINITIONS.filter((def) => def.scope === 'global')
)

const appShortcutDefs = computed(() =>
  SHORTCUT_DEFINITIONS.filter((def) => def.scope === 'app')
)

async function refresh() {
  await load()
  const prefs = store.value.prefs
  launchAtLogin.value = await window.planDesk.getLaunchAtLogin()
  dataDir.value = await window.planDesk.getDataDirectory()
  theme.value = prefs.theme ?? 'system'
  defaultPlanId.value = prefs.defaultPlanId
  if (isMac) {
    menuBarEnabled.value = await window.planDesk.getMenuBarEnabled()
    hideDockIcon.value = await window.planDesk.getHideDockIcon()
  }
}

watch(
  () => props.show,
  (visible) => {
    if (visible) {
      activeTab.value = 'general'
      void refresh()
    } else {
      recordingShortcutId.value = null
    }
  }
)

onMounted(() => {
  if (props.show) void refresh()
})

function close() {
  emit('update:show', false)
}

async function exportData() {
  busy.value = true
  try {
    const result = await window.planDesk.exportStoreDialog()
    if (result.ok) message.success('已导出数据')
  } finally {
    busy.value = false
  }
}

async function importData() {
  busy.value = true
  try {
    const result = await window.planDesk.importStoreDialog()
    if (!result.ok) return
    await load()
    emit('imported')
    message.success('已导入数据，原文件已备份为 store.json.bak')
    await refresh()
  } catch (err) {
    console.error(err)
    message.error('导入失败')
  } finally {
    busy.value = false
  }
}

async function openDataDir() {
  await window.planDesk.openDataDirectory()
}

async function onLaunchAtLoginChange(value: boolean) {
  launchAtLogin.value = value
  await window.planDesk.setLaunchAtLogin(value)
  await savePrefs({ launchAtLogin: value })
}

async function onMenuBarEnabledChange(value: boolean) {
  menuBarEnabled.value = value
  if (!value) hideDockIcon.value = false
  await window.planDesk.setMenuBarEnabled(value)
  await savePrefs({
    menuBarEnabled: value,
    hideDockIcon: value ? hideDockIcon.value : false
  })
}

async function onHideDockIconChange(value: boolean) {
  hideDockIcon.value = value
  if (value) menuBarEnabled.value = true
  await window.planDesk.setHideDockIcon(value)
  await savePrefs({ hideDockIcon: value, menuBarEnabled: true })
}

async function onThemeChange(value: ThemePreference) {
  theme.value = value
  setThemePreference(value)
  await savePrefs({ theme: value })
}

async function onDefaultPlanChange(value: string | null) {
  defaultPlanId.value = value
  await savePrefs({ defaultPlanId: value })
}

function startRecordShortcut(id: ShortcutActionId) {
  recordingShortcutId.value = id
}

function cancelRecordShortcut() {
  recordingShortcutId.value = null
}

async function persistShortcutOverrides(overrides: Partial<Record<ShortcutActionId, string>>) {
  await savePrefs({ shortcuts: overrides })
  await load()
  await window.planDesk.syncGlobalShortcuts?.()
}

async function onShortcutSave(id: ShortcutActionId, accelerator: string) {
  recordingShortcutId.value = null
  const current = { ...(store.value.prefs.shortcuts ?? {}) }
  const nextResolved = resolveShortcuts({ ...current, [id]: accelerator }, isMac)
  const duplicate = findDuplicateShortcut(nextResolved, id, accelerator)
  if (duplicate) {
    const dupLabel = SHORTCUT_DEFINITIONS.find((def) => def.id === duplicate)?.label ?? duplicate
    message.warning(`与「${dupLabel}」冲突，请换一个组合`)
    return
  }

  current[id] = accelerator
  await persistShortcutOverrides(current)
  message.success('快捷键已更新')
}

async function resetShortcut(id: ShortcutActionId) {
  const current = { ...(store.value.prefs.shortcuts ?? {}) }
  delete current[id]
  await persistShortcutOverrides(current)
  message.success('已恢复默认')
}

async function resetAllShortcuts() {
  recordingShortcutId.value = null
  await persistShortcutOverrides({})
  message.success('已全部恢复默认')
}
</script>

<template>
  <NModal
    :show="show"
    :mask-closable="!recordingShortcutId"
    :block-scroll="true"
    display-directive="if"
    transform-origin="center"
    class="settings-modal-root"
    @update:show="emit('update:show', $event)"
  >
    <div class="settings-shell">
      <header class="settings-header">
        <div class="settings-header__brand">
          <span class="settings-header__icon">
            <AppIcon :icon="Setting" :size="18" />
          </span>
          <div>
            <h2 class="settings-header__title">设置</h2>
            <p v-if="activeNav" class="settings-header__subtitle">{{ activeNav.desc }}</p>
          </div>
        </div>
        <button type="button" class="settings-close no-drag" title="关闭" @click="close">
          <AppIcon :icon="Close" :size="16" />
        </button>
      </header>

      <div class="settings-body">
        <nav class="settings-nav">
          <button
            v-for="item in navItems"
            :key="item.key"
            type="button"
            class="settings-nav__item"
            :class="{ 'settings-nav__item--active': activeTab === item.key }"
            @click="activeTab = item.key"
          >
            <span class="settings-nav__label">{{ item.label }}</span>
            <span class="settings-nav__desc">{{ item.desc }}</span>
          </button>
        </nav>

        <div class="settings-content">
          <!-- 通用 -->
          <div v-if="activeTab === 'general'" class="settings-pane">
            <section class="settings-section">
              <h3 class="settings-section__title">默认计划</h3>
              <p class="settings-section__desc">
                启动时优先选中该计划；全局快速添加也会默认写入此计划。
              </p>
              <NSelect
                :value="defaultPlanId"
                :options="planOptions"
                clearable
                placeholder="未设置（使用第一个计划）"
                @update:value="onDefaultPlanChange"
              />
            </section>

            <section class="settings-section">
              <h3 class="settings-section__title">启动</h3>
              <div class="settings-stack">
                <SettingToggleRow
                  label="开机自启"
                  :hint="launchAtLoginHint"
                  :value="launchAtLogin"
                  @update:value="onLaunchAtLoginChange"
                />
              </div>
            </section>

            <section v-if="isMac" class="settings-section">
              <h3 class="settings-section__title">菜单栏</h3>
              <div class="settings-stack">
                <SettingToggleRow
                  label="显示菜单栏图标"
                  :value="menuBarEnabled"
                  @update:value="onMenuBarEnabledChange"
                />
                <SettingToggleRow
                  label="仅保留菜单栏"
                  hint="隐藏 Dock 图标，从顶部菜单栏访问"
                  :value="hideDockIcon"
                  :disabled="!menuBarEnabled"
                  @update:value="onHideDockIconChange"
                />
              </div>
            </section>
          </div>

          <!-- 外观 -->
          <div v-else-if="activeTab === 'appearance'" class="settings-pane">
            <section class="settings-section">
              <h3 class="settings-section__title">外观模式</h3>
              <p class="settings-section__desc">
                PlanDesk 使用固定中性配色，只切换深浅模式，避免花哨主题色干扰阅读。
              </p>
              <div class="theme-cards">
                <button
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  type="button"
                  class="theme-card"
                  :class="{ 'theme-card--active': theme === opt.value }"
                  @click="onThemeChange(opt.value)"
                >
                  <span
                    class="theme-mock"
                    :class="`theme-mock--${opt.mock}`"
                    aria-hidden="true"
                  >
                    <span class="theme-mock__sider" />
                    <span class="theme-mock__main" />
                  </span>
                  <span class="theme-card__label">{{ opt.label }}</span>
                  <span class="theme-card__hint">{{ opt.hint }}</span>
                </button>
              </div>
            </section>
          </div>

          <!-- 快捷键 -->
          <div v-else-if="activeTab === 'shortcuts'" class="settings-pane settings-pane--scroll">
            <p class="settings-section__desc settings-section__desc--top">
              点击「更改」后按下新组合键；全局快捷键在后台也可触发。
            </p>

            <section class="settings-section">
              <h3 class="settings-section__title">全局</h3>
              <div class="shortcut-list">
                <ShortcutEditorRow
                  v-for="def in globalShortcutDefs"
                  :key="def.id"
                  :label="def.label"
                  :accelerator="resolvedShortcuts[def.id]"
                  :recording="recordingShortcutId === def.id"
                  :is-mac="isMac"
                  @start-record="startRecordShortcut(def.id)"
                  @cancel-record="cancelRecordShortcut"
                  @save="onShortcutSave(def.id, $event)"
                  @reset="resetShortcut(def.id)"
                />
              </div>
            </section>

            <section class="settings-section">
              <h3 class="settings-section__title">主窗口</h3>
              <div class="shortcut-list">
                <ShortcutEditorRow
                  v-for="def in appShortcutDefs"
                  :key="def.id"
                  :label="def.label"
                  :accelerator="resolvedShortcuts[def.id]"
                  :recording="recordingShortcutId === def.id"
                  :is-mac="isMac"
                  @start-record="startRecordShortcut(def.id)"
                  @cancel-record="cancelRecordShortcut"
                  @save="onShortcutSave(def.id, $event)"
                  @reset="resetShortcut(def.id)"
                />
              </div>
            </section>

            <div class="settings-pane__footer">
              <NButton size="small" quaternary @click="resetAllShortcuts">全部恢复默认</NButton>
            </div>
          </div>

          <!-- 数据 -->
          <div v-else class="settings-pane">
            <section class="settings-section">
              <h3 class="settings-section__title">备份与恢复</h3>
              <p class="settings-section__desc">数据保存在本地 JSON，可随时导出备份或迁移到其他设备。</p>

              <div class="data-grid">
                <button type="button" class="data-tile" :disabled="busy" @click="exportData">
                  <span class="data-tile__icon"><AppIcon :icon="Download" :size="20" /></span>
                  <span class="data-tile__label">导出 JSON</span>
                  <span class="data-tile__hint">保存完整备份文件</span>
                </button>
                <button type="button" class="data-tile" :disabled="busy" @click="importData">
                  <span class="data-tile__icon"><AppIcon :icon="Upload" :size="20" /></span>
                  <span class="data-tile__label">导入 JSON</span>
                  <span class="data-tile__hint">自动备份当前数据</span>
                </button>
                <button type="button" class="data-tile data-tile--wide" @click="openDataDir">
                  <span class="data-tile__icon"><AppIcon :icon="FolderOpen" :size="20" /></span>
                  <span class="data-tile__label">打开数据目录</span>
                  <span v-if="dataDir" class="data-tile__path">{{ dataDir }}</span>
                  <span v-else class="data-tile__hint">查看 store.json 位置</span>
                </button>
              </div>
            </section>

            <section class="settings-section settings-section--muted">
              <div class="about-row">
                <span class="about-row__icon"><PlanDeskLogo :size="28" /></span>
                <div>
                  <div class="about-row__name">PlanDesk</div>
                  <NText depth="3" class="about-row__ver">桌面计划本 · 本地数据</NText>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.settings-modal-root :deep(.n-modal-mask) {
  background-color: rgba(0, 0, 0, 0.55) !important;
}

.settings-modal-root :deep(.n-modal-body-wrapper) {
  padding: 0;
}

.settings-modal-root :deep(.n-modal-body) {
  padding: 0;
  background: #1c1a18;
  box-shadow: none;
}

html[data-theme='light'] .settings-modal-root :deep(.n-modal-body) {
  background: #ffffff;
}

.settings-shell {
  width: 640px;
  max-width: calc(100vw - 32px);
  max-height: min(520px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: #1c1a18;
  border: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.08));
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.35),
    0 0 0 1px var(--pd-accent-soft);
}

html[data-theme='light'] .settings-shell {
  background: #ffffff;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.12),
    0 0 0 1px rgba(0, 0, 0, 0.06);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.08));
}

.settings-header__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.settings-header__icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  background: var(--pd-accent-soft);
  color: var(--pd-accent);
}

.settings-header__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.2px;
}

.settings-header__subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  opacity: 0.55;
}

.settings-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  opacity: 0.65;
  cursor: pointer;
  transition: background 0.12s, opacity 0.12s;
}

.settings-close:hover {
  opacity: 1;
  background: var(--pd-hover-bg, rgba(255, 255, 255, 0.06));
}

.settings-body {
  display: flex;
  min-height: 360px;
  max-height: min(440px, calc(100vh - 120px));
}

.settings-nav {
  width: 148px;
  flex-shrink: 0;
  padding: 12px 10px;
  border-right: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.08));
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-nav__item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.12s;
}

.settings-nav__item:hover {
  background: var(--pd-hover-bg, rgba(255, 255, 255, 0.05));
}

.settings-nav__item--active {
  background: var(--pd-accent-soft);
}

.settings-nav__item--active .settings-nav__label {
  color: var(--pd-accent-text);
  font-weight: 600;
}

.settings-nav__label {
  font-size: 13px;
  font-weight: 500;
}

.settings-nav__desc {
  font-size: 10px;
  opacity: 0.45;
  line-height: 1.3;
}

.settings-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.settings-pane {
  height: 100%;
  padding: 18px 20px 20px;
  overflow-y: auto;
}

.settings-pane--scroll {
  padding-bottom: 12px;
}

.settings-pane__footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.settings-section + .settings-section {
  margin-top: 22px;
}

.settings-section__title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 600;
}

.settings-section__desc {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
  opacity: 0.58;
}

.settings-section__desc--top {
  margin-top: 0;
}

.settings-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.theme-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.theme-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 10px 8px 12px;
  border: 2px solid var(--pd-panel-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  background: var(--pd-hover-bg, rgba(255, 255, 255, 0.03));
  cursor: pointer;
  transition: border-color 0.12s, box-shadow 0.12s;
}

.theme-card:hover {
  border-color: var(--pd-accent-border);
}

.theme-card--active {
  border-color: var(--pd-body-fg);
  box-shadow: 0 0 0 1px var(--pd-focus-ring, rgba(0, 0, 0, 0.15));
}

.theme-mock {
  display: flex;
  width: 100%;
  height: 52px;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.theme-mock__sider {
  width: 28%;
  height: 100%;
}

.theme-mock__main {
  flex: 1;
  height: 100%;
}

.theme-mock--light .theme-mock__sider {
  background: #f2f2f7;
}

.theme-mock--light .theme-mock__main {
  background: #ffffff;
}

.theme-mock--dark .theme-mock__sider {
  background: #1c1c1e;
}

.theme-mock--dark .theme-mock__main {
  background: #000000;
}

.theme-mock--system .theme-mock__sider {
  background: linear-gradient(180deg, #1c1c1e 50%, #f2f2f7 50%);
}

.theme-mock--system .theme-mock__main {
  background: linear-gradient(180deg, #000000 50%, #ffffff 50%);
}

.theme-card__label {
  font-size: 13px;
  font-weight: 600;
}

.theme-card__hint {
  font-size: 11px;
  color: var(--pd-muted-fg);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.data-tile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 14px;
  border: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.08));
  border-radius: 12px;
  background: var(--pd-hover-bg, rgba(255, 255, 255, 0.03));
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.12s, background 0.12s;
}

.data-tile:hover:not(:disabled) {
  border-color: var(--pd-accent-border);
  background: var(--pd-accent-soft);
}

.data-tile:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.data-tile--wide {
  grid-column: 1 / -1;
}

.data-tile__icon {
  display: flex;
  color: var(--pd-accent);
  margin-bottom: 2px;
}

.data-tile__label {
  font-size: 13px;
  font-weight: 600;
}

.data-tile__hint,
.data-tile__path {
  font-size: 11px;
  opacity: 0.55;
  line-height: 1.4;
  word-break: break-all;
}

.settings-section--muted {
  padding-top: 16px;
  border-top: 1px solid var(--pd-panel-border, rgba(255, 255, 255, 0.08));
}

.about-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.about-row__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.about-row__name {
  font-size: 13px;
  font-weight: 600;
}

.about-row__ver {
  font-size: 11px;
}
</style>
