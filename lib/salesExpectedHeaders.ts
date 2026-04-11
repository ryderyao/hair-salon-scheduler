/** 與店家「匯出紀錄」Excel 之「交易紀錄」工作表第一列一致（順序固定） */

export const SALES_SHEET_NAME = '交易紀錄'

/** 目前官方匯出（含 91APP 欄）共 21 欄 */
export const SALES_HEADER_ROW = [
  '完成結帳時間',
  '訂單編號',
  '發票號碼',
  '顧客',
  '結帳項目',
  '服務人員',
  '顧客付款方式',
  '銷售總額',
  '預付金額',
  '折扣金額',
  '結帳總金額',
  '退款金額',
  '藍新金流交易序號',
  'LINE Pay線下交易序號',
  'LINE Pay線上交易序號',
  '91APP Payments 交易編號',
  '訂單狀態',
  '結帳人員',
  '信用卡後4碼',
  '網銀轉帳後5碼',
  '備註',
] as const

/** 舊版匯出（無 91APP 欄）共 20 欄 — 仍允許匯入 */
export const SALES_HEADER_ROW_LEGACY = [
  '完成結帳時間',
  '訂單編號',
  '發票號碼',
  '顧客',
  '結帳項目',
  '服務人員',
  '顧客付款方式',
  '銷售總額',
  '預付金額',
  '折扣金額',
  '結帳總金額',
  '退款金額',
  '藍新金流交易序號',
  'LINE Pay線下交易序號',
  'LINE Pay線上交易序號',
  '訂單狀態',
  '結帳人員',
  '信用卡後4碼',
  '網銀轉帳後5碼',
  '備註',
] as const

export type SalesHeaderColumn = (typeof SALES_HEADER_ROW)[number]
