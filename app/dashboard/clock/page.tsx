'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SiteBrand } from '@/components/SiteBrand'
import { AdminClockRecordsPanel } from '@/components/AdminClockRecordsPanel'
import { EmployeeMyClockRecordsPanel } from '@/components/EmployeeMyClockRecordsPanel'
import { LogOut, Clock, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { clearAdminSessionKeys } from '@/lib/adminSession'
import { MANAGER_NAV_ITEMS } from '@/lib/managerNav'
import { EMPLOYEE_NAV_ITEMS } from '@/lib/employeeNav'
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

type ClockTodaySectionProps = {
  currentTime: Date
  employees: Employee[]
  sortedTodayRecords: ClockRecord[]
  loading: boolean
  selectedEmployee: string | null
  setSelectedEmployee: (id: string | null) => void
  employeeClockSubtitle: (empId: string) => string
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
  sortedTodayRecords,
  loading,
  selectedEmployee,
  setSelectedEmployee,
  employeeClockSubtitle,
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
              const isSelected = selectedEmployee === emp.id
              const subtitle = employeeClockSubtitle(emp.id)
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
                  <span className="text-xs text-gray-500">{subtitle}</span>
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
          ) : sortedTodayRecords.length === 0 ? (
            <div className="text-center py-6 text-gray-500">尚無打卡紀錄</div>
          ) : (
            <div className="space-y-2">
              {sortedTodayRecords.map((rec) => {
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
      .order('clock_in_at', { ascending: true })
    if (currentUserId && currentUserId !== 'admin') {
      query = query.eq('employee_id', currentUserId)
    }
    const { data, error } = await query
    if (error) console.error('Error fetching clock records:', error)
    setTodayRecords(data || [])
    setLoading(false)
  }

  const getSegmentsAsc = useCallback(
    (empId: string) =>
      todayRecords
        .filter((r) => r.employee_id === empId)
        .sort((a, b) => new Date(a.clock_in_at).getTime() - new Date(b.clock_in_at).getTime()),
    [todayRecords]
  )

  const getOpenSegment = useCallback((empId: string): ClockRecord | undefined => {
    const opens = todayRecords.filter((r) => r.employee_id === empId && r.clock_out_at == null)
    if (opens.length === 0) return undefined
    return opens.reduce((best, r) =>
      new Date(r.clock_in_at).getTime() > new Date(best.clock_in_at).getTime() ? r : best
    )
  }, [todayRecords])

  const employeeClockSubtitle = useCallback(
    (empId: string) => {
      const segments = getSegmentsAsc(empId)
      const closedCount = segments.filter((s) => s.clock_out_at != null).length
      const open = getOpenSegment(empId)
      if (segments.length === 0) return '未打卡'
      if (open) return `上班中（第 ${closedCount + 1} 段）`
      return `已完成 ${segments.length} 段`
    },
    [getSegmentsAsc, getOpenSegment]
  )

  const canClockIn = useCallback((empId: string) => !getOpenSegment(empId), [getOpenSegment])

  const canClockOut = useCallback((empId: string) => !!getOpenSegment(empId), [getOpenSegment])

  const sortedTodayRecords = useMemo(() => {
    return [...todayRecords].sort((a, b) => {
      const ea = (a.employees as { name: string })?.name ?? ''
      const eb = (b.employees as { name: string })?.name ?? ''
      const n = ea.localeCompare(eb, 'zh-Hant')
      if (n !== 0) return n
      return new Date(a.clock_in_at).getTime() - new Date(b.clock_in_at).getTime()
    })
  }, [todayRecords])

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
      showMessage('error', '目前有進行中的班次，請先打下班卡後再打上班卡')
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
        showMessage('error', '無法新增打卡紀錄（可能與資料限制衝突），請洽店長')
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
    const open = getOpenSegment(selectedEmployee)
    if (!open) {
      setPunchLoading(false)
      showMessage('error', '沒有進行中的班次可下班')
      return
    }

    const { error } = await supabase
      .from('clock_records')
      .update({ clock_out_at: new Date().toISOString() })
      .eq('id', open.id)

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

  const navItems = isAdmin ? MANAGER_NAV_ITEMS : EMPLOYEE_NAV_ITEMS

  if (!userReady || !currentUserId) {
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
                    sortedTodayRecords={sortedTodayRecords}
                    loading={loading}
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    employeeClockSubtitle={employeeClockSubtitle}
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
                    sortedTodayRecords={sortedTodayRecords}
                    loading={loading}
                    selectedEmployee={selectedEmployee}
                    setSelectedEmployee={setSelectedEmployee}
                    employeeClockSubtitle={employeeClockSubtitle}
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
