import { HolidayUtil, Solar } from 'lunar-javascript'

/** 月历格内展示用的短节日名（完整名见 festivalLabel / title） */
const FESTIVAL_CELL_SHORT: Record<string, string> = {
  中国抗日战争胜利纪念日: '抗战胜利',
  全国中小学生安全教育日: '安全教育日',
  世界消费者权益日: '消费者权益日',
  国际劳动妇女节: '妇女节',
  全国助残日: '助残日',
  全国土地日: '土地日',
  世界环境日: '环境日',
  国家宪法日: '宪法日'
}

export function formatFestivalCellLabel(label: string | null): string | null {
  if (!label) return null
  const mapped = FESTIVAL_CELL_SHORT[label]
  if (mapped) return mapped
  if (label.length <= 5) return label
  const trimmed = label.startsWith('中国') ? label.slice(2) : label
  if (trimmed.length <= 5) return trimmed
  if (trimmed.length <= 7) return trimmed
  return `${trimmed.slice(0, 5)}…`
}

/** 格内是否同时显示农历（长节日名时只保留节日，详情区仍有完整农历） */
export function shouldShowLunarInCalendarCell(meta: {
  festivalLabel: string | null
  isSolarTerm: boolean
  isAdjustedWorkday: boolean
}): boolean {
  if (!meta.festivalLabel) return true
  if (meta.isSolarTerm) return false
  if (meta.isAdjustedWorkday) return true
  if (meta.festivalLabel.length <= 4) return true
  return false
}

export type CalendarCellMeta = {
  /** 农历日（初一显示某月）或当日节气名 */
  lunarLabel: string
  /** 节日 / 法定假日名称（补班日显示「补班」） */
  festivalLabel: string | null
  /** 悬停说明（如调休对应的原假期） */
  festivalHint: string | null
  /** 法定假日（非调休上班） */
  isPublicHoliday: boolean
  /** 调休需上班 */
  isAdjustedWorkday: boolean
  /** 当日为节气 */
  isSolarTerm: boolean
}

const metaCache = new Map<string, CalendarCellMeta>()

function lunarDayLabel(year: number, month: number, date: number): string {
  const lunar = Solar.fromYmd(year, month, date).getLunar()
  const jieQi = lunar.getJieQi()
  if (jieQi) return jieQi

  const dayCn = lunar.getDayInChinese()
  if (dayCn === '初一') {
    return `${lunar.getMonthInChinese()}月`
  }
  return dayCn
}

function pickFestival(year: number, month: number, date: number): {
  label: string | null
  hint: string | null
  isPublicHoliday: boolean
  isAdjustedWorkday: boolean
} {
  const holiday = HolidayUtil.getHoliday(year, month, date)
  if (holiday) {
    if (holiday.isWork()) {
      const name = holiday.getName()
      const target = holiday.getTarget()
      const hint = target
        ? `调休上班，${name}假期为 ${target}`
        : `调休上班（${name}）`
      return {
        label: '补班',
        hint,
        isPublicHoliday: false,
        isAdjustedWorkday: true
      }
    }
    return {
      label: holiday.getName(),
      hint: null,
      isPublicHoliday: true,
      isAdjustedWorkday: false
    }
  }

  const solar = Solar.fromYmd(year, month, date)
  const lunar = solar.getLunar()
  const names = [...solar.getFestivals(), ...lunar.getFestivals(), ...solar.getOtherFestivals()]
  if (names.length) {
    return { label: names[0], hint: null, isPublicHoliday: false, isAdjustedWorkday: false }
  }

  return { label: null, hint: null, isPublicHoliday: false, isAdjustedWorkday: false }
}

export function getCalendarCellMeta(year: number, month: number, date: number): CalendarCellMeta {
  const cacheKey = `${year}-${month}-${date}`
  const cached = metaCache.get(cacheKey)
  if (cached) return cached

  const lunar = Solar.fromYmd(year, month, date).getLunar()
  const jieQi = lunar.getJieQi()
  const festival = pickFestival(year, month, date)

  const meta: CalendarCellMeta = {
    lunarLabel: lunarDayLabel(year, month, date),
    festivalLabel: festival.label,
    festivalHint: festival.hint,
    isPublicHoliday: festival.isPublicHoliday,
    isAdjustedWorkday: festival.isAdjustedWorkday,
    isSolarTerm: Boolean(jieQi)
  }

  metaCache.set(cacheKey, meta)
  if (metaCache.size > 500) {
    metaCache.clear()
  }
  return meta
}

export function formatDaySolarLunarLine(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  const solar = Solar.fromYmd(y, m, d)
  const lunar = solar.getLunar()
  const week = solar.getWeekInChinese()
  const lunarStr = `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`
  const jieQi = lunar.getJieQi()
  const term = jieQi ? ` · ${jieQi}` : ''
  return `阳历 ${y}年${m}月${d}日 周${week} · 农历 ${lunarStr}${term}`
}
