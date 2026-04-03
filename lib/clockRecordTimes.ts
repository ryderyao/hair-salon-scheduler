/**
 * 將「出勤日」與本地 HH:mm 轉成可用於 clock_in_at / clock_out_at 的時間範圍。
 * 若下班時間不晚於上班（同日），視為跨日至隔日下班。
 */
export function localDateTimesToRange(
  workDate: string,
  clockInHHmm: string,
  clockOutHHmm: string
): { ok: true; clockIn: Date; clockOut: Date } | { ok: false; error: string } {
  const inMs = new Date(`${workDate}T${clockInHHmm}:00`).getTime()
  let outMs = new Date(`${workDate}T${clockOutHHmm}:00`).getTime()
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) {
    return { ok: false, error: '時間格式錯誤' }
  }
  if (outMs <= inMs) {
    outMs += 24 * 60 * 60 * 1000
  }
  return { ok: true, clockIn: new Date(inMs), clockOut: new Date(outMs) }
}

export function calcHoursBetween(clockInIso: string, clockOutIso: string): number {
  const ms = new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10
}
