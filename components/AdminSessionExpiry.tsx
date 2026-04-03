'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  ADMIN_SESSION_DURATION_MS,
  ADMIN_SESSION_EXPIRES_AT_KEY,
  clearAdminSessionKeys,
} from '@/lib/adminSession'

function redirectExpired(router: ReturnType<typeof useRouter>) {
  clearAdminSessionKeys()
  router.replace('/dashboard/select')
  router.refresh()
}

/**
 * 固定 15 分鐘管理者工作階段：自成功輸入管理密碼起算，到期後清空管理者狀態並回到選人頁。
 */
export function AdminSessionExpiry() {
  const router = useRouter()
  const pathname = usePathname()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clearTimer = () => {
      if (timeoutRef.current != null) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const schedule = () => {
      clearTimer()
      const uid = sessionStorage.getItem('current_user_id')
      const admin = sessionStorage.getItem('admin_unlocked') === '1'
      if (uid !== 'admin' || !admin) return

      let expiresRaw = sessionStorage.getItem(ADMIN_SESSION_EXPIRES_AT_KEY)
      if (!expiresRaw) {
        const t = Date.now() + ADMIN_SESSION_DURATION_MS
        sessionStorage.setItem(ADMIN_SESSION_EXPIRES_AT_KEY, String(t))
        expiresRaw = String(t)
      }
      const expiresAt = parseInt(expiresRaw, 10)
      if (Number.isNaN(expiresAt) || Date.now() >= expiresAt) {
        redirectExpired(router)
        return
      }
      const ms = expiresAt - Date.now()
      timeoutRef.current = setTimeout(() => {
        redirectExpired(router)
      }, ms)
    }

    schedule()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') schedule()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimer()
    }
  }, [pathname, router])

  return null
}
