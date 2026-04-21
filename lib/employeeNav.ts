import type { LucideIcon } from 'lucide-react'
import { Calendar, Clock, ClipboardList } from 'lucide-react'

/** 一般員工底部／側欄導覽（店長另有 MANAGER_NAV_ITEMS） */
export const EMPLOYEE_NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/handover', label: '交接', icon: ClipboardList },
]
