import type { Locale } from '../i18n/types'

export function formatArchiveDate(date: string, locale: Locale): string {
  const [year, month, day] = date.split('-').map(Number)
  const calendarDate = new Date(0)
  calendarDate.setUTCHours(0, 0, 0, 0)
  calendarDate.setUTCFullYear(year, month - 1, day)
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(calendarDate)
}
