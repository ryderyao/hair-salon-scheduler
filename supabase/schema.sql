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

-- 更新時間戳函數
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 員工表更新觸發器
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 班表表更新觸發器
DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
CREATE TRIGGER update_schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 啟用 Row Level Security
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

-- 建立 RLS 政策（允許已認證使用者存取）
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

-- 插入預設員工（範例資料）
INSERT INTO employees (name) VALUES 
  ('小華'),
  ('小美'),
  ('阿明')
ON CONFLICT DO NOTHING;
