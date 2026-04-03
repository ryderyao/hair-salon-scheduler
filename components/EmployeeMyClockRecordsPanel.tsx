'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { zhTW } from 'date-fns/locale'
import { calcHoursBetween } from '@/lib/clockRecordTimes'

interface ClockRow {
  id: string
  work_date: string
  clock_in_at: string
  clock_out_at: string | null
}

interface Props {
  supabase: SupabaseClient
  employeeId: string
  /** 今日打卡成功後遞增，以刷新本月列表 */
  refreshKey?: number
}

export function EmployeeMyClockRecordsPanel({
  supabase,
  employeeId,
  refreshKey = 0,
}: Props) {
  const [recordsMonth, setRecordsMonth] = useState(format(new Date(), 'yyyy-MM'))
  const [rows, setRows] = useState<ClockRow[]>([])
  const [recordsLoading, setRecordsLoading] = useState(false)

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

  const fetchMonthRecords = useCallback(async () => {
    if (!employeeId) return
    setRecordsLoading(true)
    const [y, m] = recordsMonth.split('-').map(Number)
    const start = startOfMonth(new Date(y, m - 1, 1))
    const end = endOfMonth(start)
    const from = format(start, 'yyyy-MM-dd')
    const to = format(end, 'yyyy-MM-dd')

    const { data, error } = await supabase
      .from('clock_records')
      .select('id, work_date, clock_in_at, clock_out_at')
      .eq('employee_id', employeeId)
      .gte('work_date', from)
      .lte('work_date', to)
      .order('work_date', { ascending: false })

    if (error) {
      console.error(error)
      setRows([])
    } else {
      setRows((data || []) as ClockRow[])
    }
    setRecordsLoading(false)
  }, [supabase, employeeId, recordsMonth, refreshKey])

  useEffect(() => {
    fetchMonthRecords()
  }, [fetchMonthRecords])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between space-y-0">
          <CardTitle>我的打卡紀錄</CardTitle>
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
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            僅供查閱。若有漏打或時間錯誤，請洽店長於「紀錄與補登」協助修正。
          </p>
          {recordsLoading ? (
            <div className="text-center py-8 text-gray-500">載入中…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-gray-500">此月份尚無您的打卡紀錄</div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="py-3 px-3 font-medium">日期</th>
                    <th className="py-3 px-3 font-medium">上班</th>
                    <th className="py-3 px-3 font-medium">下班</th>
                    <th className="py-3 px-3 font-medium text-center">時數</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const hours =
                      row.clock_out_at != null
                        ? `${calcHoursBetween(row.clock_in_at, row.clock_out_at)}`
                        : '—'
                    return (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="py-2 px-3 whitespace-nowrap">{row.work_date}</td>
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
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
