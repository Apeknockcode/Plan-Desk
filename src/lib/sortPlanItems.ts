import type { PlanItem } from './types'

export function sortPlanItems(items: PlanItem[], completed: boolean): PlanItem[] {
  return [...items]
    .filter((i) => i.completed === completed)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      const ao = a.sortOrder ?? a.createdAt
      const bo = b.sortOrder ?? b.createdAt
      if (ao !== bo) return ao - bo
      return b.updatedAt - a.updatedAt
    })
}
