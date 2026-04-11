import { format, subMonths } from 'date-fns'
import {
  categorizeLineItemFragment,
  categoryLabel,
  splitLineItemFragments,
  type LineItemCategoryId,
  LINE_ITEM_CATEGORY_ORDER,
} from '@/lib/salesLineItemCategory'

export type SalesTxRow = {
  id: string
  order_id: string
  completed_at: string
  checkout_total: number
  refund_amount: number
  payment_method: string | null
  customer_name: string | null
  order_status: string | null
  line_items: string | null
}

/** 與店家匯出「訂單狀態」一致；僅計入此狀態 */
export const ORDER_STATUS_COMPLETED = '完成結帳'

export function isCompletedCheckout(r: Pick<SalesTxRow, 'order_status'>): boolean {
  return (r.order_status || '').trim() === ORDER_STATUS_COMPLETED
}

/** 僅保留完成結帳（排除作廢等） */
export function filterCompletedRows(rows: SalesTxRow[]): SalesTxRow[] {
  return rows.filter(isCompletedCheckout)
}

/** yyyy-MM，該月台灣時間起訖（供 Supabase 篩選 completed_at） */
export function monthRangeIso(ym: string): { from: string; to: string } {
  const [ys, ms] = ym.split('-')
  const y = Number(ys)
  const m = Number(ms)
  if (!y || !m || m < 1 || m > 12) {
    return monthRangeIso(format(new Date(), 'yyyy-MM'))
  }
  const pad = (n: number) => String(n).padStart(2, '0')
  const lastDay = new Date(y, m, 0).getDate()
  const from = `${ys}-${pad(m)}-01T00:00:00+08:00`
  const to = `${ys}-${pad(m)}-${pad(lastDay)}T23:59:59.999+08:00`
  return { from, to }
}

/** 西曆年 1/1～12/31（台灣時間）— 載入年度資料做月趨勢 */
export function calendarYearRangeIso(year: number): { from: string; to: string } {
  return {
    from: `${year}-01-01T00:00:00+08:00`,
    to: `${year}-12-31T23:59:59.999+08:00`,
  }
}

export function sumCheckout(rows: Pick<SalesTxRow, 'checkout_total'>[]): number {
  return rows.reduce((s, r) => s + Number(r.checkout_total || 0), 0)
}

export function sumRefund(rows: Pick<SalesTxRow, 'refund_amount'>[]): number {
  return rows.reduce((s, r) => s + Number(r.refund_amount || 0), 0)
}

/** 完成結帳時間在指定時區的小時 0–23（無效則 null） */
export function hourInTimeZone(iso: string, timeZone: string): number | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const hv = parts.find((p) => p.type === 'hour')?.value
  if (hv == null) return null
  const h = parseInt(hv, 10)
  if (Number.isNaN(h)) return null
  return h
}

/**
 * 依「完成結帳時間」每 2 小時一組加總結帳金額與筆數（預設台灣時間，與 migration 範圍 +08:00 一致）
 * 區間：00:00–02:00 … 22:00–24:00 共 12 格
 */
export function buildTwoHourSlotSeries(
  rows: SalesTxRow[],
  timeZone = 'Asia/Taipei'
): { label: string; total: number; count: number }[] {
  const slots: { label: string; total: number; count: number }[] = Array.from(
    { length: 12 },
    (_, i) => {
      const a = String(i * 2).padStart(2, '0')
      const b = String(i * 2 + 2).padStart(2, '0')
      return {
        label: `${a}:00–${b}:00`,
        total: 0,
        count: 0,
      }
    }
  )
  for (const r of rows) {
    const h = hourInTimeZone(r.completed_at, timeZone)
    if (h == null) continue
    const idx = Math.min(11, Math.floor(h / 2))
    slots[idx].total += Number(r.checkout_total || 0)
    slots[idx].count += 1
  }
  return slots
}

export function buildDailySeries(rows: SalesTxRow[]): { day: string; total: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const d = new Date(r.completed_at)
    if (isNaN(d.getTime())) continue
    const key = format(d, 'yyyy-MM-dd')
    map.set(key, (map.get(key) || 0) + Number(r.checkout_total || 0))
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day, total }))
}

export function buildPaymentBreakdown(
  rows: SalesTxRow[]
): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const name = (r.payment_method || '未標示').trim() || '未標示'
    map.set(name, (map.get(name) || 0) + Number(r.checkout_total || 0))
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

/** 所選西曆年：1～12 月各月結帳總額（僅統計已完成列） */
export function buildMonthlyTrendForYear(
  yearRowsCompleted: SalesTxRow[],
  year: number
): { monthKey: string; label: string; total: number }[] {
  const totals = Array.from({ length: 12 }, (_, i) => ({
    monthKey: `${year}-${String(i + 1).padStart(2, '0')}`,
    label: `${i + 1}月`,
    total: 0,
  }))
  for (const r of yearRowsCompleted) {
    const d = new Date(r.completed_at)
    if (isNaN(d.getTime())) continue
    if (d.getFullYear() !== year) continue
    const m = d.getMonth()
    totals[m].total += Number(r.checkout_total || 0)
  }
  return totals
}

/** 當月：顧客回訪次數（完成結帳筆數）Top 5 */
export function buildCustomerVisitTop5(
  monthRowsCompleted: SalesTxRow[]
): { name: string; visits: number }[] {
  const map = new Map<string, number>()
  for (const r of monthRowsCompleted) {
    const name = (r.customer_name || '未留名').trim() || '未留名'
    map.set(name, (map.get(name) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, visits]) => ({ name, visits }))
}

/**
 * 結帳項目拆項（逗號／中文逗號；並先移除數字千分位逗號避免誤切）後金額均分，
 * 再對應「服務大類」加總成圓餅占比（見 salesLineItemCategory）。
 */
export function buildLineItemsPie(
  monthRowsCompleted: SalesTxRow[],
  maxSlices = 9
): { name: string; value: number }[] {
  const map = new Map<LineItemCategoryId, number>()

  const add = (id: LineItemCategoryId, v: number) => {
    map.set(id, (map.get(id) ?? 0) + v)
  }

  for (const r of monthRowsCompleted) {
    const raw = (r.line_items || '').trim()
    const amount = Number(r.checkout_total || 0)
    if (!raw) {
      add('other', amount)
      continue
    }
    const parts = splitLineItemFragments(raw)
    if (parts.length === 0) {
      add('other', amount)
      continue
    }
    const share = amount / parts.length
    for (const p of parts) {
      add(categorizeLineItemFragment(p), share)
    }
  }

  const ordered: { name: string; value: number }[] = []
  for (const id of LINE_ITEM_CATEGORY_ORDER) {
    const v = map.get(id) ?? 0
    if (v > 0) ordered.push({ name: categoryLabel(id), value: v })
  }

  if (ordered.length <= maxSlices + 1) return ordered
  const top = ordered.slice(0, maxSlices)
  const rest = ordered.slice(maxSlices).reduce((s, x) => s + x.value, 0)
  return [...top, { name: '其他（細項合併）', value: rest }]
}

export function recentMonthOptions(count: number): string[] {
  const out: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    out.push(format(subMonths(now, i), 'yyyy-MM'))
  }
  return out
}
