'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Users, Calendar, DollarSign, LogOut, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, isWeekend } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Employee {
  id: string
  name: string
  is_active: boolean
}

interface Schedule {
  id: string
  employee_id: string
  work_date: string
  shift_type: 'morning' | 'evening' | 'full'
  employees: {
    name: string
  }
}

const navItems = [
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
]

const shiftLabels: Record<string, string> = {
  morning: '早班',
  evening: '晚班',
  full: '全日班',
}

const shiftColors: Record<string, string> = {
  morning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  evening: 'bg-blue-100 text-blue-800 border-blue-200',
  full: 'bg-green-100 text-green-800 border-green-200',
}

export default function SchedulePage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [employees, setEmployees] = useState<Employee[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [selectedShift, setSelectedShift] = useState('')
  const [addScheduleLoading, setAddScheduleLoading] = useState(false)
  const [addScheduleError, setAddScheduleError] = useState<string | null>(null)

  useEffect(() => {
    fetchEmployees()
  }, [])

  useEffect(() => {
    fetchSchedules()
  }, [currentMonth])

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('is_active', true)
      .order('name')

    if (error) {
      console.error('Error fetching employees:', error)
      return
    }

    setEmployees(data || [])
  }

  const fetchSchedules = async () => {
    setLoading(true)
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)

    const { data, error } = await supabase
      .from('schedules')
      .select(`
        *,
        employees(name)
      `)
      .gte('work_date', format(start, 'yyyy-MM-dd'))
      .lte('work_date', format(end, 'yyyy-MM-dd'))

    if (error) {
      console.error('Error fetching schedules:', error)
      setLoading(false)
      return
    }

    setSchedules(data || [])
    setLoading(false)
  }

  const getDaysInMonth = () => {
    const start = startOfMonth(currentMonth)
    const end = endOfMonth(currentMonth)
    return eachDayOfInterval({ start, end })
  }

  const getSchedulesForDate = (date: Date) => {
    return schedules.filter(schedule => 
      isSameDay(new Date(schedule.work_date), date)
    )
  }

  const getAvailableShifts = (date: Date) => {
    if (isWeekend(date)) {
      return [{ value: 'full', label: '全日班 11:30-23:30 (12hr)' }]
    } else {
      return [
        { value: 'morning', label: '早班 12:00-17:00 (5hr)' },
        { value: 'evening', label: '晚班 19:00-23:00 (4hr)' },
      ]
    }
  }

  const handleDateClick = (date: Date) => {
    setSelectedDate(date)
    setSelectedEmployee('')
    setSelectedShift('')
    setAddScheduleError(null)
    setIsDialogOpen(true)
  }

  const handleAddSchedule = async () => {
    if (!selectedDate || !selectedEmployee || !selectedShift) return

    setAddScheduleError(null)
    setAddScheduleLoading(true)

    const { error } = await supabase
      .from('schedules')
      .insert([{
        employee_id: selectedEmployee,
        work_date: format(selectedDate, 'yyyy-MM-dd'),
        shift_type: selectedShift,
      }])

    setAddScheduleLoading(false)

    if (error) {
      const msg = error.message || '新增排班失敗，請稍後再試'
      setAddScheduleError(msg)
      console.error('Error adding schedule:', error)
      return
    }

    setIsDialogOpen(false)
    fetchSchedules()
  }

  const handleDeleteSchedule = async (scheduleId: string) => {
    const { error } = await supabase
      .from('schedules')
      .delete()
      .eq('id', scheduleId)

    if (error) {
      console.error('Error deleting schedule:', error)
      return
    }

    fetchSchedules()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const days = getDaysInMonth()
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

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
          <div className="max-w-6xl mx-auto w-full">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">排班</h2>
              <div className="flex items-center justify-between sm:justify-end space-x-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="h-9 w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-base sm:text-lg font-medium min-w-[100px] sm:min-w-[120px] text-center">
                  {format(currentMonth, 'yyyy年MM月', { locale: zhTW })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="h-9 w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader className="py-3 sm:py-6 px-3 sm:px-6">
                <div className="flex flex-wrap gap-3 sm:gap-6 text-xs sm:text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-yellow-100 border border-yellow-200 rounded shrink-0"></div>
                    <span>早班 (平日)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-100 border border-blue-200 rounded shrink-0"></div>
                    <span>晚班 (平日)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 sm:w-4 sm:h-4 bg-green-100 border border-green-200 rounded shrink-0"></div>
                    <span>全日班 (假日)</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-2 sm:p-6 overflow-x-auto">
                {/* 月曆 */}
                <div className="grid grid-cols-7 gap-px bg-gray-200 border rounded-lg overflow-hidden min-w-[280px]">
                  {/* 星期標題 */}
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="bg-gray-50 p-1.5 sm:p-3 text-center text-xs sm:text-sm font-medium text-gray-700"
                    >
                      {day}
                    </div>
                  ))}
                  
                  {/* 空白格子補齊第一週 */}
                  {Array.from({ length: getDay(days[0]) }).map((_, index) => (
                    <div key={`empty-${index}`} className="bg-white p-1 sm:p-2 min-h-[70px] sm:min-h-[100px]" />
                  ))}
                  
                  {/* 日期格子 */}
                  {days.map((day) => {
                    const daySchedules = getSchedulesForDate(day)
                    const isWeekendDay = isWeekend(day)
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`bg-white p-1 sm:p-2 min-h-[70px] sm:min-h-[100px] cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors ${
                          isWeekendDay ? 'bg-red-50' : ''
                        }`}
                        onClick={() => handleDateClick(day)}
                      >
                        <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${
                          isWeekendDay ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5 sm:space-y-1">
                          {daySchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded border ${shiftColors[schedule.shift_type]} flex justify-between items-center gap-0.5`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSchedule(schedule.id)
                              }}
                            >
                              <span className="truncate">{schedule.employees.name}</span>
                              <Trash2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 opacity-50 hover:opacity-100 shrink-0" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* 底部導航 - 手機版 */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-lg z-40 safe-area-pb">
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

      {/* 新增排班對話框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto mx-3 sm:mx-4 w-[calc(100%-24px)] max-w-lg">
          <DialogHeader>
            <DialogTitle>新增排班</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, 'yyyy年MM月dd日', { locale: zhTW })}
              {selectedDate && isWeekend(selectedDate) && ' (假日)'}
              {selectedDate && !isWeekend(selectedDate) && ' (平日)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {addScheduleError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {addScheduleError}
                <br />
                <span className="text-xs">提示：請確認已登入，且 Supabase 環境變數已正確設定。</span>
              </div>
            )}
            {employees.length === 0 && (
              <div className="rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                尚無在職員工。請先到「員工管理」新增員工後再排班。
              </div>
            )}

            {/* 選擇員工 - 點選式 */}
            <div className="space-y-2">
              <label className="text-sm font-medium block">選擇員工</label>
              <div className="flex flex-wrap gap-2">
                {employees.map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => setSelectedEmployee(employee.id)}
                    disabled={employees.length === 0}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all min-w-[60px] touch-manipulation ${
                      selectedEmployee === employee.id
                        ? 'bg-blue-600 text-white ring-2 ring-blue-300 ring-offset-2'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                    } ${employees.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {employee.name}
                  </button>
                ))}
              </div>
            </div>

            {/* 選擇班段 - 點選式 */}
            <div className="space-y-2">
              <label className="text-sm font-medium block">選擇班段</label>
              <div className="flex flex-wrap gap-2">
                {selectedDate && getAvailableShifts(selectedDate).map((shift) => (
                  <button
                    key={shift.value}
                    type="button"
                    onClick={() => setSelectedShift(shift.value)}
                    className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all touch-manipulation whitespace-nowrap ${
                      selectedShift === shift.value
                        ? 'ring-2 ring-offset-2 ' + (shift.value === 'morning' ? 'bg-yellow-100 text-yellow-900 ring-yellow-300' : shift.value === 'evening' ? 'bg-blue-100 text-blue-900 ring-blue-300' : 'bg-green-100 text-green-900 ring-green-300')
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300'
                    }`}
                  >
                    {shift.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={addScheduleLoading} className="w-full sm:w-auto">
              取消
            </Button>
            <Button onClick={handleAddSchedule} disabled={!selectedEmployee || !selectedShift || addScheduleLoading} className="w-full sm:w-auto">
              {addScheduleLoading ? '新增中...' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
