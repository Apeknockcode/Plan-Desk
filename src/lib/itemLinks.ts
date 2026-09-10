import type { ItemLink } from './types'

export function linkBasename(path: string): string {
  const parts = path.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? path
}

export function revealInFolderLabel(): string {
  return window.planDesk.platform === 'darwin' ? '在 Finder 中显示' : '在资源管理器中显示'
}

export function normalizeItemLinks(links: unknown): ItemLink[] {
  if (!Array.isArray(links)) return []
  return links.filter(
    (link): link is ItemLink =>
      Boolean(link) &&
      typeof link === 'object' &&
      typeof (link as ItemLink).path === 'string' &&
      ((link as ItemLink).kind === 'file' || (link as ItemLink).kind === 'folder')
  )
}

export async function pathExists(filePath: string): Promise<boolean> {
  const result = await window.planDesk.pathExists?.(filePath)
  return Boolean(result?.exists)
}

export async function pickItemLink(kind: ItemLink['kind']): Promise<ItemLink | null> {
  const result = await window.planDesk.pickLink?.(kind)
  if (!result?.ok || !result.path) return null
  return { path: result.path, kind: result.kind ?? kind }
}

export async function openItemLink(link: ItemLink): Promise<boolean> {
  const result = await window.planDesk.openPath?.(link.path)
  return Boolean(result?.ok)
}

export async function showItemInFolder(link: ItemLink): Promise<boolean> {
  const result = await window.planDesk.showInFolder?.(link.path)
  return Boolean(result?.ok)
}

export async function findMissingLinkPaths(links: ItemLink[]): Promise<Set<string>> {
  const missing = new Set<string>()
  await Promise.all(
    links.map(async (link) => {
      if (!(await pathExists(link.path))) missing.add(link.path)
    })
  )
  return missing
}
