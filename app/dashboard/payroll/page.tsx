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
import { Users, Calendar, DollarSign, LogOut } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Schedule {
  employee_id: string
  shift_type: 'morning' | 'evening' | 'full' | 'custom'
  hours?: number
  employees: {
    name: string
    hourly_rate: number
  }
}

interface PayrollData {
  employeeId: string
  employeeName: string
  hourlyRate: number
  morningShifts: number
  eveningShifts: number
  fullShifts: number
  customHours: number
  totalHours: number
  totalAmount: number
}

const navItems = [
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
]

const shiftHours: Record<string, number> = {
  morning: 5,
  evening: 4,
  full: 12,
}

export default function PayrollPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [payrollData, setPayrollData] = useState<PayrollData[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    calculatePayroll()
  }, [selectedMonth])

  const calculatePayroll = async () => {
    setLoading(true)
    
    const [year, month] = selectedMonth.split('-').map(Number)
    const startDate = new Date(year, month - 1, 1)
    const endDate = endOfMonth(startDate)

    const { data: schedules, error } = await supabase
      .from('schedules')
      .select(`
        employee_id,
        shift_type,
        hours,
        employees(name, hourly_rate)
      `)
      .gte('work_date', format(startDate, 'yyyy-MM-dd'))
      .lte('work_date', format(endDate, 'yyyy-MM-dd'))

    if (error) {
      console.error('Error fetching schedules:', error)
      setLoading(false)
      return
    }

    // 計算每位員工的薪資
    const payrollMap = new Map<string, PayrollData>()

    schedules?.forEach((schedule) => {
      const employeeId = schedule.employee_id
      const emp = schedule.employees as { name: string; hourly_rate?: number } | { name: string; hourly_rate?: number }[] | null
      const employeeName = Array.isArray(emp) ? emp[0]?.name : emp?.name ?? ''
      const hourlyRate = (Array.isArray(emp) ? emp[0]?.hourly_rate : emp?.hourly_rate) ?? 200
      const shiftType = schedule.shift_type
      const hours = shiftType === 'custom' && typeof schedule.hours === 'number' ? schedule.hours : (shiftHours[shiftType] ?? 0)

      if (!payrollMap.has(employeeId)) {
        payrollMap.set(employeeId, {
          employeeId,
          employeeName,
          hourlyRate,
          morningShifts: 0,
          eveningShifts: 0,
          fullShifts: 0,
          customHours: 0,
          totalHours: 0,
          totalAmount: 0,
        })
      }

      const data = payrollMap.get(employeeId)!
      
      if (shiftType === 'morning') {
        data.morningShifts++
      } else if (shiftType === 'evening') {
        data.eveningShifts++
      } else if (shiftType === 'full') {
        data.fullShifts++
      } else if (shiftType === 'custom') {
        data.customHours += hours
      }
      
      data.totalHours += hours
      data.totalAmount = data.totalHours * data.hourlyRate
    })

    setPayrollData(Array.from(payrollMap.values()))
    setLoading(false)
  }

  const generateMonthOptions = () => {
    const options = []
    const currentDate = new Date()
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1)
      const value = format(date, 'yyyy-MM')
      const label = format(date, 'yyyy年MM月', { locale: zhTW })
      options.push({ value, label })
    }
    
    return options
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const totalAmount = payrollData.reduce((sum, data) => sum + data.totalAmount, 0)

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      {/* 頂部導航 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">洗頭店排班系統</h1>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0">
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">登出</span>
            </Button>
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
                <CardTitle>薪資明細</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">載入中...</div>
                ) : payrollData.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    {selectedMonth} 尚無排班資料
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-medium text-gray-900">員工姓名</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">時薪</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">早班</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">晚班</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">全日班</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">自訂時段(hr)</th>
                            <th className="text-center py-3 px-4 font-medium text-gray-900">總時數</th>
                            <th className="text-right py-3 px-4 font-medium text-gray-900">總金額</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payrollData.map((data) => (
                            <tr key={data.employeeId} className="border-b last:border-0">
                              <td className="py-3 px-4 font-medium">{data.employeeName}</td>
                              <td className="text-center py-3 px-4 text-gray-600">${data.hourlyRate}</td>
                              <td className="text-center py-3 px-4 text-gray-600">{data.morningShifts}</td>
                              <td className="text-center py-3 px-4 text-gray-600">{data.eveningShifts}</td>
                              <td className="text-center py-3 px-4 text-gray-600">{data.fullShifts}</td>
                              <td className="text-center py-3 px-4 text-gray-600">{data.customHours > 0 ? data.customHours : '-'}</td>
                              <td className="text-center py-3 px-4 font-medium">{data.totalHours} 小時</td>
                              <td className="text-right py-3 px-4 font-bold text-green-600">
                                ${data.totalAmount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50">
                            <td colSpan={7} className="text-right py-4 px-4 font-bold text-gray-900">
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
                        <li>• 平日早班：12:00-17:00，共 5 小時</li>
                        <li>• 平日晚班：19:00-23:00，共 4 小時</li>
                        <li>• 假日全日班：11:30-23:30，共 12 小時</li>
                        <li>• 自訂時段：依實際排班時數計算</li>
                        <li>• 時薪：每位員工可設定 $200～$250（於員工管理設定）</li>
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
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center flex-1 py-2 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-500'
                }`}
              >
                <Icon className="h-6 w-6 mb-0.5" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
