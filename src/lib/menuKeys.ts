export const CALENDAR_MENU_KEY = '__calendar__'

export function isCalendarMenuKey(key: string | null | undefined): boolean {
  return key === CALENDAR_MENU_KEY
}
