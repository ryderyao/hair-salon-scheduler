'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Users, Calendar, DollarSign, LogOut, Plus, Pencil, Power, Clock } from 'lucide-react'

interface Employee {
  id: string
  name: string
  is_active: boolean
  hourly_rate?: number
  created_at: string
}

const navItems = [
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
]

export default function EmployeesPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [newEmployeeName, setNewEmployeeName] = useState('')
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [editName, setEditName] = useState('')
  const [editHourlyRate, setEditHourlyRate] = useState(200)
  const [newEmployeeHourlyRate, setNewEmployeeHourlyRate] = useState(200)
  const [salaryUnlocked, setSalaryUnlocked] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  const SALARY_PASSWORD = '8888'

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('salary_unlocked') === '1') {
      setSalaryUnlocked(true)
    }
  }, [])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    if (passwordInput === SALARY_PASSWORD) {
      setSalaryUnlocked(true)
      sessionStorage.setItem('salary_unlocked', '1')
      setShowPasswordDialog(false)
      setPasswordInput('')
    } else {
      setPasswordError('密碼錯誤')
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [])

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching employees:', error)
      return
    }

    setEmployees(data || [])
    setLoading(false)
  }

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmployeeName.trim()) return

    const { error } = await supabase
      .from('employees')
      .insert([{ name: newEmployeeName.trim(), hourly_rate: newEmployeeHourlyRate }])

    if (error) {
      console.error('Error adding employee:', error)
      return
    }

    setNewEmployeeName('')
    setNewEmployeeHourlyRate(200)
    setIsAddDialogOpen(false)
    fetchEmployees()
  }

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEmployee || !editName.trim()) return

    const { error } = await supabase
      .from('employees')
      .update({ name: editName.trim(), hourly_rate: editHourlyRate })
      .eq('id', editingEmployee.id)

    if (error) {
      console.error('Error updating employee:', error)
      return
    }

    setEditingEmployee(null)
    setEditName('')
    setIsEditDialogOpen(false)
    fetchEmployees()
  }

  const handleToggleStatus = async (employee: Employee) => {
    const { error } = await supabase
      .from('employees')
      .update({ is_active: !employee.is_active })
      .eq('id', employee.id)

    if (error) {
      console.error('Error toggling employee status:', error)
      return
    }

    fetchEmployees()
  }

  const openEditDialog = (employee: Employee) => {
    setEditingEmployee(employee)
    setEditName(employee.name)
    setEditHourlyRate(employee.hourly_rate ?? 200)
    setIsEditDialogOpen(true)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

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
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">員工管理</h2>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                新增員工
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>員工列表</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-gray-500">載入中...</div>
                ) : employees.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">尚無員工資料</div>
                ) : (
                  <div className="space-y-4">
                    {employees.map((employee) => (
                      <div
                        key={employee.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{employee.name}</span>
                            {salaryUnlocked ? (
                              <span className="text-sm text-gray-500">${(employee.hourly_rate ?? 200)}/hr</span>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-6 px-2 text-gray-500"
                                onClick={() => setShowPasswordDialog(true)}
                              >
                                設定薪資
                              </Button>
                            )}
                          </div>
                          {employee.is_active ? (
                            <Badge variant="default">啟用中</Badge>
                          ) : (
                            <Badge variant="secondary">已停用</Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(employee)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(employee)}
                          >
                            <Power className={`h-4 w-4 ${employee.is_active ? 'text-green-500' : 'text-gray-400'}`} />
                          </Button>
                        </div>
                      </div>
                    ))}
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

      {/* 新增員工對話框 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增員工</DialogTitle>
            <DialogDescription>請輸入員工姓名</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddEmployee}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名</Label>
                <Input
                  id="name"
                  value={newEmployeeName}
                  onChange={(e) => setNewEmployeeName(e.target.value)}
                  placeholder="請輸入員工姓名"
                  required
                />
              </div>
              {salaryUnlocked ? (
                <div className="space-y-2">
                  <Label htmlFor="hourlyRate">時薪 ($/小時)</Label>
                  <Input
                    id="hourlyRate"
                    type="number"
                    min={200}
                    max={250}
                    value={newEmployeeHourlyRate}
                    onChange={(e) => setNewEmployeeHourlyRate(Math.min(250, Math.max(200, parseInt(e.target.value) || 200)))}
                  />
                  <p className="text-xs text-gray-500">範圍：200 ~ 250</p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  設定薪資（需密碼）
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">新增</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 編輯員工對話框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯員工</DialogTitle>
            <DialogDescription>修改員工姓名</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditEmployee}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="editName">姓名</Label>
                <Input
                  id="editName"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="請輸入員工姓名"
                  required
                />
              </div>
              {salaryUnlocked ? (
                <div className="space-y-2">
                  <Label htmlFor="editHourlyRate">時薪 ($/小時)</Label>
                  <Input
                    id="editHourlyRate"
                    type="number"
                    min={200}
                    max={250}
                    value={editHourlyRate}
                    onChange={(e) => setEditHourlyRate(Math.min(250, Math.max(200, parseInt(e.target.value) || 200)))}
                  />
                  <p className="text-xs text-gray-500">範圍：200 ~ 250</p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowPasswordDialog(true)}
                >
                  設定薪資（需密碼）
                </Button>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                取消
              </Button>
              <Button type="submit">儲存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 薪資密碼對話框 */}
      <Dialog open={showPasswordDialog} onOpenChange={(open) => { setShowPasswordDialog(open); if (!open) { setPasswordInput(''); setPasswordError(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>輸入密碼</DialogTitle>
            <DialogDescription>請輸入密碼以檢視或設定薪資</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit}>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="請輸入密碼"
                autoFocus
              />
              {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)}>
                取消
              </Button>
              <Button type="submit">確認</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
