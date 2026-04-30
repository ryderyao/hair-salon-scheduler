/**
 * PT 計薪：依打卡起迄算原始時數（十進位小時）；計薪小時為「整數小時 +（零頭 ≥30 分加 0.5）」。
 * 加班時數另計，與正班相同時薪。
 */

/** 原始時數（小時，十進位；總分鐘÷60） */
export function rawHoursFromClock(clockInIso: string, clockOutIso: string): number {
  const ms = new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return ms / (1000 * 60 * 60)
}

/**
 * 單日計薪小時：總時長換算為「整小時 H + 零頭分鐘 R」，
 * R ≥ 30 分鐘則計薪加 0.5 小時，否則不加。
 */
export function billableHoursFromRaw(rawHours: number): number {
  const totalMinutes = Math.round(Math.max(0, rawHours) * 60)
  const H = Math.floor(totalMinutes / 60)
  const R = totalMinutes % 60
  return R >= 30 ? H + 0.5 : H
}

/** 畫面／報表：十進位小時 */
export function formatRawHoursDisplay(raw: number, decimals = 2): string {
  return raw.toFixed(decimals)
}

/** 對應「十進位小時」的口語長度，例如 5.78 → 「5小時47分」 */
export function formatDurationZhFromRawHours(rawHours: number): string {
  const mins = Math.round(Math.max(0, rawHours) * 60)
  const H = Math.floor(mins / 60)
  const M = mins % 60
  return `${H}小時${M}分`
}

/** 打卡計薪「同日」加總後應為 0.5 小時倍數；校正浮點誤差 */
export function snapBillableClockSumToHalfHour(totalHours: number): number {
  return Math.round(Math.max(0, totalHours) * 2) / 2
}
