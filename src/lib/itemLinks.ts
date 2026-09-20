import type { ItemLink } from './types'

export function linkBasename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function linkDisplayName(link: ItemLink): string {
  if (link.kind === 'url') {
    if (link.label?.trim()) return link.label.trim()
    try {
      const host = new URL(link.path).hostname.replace(/^www\./, '')
      return host || link.path
    } catch {
      return link.path
    }
  }
  return linkBasename(link.path)
}

export function isHttpUrl(value: string): boolean {
  const t = value.trim()
  return t.startsWith('http://') || t.startsWith('https://')
}

export function revealInFolderLabel(): string {
  return window.planDesk.platform === 'darwin' ? '在 Finder 中显示' : '在资源管理器中显示'
}

export function normalizeItemLinks(links: unknown): ItemLink[] {
  if (!Array.isArray(links)) return []
  return links
    .filter(
      (link): link is ItemLink =>
        Boolean(link) &&
        typeof link === 'object' &&
        typeof (link as ItemLink).path === 'string'
    )
    .map((link) => {
      const kind = (link as ItemLink).kind
      const path = (link as ItemLink).path.trim()
      if (kind === 'url' || isHttpUrl(path)) {
        return {
          path,
          kind: 'url' as const,
          label: typeof (link as ItemLink).label === 'string' ? (link as ItemLink).label : undefined
        }
      }
      if (kind === 'folder' || kind === 'file') {
        return { path, kind }
      }
      return { path, kind: 'file' as const }
    })
}

export async function pathExists(filePath: string): Promise<boolean> {
  const result = await window.planDesk.pathExists?.(filePath)
  return Boolean(result?.exists)
}

export async function pickItemLink(kind: ItemLink['kind']): Promise<ItemLink | null> {
  if (kind === 'url') return null
  const result = await window.planDesk.pickLink?.(kind)
  if (!result?.ok || !result.path) return null
  return { path: result.path, kind: result.kind ?? kind }
}

export async function openItemLink(
  link: ItemLink,
  opts?: { preferObsidian?: boolean }
): Promise<boolean> {
  if (link.kind === 'url') {
    const result = await window.planDesk.openUrl?.(link.path)
    return Boolean(result?.ok)
  }
  const isMarkdown = link.path.toLowerCase().endsWith('.md')
  if (isMarkdown && opts?.preferObsidian && window.planDesk.openObsidianNote) {
    const result = await window.planDesk.openObsidianNote(link.path, true)
    return Boolean(result?.ok)
  }
  const result = await window.planDesk.openPath?.(link.path)
  return Boolean(result?.ok)
}

export async function openMarkdownPath(
  filePath: string,
  preferObsidian: boolean
): Promise<boolean> {
  if (preferObsidian && window.planDesk.openObsidianNote) {
    const result = await window.planDesk.openObsidianNote(filePath, true)
    return Boolean(result?.ok)
  }
  const result = await window.planDesk.openPath?.(filePath)
  return Boolean(result?.ok)
}

export async function showItemInFolder(link: ItemLink): Promise<boolean> {
  if (link.kind === 'url') return false
  const result = await window.planDesk.showInFolder?.(link.path)
  return Boolean(result?.ok)
}

export async function findMissingLinkPaths(links: ItemLink[]): Promise<Set<string>> {
  const missing = new Set<string>()
  await Promise.all(
    links.map(async (link) => {
      if (link.kind === 'url') return
      if (!(await pathExists(link.path))) missing.add(link.path)
    })
  )
  return missing
}
