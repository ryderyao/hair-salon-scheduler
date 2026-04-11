-- 店家匯出之銷售 Excel 匯入與明細（與 finance_entries 分開）
-- 於 Supabase SQL Editor 執行（需已啟用 uuid-ossp 與 update_updated_at_column，見 schema.sql）

CREATE TABLE IF NOT EXISTS sales_import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  original_filename TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  row_count_file INT NOT NULL DEFAULT 0,
  inserted_count INT NOT NULL DEFAULT 0,
  updated_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  error_details JSONB,
  date_min TIMESTAMPTZ,
  date_max TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sales_import_batches_created_at ON sales_import_batches(created_at DESC);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  invoice_no TEXT,
  customer_name TEXT,
  line_items TEXT,
  staff_names TEXT,
  payment_method TEXT,
  sales_gross NUMERIC(14, 2) NOT NULL DEFAULT 0,
  prepaid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  checkout_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
  refund_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  newebpay_txn_id TEXT,
  linepay_offline_id TEXT,
  linepay_online_id TEXT,
  app_91_payments_txn_id TEXT,
  order_status TEXT,
  cashier TEXT,
  card_last4 TEXT,
  bank_transfer_last5 TEXT,
  notes TEXT,
  import_batch_id UUID REFERENCES sales_import_batches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT sales_transactions_order_id_unique UNIQUE (order_id)
);

CREATE INDEX IF NOT EXISTS idx_sales_transactions_completed_at ON sales_transactions(completed_at);
CREATE INDEX IF NOT EXISTS idx_sales_transactions_import_batch_id ON sales_transactions(import_batch_id);

DROP TRIGGER IF EXISTS update_sales_transactions_updated_at ON sales_transactions;
CREATE TRIGGER update_sales_transactions_updated_at
  BEFORE UPDATE ON sales_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE sales_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read sales_import_batches"
  ON sales_import_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert sales_import_batches"
  ON sales_import_batches FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sales_import_batches"
  ON sales_import_batches FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read sales_transactions"
  ON sales_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert sales_transactions"
  ON sales_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update sales_transactions"
  ON sales_transactions FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete sales_transactions"
  ON sales_transactions FOR DELETE TO authenticated USING (true);
