import type {
  PlanDeskAPI,
  PlanDeskQuickAddAPI,
  PlanDeskWidgetAPI
} from './lib/planDeskBridge'

declare global {
  interface Window {
    planDesk: PlanDeskAPI & Partial<PlanDeskWidgetAPI & PlanDeskQuickAddAPI>
  }
}

export {}
