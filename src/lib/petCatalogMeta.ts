import { DEFAULT_PETDEX_SLUG } from '@/lib/petdex/constants'

export type WidgetModeValue = 'list' | `petdex:${string}`

export function toWidgetModeValue(
  displayMode?: string,
  petdexSlug?: string
): WidgetModeValue {
  if (displayMode === 'list') return 'list'
  return `petdex:${petdexSlug || DEFAULT_PETDEX_SLUG}`
}

export function parseWidgetModeValue(value: WidgetModeValue | string): {
  displayMode: 'list' | 'pet'
  petdexSlug?: string
} {
  if (value === 'list') return { displayMode: 'list' }
  if (value.startsWith('petdex:')) {
    return { displayMode: 'pet', petdexSlug: value.slice(7) }
  }
  // 旧版 pet:xxx 等形式，迁移时统一落到默认 Petdex
  return { displayMode: 'pet', petdexSlug: DEFAULT_PETDEX_SLUG }
}
