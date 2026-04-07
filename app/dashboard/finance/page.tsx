'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Users, Calendar, DollarSign, Clock, RefreshCw, Wallet, Trash2 } from 'lucide-react'
import { clearAdminSessionKeys, FINANCE_EDIT_UNLOCKED_KEY } from '@/lib/adminSession'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import {
  EXPENSE_GROUP_META,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type FinanceDirection,
  type ExpenseGroupId,
  getFinanceCategoryLabel,
  getExpenseGroupForCategory,
  isNoteRequired,
  isValidFinanceEntry,
} from '@/lib/financeCategories'

const navItems = [
  { href: '/dashboard/employees', label: '員工管理', icon: Users },
  { href: '/dashboard/schedule', label: '排班', icon: Calendar },
  { href: '/dashboard/clock', label: '打卡', icon: Clock },
  { href: '/dashboard/payroll', label: '薪資計算', icon: DollarSign },
  { href: '/dashboard/finance', label: '收支', icon: Wallet },
]

const FINANCE_EDIT_PASSWORD = '6666'

interface FinanceRow {
  id: string
  entry_date: string
  direction: FinanceDirection
  category_id: string
  amount: number
  note: string | null
  created_at: string
}

function formatMoney(n: number) {
  return `$${Number(n).toLocaleString('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function FinancePage() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [userReady, setUserReady] = useState(false)
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [rows, setRows] = useState<FinanceRow[]>([])
  const [listLoading, setListLoading] = useState(false)

  const [direction, setDirection] = useState<FinanceDirection>('expense')
  const [expenseGroup, setExpenseGroup] = useState<ExpenseGroupId>('fixed')
  const [incomeCategoryId, setIncomeCategoryId] = useState<string>(INCOME_CATEGORIES[0].id)
  const [expenseCategoryId, setExpenseCategoryId] = useState<string>(
    EXPENSE_CATEGORIES.fixed[0].id
  )
  const [entryDate, setEntryDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [amountInput, setAmountInput] = useState('')
  const [note, setNote] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [financeEditUnlocked, setFinanceEditUnlocked] = useState(false)
  const [showFinanceUnlockDialog, setShowFinanceUnlockDialog] = useState(false)
  const [financeUnlockInput, setFinanceUnlockInput] = useState('')
  const [financeUnlockError, setFinanceUnlockError] = useState<string | null>(null)

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    const uid = sessionStorage.getItem('current_user_id')
    const admin = sessionStorage.getItem('admin_unlocked') === '1' && uid === 'admin'
    if (!uid || !admin) {
      clearAdminSessionKeys()
      router.replace('/dashboard/select')
      return
    }
    setUserReady(true)
  }, [router])

  useEffect(() => {
    if (!userReady || typeof window === 'undefined') return
    setFinanceEditUnlocked(sessionStorage.getItem(FINANCE_EDIT_UNLOCKED_KEY) === '1')
  }, [userReady])

  const fetchMonth = useCallback(async () => {
    setListLoading(true)
    const [y, m] = selectedMonth.split('-').map(Number)
    const start = startOfMonth(new Date(y, m - 1, 1))
    const end = endOfMonth(start)
    const from = format(start, 'yyyy-MM-dd')
    const to = format(end, 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('finance_entries')
      .select('id, entry_date, direction, category_id, amount, note, created_at')
      .gte('entry_date', from)
      .lte('entry_date', to)

    if (error) {
      console.error(error)
      setRows([])
    } else {
      const list = (data || []).map((r) => ({
        ...r,
        amount: Number(r.amount),
      })) as FinanceRow[]
      list.sort((a, b) => {
        const d = b.entry_date.localeCompare(a.entry_date)
        if (d !== 0) return d
        return (b.created_at || '').localeCompare(a.created_at || '')
      })
      setRows(list)
    }
    setListLoading(false)
  }, [supabase, selectedMonth])

  useEffect(() => {
    if (!userReady) return
    fetchMonth()
  }, [userReady, fetchMonth])

  useEffect(() => {
    const first = EXPENSE_CATEGORIES[expenseGroup][0]?.id
    if (first) setExpenseCategoryId(first)
  }, [expenseGroup])

  const summary = useMemo(() => {
    let income = 0
    const expenseByGroup: Record<ExpenseGroupId, number> = {
      setup: 0,
      fixed: 0,
      variable: 0,
      payroll: 0,
    }
    for (const r of rows) {
      const amt = Number(r.amount)
      if (r.direction === 'income') {
        income += amt
      } else {
        const g = getExpenseGroupForCategory(r.category_id)
        if (g) expenseByGroup[g] += amt
      }
    }
    const expenseTotal = Object.values(expenseByGroup).reduce((a, b) => a + b, 0)
    return { income, expenseByGroup, expenseTotal, net: income - expenseTotal }
  }, [rows])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!financeEditUnlocked) {
      setFormError('請先輸入記帳密碼解鎖，才能新增紀錄。')
      setShowFinanceUnlockDialog(true)
      return
    }

    const categoryId = direction === 'income' ? incomeCategoryId : expenseCategoryId
    if (!isValidFinanceEntry(direction, categoryId)) {
      setFormError('科目無效，請重新選擇。')
      return
    }

    const noteTrim = note.trim()
    if (isNoteRequired(categoryId) && !noteTrim) {
      setFormError('此科目請填寫備註，說明支出或收入內容。')
      return
    }

    if (entryDate > todayStr) {
      setFormError('日期不可晚於今天。')
      return
    }

    const amt = parseFloat(amountInput.replace(/,/g, ''))
    if (Number.isNaN(amt) || amt <= 0) {
      setFormError('請輸入大於 0 的金額。')
      return
    }

    const rounded = Math.round(amt * 100) / 100

    setSaving(true)
    const { error } = await supabase.from('finance_entries').insert({
      entry_date: entryDate,
      direction,
      category_id: categoryId,
      amount: rounded,
      note: noteTrim || null,
    })
    setSaving(false)

    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        setFormError('資料表尚未建立。請在 Supabase 執行 supabase/migration_finance_entries.sql。')
      } else {
        setFormError(error.message || '儲存失敗')
      }
      return
    }

    setAmountInput('')
    setNote('')
    await fetchMonth()
  }

  const handleDelete = async (id: string) => {
    if (!financeEditUnlocked) {
      setShowFinanceUnlockDialog(true)
      return
    }
    if (!window.confirm('確定刪除此筆紀錄？')) return
    const { error } = await supabase.from('finance_entries').delete().eq('id', id)
    if (error) {
      window.alert(error.message || '刪除失敗')
      return
    }
    await fetchMonth()
  }

  const handleFinanceUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFinanceUnlockError(null)
    if (financeUnlockInput !== FINANCE_EDIT_PASSWORD) {
      setFinanceUnlockError('密碼錯誤')
      return
    }
    sessionStorage.setItem(FINANCE_EDIT_UNLOCKED_KEY, '1')
    setFinanceEditUnlocked(true)
    setShowFinanceUnlockDialog(false)
    setFinanceUnlockInput('')
  }

  const clearCurrentUser = () => {
    clearAdminSessionKeys()
    router.push('/dashboard/select')
    router.refresh()
  }

  const generateMonthOptions = () => {
    const options: { value: string; label: string }[] = []
    const current = new Date()
    for (let i = 0; i < 36; i++) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1)
      options.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'yyyy年MM月', { locale: zhTW }),
      })
    }
    return options
  }

  if (!userReady) {
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
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">收支記帳</h2>
            <p className="text-sm text-gray-600 mb-6">
              僅管理者使用。「月報表」可隨時檢視；「記一筆」與刪除明細須輸入記帳密碼解鎖（與店長後台密碼不同）。
            </p>

            <Tabs defaultValue="add" className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                <TabsTrigger value="add">記一筆</TabsTrigger>
                <TabsTrigger value="report">月報表</TabsTrigger>
              </TabsList>

              <TabsContent value="add" className="mt-0 space-y-6">
                {!financeEditUnlocked ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <span>記帳表單已鎖定。請先解鎖後再新增紀錄。</span>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowFinanceUnlockDialog(true)}>
                      輸入記帳密碼解鎖
                    </Button>
                  </div>
                ) : null}
                <Card>
                  <CardHeader>
                    <CardTitle>新增收支</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                      {formError ? (
                        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                          {formError}
                        </div>
                      ) : null}

                      <fieldset disabled={!financeEditUnlocked} className="space-y-5 min-w-0 border-0 p-0 m-0 disabled:opacity-60">
                      <div className="space-y-2">
                        <Label>類型</Label>
                        <Select
                          value={direction}
                          onValueChange={(v) => setDirection(v as FinanceDirection)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="income">收入</SelectItem>
                            <SelectItem value="expense">支出</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="entry-date">日期</Label>
                        <Input
                          id="entry-date"
                          type="date"
                          value={entryDate}
                          max={todayStr}
                          onChange={(e) => setEntryDate(e.target.value)}
                          required
                        />
                      </div>

                      {direction === 'income' ? (
                        <div className="space-y-2">
                          <Label>收入科目</Label>
                          <Select value={incomeCategoryId} onValueChange={setIncomeCategoryId}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {INCOME_CATEGORIES.map((c) => (
                                <SelectItem key={c.id} value={c.id}>
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label>支出大類</Label>
                            <Select
                              value={expenseGroup}
                              onValueChange={(v) => setExpenseGroup(v as ExpenseGroupId)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPENSE_GROUP_META.map((g) => (
                                  <SelectItem key={g.id} value={g.id}>
                                    {g.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>科目</Label>
                            <Select value={expenseCategoryId} onValueChange={setExpenseCategoryId}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES[expenseGroup].map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="amount">金額</Label>
                        <Input
                          id="amount"
                          type="number"
                          inputMode="decimal"
                          min={0.01}
                          step={0.01}
                          placeholder="0"
                          value={amountInput}
                          onChange={(e) => setAmountInput(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="note">備註</Label>
                        <textarea
                          id="note"
                          className="w-full min-h-[88px] px-3 py-2 text-sm border border-input rounded-md bg-background"
                          placeholder={
                            direction === 'income' && incomeCategoryId === 'income_other'
                              ? '其他收入請說明'
                              : direction === 'expense' && expenseCategoryId.endsWith('_other')
                              ? '其他支出請說明'
                              : '選填'
                          }
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                        />
                        {(direction === 'income' && incomeCategoryId === 'income_other') ||
                        (direction === 'expense' && expenseCategoryId.endsWith('_other')) ? (
                          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded px-2 py-1">
                            所選為「其他」科目時，備註為必填。
                          </p>
                        ) : null}
                      </div>

                      <Button type="submit" disabled={saving || !financeEditUnlocked} className="w-full sm:w-auto">
                        {saving ? '儲存中…' : '儲存'}
                      </Button>
                      </fieldset>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="report" className="mt-0 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <span className="text-sm font-medium text-gray-700">報表月份</span>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-full sm:w-[220px]">
                      <SelectValue placeholder="選擇月份" />
                    </SelectTrigger>
                    <SelectContent>
                      {generateMonthOptions().map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium text-gray-600">收入合計</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xl font-bold text-green-700">{formatMoney(summary.income)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium text-gray-600">支出合計</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xl font-bold text-red-700">{formatMoney(summary.expenseTotal)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="py-4">
                      <CardTitle className="text-sm font-medium text-gray-600">本月淨額</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p
                        className={`text-xl font-bold ${summary.net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}
                      >
                        {formatMoney(summary.net)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>支出依大類</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {EXPENSE_GROUP_META.map((g) => (
                      <div
                        key={g.id}
                        className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0"
                      >
                        <span className="text-gray-800">{g.label}</span>
                        <span className="font-medium">{formatMoney(summary.expenseByGroup[g.id])}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>科目小計</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {listLoading ? (
                      <p className="text-gray-500 text-center py-6">載入中…</p>
                    ) : rows.length === 0 ? (
                      <p className="text-gray-500 text-center py-6">此月份尚無紀錄</p>
                    ) : (
                      (() => {
                        const byCat = new Map<string, number>()
                        for (const r of rows) {
                          byCat.set(r.category_id, (byCat.get(r.category_id) || 0) + Number(r.amount))
                        }
                        const lines = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1])
                        return (
                          <ul className="space-y-2 text-sm">
                            {lines.map(([cid, total]) => (
                              <li key={cid} className="flex justify-between gap-4">
                                <span className="text-gray-700">{getFinanceCategoryLabel(cid)}</span>
                                <span className="font-medium shrink-0">{formatMoney(total)}</span>
                              </li>
                            ))}
                          </ul>
                        )
                      })()
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>明細列表</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {listLoading ? (
                      <p className="text-gray-500 text-center py-6">載入中…</p>
                    ) : rows.length === 0 ? (
                      <p className="text-gray-500 text-center py-6">此月份尚無紀錄</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-gray-50 text-left">
                              <th className="py-2 px-2 font-medium">日期</th>
                              <th className="py-2 px-2 font-medium">類型</th>
                              <th className="py-2 px-2 font-medium">科目</th>
                              <th className="py-2 px-2 font-medium text-right">金額</th>
                              <th className="py-2 px-2 font-medium">備註</th>
                              <th className="py-2 px-2 w-24 text-right font-medium text-gray-700">
                                {financeEditUnlocked ? '刪除' : <span className="text-xs font-normal text-amber-800">刪除須解鎖</span>}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => (
                              <tr key={r.id} className="border-b last:border-0">
                                <td className="py-2 px-2 whitespace-nowrap">{r.entry_date}</td>
                                <td className="py-2 px-2">
                                  {r.direction === 'income' ? (
                                    <span className="text-green-700">收入</span>
                                  ) : (
                                    <span className="text-red-700">支出</span>
                                  )}
                                </td>
                                <td className="py-2 px-2">{getFinanceCategoryLabel(r.category_id)}</td>
                                <td className="py-2 px-2 text-right font-medium">
                                  {formatMoney(Number(r.amount))}
                                </td>
                                <td className="py-2 px-2 max-w-[140px] truncate" title={r.note ?? ''}>
                                  {r.note ?? '—'}
                                </td>
                                <td className="py-2 px-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={`h-8 w-8 ${financeEditUnlocked ? 'text-gray-500 hover:text-red-600' : 'text-gray-400 hover:text-amber-700'}`}
                                    onClick={() => handleDelete(r.id)}
                                    aria-label={financeEditUnlocked ? '刪除' : '解鎖後刪除'}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <Dialog
        open={showFinanceUnlockDialog}
        onOpenChange={(open) => {
          setShowFinanceUnlockDialog(open)
          if (!open) {
            setFinanceUnlockInput('')
            setFinanceUnlockError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>記帳解鎖</DialogTitle>
            <DialogDescription>輸入密碼後，此分頁可新增紀錄與刪除明細（僅在目前瀏覽器分頁有效，切換使用者後須重新解鎖）。</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFinanceUnlockSubmit}>
            <div className="space-y-4 py-4">
              <Input
                type="password"
                value={financeUnlockInput}
                onChange={(e) => setFinanceUnlockInput(e.target.value)}
                placeholder="記帳密碼"
                autoFocus
                autoComplete="off"
              />
              {financeUnlockError ? <p className="text-sm text-red-600">{financeUnlockError}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowFinanceUnlockDialog(false)}>
                取消
              </Button>
              <Button type="submit">解鎖</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
