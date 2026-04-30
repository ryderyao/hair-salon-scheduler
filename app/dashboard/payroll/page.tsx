'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LogOut, RefreshCw, Download } from 'lucide-react'
import { SiteBrand } from '@/components/SiteBrand'
import { clearAdminSessionKeys } from '@/lib/adminSession'
import { MANAGER_NAV_ITEMS } from '@/lib/managerNav'
import {
  billableHoursFromRaw,
  formatDurationZhFromRawHours,
  formatRawHoursDisplay,
  rawHoursFromClock,
  snapBillableClockSumToHalfHour,
} from '@/lib/payrollCompute'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface PayrollData {
  employeeId: string
  employeeName: string
  hourlyRate: number
  /** 有打卡或排班紀錄的天數 */
  recordCount: number
  /** 打卡原始時數加總（小數） */
  rawClockHoursTotal: number
  /** 打卡計薪：每日「整點 +（零頭≥30分→+0.5）」再加總 */
  billableClockHoursTotal: number
  overtimeHoursTotal: number
  /** 計薪打卡 + 加班 */
  totalBillableHours: number
  totalAmount: number
}

interface PayrollDetailRow {
  employeeId: string
  employeeName: string
  workDate: string
  clockInDisplay: string
  clockOutDisplay: string
  rawHours: number
  billableHours: number
  source: 'clock' | 'schedule'
}

interface OvertimeEntryRow {
  id: string
  employee_id: string
  work_date: string
  overtime_hours: number
  notes: string | null
  employees?: { name: string } | { name: string }[]
}

interface EmployeeOption {
  id: string
  name: string
}

const shiftHours: Record<string, number> = {
  morning: 5,
  evening: 4,
  full: 12,
}

function normalizePayrollRow(d: PayrollData): PayrollData {
  const rawClockHoursTotal = Math.round(d.rawClockHoursTotal * 100) / 100
  const overtimeHoursTotal = Math.round(d.overtimeHoursTotal * 100) / 100
  const billableClockHoursTotal = snapBillableClockSumToHalfHour(d.billableClockHoursTotal)
  const totalBillableHours = billableClockHoursTotal + overtimeHoursTotal
  const totalAmount = Math.round(totalBillableHours * d.hourlyRate)
  return {
    ...d,
    rawClockHoursTotal,
    billableClockHoursTotal,
    overtimeHoursTotal,
    totalBillableHours,
    totalAmount,
  }
}

