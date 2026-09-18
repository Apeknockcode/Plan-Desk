declare module 'lunar-javascript' {
  export class Solar {
    static fromYmd(year: number, month: number, day: number): Solar
    getLunar(): Lunar
    getFestivals(): string[]
    getOtherFestivals(): string[]
    getWeekInChinese(): string
  }

  export class Lunar {
    getMonthInChinese(): string
    getDayInChinese(): string
    getJieQi(): string
    getFestivals(): string[]
  }

  export class HolidayUtil {
    static getHoliday(
      year: number,
      month: number,
      day: number
    ): {
      getName(): string
      isWork(): boolean
      getTarget(): string
    } | null
  }
}
