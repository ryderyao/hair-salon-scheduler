'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { clearAdminSessionKeys } from '@/lib/adminSession'

const STORAGE_USER = 'current_user_id'
const STORAGE_ADMIN = 'admin_unlocked'

export function useCurrentUser() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const uid = sessionStorage.getItem(STORAGE_USER)
    const admin = sessionStorage.getItem(STORAGE_ADMIN) === '1'
    setCurrentUserId(uid)
    setIsAdmin(admin && uid === 'admin')
    setReady(true)
  }, [])

  const setCurrentUser = useCallback((userId: string, admin?: boolean) => {
    sessionStorage.setItem(STORAGE_USER, userId)
    if (admin) sessionStorage.setItem(STORAGE_ADMIN, '1')
    setCurrentUserId(userId)
    setIsAdmin(!!admin)
  }, [])

  const clearCurrentUser = useCallback(() => {
    clearAdminSessionKeys()
    setCurrentUserId(null)
    setIsAdmin(false)
    router.push('/dashboard/select')
  }, [router])

  return { currentUserId, isAdmin, setCurrentUser, clearCurrentUser, ready }
}
