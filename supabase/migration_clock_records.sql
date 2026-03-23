-- Migration: 打卡紀錄表
-- 執行方式：Supabase SQL Editor 貼上執行

-- 更新時間戳函數（若 schema 未建立過）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS clock_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_clock_records_employee ON clock_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_clock_records_work_date ON clock_records(work_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clock_records_employee_date 
  ON clock_records(employee_id, work_date);

-- 觸發器
DROP TRIGGER IF EXISTS update_clock_records_updated_at ON clock_records;
CREATE TRIGGER update_clock_records_updated_at
  BEFORE UPDATE ON clock_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE clock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read clock_records"
  ON clock_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert clock_records"
  ON clock_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update clock_records"
  ON clock_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete clock_records"
  ON clock_records FOR DELETE TO authenticated USING (true);
