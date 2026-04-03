'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Pencil } from 'lucide-react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { calcHoursBetween, localDateTimesToRange } from '@/lib/clockRecordTimes'

interface Employee {
  id: string
  name: string
  is_active: boolean
}

interface ClockRow {
  id: string
  employee_id: string
  work_date: string
  clock_in_at: string
  clock_out_at: string | null
  employees: { name: string }
}

interface Props {
  supabase: SupabaseClient
  /** 同一月份時同步刷新「今日打卡」列表 */
  onRecordsChanged?: () => void
}

export function AdminClockRecordsPanel({ supabase, onRecordsChanged }: Props) {
  const [recordsMonth, setRecordsMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rows, setRows] = useState<ClockRow[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)

  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [addEmployeeId, setAddEmployeeId] = useState('')
  const [addWorkDate, setAddWorkDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [addTimeIn, setAddTimeIn] = useState('09:00')
  const [addTimeOut, setAddTimeOut] = useState('18:00')

  const [editing, setEditing] = useState<ClockRow | null>(null)
  const [editWorkDate, setEditWorkDate] = useState('')
  const [editTimeIn, setEditTimeIn] = useState('')
  const [editTimeOut, setEditTimeOut] = useState('')

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const generateMonthOptions = () => {
    const options: { value: string; label: string }[] = []
    const current = new Date()
    for (let i = 0; i < 24; i++) {
      const d = new Date(current.getFullYear(), current.getMonth() - i, 1)
      options.push({
        value: format(d, 'yyyy-MM'),
        label: format(d, 'yyyy年MM月', { locale: zhTW }),
      })
    }
    return options
  }

  const fetchEmployees = useCallback(async () => {
    const { data } = await supabase.from('employees').select('id, name, is_active').eq('is_active', true).order('name')
    setEmployees(data || [])
  }, [supabase])

  const fetchMonthRecords = useCallback(async () => {
    setRecordsLoading(true)
    const [y, m] = recordsMonth.split('-').map(Number)
    const start = startOfMonth(new Date(y, m - 1, 1))
    const end = endOfMonth(start)
    const from = format(start, 'yyyy-MM-dd')
    const to = format(end, 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('clock_records')
      .select('id, employee_id, work_date, clock_in_at, clock_out_at, employees(name)')
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: false })

    if (error) {
      console.error(error)
      setRows([])
    } else {
      const raw = data || []
      const list: ClockRow[] = raw.map((row: Record<string, unknown>) => {
        const emp = row.employees as { name: string } | { name: string }[] | null | undefined
        const name = Array.isArray(emp) ? emp[0]?.name : emp?.name
        return {
          id: row.id as string,
          employee_id: row.employee_id as string,
          work_date: row.work_date as string,
          clock_in_at: row.clock_in_at as string,
          clock_out_at: (row.clock_out_at as string | null) ?? null,
          employees: { name: name ?? '' },
        }
      })
      list.sort((a, b) => {
        const wd = b.work_date.localeCompare(a.work_date)
        if (wd !== 0) return wd
        const an = (a.employees as { name: string })?.name ?? ''
        const bn = (b.employees as { name: string })?.name ?? ''
        return an.localeCompare(bn, 'zh-Hant')
      })
      setRows(list)
    }
    setRecordsLoading(false)
  }, [supabase, recordsMonth])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    fetchMonthRecords()
  }, [fetchMonthRecords])

  const resetAddForm = () => {
    setAddEmployeeId('')
    setAddWorkDate(format(new Date(), 'yyyy-MM-dd'))
    setAddTimeIn('09:00')
    setAddTimeOut('18:00')
    setFormError(null)
  }

  const openAdd = () => {
    resetAddForm()
    if (employees.length > 0) setAddEmployeeId(employees[0].id)
    setAddOpen(true)
  }

  const validateWorkDateNotFuture = (d: string): string | null => {
    if (d > todayStr) return '出勤日不可晚於今天'
    return null
  }

  const handleAddSubmit = async () => {
    setFormError(null)
    if (!addEmployeeId) {
      setFormError('請選擇員工')
      return
    }
    const dateErr = validateWorkDateNotFuture(addWorkDate)
    if (dateErr) {
      setFormError(dateErr)
      return
    }
    const range = localDateTimesToRange(addWorkDate, addTimeIn, addTimeOut)
    if (!range.ok) {
      setFormError(range.error)
      return
    }

    setSaving(true)
    const { error } = await supabase.from('clock_records').insert({
      employee_id: addEmployeeId,
      work_date: addWorkDate,
      clock_in_at: range.clockIn.toISOString(),
      clock_out_at: range.clockOut.toISOString(),
    })
    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        setFormError('該員工此出勤日已有打卡紀錄，請改用「編輯」修改。')
      } else {
        setFormError(error.message || '新增失敗')
      }
      return
    }

    setAddOpen(false)
    await fetchMonthRecords()
    onRecordsChanged?.()
  }

  const openEdit = (row: ClockRow) => {
    setEditing(row)
    setEditWorkDate(row.work_date)
    setEditTimeIn(format(new Date(row.clock_in_at), 'HH:mm'))
    setEditTimeOut(row.clock_out_at ? format(new Date(row.clock_out_at), 'HH:mm') : '18:00')
    setFormError(null)
    setEditOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!editing) return
    setFormError(null)

    const dateErr = validateWorkDateNotFuture(editWorkDate)
    if (dateErr) {
      setFormError(dateErr)
      return
    }

    const range = localDateTimesToRange(editWorkDate, editTimeIn, editTimeOut)
    if (!range.ok) {
      setFormError(range.error)
      return
    }

    setSaving(true)
    const { error } = await supabase
      .from('clock_records')
      .update({
        work_date: editWorkDate,
        clock_in_at: range.clockIn.toISOString(),
        clock_out_at: range.clockOut.toISOString(),
      })
      .eq('id', editing.id)

    setSaving(false)

    if (error) {
      if (error.code === '23505') {
        setFormError('無法變更：該員工在選定的日期已有其他紀錄。')
      } else {
        setFormError(error.message || '更新失敗')
      }
      return
    }

    setEditOpen(false)
    setEditing(null)
    await fetchMonthRecords()
    onRecordsChanged?.()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle>紀錄查詢與補登</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full sm:w-auto">
            <Select value={recordsMonth} onValueChange={setRecordsMonth}>
              <SelectTrigger className="w-full sm:w-[200px]">
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
            <Button type="button" onClick={openAdd} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              新增紀錄
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            僅管理者可補登或修改。每位員工每日一筆；下班時間可晚於午夜（跨日）時，若同日較早，系統會自動視為隔天下班。
          </p>
          {recordsLoading ? (
            <div className="text-center py-8 text-gray-500">載入中…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">此月份尚無打卡紀錄</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-3 font-medium">日期</th>
                    <th className="py-3 px-3 font-medium">員工</th>
                    <th className="py-3 px-3 font-medium">上班</th>
                    <th className="py-3 px-3 font-medium">下班</th>
                    <th className="py-3 px-3 font-medium text-center">時數</th>
                    <th className="py-3 px-3 font-medium w-24">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const name = (row.employees as { name: string })?.name ?? '—'
                    const hours =
                      row.clock_out_at != null
                        ? `${calcHoursBetween(row.clock_in_at, row.clock_out_at)}`
                        : '—'
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 px-3 whitespace-nowrap">{row.work_date}</td>
                        <td className="py-2 px-3">{name}</td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {format(new Date(row.clock_in_at), 'yyyy-MM-dd HH:mm')}
                        </td>
                        <td className="py-2 px-3 whitespace-nowrap">
                          {row.clock_out_at ? (
                            format(new Date(row.clock_out_at), 'yyyy-MM-dd HH:mm')
                          ) : (
                            <span className="text-amber-600">未打下班</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">{hours}</td>
                        <td className="py-2 px-3">
                          <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setAddOpen(false)
            setFormError(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增打卡紀錄</DialogTitle>
            <DialogDescription>補登漏打或忘打；每位員工同一天僅一筆。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label>員工</Label>
              <Select
                value={addEmployeeId || undefined}
                onValueChange={setAddEmployeeId}
                disabled={employees.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={employees.length === 0 ? '尚無在職員工' : '選擇員工'} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-work-date">出勤日</Label>
              <input
                id="add-work-date"
                type="date"
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={addWorkDate}
                max={todayStr}
                onChange={(e) => setAddWorkDate(e.target.value)}
                aria-label="出勤日"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="add-in">上班時間</Label>
                <input
                  id="add-in"
                  type="time"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={addTimeIn}
                  onChange={(e) => setAddTimeIn(e.target.value)}
                  aria-label="上班時間"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-out">下班時間</Label>
                <input
                  id="add-out"
                  type="time"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={addTimeOut}
                  onChange={(e) => setAddTimeOut(e.target.value)}
                  aria-label="下班時間"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={saving} onClick={handleAddSubmit}>
              {saving ? '儲存中…' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setEditOpen(false)
            setEditing(null)
            setFormError(null)
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>編輯打卡紀錄</DialogTitle>
            <DialogDescription>修正時間或出勤日（不可與該員工其他日期紀錄衝突）。</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formError && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                {formError}
              </div>
            )}
            <div className="space-y-2">
              <Label>員工</Label>
              <p className="text-sm font-medium text-gray-900 py-2">
                {editing
                  ? (editing.employees as { name: string })?.name ?? '—'
                  : '—'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-work-date">出勤日</Label>
              <input
                id="edit-work-date"
                type="date"
                className="w-full px-3 py-2 border rounded-md text-sm"
                value={editWorkDate}
                max={todayStr}
                onChange={(e) => setEditWorkDate(e.target.value)}
                aria-label="出勤日"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit-in">上班時間</Label>
                <input
                  id="edit-in"
                  type="time"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={editTimeIn}
                  onChange={(e) => setEditTimeIn(e.target.value)}
                  aria-label="上班時間"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-out">下班時間</Label>
                <input
                  id="edit-out"
                  type="time"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  value={editTimeOut}
                  onChange={(e) => setEditTimeOut(e.target.value)}
                  aria-label="下班時間"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setEditOpen(false)
                setEditing(null)
              }}
            >
              取消
            </Button>
            <Button type="button" disabled={saving} onClick={handleEditSubmit}>
              {saving ? '儲存中…' : '儲存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
