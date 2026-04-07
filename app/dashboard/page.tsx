'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Users, Calendar, DollarSign, LogOut, Clock, RefreshCw, Wallet } from 'lucide-react'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { clearAdminSessionKeys } from '@/lib/adminSession'

const adminNavItems = [
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
  { href: '/dashboard/finance', label: '收支', icon: Wallet },
]

export default function DashboardPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { currentUserId, isAdmin, ready, clearCurrentUser } = useCurrentUser()

  useEffect(() => {
    if (!ready) return
    if (!currentUserId) {
      router.replace('/dashboard/select')
      return
    }
    if (currentUserId !== 'admin') {
      router.replace('/dashboard/schedule')
    }
  }, [ready, currentUserId, router])

  const handleLogout = async () => {
    clearAdminSessionKeys()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  if (!ready || !currentUserId || currentUserId !== 'admin') {
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
            {adminNavItems.map((item) => {
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
          <div className="max-w-6xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">歡迎使用排班系統</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              {adminNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="bg-white p-6 rounded-lg shadow-sm border hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{item.label}</h3>
                        <p className="text-sm text-gray-500">點擊進入</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* 底部導航 - 手機版 */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t shadow-lg z-40">
        <div className="flex justify-around items-stretch h-16 overflow-x-auto">
          {adminNavItems.map((item) => {
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
