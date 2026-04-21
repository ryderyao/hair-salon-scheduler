'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Check, X } from 'lucide-react'
import {
  emptyCleaningState,
  HANDOVER_CLEANING_ITEMS,
  HANDOVER_EVENING_ONLY,
  SHIFT_SLOT_LABEL,
  type HandoverCleaningKeys,
  type ShiftSlot,
} from '@/lib/handoverConstants'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'

type Employee = { id: string; name: string }

type HandoverRow = {
  id: string
  work_date: string
  shift_slot: ShiftSlot
  employee_id: string
  created_by_admin: boolean
} & HandoverCleaningKeys & {
  cash_reconciled: boolean
  cash_notes: string | null
  special_notes: string | null
  created_at: string
  updated_at: string
}

function rowToCleaning(r: HandoverRow): HandoverCleaningKeys {
  return {
    clean_service_area: r.clean_service_area,
    clean_smart_unit: r.clean_smart_unit,
    clean_styling_seating: r.clean_styling_seating,
    clean_trash_restroom: r.clean_trash_restroom,
    clean_consumables_tools: r.clean_consumables_tools,
    clean_water_light_audio: r.clean_water_light_audio,
    clean_evening_close: r.clean_evening_close,
  }
}

type Props = {
  supabase: SupabaseClient
  currentUserId: string
  isAdmin: boolean
}

function canEditRecord(r: HandoverRow, currentUserId: string, isAdmin: boolean): boolean {
  if (isAdmin) return true
  return r.employee_id === currentUserId
}

