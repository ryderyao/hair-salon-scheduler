# Supabase 資料表設定

若出現 `Could not find the table 'public.schedules'`，請在 Supabase 執行以下 SQL。

## 步驟

1. 前往 [Supabase Dashboard](https://supabase.com/dashboard) → 選擇專案 **hair-salon-scheder**
2. 左側點 **SQL Editor**
3. 新增 Query，貼上下方 SQL
4. 點 **Run**

---

## SQL 內容

```sql
-- 啟用 UUID 擴充
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 員工表
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 班表表
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  shift_type TEXT NOT NULL CHECK (shift_type IN ('morning', 'evening', 'full')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(employee_id, work_date, shift_type)
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(work_date);
CREATE INDEX IF NOT EXISTS idx_schedules_employee ON schedules(employee_id);

-- 啟用 Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- RLS 政策（已認證使用者可存取）
CREATE POLICY "Allow authenticated users to read employees"
  ON employees FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert employees"
  ON employees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update employees"
  ON employees FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete employees"
  ON employees FOR DELETE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to read schedules"
  ON schedules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert schedules"
  ON schedules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update schedules"
  ON schedules FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete schedules"
  ON schedules FOR DELETE TO authenticated USING (true);

-- 預設員工（僅在表格為空時執行）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM employees) THEN
    INSERT INTO employees (name) VALUES ('小華'), ('小美'), ('阿明');
  END IF;
END $$;
```

---

若已有 `employees` 表，可跳過建立表的語句，只執行 `schedules` 和 RLS 相關部分。
若出現「policy already exists」等錯誤，代表該政策已存在，可略過該行。

---

## 收支記帳（`finance_entries`）

若後台「收支」頁面出現資料表不存在的錯誤，請在 SQL Editor 執行專案內的 **`supabase/migration_finance_entries.sql`**。

須已存在 `update_updated_at_column` 函數（若已跑過 `schema.sql` 或 `migration_clock_records.sql` 通常已有）。

---

## 銷售匯入與明細（`sales_import_batches` / `sales_transactions`）

店長後台「**銷售**」頁面上傳店家匯出之 Excel 前，請在 SQL Editor 執行專案內的 **`supabase/migration_sales.sql`**。

須已存在 `update_updated_at_column` 函數（同上）。此組資料表與 `finance_entries` **分開**，僅供銷售儀表板與匯入紀錄使用。

若你**先前已跑過**較舊的 `migration_sales.sql`（尚無 **91APP** 欄），請再執行 **`supabase/migration_sales_91app_column.sql`** 新增 `app_91_payments_txn_id` 欄位，否則新版 21 欄 Excel 匯入會失敗。

---

## 交接班紀錄（`handover_records`）

若「**交接**」頁面出現資料表不存在的錯誤，請在 SQL Editor 執行專案內的 **`supabase/migration_handover.sql`**。

須已存在 `employees` 表與 `update_updated_at_column` 函數（若已跑過打卡相關 migration 通常已有）。
