import type { PlanItem } from './types'

/** 本地日历日 `YYYY-MM-DD` */
export function toDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dateKeyFromParts(year: number, month: number, date: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  const out = new Date(y, m - 1, d)
  out.setHours(0, 0, 0, 0)
  return out
}

export function itemDueDateKey(item: PlanItem): string | null {
  if (!item.dueDate) return null
  return item.dueDate.slice(0, 10)
}

export function formatDateKeyLabel(key: string): string {
  const d = parseDateKey(key)
  const today = toDateKey(new Date())
  if (key === today) return '今天'
  const tomorrow = toDateKey(new Date(Date.now() + 86400000))
  if (key === tomorrow) return '明天'
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日 · 周${w}`
}

export function countActiveItemsByDueDate(items: PlanItem[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const item of items) {
    if (item.completed) continue
    const key = itemDueDateKey(item)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

export function itemsDueOnDate(items: PlanItem[], dateKey: string): PlanItem[] {
  return items.filter((item) => itemDueDateKey(item) === dateKey)
}
