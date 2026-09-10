import { createApp, h } from 'vue'
import QuickAddApp from './QuickAddApp.vue'
import AppProvider from './ui/AppProvider.vue'
import { initPlanDeskBridge } from './lib/planDeskBridge'
import '@icon-park/vue-next/styles/index.css'
import './styles/main.css'

if (navigator.platform.toLowerCase().includes('mac')) {
  document.documentElement.classList.add('platform-mac')
}

async function bootstrap() {
  await initPlanDeskBridge('quick-add')
  createApp({
    render: () => h(AppProvider, null, { default: () => h(QuickAddApp) })
  }).mount('#app')
}

void bootstrap()
