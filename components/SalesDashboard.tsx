'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildCustomerVisitTop5,
  buildDailySeries,
  buildLineItemsPie,
  buildMonthlyTrendForYear,
  buildPaymentBreakdown,
  buildTwoHourSlotSeries,
  calendarYearRangeIso,
  filterCompletedRows,
  sumCheckout,
  sumRefund,
  type SalesTxRow,
} from '@/lib/salesAgg'
import { format } from 'date-fns'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  PieChart,
  Pie,
  Legend,
} from 'recharts'
import { Upload } from 'lucide-react'

function buildYearOptions(): number[] {
  const y = new Date().getFullYear()
  const start = Math.min(2023, y - 1)
  const end = y + 1
  const out: number[] = []
  for (let i = start; i <= end; i++) out.push(i)
  return out
}

const YEAR_OPTIONS = buildYearOptions()

const CHART_MUTED = '#94a3b8'
const ACCENT = '#0f766e'

/** 時段圖略過 00:00–10:00；自 index 5 = 10:00–12:00 起顯示 */
const TIME_SLOT_BUSINESS_START_INDEX = 5

const PIE_COLORS = [
  '#0f766e',
  '#0369a1',
  '#7c3aed',
  '#c2410c',
  '#b45309',
  '#64748b',
  '#db2777',
  '#059669',
  '#4f46e5',
  '#ca8a04',
]

function formatMoney(n: number) {
  return `$${Math.round(n).toLocaleString('zh-TW')}`
}