export function HandoverDashboard({ supabase, currentUserId, isAdmin }: Props) {
  const formAnchorRef = useRef<HTMLDivElement>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [listMonth, setListMonth] = useState(() => format(new Date(), 'yyyy-MM'))
  const [records, setRecords] = useState<HandoverRow[]>([])
  const [todayRows, setTodayRows] = useState<HandoverRow[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [todayLoading, setTodayLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [workDate, setWorkDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [shiftSlot, setShiftSlot] = useState<ShiftSlot>('morning')
  const [employeeId, setEmployeeId] = useState<string>('')
  const [cleaning, setCleaning] = useState<HandoverCleaningKeys>(() => emptyCleaningState())
  const [cashReconciled, setCashReconciled] = useState(false)
  const [cashNotes, setCashNotes] = useState('')
  const [specialNotes, setSpecialNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formMessage, setFormMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [viewingRecord, setViewingRecord] = useState<HandoverRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  useEffect(() => {
    supabase
      .from('employees')
      .select('id, name')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => setEmployees(data || []))
  }, [supabase])

  useEffect(() => {
    if (!isAdmin && currentUserId && currentUserId !== 'admin') {
      setEmployeeId(currentUserId)
    }
  }, [isAdmin, currentUserId])

  const loadTodayBoard = useCallback(async () => {
    setTodayLoading(true)
    const { data, error } = await supabase
      .from('handover_records')
      .select('*')
      .eq('work_date', todayStr)
      .order('shift_slot', { ascending: true })

    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        setFetchError((prev) => prev ?? '尚未建立交接表，請在 Supabase 執行 migration_handover.sql。')
      } else {
        setFetchError((prev) => prev ?? error.message)
      }
      setTodayRows([])
    } else {
      setTodayRows((data as HandoverRow[]) || [])
    }
    setTodayLoading(false)
  }, [supabase, todayStr])

  const loadRecords = useCallback(async () => {
    setListLoading(true)
    setFetchError(null)
    const start = format(startOfMonth(new Date(listMonth + '-01')), 'yyyy-MM-dd')
    const end = format(endOfMonth(new Date(listMonth + '-01')), 'yyyy-MM-dd')
    const { data, error } = await supabase
      .from('handover_records')
      .select('*')
      .gte('work_date', start)
      .lte('work_date', end)
      .order('work_date', { ascending: false })
      .order('shift_slot', { ascending: true })

    if (error) {
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        setFetchError('尚未建立交接表，請在 Supabase 執行 migration_handover.sql。')
      } else {
        setFetchError(error.message)
      }
      setRecords([])
    } else {
      setRecords((data as HandoverRow[]) || [])
    }
    setListLoading(false)
  }, [supabase, listMonth])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  useEffect(() => {
    loadTodayBoard()
  }, [loadTodayBoard])

  const applyRowToForm = (r: HandoverRow) => {
    setWorkDate(r.work_date)
    setShiftSlot(r.shift_slot)
    setEmployeeId(r.employee_id)
    setCleaning(rowToCleaning(r))
    setCashReconciled(r.cash_reconciled)
    setCashNotes(r.cash_notes || '')
    setSpecialNotes(r.special_notes || '')
    setFormMessage(null)
    formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const clearForm = () => {
    setWorkDate(format(new Date(), 'yyyy-MM-dd'))
    setShiftSlot('morning')
    if (isAdmin) setEmployeeId(employees[0]?.id || '')
    else if (currentUserId !== 'admin') setEmployeeId(currentUserId)
    setCleaning(emptyCleaningState())
    setCashReconciled(false)
    setCashNotes('')
    setSpecialNotes('')
    setFormMessage(null)
  }

  const startFillSlot = (slot: ShiftSlot) => {
    setWorkDate(todayStr)
    setShiftSlot(slot)
    setCleaning(emptyCleaningState())
    setCashReconciled(false)
    setCashNotes('')
    setSpecialNotes('')
    setFormMessage(null)
    if (isAdmin) {
      if (!employeeId && employees[0]) setEmployeeId(employees[0].id)
    } else if (currentUserId !== 'admin') {
      setEmployeeId(currentUserId)
    }
    formAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    if (isAdmin && employees.length && !employeeId) setEmployeeId(employees[0].id)
  }, [isAdmin, employees, employeeId])

  const eveningRequired = shiftSlot === 'evening'

  const effectiveEmployeeId = isAdmin ? employeeId : currentUserId

  const validate = (): string | null => {
    for (const { key } of HANDOVER_CLEANING_ITEMS) {
      if (!cleaning[key]) return '請完成所有清潔勾選項目。'
    }
    if (eveningRequired && !cleaning.clean_evening_close) return '晚班請勾選「關店安檢」項目。'
    if (!cashReconciled) return '請勾選「本班結帳完成、帳務相符（正負零）」。'
    if (isAdmin && !employeeId) return '請選擇填寫人（員工）。'
    if (!isAdmin && (!currentUserId || currentUserId === 'admin')) return '請先選擇員工身分再填寫。'
    return null
  }

  const buildPayload = (eveningClose: boolean) => ({
    clean_service_area: cleaning.clean_service_area,
    clean_smart_unit: cleaning.clean_smart_unit,
    clean_styling_seating: cleaning.clean_styling_seating,
    clean_trash_restroom: cleaning.clean_trash_restroom,
    clean_consumables_tools: cleaning.clean_consumables_tools,
    clean_water_light_audio: cleaning.clean_water_light_audio,
    clean_evening_close: eveningClose ? cleaning.clean_evening_close : false,
    cash_reconciled: cashReconciled,
    cash_notes: cashNotes.trim() || null,
    special_notes: specialNotes.trim() || null,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormMessage(null)
    const err = validate()
    if (err) {
      setFormMessage({ type: 'err', text: err })
      return
    }

    const eveningClose = eveningRequired
    const payloadBase = buildPayload(eveningClose)

    const { data: existing, error: selErr } = await supabase
      .from('handover_records')
      .select('id, employee_id')
      .eq('work_date', workDate)
      .eq('shift_slot', shiftSlot)
      .maybeSingle()

    if (selErr) {
      setFormMessage({ type: 'err', text: selErr.message })
      return
    }

    if (existing) {
      if (!isAdmin && existing.employee_id !== currentUserId) {
        setFormMessage({
          type: 'err',
          text: '此班別已有紀錄，僅限該筆填寫人或店長可修改。',
        })
        return
      }
      const updatePayload = {
        ...payloadBase,
        employee_id: isAdmin ? employeeId : existing.employee_id,
        created_by_admin: isAdmin,
      }
      setSubmitting(true)
      const { error } = await supabase
        .from('handover_records')
        .update(updatePayload)
        .eq('id', existing.id)
      setSubmitting(false)
      if (error) {
        setFormMessage({ type: 'err', text: error.message || '儲存失敗' })
        return
      }
      setFormMessage({ type: 'ok', text: '已更新交接紀錄。' })
    } else {
      const insertPayload = {
        work_date: workDate,
        shift_slot: shiftSlot,
        employee_id: isAdmin ? employeeId : currentUserId,
        created_by_admin: isAdmin,
        ...payloadBase,
      }
      setSubmitting(true)
      const { error } = await supabase.from('handover_records').insert(insertPayload)
      setSubmitting(false)
      if (error) {
        if (error.code === '23505' || error.message?.includes('duplicate')) {
          setFormMessage({
            type: 'err',
            text: '此班別已有紀錄，請重新整理頁面後再編輯。',
          })
        } else {
          setFormMessage({ type: 'err', text: error.message || '儲存失敗' })
        }
        return
      }
      setFormMessage({ type: 'ok', text: '已新增交接紀錄。' })
    }

    loadRecords()
    loadTodayBoard()
  }

  const toggleClean = (key: keyof HandoverCleaningKeys, v: boolean) => {
    setCleaning((prev) => ({ ...prev, [key]: v }))
  }

  /** 目前表單中，與送出驗證一致的「清潔項目是否已全部勾選」 */
  const allCleaningSelected = useMemo(() => {
    const base = HANDOVER_CLEANING_ITEMS.every(({ key }) => cleaning[key])
    if (eveningRequired) {
      return base && cleaning.clean_evening_close
    }
    return base
  }, [cleaning, eveningRequired])

  /** 全選 ↔ 全部取消（晚班時含關店安檢） */
  const toggleSelectAllCleaning = () => {
    if (allCleaningSelected) {
      setCleaning(emptyCleaningState())
      return
    }
    setCleaning(() => {
      const next = { ...emptyCleaningState() }
      for (const { key } of HANDOVER_CLEANING_ITEMS) {
        next[key] = true
      }
      next.clean_evening_close = eveningRequired ? true : false
      return next
    })
  }

  const deleteHandoverById = async (id: string) => {
    if (!isAdmin) return
    if (!confirm('確定要刪除此筆交接紀錄嗎？此動作無法復原。')) return
    setDeleting(true)
    const { error } = await supabase.from('handover_records').delete().eq('id', id)
    setDeleting(false)
    if (error) {
      alert(error.message || '刪除失敗')
      return
    }
    setViewingRecord(null)
    await loadRecords()
    await loadTodayBoard()
  }

  const nameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of employees) m.set(e.id, e.name)
    return m
  }, [employees])

  const morningToday = todayRows.find((r) => r.shift_slot === 'morning')
  const eveningToday = todayRows.find((r) => r.shift_slot === 'evening')

  const renderSlotBoard = (slot: ShiftSlot, row: HandoverRow | undefined) => {
    const label = SHIFT_SLOT_LABEL[slot]
    if (todayLoading) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">載入中…</p>
        </div>
      )
    }
    if (!row) {
      return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
          <p className="text-sm text-slate-500">尚未填寫</p>
          <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => startFillSlot(slot)}>
            填寫{label}
          </Button>
        </div>
      )
    }
    const canEdit = canEditRecord(row, currentUserId, isAdmin)
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">{label}</h3>
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button type="button" variant="default" size="sm" className="bg-teal-700 hover:bg-teal-800" onClick={() => applyRowToForm(row)}>
                編輯
              </Button>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setViewingRecord(row)}>
                查看
              </Button>
            )}
          </div>
        </div>
        <dl className="text-sm space-y-1.5 text-slate-700">
          <div className="flex gap-2">
            <dt className="text-slate-500 shrink-0">填寫人</dt>
            <dd className="font-medium">{nameById.get(row.employee_id) || '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-slate-500 shrink-0">結帳</dt>
            <dd>{row.cash_reconciled ? '已確認' : '—'}</dd>
          </div>
          {row.special_notes ? (
            <div>
              <dt className="text-slate-500">特別狀況／交接</dt>
              <dd className="mt-0.5 text-slate-800 whitespace-pre-wrap line-clamp-4">{row.special_notes}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <Card className="border-teal-200 shadow-sm bg-teal-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg text-slate-900">今日交接看板</CardTitle>
          <p className="text-sm text-slate-600 mt-1">
            {format(new Date(todayStr + 'T12:00:00'), 'yyyy年M月d日 EEEE', { locale: zhTW })} — 全班可讀；僅該筆填寫人或店長可編輯。
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            {renderSlotBoard('morning', morningToday)}
            {renderSlotBoard('evening', eveningToday)}
          </div>
        </CardContent>
      </Card>

      <div ref={formAnchorRef}>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg text-slate-900">填寫交接班</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              每日最多兩筆（早班、晚班各一）。登入員工送出之填寫人為本人；可補填。請完成清潔勾選與結帳聲明後送出。
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="handover-date">日期</Label>
                  <input
                    id="handover-date"
                    type="date"
                    aria-label="交接日期"
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>班別</Label>
                  <Select
                    value={shiftSlot}
                    onValueChange={(v) => {
                      setShiftSlot(v as ShiftSlot)
                      setCleaning((c) =>
                        v === 'morning' ? { ...c, clean_evening_close: false } : c
                      )
                    }}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="morning">{SHIFT_SLOT_LABEL.morning}</SelectItem>
                      <SelectItem value="evening">{SHIFT_SLOT_LABEL.evening}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isAdmin ? (
                <div className="space-y-2">
                  <Label>填寫人（員工）</Label>
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="選擇員工" />
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
              ) : (
                <p className="text-sm text-slate-600">
                  填寫人：<span className="font-medium">{nameById.get(effectiveEmployeeId) || '—'}</span>
                  <span className="text-slate-400">（目前登入員工）</span>
                </p>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800">清潔項目</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs shrink-0"
                    onClick={toggleSelectAllCleaning}
                  >
                    {allCleaningSelected ? '取消全選' : '全選'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {HANDOVER_CLEANING_ITEMS.map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex items-start gap-3 cursor-pointer text-sm text-slate-700"
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                        checked={cleaning[key]}
                        onChange={(e) => toggleClean(key, e.target.checked)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                  {eveningRequired ? (
                    <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                        checked={cleaning[HANDOVER_EVENING_ONLY.key]}
                        onChange={(e) =>
                          toggleClean(HANDOVER_EVENING_ONLY.key, e.target.checked)
                        }
                      />
                      <span>{HANDOVER_EVENING_ONLY.label}</span>
                    </label>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
                <h3 className="text-sm font-semibold text-teal-900">結帳</h3>
                <label className="flex items-start gap-3 cursor-pointer text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    checked={cashReconciled}
                    onChange={(e) => setCashReconciled(e.target.checked)}
                  />
                  <span>本班已依店內規定完成結帳，現金／帳務相符（正負零）。</span>
                </label>
                <div className="space-y-1">
                  <Label htmlFor="cash-notes" className="text-slate-600">
                    結帳異常備註（選填）
                  </Label>
                  <textarea
                    id="cash-notes"
                    rows={2}
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="若有短溢或其他狀況請簡述"
                    value={cashNotes}
                    onChange={(e) => setCashNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="special-notes">特別狀況／交接事項（選填）</Label>
                <textarea
                  id="special-notes"
                  rows={3}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  placeholder="設備異常、客情、耗材提醒等"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                />
              </div>

              {formMessage ? (
                <p
                  className={`text-sm ${formMessage.type === 'ok' ? 'text-teal-700' : 'text-red-600'}`}
                >
                  {formMessage.text}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={submitting} className="bg-slate-900 hover:bg-slate-800">
                  {submitting ? '儲存中…' : '儲存交接紀錄'}
                </Button>
                <Button type="button" variant="outline" onClick={clearForm}>
                  清空表單
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg text-slate-900">交接紀錄</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              依月份瀏覽（可切換至任意月份查詢歷史）。點「帶入」僅限本人或店長可編輯表單。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="handover-list-month" className="text-xs text-slate-500 shrink-0">
              月份
            </Label>
            <input
              id="handover-list-month"
              type="month"
              aria-label="查詢交接紀錄的月份"
              className="rounded-md border border-slate-200 px-2 py-1.5 text-sm"
              value={listMonth}
              onChange={(e) => setListMonth(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {fetchError ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {fetchError}
            </p>
          ) : listLoading ? (
            <p className="text-sm text-slate-500">載入中…</p>
          ) : records.length === 0 ? (
            <p className="text-sm text-slate-500">此月份尚無紀錄。</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3 font-medium">日期</th>
                    <th className="py-2 pr-3 font-medium">班別</th>
                    <th className="py-2 pr-3 font-medium">填寫人</th>
                    <th className="py-2 pr-3 font-medium">結帳</th>
                    <th className="py-2 pr-3 font-medium">店長代填</th>
                    <th className="py-2 font-medium min-w-[8rem]"></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r) => {
                    const canEdit = canEditRecord(r, currentUserId, isAdmin)
                    return (
                      <tr key={r.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {format(new Date(r.work_date + 'T12:00:00'), 'M/d (EEE)', {
                            locale: zhTW,
                          })}
                        </td>
                        <td className="py-2 pr-3">{SHIFT_SLOT_LABEL[r.shift_slot]}</td>
                        <td className="py-2 pr-3">{nameById.get(r.employee_id) || '—'}</td>
                        <td className="py-2 pr-3">{r.cash_reconciled ? '已確認' : '—'}</td>
                        <td className="py-2 pr-3">{r.created_by_admin ? '是' : '—'}</td>
                        <td className="py-2">
                          <div className="flex flex-wrap items-center gap-1">
                            {canEdit ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-teal-700"
                                onClick={() => applyRowToForm(r)}
                              >
                                帶入
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-slate-600"
                                onClick={() => setViewingRecord(r)}
                              >
                                查看
                              </Button>
                            )}
                            {isAdmin ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700"
                                disabled={deleting}
                                onClick={() => deleteHandoverById(r.id)}
                              >
                                刪除
                              </Button>
                            ) : null}
                          </div>
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

      <Dialog open={!!viewingRecord} onOpenChange={(open) => !open && setViewingRecord(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {viewingRecord ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {format(new Date(viewingRecord.work_date + 'T12:00:00'), 'yyyy/M/d (EEE)', {
                    locale: zhTW,
                  })}{' '}
                  · {SHIFT_SLOT_LABEL[viewingRecord.shift_slot]}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm text-slate-700">
                <p>
                  <span className="text-slate-500">填寫人：</span>
                  <span className="font-medium">{nameById.get(viewingRecord.employee_id) || '—'}</span>
                  {viewingRecord.created_by_admin ? (
                    <span className="text-slate-500">（店長代填）</span>
                  ) : null}
                </p>
                <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3">
                  <p className="font-medium text-slate-800 mb-2.5">清潔</p>
                  <ul className="space-y-2">
                    {HANDOVER_CLEANING_ITEMS.map(({ key, label }) => (
                      <li key={key} className="flex gap-2.5 items-start text-slate-700 leading-snug">
                        {viewingRecord[key] ? (
                          <Check className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
                        ) : (
                          <X className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" aria-hidden />
                        )}
                        <span>{label}</span>
                      </li>
                    ))}
                    {viewingRecord.shift_slot === 'evening' ? (
                      <li className="flex gap-2.5 items-start text-slate-700 leading-snug">
                        {viewingRecord.clean_evening_close ? (
                          <Check className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
                        ) : (
                          <X className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" aria-hidden />
                        )}
                        <span>{HANDOVER_EVENING_ONLY.label}</span>
                      </li>
                    ) : null}
                  </ul>
                </div>
                <p>
                  <span className="text-slate-500">結帳聲明：</span>
                  {viewingRecord.cash_reconciled ? (
                    <span className="inline-flex items-center gap-1 text-teal-800 font-medium">
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                      已確認
                    </span>
                  ) : (
                    '—'
                  )}
                </p>
                {viewingRecord.cash_notes ? (
                  <p className="whitespace-pre-wrap">
                    <span className="text-slate-500">結帳備註：</span>
                    {viewingRecord.cash_notes}
                  </p>
                ) : null}
                {viewingRecord.special_notes ? (
                  <p className="whitespace-pre-wrap">
                    <span className="text-slate-500">特別狀況／交接：</span>
                    {viewingRecord.special_notes}
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm">（無特別狀況文字）</p>
                )}
              </div>
              {isAdmin ? (
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting}
                    onClick={() => deleteHandoverById(viewingRecord.id)}
                  >
                    {deleting ? '刪除中…' : '刪除此筆紀錄'}
                  </Button>
                </DialogFooter>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
