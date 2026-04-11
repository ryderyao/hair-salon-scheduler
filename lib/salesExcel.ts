import * as XLSX from 'xlsx'
import {
  SALES_HEADER_ROW,
  SALES_HEADER_ROW_LEGACY,
  SALES_SHEET_NAME,
} from '@/lib/salesExpectedHeaders'

export type SalesTransactionInput = {
  order_id: string
  completed_at: string
  invoice_no: string | null
  customer_name: string | null
  line_items: string | null
  staff_names: string | null
  payment_method: string | null
  sales_gross: number
  prepaid_amount: number
  discount_amount: number
  checkout_total: number
  refund_amount: number
  newebpay_txn_id: string | null
  linepay_offline_id: string | null
  linepay_online_id: string | null
  /** 新版 Excel「91APP Payments 交易編號」；舊版 20 欄匯出為 null */
  app_91_payments_txn_id: string | null
  order_status: string | null
  cashier: string | null
  card_last4: string | null
  bank_transfer_last5: string | null
  notes: string | null
}

function cellToString(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') {
    const t = v.trim()
    return t.length ? t : null
  }
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return String(v)
}

function cellToMoney(v: unknown): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/** 將完成結帳時間轉成 ISO；假設為台灣本地時間字串 */
export function parseCompletedAt(raw: unknown): string | null {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return raw.toISOString()
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = XLSX.SSF.parse_date_code(raw)
    if (!d) return null
    const iso = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0))
    return iso.toISOString()
  }
  if (typeof raw !== 'string') return null
  const t = raw.trim()
  if (!t) return null
  const m = t.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
  )
  if (m) {
    const hh = m[4].padStart(2, '0')
    const ss = (m[6] ?? '00').padStart(2, '0')
    return new Date(
      `${m[1]}-${m[2]}-${m[3]}T${hh}:${m[5]}:${ss}+08:00`
    ).toISOString()
  }
  const d = new Date(t)
  if (!isNaN(d.getTime())) return d.toISOString()
  return null
}

type HeaderVersion = 'current' | 'legacy'

function detectHeaderVersion(firstRow: unknown[]): HeaderVersion | null {
  const cells = firstRow.map((c) => String(c ?? '').trim())
  if (
    cells.length >= SALES_HEADER_ROW.length &&
    SALES_HEADER_ROW.every((h, i) => cells[i] === h)
  ) {
    return 'current'
  }
  if (
    cells.length >= SALES_HEADER_ROW_LEGACY.length &&
    SALES_HEADER_ROW_LEGACY.every((h, i) => cells[i] === h)
  ) {
    return 'legacy'
  }
  return null
}

function rowToInput(
  cells: unknown[],
  excelRowIndex: number,
  version: HeaderVersion
): { ok: true; value: SalesTransactionInput } | { ok: false; message: string } {
  const orderId = cellToString(cells[1])
  if (!orderId) {
    return { ok: false, message: `第 ${excelRowIndex} 列：訂單編號為空` }
  }
  const completedAt = parseCompletedAt(cells[0])
  if (!completedAt) {
    return { ok: false, message: `第 ${excelRowIndex} 列：完成結帳時間無法解析` }
  }

  if (version === 'legacy') {
    return {
      ok: true,
      value: {
        order_id: orderId,
        completed_at: completedAt,
        invoice_no: cellToString(cells[2]),
        customer_name: cellToString(cells[3]),
        line_items: cellToString(cells[4]),
        staff_names: cellToString(cells[5]),
        payment_method: cellToString(cells[6]),
        sales_gross: cellToMoney(cells[7]),
        prepaid_amount: cellToMoney(cells[8]),
        discount_amount: cellToMoney(cells[9]),
        checkout_total: cellToMoney(cells[10]),
        refund_amount: cellToMoney(cells[11]),
        newebpay_txn_id: cellToString(cells[12]),
        linepay_offline_id: cellToString(cells[13]),
        linepay_online_id: cellToString(cells[14]),
        app_91_payments_txn_id: null,
        order_status: cellToString(cells[15]),
        cashier: cellToString(cells[16]),
        card_last4: cellToString(cells[17]),
        bank_transfer_last5: cellToString(cells[18]),
        notes: cellToString(cells[19]),
      },
    }
  }

  return {
    ok: true,
    value: {
      order_id: orderId,
      completed_at: completedAt,
      invoice_no: cellToString(cells[2]),
      customer_name: cellToString(cells[3]),
      line_items: cellToString(cells[4]),
      staff_names: cellToString(cells[5]),
      payment_method: cellToString(cells[6]),
      sales_gross: cellToMoney(cells[7]),
      prepaid_amount: cellToMoney(cells[8]),
      discount_amount: cellToMoney(cells[9]),
      checkout_total: cellToMoney(cells[10]),
      refund_amount: cellToMoney(cells[11]),
      newebpay_txn_id: cellToString(cells[12]),
      linepay_offline_id: cellToString(cells[13]),
      linepay_online_id: cellToString(cells[14]),
      app_91_payments_txn_id: cellToString(cells[15]),
      order_status: cellToString(cells[16]),
      cashier: cellToString(cells[17]),
      card_last4: cellToString(cells[18]),
      bank_transfer_last5: cellToString(cells[19]),
      notes: cellToString(cells[20]),
    },
  }
}

export type ParsedSalesFile = {
  rows: SalesTransactionInput[]
  errors: { row: number; message: string }[]
}

export function parseSalesExportBuffer(buffer: Buffer): ParsedSalesFile | { error: string } {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const sheet = workbook.Sheets[SALES_SHEET_NAME]
  if (!sheet) {
    return { error: `找不到工作表「${SALES_SHEET_NAME}」，請確認為店家系統匯出檔。` }
  }
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][]
  if (!matrix.length) {
    return { error: '工作表為空。' }
  }
  const header = matrix[0] as unknown[]
  const headerVersion = detectHeaderVersion(header)
  if (!headerVersion) {
    return {
      error:
        '表頭與預期不符。請使用官方匯出檔（第一列須為「完成結帳時間、訂單編號…」；目前支援 20 欄舊版或 21 欄含「91APP Payments 交易編號」）。',
    }
  }

  const byOrderId = new Map<string, SalesTransactionInput>()
  const errors: { row: number; message: string }[] = []

  for (let i = 1; i < matrix.length; i++) {
    const excelRowIndex = i + 1
    const cells = matrix[i] as unknown[]
    if (!cells || cells.every((c) => c === null || c === undefined || c === '')) {
      continue
    }
    const parsed = rowToInput(cells, excelRowIndex, headerVersion)
    if (!parsed.ok) {
      errors.push({ row: excelRowIndex, message: parsed.message })
      continue
    }
    byOrderId.set(parsed.value.order_id, parsed.value)
  }

  const rows = Array.from(byOrderId.values())

  return { rows, errors }
}
