export const DEFAULT_PETDEX_SLUG = 'tiko'

/** 本地离线内置（仅默认桌宠，减小安装包体积） */
export const BUNDLED_PETDEX_SLUGS = ['tiko'] as const

/** 选择器推荐展示（其余从 Petdex CDN 加载） */
export const FEATURED_PETDEX_SLUGS = [
  'tiko',
  'iikun',
  'pochita',
  'a-tom',
  'corgi-cool'
] as const
