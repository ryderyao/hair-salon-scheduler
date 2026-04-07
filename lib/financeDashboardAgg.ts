import type { FinanceDirection } from '@/lib/financeCategories'

export type FinanceEntryRow = {
  entry_date: string
  direction: FinanceDirection
  category_id: string
  amount: number
}

export type MonthBucket = {
  monthKey: string
  income: number
  expense: number
  net: number
}

export function formatDashboardMoney(n: number): string {
  return `$${Number(n).toLocaleString('zh-TW', { maximumFractionDigits: 0 })}`
}

/** 自資料列推算最早、最晚 yyyy-MM；無資料則 null */
export function minMaxMonthKeys(rows: FinanceEntryRow[]): { min: string; max: string } | null {
  if (!rows.length) return null
  let min = rows[0].entry_date.slice(0, 7)
  let max = min
  for (const r of rows) {
    const k = r.entry_date.slice(0, 7)
    if (k < min) min = k
    if (k > max) max = k
  }
  return { min, max }
}

/** 列舉 [fromYM, toYM] 內每個曆月 yyyy-MM */
export function enumerateMonthKeys(fromYM: string, toYM: string): string[] {
  const [fy, fm] = fromYM.split('-').map(Number)
  const [ty, tm] = toYM.split('-').map(Number)
  const out: string[] = []
  let y = fy
  let m = fm
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }
  return out
}

export function aggregateRowsToMonthMap(rows: FinanceEntryRow[]): Map<string, { income: number; expense: number }> {
  const map = new Map<string, { income: number; expense: number }>()
  for (const r of rows) {
    const key = r.entry_date.slice(0, 7)
    if (!map.has(key)) map.set(key, { income: 0, expense: 0 })
    const b = map.get(key)!
    if (r.direction === 'income') b.income += r.amount
    else b.expense += r.amount
  }
  return map
}

export function buildTrendSeries(
  rows: FinanceEntryRow[],
  chartYear: 'all' | number
): MonthBucket[] {
  const bounds = minMaxMonthKeys(rows)
  const monthMap = aggregateRowsToMonthMap(rows)

  let keys: string[]
  if (chartYear === 'all') {
    if (!bounds) return []
    keys = enumerateMonthKeys(bounds.min, bounds.max)
  } else {
    const y = chartYear
    const jan = `${y}-01`
    const dec = `${y}-12`
    keys = enumerateMonthKeys(jan, dec)
  }

  return keys.map((monthKey) => {
    const b = monthMap.get(monthKey) ?? { income: 0, expense: 0 }
    return {
      monthKey,
      income: b.income,
      expense: b.expense,
      net: b.income - b.expense,
    }
  })
}

export function parseYearFromRows(rows: FinanceEntryRow[]): number[] {
  const set = new Set<number>()
  for (const r of rows) {
    const y = parseInt(r.entry_date.slice(0, 4), 10)
    if (!Number.isNaN(y)) set.add(y)
  }
  return Array.from(set).sort((a, b) => b - a)
}

export type KpiFilter =
  | { mode: 'all' }
  | { mode: 'year'; year: number }
  | { mode: 'month'; year: number; month: number }

export function getKpiFilter(chartYear: 'all' | number, monthChoice: number): KpiFilter {
  if (chartYear === 'all') return { mode: 'all' }
  if (monthChoice === 0) return { mode: 'year', year: chartYear }
  return { mode: 'month', year: chartYear, month: monthChoice }
}

export function filterRowsForKpi(rows: FinanceEntryRow[], filter: KpiFilter): FinanceEntryRow[] {
  if (filter.mode === 'all') return rows
  if (filter.mode === 'year') {
    const p = `${filter.year}-`
    return rows.filter((r) => r.entry_date.startsWith(p))
  }
  const mm = String(filter.month).padStart(2, '0')
  const prefix = `${filter.year}-${mm}`
  return rows.filter((r) => r.entry_date.startsWith(prefix))
}

export function sumIncomeExpense(rows: FinanceEntryRow[]): {
  income: number
  expense: number
  net: number
  count: number
} {
  let income = 0
  let expense = 0
  for (const r of rows) {
    if (r.direction === 'income') income += r.amount
    else expense += r.amount
  }
  return { income, expense, net: income - expense, count: rows.length }
}

export type PieSlice = { name: string; value: number }

export function buildCategoryPie(rows: FinanceEntryRow[], direction: FinanceDirection, topN = 8): PieSlice[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    if (r.direction !== direction) continue
    const k = r.category_id
    map.set(k, (map.get(k) ?? 0) + r.amount)
  }
  const list = Array.from(map.entries())
    .map(([id, value]) => ({ id, value }))
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value)

  if (!list.length) return []

  const head = list.slice(0, topN)
  const tail = list.slice(topN)
  const other = tail.reduce((s, x) => s + x.value, 0)
  const slices: PieSlice[] = head.map((x) => ({ name: x.id, value: x.value }))
  if (other > 0) slices.push({ name: '__other__', value: other })
  return slices
}
