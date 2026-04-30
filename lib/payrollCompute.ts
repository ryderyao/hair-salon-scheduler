/**
 * PT 計薪：依打卡起迄算原始時數；計薪小時 = 無條件捨去至整數小時（每日）。
 * 加班時數另計，與正班相同時薪。
 */

/** 原始時數（小時，不分捨入） */
export function rawHoursFromClock(clockInIso: string, clockOutIso: string): number {
  const ms = new Date(clockOutIso).getTime() - new Date(clockInIso).getTime()
  if (!Number.isFinite(ms) || ms <= 0) return 0
  return ms / (1000 * 60 * 60)
}

/** 單日計薪整數小時 */
export function billableHoursFromRaw(rawHours: number): number {
  return Math.floor(Math.max(0, rawHours))
}

/** 畫面／報表用：原始時數取合理小數位 */
export function formatRawHoursDisplay(raw: number, decimals = 2): string {
  return raw.toFixed(decimals)
}