/** 淺色 → 深色（依筆數相對最大值） */
function mixHex(from: string, to: string, t: number): string {
  const x = (s: string) => parseInt(s.slice(1), 16)
  const A = x(from)
  const B = x(to)
  const ar = (A >> 16) & 0xff
  const ag = (A >> 8) & 0xff
  const ab = A & 0xff
  const br = (B >> 16) & 0xff
  const bg = (B >> 8) & 0xff
  const bb = B & 0xff
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

function slotHeatPalette(counts: number[]): string[] {
  const LIGHT = '#ccfbf1'
  const DARK = '#0f766e'
  const max = Math.max(0, ...counts)
  if (max === 0) return counts.map(() => LIGHT)
  return counts.map((c) => mixHex(LIGHT, DARK, Math.min(1, c / max)))
}

type TimeSlotBarDatum = { label: string; total: number; count: number }

function TimeDistributionBarCard({
  slots,
  contentHeightClass,
}: {
  slots: TimeSlotBarDatum[]
  contentHeightClass: string
}) {
  const fills = useMemo(() => slotHeatPalette(slots.map((s) => s.count)), [slots])
  return (
    <Card className="border-slate-200/90 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-800">時段分佈</CardTitle>
      </CardHeader>
      <CardContent className={contentHeightClass}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={slots} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: CHART_MUTED }}
              stroke="#cbd5e1"
              interval={0}
              angle={-28}
              textAnchor="end"
              height={52}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: CHART_MUTED }}
              stroke="#cbd5e1"
            />
            <Tooltip
              formatter={(value: number) => [`${Number(value)} 筆`, '結單筆數']}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '13px',
              }}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]}>
              {slots.map((s, i) => (
                <Cell key={s.label} fill={fills[i] ?? '#ccfbf1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

function rowInCalendarMonth(r: SalesTxRow, ym: string): boolean {
  const d = new Date(r.completed_at)
  if (isNaN(d.getTime())) return false
  return format(d, 'yyyy-MM') === ym
}

type ViewMonthFilter = 'all' | number

export function SalesDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState<ViewMonthFilter>('all')
  const [yearRows, setYearRows] = useState<SalesTxRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const y = viewYear
    const { from, to } = calendarYearRangeIso(y)

    const all: SalesTxRow[] = []
    const size = 1000
    let start = 0
    try {
      for (;;) {
        const { data, error } = await supabase
          .from('sales_transactions')
          .select(
            'id, order_id, completed_at, checkout_total, refund_amount, payment_method, customer_name, order_status, line_items'
          )
          .gte('completed_at', from)
          .lte('completed_at', to)
          .order('completed_at', { ascending: true })
          .range(start, start + size - 1)

        if (error) {
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            setFetchError('尚未建立 sales 資料表，請在 Supabase 執行 migration_sales.sql。')
          } else {
            setFetchError(error.message || '載入失敗')
          }
          setYearRows([])
          setLoading(false)
          return
        }
        if (!data?.length) break
        for (const r of data) {
          all.push({
            id: r.id as string,
            order_id: r.order_id as string,
            completed_at: r.completed_at as string,
            checkout_total: Number(r.checkout_total),
            refund_amount: Number(r.refund_amount),
            payment_method: r.payment_method as string | null,
            customer_name: r.customer_name as string | null,
            order_status: r.order_status as string | null,
            line_items: r.line_items as string | null,
          })
        }
        if (data.length < size) break
        start += size
      }
      setYearRows(all)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '載入失敗')
      setYearRows([])
    }
    setLoading(false)
  }, [supabase, viewYear])

  useEffect(() => {
    load()
  }, [load])

  const yearCompleted = useMemo(() => filterCompletedRows(yearRows), [yearRows])

  const selectedYm = useMemo(() => {
    if (viewMonth === 'all') return null
    return `${viewYear}-${String(viewMonth).padStart(2, '0')}`
  }, [viewYear, viewMonth])

  const monthCompleted = useMemo(() => {
    if (!selectedYm) return []
    return yearCompleted.filter((r) => rowInCalendarMonth(r, selectedYm))
  }, [yearCompleted, selectedYm])

  const monthlyTrend = useMemo(
    () => buildMonthlyTrendForYear(yearCompleted, viewYear),
    [yearCompleted, viewYear]
  )

  const kpiRows = useMemo(() => {
    if (viewMonth === 'all') return yearCompleted
    return monthCompleted
  }, [viewMonth, yearCompleted, monthCompleted])

  const totalCheckout = useMemo(() => sumCheckout(kpiRows), [kpiRows])
  const totalRefund = useMemo(() => sumRefund(kpiRows), [kpiRows])
  const daily = useMemo(() => buildDailySeries(monthCompleted), [monthCompleted])
  const payments = useMemo(() => buildPaymentBreakdown(monthCompleted), [monthCompleted])
  const lineItemsPie = useMemo(() => buildLineItemsPie(monthCompleted), [monthCompleted])
  const customerTop5 = useMemo(() => buildCustomerVisitTop5(monthCompleted), [monthCompleted])

  /** 略過 00:00–10:00（未營業），自 10:00–12:00 起顯示 */
  const timeSlotSeriesYear = useMemo(
    () => buildTwoHourSlotSeries(yearCompleted).slice(TIME_SLOT_BUSINESS_START_INDEX),
    [yearCompleted]
  )
  const timeSlotSeriesMonth = useMemo(
    () => buildTwoHourSlotSeries(monthCompleted).slice(TIME_SLOT_BUSINESS_START_INDEX),
    [monthCompleted]
  )

  const avgTicket = kpiRows.length > 0 ? totalCheckout / kpiRows.length : 0

  const paymentColors = useMemo(
    () => ['#0f766e', '#0369a1', '#7c3aed', '#c2410c', '#b45309', '#64748b'],
    []
  )

  const handleImport = async () => {
    if (!file) {
      setImportError('請先選擇 .xlsx 檔案')
      return
    }
    setImporting(true)
    setImportError(null)
    setImportMessage(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res = await fetch('/api/sales/import', {
        method: 'POST',
        body: fd,
        credentials: 'same-origin',
      })
      const raw = await res.text()
      let json: {
        error?: string
        warning?: string
        ok?: boolean
        insertedCount?: number
        updatedCount?: number
        rowCount?: number
        parseErrorCount?: number
      } = {}
      try {
        json = raw ? (JSON.parse(raw) as typeof json) : {}
      } catch {
        setImportError(
          `無法解析伺服器回應（HTTP ${res.status}）。若內容為登入頁或錯誤頁 HTML，請重新登入後再試；或確認網址與開發伺服器埠一致。`
        )
        setImporting(false)
        return
      }
      if (!res.ok) {
        setImportError(json.error || `匯入失敗（HTTP ${res.status}）`)
        setImporting(false)
        return
      }
      setImportMessage(
        `匯入完成：${json.rowCount ?? 0} 筆（新增 ${json.insertedCount ?? 0}、更新 ${json.updatedCount ?? 0}）` +
          (json.parseErrorCount ? `；略過 ${json.parseErrorCount} 列格式錯誤` : '') +
          '。' +
          (json.warning ? `\n\n※ ${json.warning}` : '')
      )
      setFile(null)
      await load()
    } catch (e) {
      setImportError(e instanceof Error ? e.message : '匯入失敗')
    }
    setImporting(false)
  }

  const monthDetailLabel = useMemo(() => {
    if (viewMonth === 'all') return ''
    return `${viewYear} 年 ${viewMonth} 月`
  }, [viewYear, viewMonth])

  const hasYearData = yearRows.length > 0
  const isMonthDetail = viewMonth !== 'all'

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <input
            type="file"
            aria-label="選擇 xlsx 檔案"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setImportError(null)
              setImportMessage(null)
            }}
          />
          <Button
            type="button"
            className="shrink-0 bg-slate-900 hover:bg-slate-800 text-white w-full sm:w-auto"
            disabled={!file || importing}
            onClick={handleImport}
          >
            {importing ? (
              '匯入中…'
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                上傳並匯入
              </>
            )}
          </Button>
        </div>
        {importError ? (
          <p className="mt-3 text-sm text-red-600">{importError}</p>
        ) : null}
        {importMessage ? (
          <p className="mt-3 text-sm text-teal-800 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2 whitespace-pre-wrap">
            {importMessage}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-slate-900 tracking-tight">銷售摘要</h3>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end">
          <div className="space-y-2 flex-1 min-w-0 sm:max-w-[200px]">
            <span className="text-xs font-medium text-slate-500">年份</span>
            <Select
              value={String(viewYear)}
              onValueChange={(v) => setViewYear(parseInt(v, 10))}
            >
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue placeholder="年份" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y} 年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 min-w-0 sm:max-w-[220px]">
            <span className="text-xs font-medium text-slate-500">月份</span>
            <Select
              value={viewMonth === 'all' ? 'all' : String(viewMonth)}
              onValueChange={(v) => {
                if (v === 'all') setViewMonth('all')
                else {
                  const n = parseInt(v, 10)
                  if (n >= 1 && n <= 12) setViewMonth(n)
                }
              }}
            >
              <SelectTrigger className="bg-white border-slate-200">
                <SelectValue placeholder="月份" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全年</SelectItem>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} 月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {fetchError}
        </div>
      ) : loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">載入銷售資料中…</div>
      ) : !hasYearData ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-6 py-14 text-center">
          <p className="text-slate-600 font-medium">{viewYear} 年尚無資料</p>
          <p className="text-sm text-slate-500 mt-2">請先匯入含該年度交易的 Excel。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card className="border-slate-200/90 shadow-sm overflow-hidden">
              <CardHeader className="py-3 pb-1 space-y-0 bg-gradient-to-br from-white to-slate-50/80">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  結帳總額
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                  {formatMoney(totalCheckout)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/90 shadow-sm">
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  交易筆數
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                  {kpiRows.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/90 shadow-sm">
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  平均客單
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                  {formatMoney(avgTicket)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200/90 shadow-sm">
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  退款合計
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <p className="text-2xl font-semibold text-slate-700 tabular-nums">
                  {formatMoney(totalRefund)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200/90 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-800">
                {viewYear} 年 · 各月結帳趨勢
              </CardTitle>
            </CardHeader>
            <CardContent className={`pt-0 ${viewMonth === 'all' ? 'h-[320px]' : 'h-[260px]'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART_MUTED }} stroke="#cbd5e1" />
                  <YAxis
                    tick={{ fontSize: 11, fill: CHART_MUTED }}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                    stroke="#cbd5e1"
                  />
                  <Tooltip
                    formatter={(value: number) => [formatMoney(Number(value)), '結帳']}
                    contentStyle={{
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      fontSize: '13px',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke={ACCENT}
                    strokeWidth={2}
                    dot={{ r: 3, fill: ACCENT }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {viewMonth === 'all' ? (
            <TimeDistributionBarCard
              slots={timeSlotSeriesYear}
              contentHeightClass="h-[300px] pt-0"
            />
          ) : null}

          {isMonthDetail && monthCompleted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
              {monthDetailLabel} 尚無「完成結帳」資料；請換月份或確認匯入檔是否含該月。
            </div>
          ) : null}

          {isMonthDetail && monthCompleted.length > 0 ? (
            <>
              <Card className="border-slate-200/90 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-800">
                    每日結帳金額（{monthDetailLabel}）
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px] pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="salesArea2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.22} />
                          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 11, fill: CHART_MUTED }}
                        tickFormatter={(v) => {
                          const [, , d] = String(v).split('-')
                          return d ? `${parseInt(d, 10)}日` : v
                        }}
                        stroke="#cbd5e1"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: CHART_MUTED }}
                        tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : `${v}`)}
                        stroke="#cbd5e1"
                      />
                      <Tooltip
                        formatter={(value: number) => [formatMoney(Number(value)), '結帳']}
                        labelFormatter={(label) => String(label)}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          fontSize: '13px',
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke={ACCENT}
                        strokeWidth={2}
                        fill="url(#salesArea2)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 min-w-0">
                  <TimeDistributionBarCard
                    slots={timeSlotSeriesMonth}
                    contentHeightClass="h-[280px] pt-0"
                  />
                </div>

                <Card className="lg:col-span-2 border-slate-200/90 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-800">
                      付款方式（{monthDetailLabel}）
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[280px] pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={payments.slice(0, 8)}
                        layout="vertical"
                        margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" hide />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={88}
                          tick={{ fontSize: 11, fill: '#475569' }}
                          stroke="transparent"
                        />
                        <Tooltip
                          formatter={(value: number) => formatMoney(Number(value))}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            fontSize: '13px',
                          }}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                          {payments.slice(0, 8).map((_, i) => (
                            <Cell key={i} fill={paymentColors[i % paymentColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="border-slate-200/90 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-800">
                      顧客回訪次數 Top 5（{monthDetailLabel}）
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ol className="space-y-3">
                      {customerTop5.map((row, i) => (
                        <li
                          key={row.name + String(i)}
                          className="flex justify-between items-baseline gap-2 text-sm border-b border-slate-100 pb-2 last:border-0"
                        >
                          <span className="text-slate-500 w-6 shrink-0">{i + 1}.</span>
                          <span className="flex-1 text-slate-800 truncate" title={row.name}>
                            {row.name}
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums shrink-0">
                            {row.visits} 次
                          </span>
                        </li>
                      ))}
                    </ol>
                  </CardContent>
                </Card>

                <Card className="border-slate-200/90 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-slate-800">
                      結帳項目占比—大類（{monthDetailLabel}）
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px] pt-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={lineItemsPie}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                        >
                          {lineItemsPie.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: number) => formatMoney(Number(value))}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            maxWidth: 280,
                          }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: '11px' }}
                          formatter={(value) => (
                            <span className="text-slate-600">{String(value).slice(0, 24)}</span>
                          )}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
