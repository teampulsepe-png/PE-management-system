import type { RecurrenceType } from '../types'

export function getPeriodLabel(recurrence: RecurrenceType, anchor: Date): string {
  switch (recurrence) {
    case 'weekly': {
      const mon = startOfWeek(anchor)
      const sun = new Date(mon)
      sun.setDate(sun.getDate() + 6)
      const monStr = mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const sunStr = sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      return `${monStr} – ${sunStr}`
    }
    case 'monthly':
      return anchor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    case 'quarterly': {
      const q = Math.floor(anchor.getMonth() / 3) + 1
      return `Q${q} ${anchor.getFullYear()}`
    }
    case 'annually':
      return String(anchor.getFullYear())
  }
}

export function getPeriodKey(recurrence: RecurrenceType, anchor: Date): string {
  switch (recurrence) {
    case 'weekly': {
      const mon = startOfWeek(anchor)
      const week = getISOWeek(mon)
      return `${mon.getFullYear()}-W${String(week).padStart(2, '0')}`
    }
    case 'monthly': {
      const m = String(anchor.getMonth() + 1).padStart(2, '0')
      return `${anchor.getFullYear()}-${m}`
    }
    case 'quarterly': {
      const q = Math.floor(anchor.getMonth() / 3) + 1
      return `${anchor.getFullYear()}-Q${q}`
    }
    case 'annually':
      return String(anchor.getFullYear())
  }
}

export function addPeriod(recurrence: RecurrenceType, anchor: Date, delta: number): Date {
  const d = new Date(anchor)
  switch (recurrence) {
    case 'weekly':
      d.setDate(d.getDate() + delta * 7)
      break
    case 'monthly':
      d.setMonth(d.getMonth() + delta)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + delta * 3)
      break
    case 'annually':
      d.setFullYear(d.getFullYear() + delta)
      break
  }
  return d
}

export function isCurrentPeriod(recurrence: RecurrenceType, anchor: Date): boolean {
  return getPeriodKey(recurrence, anchor) === getPeriodKey(recurrence, new Date())
}

export function isPastPeriod(recurrence: RecurrenceType, anchor: Date): boolean {
  return getPeriodKey(recurrence, anchor) < getPeriodKey(recurrence, new Date())
}

const HISTORY_COUNT: Record<RecurrenceType, number> = {
  weekly: 52,
  monthly: 12,
  quarterly: 8,
  annually: 5,
}

export function getHistoryCount(recurrence: RecurrenceType): number {
  return HISTORY_COUNT[recurrence]
}

export function getPastPeriods(recurrence: RecurrenceType, count: number): Date[] {
  const result: Date[] = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i--) {
    result.push(addPeriod(recurrence, now, -i))
  }
  return result
}

export function getCurrentLabel(recurrence: RecurrenceType): string {
  const labels: Record<RecurrenceType, string> = {
    weekly: 'This Week',
    monthly: 'This Month',
    quarterly: 'This Quarter',
    annually: 'This Year',
  }
  return labels[recurrence]
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getISOWeek(date: Date): number {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}
