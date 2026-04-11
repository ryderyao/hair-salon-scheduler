'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { LogOut, RefreshCw } from 'lucide-react'
import { useCurrentUser } from '@/lib/useCurrentUser'
import { clearAdminSessionKeys } from '@/lib/adminSession'
import { SiteBrand } from '@/components/SiteBrand'
import { SalesDashboard } from '@/components/SalesDashboard'
import { MANAGER_NAV_ITEMS } from '@/lib/managerNav'

export default function SalesPage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { currentUserId, ready, clearCurrentUser } = useCurrentUser()

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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">載入中...</div>
  }

  return (
    <div className="min-h-screen bg-slate-50/90 pb-24 md:pb-0">
      <header className="bg-white/95 backdrop-blur border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <SiteBrand />
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
        <aside className="hidden md:block w-64 bg-white border-r border-slate-200/80 min-h-[calc(100vh-64px)] shrink-0">
          <nav className="p-4 space-y-1.5">
            {MANAGER_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">銷售儀表板</h1>
            </div>
            <SalesDashboard />
          </div>
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-slate-200 z-40">
        <div className="flex justify-around items-stretch h-16 overflow-x-auto">
          {MANAGER_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center min-w-[3.75rem] flex-1 py-1.5 transition-colors ${
                  isActive ? 'text-slate-900' : 'text-slate-400'
                }`}
              >
                <Icon className="h-5 w-5 mb-0.5 shrink-0" />
                <span className="text-[10px] font-medium leading-tight text-center px-0.5">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
