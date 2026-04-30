import { format } from 'date-fns'

/** JS：0=日 … 6=六（與 Date#getDay 一致） */

/** 該日在當月為「第幾個」同名星期（1-based） */
export function weekdayOrdinalInMonth(d: Date): { dow: number; ordinal: number } {
  const dow = d.getDay()
  const y = d.getFullYear()
  const m = d.getMonth()
  const until = d.getDate()
  let ordinal = 0
  for (let day = 1; day <= until; day++) {
    const t = new Date(y, m, day)
    if (t.getDay() === dow) ordinal++
  }
  return { dow, ordinal }
}

/**
 * 在目標年月找出「第 ordinal 個 dow」的日期；無此組合（例如第五個週三不存在）回傳 null。
 */
export function dateByWeekdayOrdinal(
  year: number,
  monthIndex: number,
  dow: number,
  ordinal: number
): string | null {
  if (ordinal < 1) return null
  let count = 0
  const lastDay = new Date(year, monthIndex + 1, 0).getDate()
  for (let day = 1; day <= lastDay; day++) {
    const t = new Date(year, monthIndex, day)
    if (t.getDay() === dow) {
      count++
      if (count === ordinal) return format(t, 'yyyy-MM-dd')
    }
  }
  return null
}

/** `yyyy-MM-dd` 字串 → 本地正午 Date，避免時區偏移 */
export function parseWorkDateLocal(workDateStr: string): Date {
  const [y, mo, d] = workDateStr.split('-').map((x) => parseInt(x, 10))
  return new Date(y, mo - 1, d, 12, 0, 0)
}

/**
 * 將來源日的班，對應到「targetMonth」同一個「第幾個星期幾」。
 * `targetMonth` 為該月任意一天（通常用月初）。
 */
export function mapWorkDateByWeekOrdinal(
  sourceWorkDateStr: string,
  targetMonth: Date
): string | null {
  const source = parseWorkDateLocal(sourceWorkDateStr)
  const { dow, ordinal } = weekdayOrdinalInMonth(source)
  const y = targetMonth.getFullYear()
  const m = targetMonth.getMonth()
  return dateByWeekdayOrdinal(y, m, dow, ordinal)
}

export function scheduleDuplicateKey(row: {
  employee_id: string
  work_date: string
  shift_type: string
  start_time: string | null
  end_time: string | null
}): string {
  const st = row.start_time ?? ''
  const en = row.end_time ?? ''
  return `${row.employee_id}|${row.work_date}|${row.shift_type}|${st}|${en}`
}
