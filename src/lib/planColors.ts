/** 计划标识色 — 低饱和，仅用于侧栏小圆点 */
export const PLAN_COLOR_PALETTE = [
  '#6366F1',
  '#64748B',
  '#0EA5E9',
  '#10B981',
  '#8B5CF6',
  '#94A3B8',
  '#475569',
  '#334155'
] as const

const LEGACY_HARSH_PLAN_COLORS = new Set([
  '#e8a838',
  '#e87838',
  '#e87858',
  '#d89828',
  '#c48420',
  '#b87818',
  '#d85668',
  '#d85878'
])

export function pickPlanColor(projects: { color: string }[]): string {
  const used = new Set(projects.map((p) => p.color.toLowerCase()))
  const next = PLAN_COLOR_PALETTE.find((c) => !used.has(c.toLowerCase()))
  if (next) return next
  return PLAN_COLOR_PALETTE[projects.length % PLAN_COLOR_PALETTE.length]
}

/** 将旧版默认暖色计划色替换为新版低饱和色板 */
export function softenLegacyPlanColor(color: string): string | null {
  const c = color.trim().toLowerCase()
  if (LEGACY_HARSH_PLAN_COLORS.has(c)) return null
  return color
}

export function planColorSoft(color: string, alpha = 0.14): string {
  const hex = color.replace('#', '')
  if (hex.length !== 6) return `rgba(100, 116, 139, ${alpha})`
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
