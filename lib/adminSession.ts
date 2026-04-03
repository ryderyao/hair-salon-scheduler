/** 管理者模式固定時長工作階段（成功輸入 8888 後起算） */

export const ADMIN_SESSION_EXPIRES_AT_KEY = 'admin_session_expires_at'

/** 15 分鐘 */
export const ADMIN_SESSION_DURATION_MS = 15 * 60 * 1000

export function setAdminSessionExpiryFromNow() {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(
    ADMIN_SESSION_EXPIRES_AT_KEY,
    String(Date.now() + ADMIN_SESSION_DURATION_MS)
  )
}

/** 離開管理者／切換使用者／強制到期時清空與身分相關的 sessionStorage */
export function clearAdminSessionKeys() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('current_user_id')
  sessionStorage.removeItem('admin_unlocked')
  sessionStorage.removeItem('salary_unlocked')
  sessionStorage.removeItem(ADMIN_SESSION_EXPIRES_AT_KEY)
}
