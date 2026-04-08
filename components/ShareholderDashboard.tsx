'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getFinanceCategoryLabel } from '@/lib/financeCategories'
import {
  buildTrendSeries,
  buildCategoryPie,
  filterRowsForKpi,
  formatDashboardMoney,
  getKpiFilter,
  parseYearFromRows,
  sumIncomeExpense,
  type FinanceEntryRow,
} from '@/lib/financeDashboardAgg'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const PIE_COLORS = [
  '#2563eb',
  '#16a34a',
  '#ca8a04',
  '#dc2626',
  '#9333ea',
  '#0891b2',
  '#ea580c',
  '#4f46e5',
  '#64748b',
  '#b45309',
]

function formatTickMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  return `${y}/${m}`
}

function labelForPieSlice(id: string): string {
  if (id === '__other__') return '其他科目'
  return getFinanceCategoryLabel(id)
}

export function ShareholderDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const [rows, setRows] = useState<FinanceEntryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [chartYear, setChartYear] = useState<'all' | number>('all')
  const [monthChoice, setMonthChoice] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    const all: FinanceEntryRow[] = []
    const size = 1000
    let from = 0
    try {
      for (;;) {
        const { data, error } = await supabase
          .from('finance_entries')
          .select('entry_date, direction, category_id, amount')
          .order('entry_date', { ascending: true })
          .range(from, from + size - 1)

        if (error) {
          if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
            setFetchError('尚未建立 finance_entries 資料表，請在 Supabase 執行 migration。')
          } else {
            setFetchError(error.message || '載入失敗')
          }
          setRows([])
          setLoading(false)
          return
        }
        if (!data?.length) break
        for (const r of data) {
          all.push({
            entry_date: r.entry_date as string,
            direction: r.direction as FinanceEntryRow['direction'],
            category_id: r.category_id as string,
            amount: Number(r.amount),
          })
        }
        if (data.length < size) break
        from += size
      }
      setRows(all)
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : '載入失敗')
      setRows([])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  const years = useMemo(() => parseYearFromRows(rows), [rows])
  const trendData = useMemo(() => buildTrendSeries(rows, chartYear), [rows, chartYear])
  const kpiFilter = useMemo(() => getKpiFilter(chartYear, monthChoice), [chartYear, monthChoice])
  const kpiRows = useMemo(() => filterRowsForKpi(rows, kpiFilter), [rows, kpiFilter])
  const kpi = useMemo(() => sumIncomeExpense(kpiRows), [kpiRows])

  const incomePie = useMemo(() => buildCategoryPie(kpiRows, 'income'), [kpiRows])
  const expensePie = useMemo(() => buildCategoryPie(kpiRows, 'expense'), [kpiRows])

  const incomePieLabeled = useMemo(
    () => incomePie.map((s) => ({ ...s, name: labelForPieSlice(s.name) })),
    [incomePie]
  )
  const expensePieLabeled = useMemo(
    () => expensePie.map((s) => ({ ...s, name: labelForPieSlice(s.name) })),
    [expensePie]
  )

  const handleYearChange = (v: string) => {
    if (v === 'all') {
      setChartYear('all')
      setMonthChoice(0)
      return
    }
    setChartYear(parseInt(v, 10))
    setMonthChoice(0)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4 items-stretch sm:items-end">
        <div className="space-y-2 min-w-[140px]">
          <span className="text-xs font-medium text-gray-600">年份</span>
          <Select value={chartYear === 'all' ? 'all' : String(chartYear)} onValueChange={handleYearChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="年份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 min-w-[140px]">
          <span className="text-xs font-medium text-gray-600">月份</span>
          <Select
            value={String(monthChoice)}
            onValueChange={(v) => setMonthChoice(parseInt(v, 10))}
            disabled={chartYear === 'all'}
          >
            <SelectTrigger className="w-full sm:w-[160px]" disabled={chartYear === 'all'}>
              <SelectValue placeholder="月份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">全年</SelectItem>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {fetchError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{fetchError}</div>
      ) : loading ? (
        <div className="text-center py-12 text-gray-500">載入收支資料中…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center text-gray-500">
          尚無收支紀錄。請至「收支」新增記帳後圖表即會顯示。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-gray-500">收入</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <p className="text-lg sm:text-xl font-bold text-green-700">{formatDashboardMoney(kpi.income)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-gray-500">支出</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <p className="text-lg sm:text-xl font-bold text-red-700">{formatDashboardMoney(kpi.expense)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-gray-500">淨額</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <p
                  className={`text-lg sm:text-xl font-bold ${kpi.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}
                >
                  {formatDashboardMoney(kpi.net)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="py-3 pb-1 space-y-0">
                <CardTitle className="text-xs font-medium text-gray-500">紀錄筆數</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-3">
                <p className="text-lg sm:text-xl font-bold text-gray-900">{kpi.count}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">月趨勢</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] sm:h-[340px] w-full min-w-0 -ml-2 sm:ml-0">
              {trendData.length === 0 ? (
                <p className="text-gray-500 text-center py-12">此範圍無資料</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                    <XAxis dataKey="monthKey" tickFormatter={formatTickMonth} tick={{ fontSize: 11 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => (Math.abs(v) >= 1000 ? `${v / 1000}k` : `${v}`)}
                    />
                    <Tooltip
                      formatter={(val: number) => [formatDashboardMoney(val), '']}
                      labelFormatter={(label) => `月份 ${formatTickMonth(label as string)}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="income" name="收入" stroke="#16a34a" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="expense" name="支出" stroke="#dc2626" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="net" name="淨額" stroke="#2563eb" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">收入 · 科目分布</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] w-full min-w-0">
                {incomePieLabeled.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">此範圍無收入資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={incomePieLabeled}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {incomePieLabeled.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatDashboardMoney(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">支出 · 科目分布</CardTitle>
              </CardHeader>
              <CardContent className="h-[280px] w-full min-w-0">
                {expensePieLabeled.length === 0 ? (
                  <p className="text-gray-500 text-center py-12">此範圍無支出資料</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expensePieLabeled}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={88}
                        label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      >
                        {expensePieLabeled.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatDashboardMoney(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
