'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Users, Calendar, DollarSign, LogOut, Clock, RefreshCw, Wallet, LayoutDashboard } from 'lucide-react'
import { clearAdminSessionKeys } from '@/lib/adminSession'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface PayrollData {
  employeeId: string
  employeeName: string
  hourlyRate: number
  totalHours: number
  totalAmount: number
  recordCount: number
}

const shiftHours: Record<string, number> = {
  morning: 5,
  evening: 4,
  full: 12,
}

const navItems = [
  { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
  { href: '/dashboard/finance', label: '收支', icon: Wallet },
]

function calcHoursFromClock(clockIn: string, clockOut: string): number {
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime()
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10
}

/** 匯總後避免浮點誤差；僅供畫面用，不寫入資料庫 */
function normalizePayrollRow(d: PayrollData): PayrollData {
  const totalHours = Math.round(d.totalHours * 10) / 10
  const totalAmount = Math.round(totalHours * d.hourlyRate)
  return { ...d, totalHours, totalAmount }
}

export default function PayrollPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [payrollData, setPayrollData] = useState<PayrollData[]>([])
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<'clock' | 'schedule'>('clock')
  const [userReady, setUserReady] = useState(false)

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
    if (!userReady) return
    calculatePayroll()
  }, [selectedMonth, userReady])

  const calculatePayroll = async () => {
    setLoading(true)
    
    const [year, month] = selectedMonth.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = endOfMonth(startDate)
    const startStr = format(startDate, 'yyyy-MM-dd')
    const endStr = format(endDate, 'yyyy-MM-dd')

    // 1. 優先使用打卡紀錄
    const { data: records } = await supabase
      .from('clock_records')
      .select(`employee_id, clock_in_at, clock_out_at, employees(name, hourly_rate)`)
      .gte('work_date', startStr)
      .lte('work_date', endStr)
      .not('clock_out_at', 'is', null)

    const payrollMap = new Map<string, PayrollData>()

    if (records && records.length > 0) {
      setDataSource('clock')
      records.forEach((rec: { employee_id: string; clock_in_at: string; clock_out_at: string | null; employees: { name: string; hourly_rate?: number } | { name: string; hourly_rate?: number }[] }) => {
        if (!rec.clock_out_at) return
        const employeeId = rec.employee_id
        const emp = rec.employees
        const employeeName = Array.isArray(emp) ? emp[0]?.name : (emp?.name ?? '')
        const hourlyRate = (Array.isArray(emp) ? emp[0]?.hourly_rate : emp?.hourly_rate) ?? 200
        const hours = calcHoursFromClock(rec.clock_in_at, rec.clock_out_at)

        if (!payrollMap.has(employeeId)) {
          payrollMap.set(employeeId, { employeeId, employeeName, hourlyRate, totalHours: 0, totalAmount: 0, recordCount: 0 })
        }
        const data = payrollMap.get(employeeId)!
        data.totalHours += hours
        data.recordCount++
        data.totalAmount = data.totalHours * data.hourlyRate
      })
    } else {
      // 2. 若無打卡紀錄，改依排班表（保留既有資料）
      setDataSource('schedule')
      const { data: schedules } = await supabase
        .from('schedules')
        .select(`employee_id, shift_type, hours, employees(name, hourly_rate)`)
        .gte('work_date', startStr)
        .lte('work_date', endStr)

      schedules?.forEach((s: { employee_id: string; shift_type: string; hours?: number; employees: { name: string; hourly_rate?: number } | { name: string; hourly_rate?: number }[] }) => {
        const employeeId = s.employee_id
        const emp = s.employees
        const employeeName = Array.isArray(emp) ? emp[0]?.name : (emp?.name ?? '')
        const hourlyRate = (Array.isArray(emp) ? emp[0]?.hourly_rate : emp?.hourly_rate) ?? 200
        const hours = s.shift_type === 'custom' && typeof s.hours === 'number' ? s.hours : (shiftHours[s.shift_type] ?? 0)

        if (!payrollMap.has(employeeId)) {
          payrollMap.set(employeeId, { employeeId, employeeName, hourlyRate, totalHours: 0, totalAmount: 0, recordCount: 0 })
        }
        const data = payrollMap.get(employeeId)!
        data.totalHours += hours
        data.recordCount++
        data.totalAmount = data.totalHours * data.hourlyRate
      })
    }

    setPayrollData(Array.from(payrollMap.values()).map(normalizePayrollRow))
    setLoading(false)
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

  if (!userReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">載入中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      {/* 頂部導航 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">洗頭店排班系統</h1>
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
        {/* 側邊導航 - 桌面版 */}
        <aside className="hidden md:block w-64 bg-white shadow-sm min-h-[calc(100vh-64px)] shrink-0">
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
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

        {/* 主內容區 */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">薪資計算</h2>
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
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>薪資明細</span>
                  {!loading && payrollData.length > 0 && (
                    <span className="text-sm font-normal text-gray-500">
                      {dataSource === 'clock' ? '依打卡' : '依排班'}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">載入中...</div>
                ) : payrollData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {selectedMonth} 尚無排班或打卡資料
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-900">員工姓名</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">時薪</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">出勤天數</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">總時數</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">總金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollData.map((data) => (
                            <tr key={data.employeeId} className="border-b last:border-0">
                              <td className="py-3 px-4 font-medium">{data.employeeName}</td>
                              <td className="text-center py-3 px-4 text-gray-600">${data.hourlyRate}</td>
                              <td className="text-center py-3 px-4 text-gray-600">{data.recordCount}</td>
                              <td className="text-center py-3 px-4 font-medium">
                                {data.totalHours.toFixed(1)} 小時
                              </td>
                              <td className="text-right py-3 px-4 font-bold text-green-600">
                                ${data.totalAmount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td colSpan={4} className="text-right py-4 px-4 font-bold text-gray-900">
                              總計
                            </td>
                            <td className="text-right py-4 px-4 font-bold text-green-600 text-lg">
                              ${totalAmount.toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">計算說明</h4>
                      <ul className="text-sm text-blue-800 space-y-1">
                        <li>• <strong>依打卡</strong>：該月份有打卡紀錄時，以實際上/下班時數計算</li>
                        <li>• <strong>依排班</strong>：該月份無打卡時，改以排班表（早/晚/全日/自訂時段）計算</li>
                        <li>• 可選擇過去 24 個月進行每月分析</li>
                        <li>
                          • 時薪：每位員工可在員工管理設定 $200～$250 之間任一整數（例如 210、215、218）
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* 底部導航 - 手機版 */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-lg z-40">
        <div className="flex justify-around items-stretch h-16 overflow-x-auto">
          {navItems.map((item) => {
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
