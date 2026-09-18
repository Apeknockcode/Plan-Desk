import type { Component } from 'vue'
import { h } from 'vue'
import { IconProvider, DEFAULT_ICON_CONFIGS } from '@icon-park/vue-next'
import {
  Calendar,
  CheckOne,
  Close,
  Delete,
  Drag,
  Download,
  Edit,
  FileAddition,
  FolderOpen,
  Link,
  MoreOne,
  Notepad,
  Plus,
  Search,
  Setting,
  Time,
  Upload,
  renderMenuIcon
} from '@icon-park/vue-next'

export {
  Calendar,
  CheckOne,
  Close,
  Delete,
  Drag,
  Download,
  Edit,
  FileAddition,
  FolderOpen,
  Link,
  MoreOne,
  Notepad,
  Plus,
  Search,
  Setting,
  Time,
  Upload
}

export const iconDefaults = {
  theme: 'outline' as const,
  size: 16,
  strokeWidth: 3,
  strokeLinejoin: 'round' as const,
  strokeLinecap: 'round' as const
}

export function setupIconPark(): void {
  IconProvider({
    ...DEFAULT_ICON_CONFIGS,
    ...iconDefaults
  })
}

/** Render IconPark icon for Naive UI NMenu `icon` slot. */
export function renderMenuIcon(Icon: Component, size = 16) {
  return () =>
    h(Icon, {
      ...iconDefaults,
      size
    })
}
