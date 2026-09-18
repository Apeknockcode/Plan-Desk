import { createApp } from 'vue'
import WidgetApp from './WidgetApp.vue'
import { initPlanDeskBridge } from './lib/planDeskBridge'
import { installWebviewContextMenu } from './lib/webviewContextMenu'
import './styles/widget.css'

async function bootstrap() {
  await initPlanDeskBridge('widget')
  installWebviewContextMenu()
  const isMac = window.planDesk.platform === 'darwin'
  document.documentElement.classList.add('widget-page', isMac ? 'widget-mac' : 'widget-desktop')
  document.documentElement.style.background = 'transparent'
  document.body.style.background = 'transparent'

  const widgetId =
    window.planDesk.widgetId ?? (await window.planDesk.getWidgetId?.()) ?? null
  if (widgetId) {
    try {
      const store = await window.planDesk.loadStore()
      const config = store.widgets.find((w) => w.id === widgetId)
      if (config?.displayMode === 'pet' || config?.displayMode === 'pet-stage') {
        document.documentElement.classList.add('widget-pet-mode')
      }
    } catch {
      // ignore preload store errors during bootstrap
    }
  }

  createApp(WidgetApp).mount('#app')
}

void bootstrap()