export default function PayrollPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [payrollData, setPayrollData] = useState<PayrollData[]>([])
  const [detailRows, setDetailRows] = useState<PayrollDetailRow[]>([])
  const [dataSource, setDataSource] = useState<'clock' | 'schedule'>('clock')
  const [loading, setLoading] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const [overtimeMissing, setOvertimeMissing] = useState(false)
  const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntryRow[]>([])
  const [employeesList, setEmployeesList] = useState<EmployeeOption[]>([])
  const [otEmployeeId, setOtEmployeeId] = useState('')
  const [otWorkDate, setOtWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [otHours, setOtHours] = useState('1')
  const [otNotes, setOtNotes] = useState('')
  const [otSaving, setOtSaving] = useState(false)

  useEffect(() => {
    const uid = sessionStorage.getItem('current_user_id')
    const admin = sessionStorage.getItem('admin_unlocked') === '1' && uid === 'admin'
    if (!uid || !admin) {
      clearAdminSessionKeys()
      router.replace('/dashboard/select')
      return
    }
    setUserReady(true)
  }, [router])

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => {
        const list = (data || []) as EmployeeOption[]
        setEmployeesList(list)
        setOtEmployeeId((prev) => prev || (list[0]?.id ?? ''))
      })
  }, [supabase])

  const calculatePayroll = useCallback(async () => {
    setLoading(true)
    setOvertimeMissing(false)

    const [year, month] = selectedMonth.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = endOfMonth(startDate)
    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    const payrollMap = new Map<string, PayrollData>()
    const details: PayrollDetailRow[] = []

    const ensureEmployee = (
      employeeId: string,
      employeeName: string,
      hourlyRate: number
    ) => {
      if (!payrollMap.has(employeeId)) {
        payrollMap.set(employeeId, {
          employeeId,
          employeeName,
          hourlyRate,
          recordCount: 0,
          rawClockHoursTotal: 0,
          billableClockHoursTotal: 0,
          overtimeHoursTotal: 0,
          totalBillableHours: 0,
          totalAmount: 0,
        })
      }
      return payrollMap.get(employeeId)!
    }

    const { data: records } = await supabase
      .from('clock_records')
      .select(`employee_id, work_date, clock_in_at, clock_out_at, employees(name, hourly_rate)`)
      .gte('work_date', startStr)
      .lte('work_date', endStr)
      .not('clock_out_at', 'is', null)

    if (records && records.length > 0) {
      setDataSource('clock')
      records.forEach(
        (rec: {
          employee_id: string
          work_date: string
          clock_in_at: string
          clock_out_at: string | null
          employees: { name: string; hourly_rate?: number } | { name: string; hourly_rate?: number }[]
        }) => {
          if (!rec.clock_out_at) return
          const employeeId = rec.employee_id
          const emp = rec.employees
          const employeeName = Array.isArray(emp) ? emp[0]?.name : (emp?.name ?? '')
          const hourlyRate = (Array.isArray(emp) ? emp[0]?.hourly_rate : emp?.hourly_rate) ?? 200
          const raw = rawHoursFromClock(rec.clock_in_at, rec.clock_out_at)
          const bill = billableHoursFromRaw(raw)

          const data = ensureEmployee(employeeId, employeeName, hourlyRate)
          data.recordCount++
          data.rawClockHoursTotal += raw
          data.billableClockHoursTotal += bill

          details.push({
            employeeId,
            employeeName,
            workDate: rec.work_date,
            clockInDisplay: format(new Date(rec.clock_in_at), 'yyyy-MM-dd HH:mm'),
            clockOutDisplay: format(new Date(rec.clock_out_at), 'yyyy-MM-dd HH:mm'),
            rawHours: raw,
            billableHours: bill,
            source: 'clock',
          })
        }
      )
    } else {
      setDataSource('schedule')
      const { data: schedules } = await supabase
        .from('schedules')
        .select(`employee_id, work_date, shift_type, hours, employees(name, hourly_rate)`)
        .gte('work_date', startStr)
        .lte('work_date', endStr)

      schedules?.forEach(
        (s: {
          employee_id: string
          work_date: string
          shift_type: string
          hours?: number
          employees: { name: string; hourly_rate?: number } | { name: string; hourly_rate?: number }[]
        }) => {
          const employeeId = s.employee_id
          const emp = s.employees
          const employeeName = Array.isArray(emp) ? emp[0]?.name : (emp?.name ?? '')
          const hourlyRate = (Array.isArray(emp) ? emp[0]?.hourly_rate : emp?.hourly_rate) ?? 200
          const hours =
            s.shift_type === 'custom' && typeof s.hours === 'number'
              ? s.hours
              : (shiftHours[s.shift_type] ?? 0)
          const bill = billableHoursFromRaw(hours)

          const data = ensureEmployee(employeeId, employeeName, hourlyRate)
          data.recordCount++
          data.rawClockHoursTotal += hours
          data.billableClockHoursTotal += bill

          details.push({
            employeeId,
            employeeName,
            workDate: s.work_date,
            clockInDisplay: '—',
            clockOutDisplay: '—',
            rawHours: hours,
            billableHours: bill,
            source: 'schedule',
          })
        }
      )
    }

    const { data: otData, error: otError } = await supabase
      .from('payroll_overtime_entries')
      .select('id, employee_id, work_date, overtime_hours, notes, employees(name)')
      .gte('work_date', startStr)
      .lte('work_date', endStr)
      .order('work_date', { ascending: false })

    if (otError) {
      if (
        otError.message?.includes('relation') &&
        otError.message?.includes('does not exist')
      ) {
        setOvertimeMissing(true)
      }
      setOvertimeEntries([])
    } else {
      const otRows = (otData as OvertimeEntryRow[]) || []
      setOvertimeEntries(otRows)

      const otSum = new Map<string, number>()
      for (const row of otRows) {
        const h = Number(row.overtime_hours)
        if (!Number.isFinite(h)) continue
        otSum.set(row.employee_id, (otSum.get(row.employee_id) ?? 0) + h)
      }

      const missingIds = Array.from(otSum.keys()).filter((id) => !payrollMap.has(id))
      if (missingIds.length > 0) {
        const { data: empsMissing } = await supabase
          .from('employees')
          .select('id, name, hourly_rate')
          .in('id', missingIds)
        for (const e of empsMissing || []) {
          payrollMap.set(e.id, {
            employeeId: e.id,
            employeeName: e.name,
            hourlyRate: e.hourly_rate ?? 200,
            recordCount: 0,
            rawClockHoursTotal: 0,
            billableClockHoursTotal: 0,
            overtimeHoursTotal: otSum.get(e.id) ?? 0,
            totalBillableHours: 0,
            totalAmount: 0,
          })
        }
      }

      Array.from(otSum.entries()).forEach(([eid, sumOt]) => {
        const rowData = payrollMap.get(eid)
        if (rowData) rowData.overtimeHoursTotal = sumOt
      })
    }

    details.sort((a, b) => {
      if (a.workDate !== b.workDate) return b.workDate.localeCompare(a.workDate)
      return a.employeeName.localeCompare(b.employeeName, 'zh-Hant')
    })

    setPayrollData(Array.from(payrollMap.values()).map(normalizePayrollRow))
    setDetailRows(details)
    setLoading(false)
  }, [selectedMonth, supabase])

  useEffect(() => {
    if (!userReady) return
    calculatePayroll()
  }, [selectedMonth, userReady, calculatePayroll])

  const reloadOvertimeOnly = async () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = endOfMonth(startDate)
    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('payroll_overtime_entries')
      .select('id, employee_id, work_date, overtime_hours, notes, employees(name)')
      .gte('work_date', startStr)
      .lte('work_date', endStr)
      .order('work_date', { ascending: false })
    if (!error && data) setOvertimeEntries(data as OvertimeEntryRow[])
    await calculatePayroll()
  }

  const addOvertime = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otEmployeeId) return
    const h = parseFloat(otHours.replace(',', '.'))
    if (!Number.isFinite(h) || h <= 0) {
      alert('請輸入大於 0 的加班時數')
      return
    }
    setOtSaving(true)
    const { error } = await supabase.from('payroll_overtime_entries').insert({
      employee_id: otEmployeeId,
      work_date: otWorkDate,
      overtime_hours: h,
      notes: otNotes.trim() || null,
    })
    setOtSaving(false)
    if (error) {
      if (error.message?.includes('does not exist')) {
        alert('請先在 Supabase 執行 migration_payroll_overtime.sql')
      } else {
        alert(error.message)
      }
      return
    }
    setOtNotes('')
    setOtHours('1')
    await reloadOvertimeOnly()
  }

  const deleteOvertime = async (id: string) => {
    if (!confirm('確定刪除此筆加班登記？')) return
    const { error } = await supabase.from('payroll_overtime_entries').delete().eq('id', id)
    if (error) {
      alert(error.message)
      return
    }
    await reloadOvertimeOnly()
  }

  const downloadPayrollExcel = () => {
    const [year, month] = selectedMonth.split('-').map(Number)
    const monthLabel = format(new Date(year, month - 1, 1), 'yyyy年MM月', { locale: zhTW })

    const sheetDetail = detailRows.map((r) => ({
      員工: r.employeeName,
      日期: r.workDate,
      上班打卡: r.clockInDisplay,
      下班打卡: r.clockOutDisplay,
      資料來源: r.source === 'clock' ? '打卡' : '排班',
      時長說明: formatDurationZhFromRawHours(r.rawHours),
      原始時數十進位小時: Number(formatRawHoursDisplay(r.rawHours)),
      計薪時數: r.billableHours,
    }))

    const sheetOt = overtimeEntries.map((r) => {
      const emp = r.employees
      const name = Array.isArray(emp) ? emp[0]?.name : emp?.name
      return {
        員工: name || '—',
        日期: r.work_date,
        加班時數: Number(r.overtime_hours),
        備註: r.notes || '',
      }
    })

    const sheetSummary = payrollData.map((d) => ({
      員工: d.employeeName,
      時薪: d.hourlyRate,
      出勤天數: d.recordCount,
      原始總時數打卡: Number(formatRawHoursDisplay(d.rawClockHoursTotal)),
      計薪時數打卡加總: d.billableClockHoursTotal,
      加班時數加總: d.overtimeHoursTotal,
      總計薪時數: d.totalBillableHours,
      薪資金額: d.totalAmount,
    }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetDetail), '逐日明細')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetOt), '加班登記')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetSummary), '月彙總')
    XLSX.writeFile(wb, `薪資報表_${monthLabel}.xlsx`)
  }

  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()
    for (let i = 0; i < 24; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const value = format(date, 'yyyy-MM')
      const label = format(date, 'yyyy年MM月', { locale: zhTW })
      options.push({ value, label })
    }
    return options
  }

  const handleLogout = async () => {
    clearAdminSessionKeys()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const clearCurrentUser = () => {
    clearAdminSessionKeys()
    router.push('/dashboard/select')
    router.refresh()
  }

  const totalAmount = payrollData.reduce((sum, data) => sum + data.totalAmount, 0)

  const otEmployeeName = (r: OvertimeEntryRow) => {
    const emp = r.employees
    return Array.isArray(emp) ? emp[0]?.name : emp?.name
  }

  if (!userReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">載入中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <SiteBrand />
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={clearCurrentUser} className="shrink-0">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">切換使用者</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0">
                <LogOut className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">登出</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden md:block w-64 bg-white shadow-sm min-h-[calc(100vh-64px)] shrink-0">
          <nav className="p-4 space-y-2">
            {MANAGER_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">薪資計算</h2>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="選擇月份" />
                  </SelectTrigger>
                  <SelectContent>
                    {generateMonthOptions().map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={loading || (payrollData.length === 0 && overtimeEntries.length === 0)}
                  onClick={downloadPayrollExcel}
                >
                  <Download className="h-4 w-4" />
                  下載 Excel
                </Button>
              </div>
            </div>

            {overtimeMissing ? (
              <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                尚未建立加班表：請在 Supabase 執行{' '}
                <code className="text-xs bg-amber-100 px-1 rounded">migration_payroll_overtime.sql</code>
                後重新整理。
              </p>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
                  <span>薪資明細</span>
                  {!loading && payrollData.length > 0 && (
                    <span className="text-sm font-normal text-gray-500">
                      {dataSource === 'clock' ? '依打卡' : '依排班'} · 計薪：每日零頭 ≥30 分加 0.5 小時
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">載入中...</div>
                ) : payrollData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {selectedMonth} 尚無排班、打卡或加班資料
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-2 font-medium text-gray-900">員工</th>
                            <th className="text-center py-3 px-2 font-medium text-gray-900 whitespace-nowrap">
                              時薪
                            </th>
                            <th className="text-center py-3 px-2 font-medium text-gray-900 whitespace-nowrap">
                              天數
                            </th>
                            <th className="text-center py-3 px-2 font-medium text-gray-900 whitespace-nowrap">
                              原始（時）
                            </th>
                            <th className="text-center py-3 px-2 font-medium text-gray-900 whitespace-nowrap">
                              計薪時數
                            </th>
                            <th className="text-center py-3 px-2 font-medium text-gray-900 whitespace-nowrap">
                              加班
                            </th>
                            <th className="text-center py-3 px-2 font-medium text-gray-900 whitespace-nowrap">
                              總計薪
                            </th>
                            <th className="text-right py-3 px-2 font-medium text-gray-900">金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollData.map((data) => (
                            <tr key={data.employeeId} className="border-b last:border-0">
                              <td className="py-3 px-2 font-medium">{data.employeeName}</td>
                              <td className="text-center py-3 px-2 text-gray-600">${data.hourlyRate}</td>
                              <td className="text-center py-3 px-2 text-gray-600">{data.recordCount}</td>
                              <td className="text-center py-3 px-2 text-gray-600">
                                <span className="block">{formatRawHoursDisplay(data.rawClockHoursTotal)}</span>
                                <span className="text-xs text-gray-500">
                                  （{formatDurationZhFromRawHours(data.rawClockHoursTotal)}）
                                </span>
                              </td>
                              <td className="text-center py-3 px-2 font-medium text-gray-900">
                                {formatRawHoursDisplay(data.billableClockHoursTotal, 1)} 小時
                              </td>
                              <td className="text-center py-3 px-2 text-gray-700">
                                {data.overtimeHoursTotal > 0
                                  ? `${formatRawHoursDisplay(data.overtimeHoursTotal)} 小時`
                                  : '—'}
                              </td>
                              <td className="text-center py-3 px-2 font-semibold">
                                {formatRawHoursDisplay(data.totalBillableHours)} 小時
                              </td>
                              <td className="text-right py-3 px-2 font-bold text-green-600">
                                ${data.totalAmount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="text-right py-4 px-2 font-bold text-gray-900">
                              總計
                            </td>
                            <td className="text-right py-4 px-2 font-bold text-green-600 text-lg">
                              ${totalAmount.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg space-y-2 text-sm text-blue-900">
                      <h4 className="font-medium">計算說明</h4>
                      <ul className="text-blue-800 space-y-1 list-disc pl-4">
                        <li>
                          <strong>原始時數（十進位）</strong>：總工作分鐘 ÷ 60，報表另附「時長說明（幾小時幾分）」輔助閱讀。
                        </li>
                        <li>
                          <strong>依打卡・計薪時數</strong>：該日換算為「整數小時 H + 零頭分鐘 R」；若{' '}
                          <strong>R ≥ 30 分</strong>則再加 <strong>0.5</strong> 小時，否則不加；每日計薪後於當月加總。
                        </li>
                        <li>
                          <strong>依排班</strong>：無打卡時以排班時數為原始時數，套用<strong>相同規則</strong>後再加總。
                        </li>
                        <li>
                          <strong>加班</strong>：由店長另行登記，<strong>與正班相同時薪</strong>；計入「總計薪」與金額。
                        </li>
                        <li>
                          時薪於<strong>員工管理</strong>設定（預設 $200）。
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">加班登記（店長代填）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={addOvertime} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                  <div className="space-y-2">
                    <Label>員工</Label>
                    <Select value={otEmployeeId} onValueChange={setOtEmployeeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="選擇員工" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeesList.map((em) => (
                          <SelectItem key={em.id} value={em.id}>
                            {em.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ot-date">日期</Label>
                    <Input
                      id="ot-date"
                      type="date"
                      value={otWorkDate}
                      onChange={(e) => setOtWorkDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ot-hours">加班時數</Label>
                    <Input
                      id="ot-hours"
                      type="number"
                      step="0.5"
                      min={0.5}
                      value={otHours}
                      onChange={(e) => setOtHours(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 lg:col-span-1">
                    <Label htmlFor="ot-notes">備註（選填）</Label>
                    <Input
                      id="ot-notes"
                      value={otNotes}
                      onChange={(e) => setOtNotes(e.target.value)}
                      placeholder="例：活動支援"
                    />
                  </div>
                  <Button type="submit" disabled={otSaving || overtimeMissing}>
                    {otSaving ? '儲存中…' : '新增'}
                  </Button>
                </form>

                {overtimeEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">本月尚無加班登記。</p>
                ) : (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left py-2 px-3">日期</th>
                          <th className="text-left py-2 px-3">員工</th>
                          <th className="text-center py-2 px-3">時數</th>
                          <th className="text-left py-2 px-3">備註</th>
                          <th className="w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {overtimeEntries.map((r) => (
                          <tr key={r.id} className="border-b last:border-0">
                            <td className="py-2 px-3 whitespace-nowrap">{r.work_date}</td>
                            <td className="py-2 px-3">{otEmployeeName(r) || '—'}</td>
                            <td className="py-2 px-3 text-center">{r.overtime_hours}</td>
                            <td className="py-2 px-3 text-gray-600">{r.notes || '—'}</td>
                            <td className="py-2 px-3">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => deleteOvertime(r.id)}
                              >
                                刪除
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-lg z-40">
        <div className="flex justify-around items-stretch h-16 overflow-x-auto">
          {MANAGER_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[4.5rem] flex-1 py-1.5 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className="h-5 w-5 mb-0.5 shrink-0" />
                <span className="text-[10px] font-medium leading-tight text-center px-0.5">
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
