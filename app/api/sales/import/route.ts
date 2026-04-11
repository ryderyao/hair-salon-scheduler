import { createClient } from '@/lib/supabase/server'
import { parseSalesExportBuffer } from '@/lib/salesExcel'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Supabase 單次請求不宜過大；一般店家匯出多低於 1000 列，單批可降低中途失敗造成部分寫入 */
const UPSERT_CHUNK = 1000

type TxPayload = Record<string, unknown>

function isMissingApp91ColumnError(message: string): boolean {
  return (
    message.includes('app_91_payments_txn_id') ||
    (message.includes('schema cache') && message.includes('column'))
  )
}

/** 若資料表尚未執行 migration 新增 91APP 欄，略過該欄仍可匯入其餘欄位 */
function stripApp91Column(rows: TxPayload[]): TxPayload[] {
  return rows.map((r) => {
    const { app_91_payments_txn_id: _a, ...rest } = r as TxPayload & {
      app_91_payments_txn_id?: unknown
    }
    return rest
  })
}

export async function POST(request: Request) {
  try {
    return await handleSalesImport(request)
  } catch (e) {
    console.error('[api/sales/import]', e)
    const message =
      e instanceof Error ? e.message : '伺服器處理匯入時發生未預期錯誤。'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

async function handleSalesImport(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: '未登入，請先登入後再匯入。' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: '無法讀取上傳內容，請確認檔案大小未超過主機限制。' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '請選擇 .xlsx 檔案。' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return NextResponse.json({ error: '僅支援副檔名 .xlsx。' }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  const parsed = parseSalesExportBuffer(buf)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { rows, errors: parseErrors } = parsed
  if (rows.length === 0) {
    return NextResponse.json(
      { error: '沒有可匯入的資料列（或僅有空列）。' },
      { status: 400 }
    )
  }

  const orderIds = rows.map((r) => r.order_id)
  const existing = new Set<string>()
  const chunkSize = 150
  for (let i = 0; i < orderIds.length; i += chunkSize) {
    const chunk = orderIds.slice(i, i + chunkSize)
    const { data: found, error: selErr } = await supabase
      .from('sales_transactions')
      .select('order_id')
      .in('order_id', chunk)
    if (selErr) {
      if (
        selErr.message?.includes('relation') &&
        selErr.message?.includes('does not exist')
      ) {
        return NextResponse.json(
          {
            error:
              '資料表尚未建立。請在 Supabase 執行 supabase/migration_sales.sql 後再試。',
          },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: selErr.message || '讀取現有資料失敗' },
        { status: 500 }
      )
    }
    for (const r of found || []) {
      existing.add((r as { order_id: string }).order_id)
    }
  }

  let inserted = 0
  let updated = 0
  for (const id of orderIds) {
    if (existing.has(id)) updated += 1
    else inserted += 1
  }

  const dates = rows.map((r) => new Date(r.completed_at).getTime()).filter(Number.isFinite)
  const dateMin =
    dates.length > 0 ? new Date(Math.min(...dates)).toISOString() : null
  const dateMax =
    dates.length > 0 ? new Date(Math.max(...dates)).toISOString() : null

  const status: 'success' | 'partial' | 'failed' =
    parseErrors.length > 0 ? 'partial' : 'success'

  const { data: batchRow, error: batchErr } = await supabase
    .from('sales_import_batches')
    .insert({
      created_by: user.id,
      original_filename: file.name,
      status,
      row_count_file: rows.length,
      inserted_count: inserted,
      updated_count: updated,
      error_count: parseErrors.length,
      error_details:
        parseErrors.length > 0 ? parseErrors.slice(0, 50) : null,
      date_min: dateMin,
      date_max: dateMax,
    })
    .select('id')
    .single()

  if (batchErr || !batchRow) {
    return NextResponse.json(
      { error: batchErr?.message || '無法建立匯入紀錄' },
      { status: 500 }
    )
  }

  const batchId = batchRow.id as string

  let payload: TxPayload[] = rows.map((r) => ({
    ...r,
    import_batch_id: batchId,
  }))

  let omittedApp91Column = false

  const upsertAll = async (data: TxPayload[]) => {
    for (let i = 0; i < data.length; i += UPSERT_CHUNK) {
      const chunk = data.slice(i, i + UPSERT_CHUNK)
      const { error } = await supabase
        .from('sales_transactions')
        .upsert(chunk, { onConflict: 'order_id' })
      if (error) return error
    }
    return null
  }

  let upErr = await upsertAll(payload)
  if (upErr && isMissingApp91ColumnError(upErr.message || '')) {
    payload = stripApp91Column(payload)
    omittedApp91Column = true
    upErr = await upsertAll(payload)
  }

  if (upErr) {
    await supabase
      .from('sales_import_batches')
      .update({
        status: 'failed',
        error_details: [
          ...(parseErrors || []),
          { row: 0, message: upErr.message || '寫入資料庫失敗' },
        ].slice(0, 50),
      })
      .eq('id', batchId)
    return NextResponse.json(
      { error: upErr.message || '寫入銷售明細失敗' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    batchId,
    filename: file.name,
    rowCount: rows.length,
    insertedCount: inserted,
    updatedCount: updated,
    parseErrorCount: parseErrors.length,
    parseErrors: parseErrors.slice(0, 20),
    dateMin,
    dateMax,
    ...(omittedApp91Column
      ? {
          warning:
            '資料庫尚未建立「91APP Payments 交易編號」欄位，已略過該欄完成匯入。請在 Supabase 執行 supabase/migration_sales_91app_column.sql 後再匯入一次即可寫入該欄。',
        }
      : {}),
  })
}

