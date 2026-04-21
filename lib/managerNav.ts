import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  Users,
  Calendar,
  Clock,
  DollarSign,
  Wallet,
  LineChart,
  ClipboardList,
} from 'lucide-react'

/** 店長後台側欄／底部導覽（與各 dashboard 頁一致） */
export const MANAGER_NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/dashboard', label: '總覽', icon: LayoutDashboard },
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/handover', label: '交接', icon: ClipboardList },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
  { href: '/dashboard/finance', label: '收支', icon: Wallet },
  { href: '/dashboard/sales', label: '銷售', icon: LineChart },
]
