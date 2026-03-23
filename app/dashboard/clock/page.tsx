'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, DollarSign, LogOut, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

interface Employee {
  id: string
  name: string
  is_active: boolean
}

interface ClockRecord {
  id: string
  employee_id: string
  work_date: string
  clock_in_at: string
  clock_out_at: string | null
  employees: { name: string }
}

const navItems = [
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
]

export default function ClockPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [punchLoading, setPunchLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    fetchEmployees()
    fetchTodayRecords()
  }, [])

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

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

  const fetchTodayRecords = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('clock_records')
      .select('*, employees(name)')
      .eq('work_date', todayStr)
      .order('clock_in_at', { ascending: false })

    if (error) {
      console.error('Error fetching clock records:', error)
    }
    setTodayRecords(data || [])
    setLoading(false)
  }

  const getRecordForEmployee = (empId: string) =>
    todayRecords.find((r) => r.employee_id === empId)

  const canClockIn = (empId: string) => {
    const rec = getRecordForEmployee(empId)
    return !rec // 今日尚無紀錄才可上班打卡
  }

  const canClockOut = (empId: string) => {
    const rec = getRecordForEmployee(empId)
    return rec != null && rec.clock_out_at == null
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleClockIn = async () => {
    if (!selectedEmployee) {
      showMessage('error', '請先選擇人員')
      return
    }
    if (!canClockIn(selectedEmployee)) {
      showMessage('error', '已打上班卡，請先打下班卡')
      return
    }

    setPunchLoading(true)
    const now = new Date()
    const { error } = await supabase.from('clock_records').insert([
      {
        employee_id: selectedEmployee,
        work_date: format(now, 'yyyy-MM-dd'),
        clock_in_at: now.toISOString(),
      },
    ])

    setPunchLoading(false)
    if (error) {
      if (error.code === '23505') {
        showMessage('error', '今日已打上班卡')
      } else {
        showMessage('error', error.message || '打卡失敗')
      }
      return
    }

    setSelectedEmployee(null)
    showMessage('success', '上班打卡成功')
    fetchTodayRecords()
  }

  const handleClockOut = async () => {
    if (!selectedEmployee) {
      showMessage('error', '請先選擇人員')
      return
    }
    if (!canClockOut(selectedEmployee)) {
      showMessage('error', '尚未打上班卡或已打下班卡')
      return
    }

    setPunchLoading(true)
    const rec = getRecordForEmployee(selectedEmployee)
    if (!rec) return

    const { error } = await supabase
      .from('clock_records')
      .update({ clock_out_at: new Date().toISOString() })
      .eq('id', rec.id)

    setPunchLoading(false)
    if (error) {
      showMessage('error', error.message || '打卡失敗')
      return
    }

    setSelectedEmployee(null)
    showMessage('success', '下班打卡成功')
    fetchTodayRecords()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
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
                    isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'
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
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6">打卡</h2>

            {/* 即時時間 */}
            <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border text-center">
              <p className="text-sm text-gray-500 mb-1">
                {format(currentTime, 'yyyy年M月d日 EEEE', { locale: zhTW })}
              </p>
              <p className="text-3xl sm:text-4xl font-mono font-bold text-gray-900">
                {format(currentTime, 'HH:mm:ss')}
              </p>
            </div>

            {/* 選擇人員 - 點選按鈕 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>選擇人員</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {employees.map((emp) => {
                    const rec = getRecordForEmployee(emp.id)
                    const isSelected = selectedEmployee === emp.id
                    const status =
                      !rec
                        ? '未打卡'
                        : rec.clock_out_at
                        ? '已完成'
                        : '上班中'
                    return (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedEmployee(emp.id)}
                        className={`px-4 py-3 rounded-lg text-sm font-medium transition-all touch-manipulation ${
                          isSelected
                            ? 'ring-2 ring-offset-2 ring-blue-500 bg-blue-50 text-blue-900'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        <span className="block">{emp.name}</span>
                        <span className="text-xs text-gray-500">{status}</span>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 上班 / 下班按鈕 */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>打卡</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handleClockIn}
                    disabled={
                      punchLoading ||
                      !selectedEmployee ||
                      !canClockIn(selectedEmployee!)
                    }
                  >
                    上班打卡
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 border-amber-500 text-amber-700 hover:bg-amber-50"
                    onClick={handleClockOut}
                    disabled={
                      punchLoading ||
                      !selectedEmployee ||
                      !canClockOut(selectedEmployee!)
                    }
                  >
                    下班打卡
                  </Button>
                </div>
                {selectedEmployee && (
                  <p className="mt-3 text-sm text-gray-500">
                    已選擇：{employees.find((e) => e.id === selectedEmployee)?.name}
                  </p>
                )}
                {message && (
                  <p
                    className={`mt-3 text-sm ${
                      message.type === 'success' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {message.text}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* 今日打卡紀錄 */}
            <Card>
              <CardHeader>
                <CardTitle>今日打卡紀錄</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-6 text-gray-500">載入中...</div>
                ) : todayRecords.length === 0 ? (
                  <div className="text-center py-6 text-gray-500">尚無打卡紀錄</div>
                ) : (
                  <div className="space-y-2">
                    {todayRecords.map((rec) => {
                      const emp = rec.employees as { name: string }
                      return (
                        <div
                          key={rec.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <span className="font-medium">{emp.name}</span>
                          <div className="text-sm text-gray-600">
                            {format(new Date(rec.clock_in_at), 'HH:mm')}
                            {rec.clock_out_at ? (
                              <>～{format(new Date(rec.clock_out_at), 'HH:mm')}</>
                            ) : (
                              <span className="text-amber-600 ml-1">(上班中)</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

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
