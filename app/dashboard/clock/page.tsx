'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AdminClockRecordsPanel } from '@/components/AdminClockRecordsPanel'
import { EmployeeMyClockRecordsPanel } from '@/components/EmployeeMyClockRecordsPanel'
import { Users, Calendar, DollarSign, LogOut, Clock, RefreshCw, Wallet, LayoutDashboard } from 'lucide-react'
import { format } from 'date-fns'
import { clearAdminSessionKeys } from '@/lib/adminSession'
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

const adminNavItems = [
  { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
  { href: '/dashboard/finance', label: '收支', icon: Wallet },
]
const employeeNavItems = [
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
]

type ClockTodaySectionProps = {
  currentTime: Date
  employees: Employee[]
  todayRecords: ClockRecord[]
  loading: boolean
  selectedEmployee: string | null
  setSelectedEmployee: (id: string | null) => void
  getRecordForEmployee: (empId: string) => ClockRecord | undefined
  canClockIn: (empId: string) => boolean
  canClockOut: (empId: string) => boolean
  handleClockIn: () => void
  handleClockOut: () => void
  punchLoading: boolean
  message: { type: 'success' | 'error'; text: string } | null
}

function ClockTodaySection({
  currentTime,
  employees,
  todayRecords,
  loading,
  selectedEmployee,
  setSelectedEmployee,
  getRecordForEmployee,
  canClockIn,
  canClockOut,
  handleClockIn,
  handleClockOut,
  punchLoading,
  message,
}: ClockTodaySectionProps) {
  return (
    <>
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border text-center">
        <p className="text-sm text-gray-500 mb-1">
          {format(currentTime, 'yyyy年M月d日 EEEE', { locale: zhTW })}
        </p>
        <p className="text-3xl sm:text-4xl font-mono font-bold text-gray-900">
          {format(currentTime, 'HH:mm:ss')}
        </p>
      </div>

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
                !rec ? '未打卡' : rec.clock_out_at ? '已完成' : '上班中'
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
    </>
  )
}

export default function ClockPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userReady, setUserReady] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [todayRecords, setTodayRecords] = useState<ClockRecord[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [punchLoading, setPunchLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  /** 員工「我的打卡紀錄」在今日打卡成功後刷新 */
  const [myRecordsRefreshKey, setMyRecordsRefreshKey] = useState(0)

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const uid = sessionStorage.getItem('current_user_id')
    const admin = sessionStorage.getItem('admin_unlocked') === '1' && uid === 'admin'
    setCurrentUserId(uid)
    setIsAdmin(!!admin)
    setUserReady(true)
  }, [])

  useEffect(() => {
    if (!userReady) return
    if (!currentUserId) router.replace('/dashboard/select')
  }, [userReady, currentUserId, router])

  useEffect(() => {
    if (!currentUserId) return
    fetchEmployees()
    fetchTodayRecords()
  }, [currentUserId, todayStr])

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const fetchEmployees = async () => {
    let query = supabase.from('employees').select('*').eq('is_active', true).order('name')
    if (currentUserId && currentUserId !== 'admin') {
      query = query.eq('id', currentUserId)
    }
    const { data, error } = await query
    if (error) {
      console.error('Error fetching employees:', error)
      return
    }
    const list = data || []
    setEmployees(list)
    if (list.length === 1 && !selectedEmployee) setSelectedEmployee(list[0].id)
  }

  const fetchTodayRecords = async () => {
    setLoading(true)
    let query = supabase
      .from('clock_records')
      .select('*, employees(name)')
      .eq('work_date', todayStr)
      .order('clock_in_at', { ascending: false })
    if (currentUserId && currentUserId !== 'admin') {
      query = query.eq('employee_id', currentUserId)
    }
    const { data, error } = await query
    if (error) console.error('Error fetching clock records:', error)
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
    setMyRecordsRefreshKey((k) => k + 1)
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
    setMyRecordsRefreshKey((k) => k + 1)
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

  const navItems = isAdmin ? adminNavItems : employeeNavItems

  if (!userReady || !currentUserId) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">載入中...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-0">
      <header className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">洗頭店排班系統</h1>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={clearCurrentUser} className="shrink-0">
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">切換使用者</span>
              </Button>
              {isAdmin ? (
                <Button variant="ghost" size="sm" onClick={handleLogout} className="shrink-0">
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">登出</span>
                </Button>
              ) : null}
            </div>
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

            {isAdmin ? (
              <Tabs defaultValue="today" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                  <TabsTrigger value="today">今日打卡</TabsTrigger>
                  <TabsTrigger value="records">紀錄與補登</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="space-y-6 mt-0">
                  <ClockTodaySection
                    currentTime={currentTime}
                    employees={employees}
                    todayRecords={todayRecords}
                    loading={loading}
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    getRecordForEmployee={getRecordForEmployee}
                    canClockIn={canClockIn}
                    canClockOut={canClockOut}
                    handleClockIn={handleClockIn}
                    handleClockOut={handleClockOut}
                    punchLoading={punchLoading}
                    message={message}
                  />
                </TabsContent>
                <TabsContent value="records" className="mt-0">
                  <AdminClockRecordsPanel supabase={supabase} onRecordsChanged={fetchTodayRecords} />
                </TabsContent>
              </Tabs>
            ) : (
              <Tabs defaultValue="today" className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                  <TabsTrigger value="today">今日打卡</TabsTrigger>
                  <TabsTrigger value="my-records">我的打卡紀錄</TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="space-y-6 mt-0">
                  <ClockTodaySection
                    currentTime={currentTime}
                    employees={employees}
                    todayRecords={todayRecords}
                    loading={loading}
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    getRecordForEmployee={getRecordForEmployee}
                    canClockIn={canClockIn}
                    canClockOut={canClockOut}
                    handleClockIn={handleClockIn}
                    handleClockOut={handleClockOut}
                    punchLoading={punchLoading}
                    message={message}
                  />
                </TabsContent>
                <TabsContent value="my-records" className="mt-0">
                  <EmployeeMyClockRecordsPanel
                    supabase={supabase}
                    employeeId={currentUserId}
                    refreshKey={myRecordsRefreshKey}
                  />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>
      </div>

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
