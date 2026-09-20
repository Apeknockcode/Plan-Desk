import type { Project } from './types'

export function normalizeNotionUrl(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? ''
  if (!t) return null
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  return null
}

export function normalizeObsidianPath(raw: string | null | undefined): string | null {
  const t = raw?.trim() ?? ''
  return t || null
}

export function planHasExternalNotes(plan: Project): boolean {
  return Boolean(normalizeNotionUrl(plan.notionUrl) || normalizeObsidianPath(plan.obsidianPath))
}
