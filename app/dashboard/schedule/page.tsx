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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
    setIsDialogOpen(true)
  }

  const handleAddSchedule = async () => {
    if (!selectedDate || !selectedEmployee || !selectedShift) return

    const { error } = await supabase
      .from('schedules')
      .insert([{
        employee_id: selectedEmployee,
        work_date: format(selectedDate, 'yyyy-MM-dd'),
        shift_type: selectedShift,
      }])

    if (error) {
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
    <div className="min-h-screen bg-gray-50">
      {/* 頂部導航 */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-xl font-bold text-gray-900">洗頭店排班系統</h1>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              登出
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 側邊導航 */}
        <aside className="w-64 bg-white shadow-sm min-h-[calc(100vh-64px)]">
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
        <main className="flex-1 p-8">
          <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">排班</h2>
              <div className="flex items-center space-x-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-lg font-medium min-w-[120px] text-center">
                  {format(currentMonth, 'yyyy年MM月', { locale: zhTW })}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded"></div>
                    <span>早班 (平日)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-200 rounded"></div>
                    <span>晚班 (平日)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 bg-green-100 border border-green-200 rounded"></div>
                    <span>全日班 (假日)</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* 月曆 */}
                <div className="grid grid-cols-7 gap-px bg-gray-200 border rounded-lg overflow-hidden">
                  {/* 星期標題 */}
                  {weekDays.map((day) => (
                    <div
                      key={day}
                      className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-700"
                    >
                      {day}
                    </div>
                  ))}
                  
                  {/* 空白格子補齊第一週 */}
                  {Array.from({ length: getDay(days[0]) }).map((_, index) => (
                    <div key={`empty-${index}`} className="bg-white p-2 min-h-[100px]" />
                  ))}
                  
                  {/* 日期格子 */}
                  {days.map((day) => {
                    const daySchedules = getSchedulesForDate(day)
                    const isWeekendDay = isWeekend(day)
                    
                    return (
                      <div
                        key={day.toISOString()}
                        className={`bg-white p-2 min-h-[100px] cursor-pointer hover:bg-gray-50 transition-colors ${
                          isWeekendDay ? 'bg-red-50' : ''
                        }`}
                        onClick={() => handleDateClick(day)}
                      >
                        <div className={`text-sm font-medium mb-1 ${
                          isWeekendDay ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-1">
                          {daySchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className={`text-xs px-2 py-1 rounded border ${shiftColors[schedule.shift_type]} flex justify-between items-center`}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSchedule(schedule.id)
                              }}
                            >
                              <span>{schedule.employees.name}</span>
                              <Trash2 className="h-3 w-3 opacity-50 hover:opacity-100" />
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

      {/* 新增排班對話框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增排班</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, 'yyyy年MM月dd日', { locale: zhTW })}
              {selectedDate && isWeekend(selectedDate) && ' (假日)'}
              {selectedDate && !isWeekend(selectedDate) && ' (平日)'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">選擇員工</label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇員工" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">選擇班段</label>
              <Select value={selectedShift} onValueChange={setSelectedShift}>
                <SelectTrigger>
                  <SelectValue placeholder="請選擇班段" />
                </SelectTrigger>
                <SelectContent>
                  {selectedDate && getAvailableShifts(selectedDate).map((shift) => (
                    <SelectItem key={shift.value} value={shift.value}>
                      {shift.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddSchedule} disabled={!selectedEmployee || !selectedShift}>
              新增
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
