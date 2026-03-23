'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Users, LogOut } from 'lucide-react'

const ADMIN_PASSWORD = '8888'

interface Employee {
  id: string
  name: string
  is_active: boolean
}

export default function SelectUserPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [showManagerPassword, setShowManagerPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    createClient()
      .from('employees')
      .select('id, name, is_active')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setEmployees(data || []))
  }, [])

  const handleSelectEmployee = (employeeId: string) => {
    sessionStorage.setItem('current_user_id', employeeId)
    sessionStorage.removeItem('admin_unlocked')
    router.push('/dashboard/schedule')
    router.refresh()
  }

  const handleSelectManager = () => {
    setShowManagerPassword(true)
  }

  const handleManagerPassword = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('current_user_id', 'admin')
      sessionStorage.setItem('admin_unlocked', '1')
      sessionStorage.setItem('salary_unlocked', '1')
      router.push('/dashboard')
      router.refresh()
    } else {
      setPasswordError('密碼錯誤')
    }
  }

  if (showManagerPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              管理者模式
            </CardTitle>
            <CardDescription>請輸入密碼以進入完整後台</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleManagerPassword} className="space-y-4">
              <Input
                type="password"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowManagerPassword(false)
                    setPassword('')
                    setPasswordError(null)
                  }}
                >
                  返回
                </Button>
                <Button type="submit" className="flex-1">
                  確認
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    sessionStorage.clear()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4 relative">
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-4 right-4"
        onClick={handleLogout}
      >
        <LogOut className="h-4 w-4 mr-1" />
        登出
      </Button>
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-bold text-center text-gray-900">誰在使用？</h1>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              員工
            </CardTitle>
            <CardDescription>查看排班並打卡</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {employees.map((emp) => (
                <Button
                  key={emp.id}
                  variant="outline"
                  className="flex-1 min-w-[100px]"
                  onClick={() => handleSelectEmployee(emp.id)}
                >
                  {emp.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              管理者
            </CardTitle>
            <CardDescription>完整後台（排班、打卡、員工、薪資）</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={handleSelectManager}>
              進入管理者模式
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
