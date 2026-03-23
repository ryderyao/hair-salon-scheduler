-- 驗證 migration_salary_custom_shifts 是否已執行
-- 在 Supabase SQL Editor 執行此腳本，若全部顯示 ✓ 即表示 migration 已完成

SELECT 
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='employees' AND column_name='hourly_rate')
    THEN '✓' ELSE '✗' END AS "employees.hourly_rate",
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schedules' AND column_name='start_time')
    THEN '✓' ELSE '✗' END AS "schedules.start_time",
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schedules' AND column_name='end_time')
    THEN '✓' ELSE '✗' END AS "schedules.end_time",
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='schedules' AND column_name='hours')
    THEN '✓' ELSE '✗' END AS "schedules.hours";
