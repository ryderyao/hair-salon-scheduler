-- 若已執行過舊版 migration_sales.sql（無 91APP 欄），請在 SQL Editor 執行本檔新增欄位。
-- 新版官方匯出在「LINE Pay線上交易序號」與「訂單狀態」之間多一欄「91APP Payments 交易編號」。

ALTER TABLE sales_transactions
  ADD COLUMN IF NOT EXISTS app_91_payments_txn_id TEXT;
