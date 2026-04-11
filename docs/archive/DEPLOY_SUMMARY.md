# 洗頭店排班系統 - 部署完成摘要

## 📦 專案檔案

專案已壓縮為 `hair-salon-scheduler.zip`，包含：
- 完整的 Next.js 專案程式碼
- Supabase 資料庫結構 (schema.sql)
- 部署說明文件

---

## 🚀 部署步驟

### 步驟 1：建立 Supabase 專案

1. 前往 https://supabase.com/dashboard/sign-up
2. 註冊並建立新專案
   - 專案名稱：`hair-salon-scheduler`
   - 地區：選擇 `Southeast Asia (Singapore)` 或最接近的地區
3. 等待專案建立完成

### 步驟 2：設定資料庫

1. 在 Supabase Dashboard 左側選單點擊 **SQL Editor**
2. 點擊 **New query**
3. 複製貼上以下 SQL（或 `supabase/schema.sql` 的內容）：

```sql
-- Create employees table
create table if not exists employees (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create shifts table
create table if not exists shifts (
  id uuid default gen_random_uuid() primary key,
  employee_id uuid references employees(id) on delete cascade not null,
  date date not null,
  start_time text not null,
  end_time text not null,
  hours numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create payroll_records table
create table if not exists payroll_records (
  id uuid default gen_random_uuid() primary key,
  month text not null,
  employee_id uuid references employees(id) on delete cascade not null,
  total_hours numeric not null,
  total_amount numeric not null,
  generated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(month, employee_id)
);

-- Enable RLS
create policy "Enable all access for authenticated users" on employees
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on shifts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "Enable all access for authenticated users" on payroll_records
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Create indexes
create index if not exists idx_shifts_date on shifts(date);
create index if not exists idx_shifts_employee_id on shifts(employee_id);
create index if not exists idx_payroll_month on payroll_records(month);
```

4. 點擊 **Run** 執行 SQL

### 步驟 3：啟用 Email 認證

1. 前往 **Authentication** > **Providers**
2. 找到 **Email** 並確認已啟用
3. 建議關閉 "Confirm email" 以便快速測試

### 步驟 4：建立店長帳號

1. 前往 **Authentication** > **Users**
2. 點擊 **Add user**
3. 輸入：
   - 電子郵件：你的店長信箱（例如：manager@hairsalon.com）
   - 密碼：設定一個安全密碼
4. 記下這組帳密，這是登入系統的憑證

### 步驟 5：取得 API 金鑰

1. 前往 **Project Settings** > **API**
2. 複製以下資訊：
   - **Project URL** (例如: `https://abcdefgh12345678.supabase.co`)
   - **anon public** API key (以 `eyJhbG` 開頭的長字串)

### 步驟 6：部署到 Vercel

#### 選項 A：使用 Vercel Dashboard（推薦）

1. 前往 https://vercel.com/new
2. 如果專案已推送到 GitHub，選擇 Import Git Repository
3. 或選擇 Upload 上傳專案資料夾
4. 在 Environment Variables 中新增：
   - `NEXT_PUBLIC_SUPABASE_URL` = 你的 Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = 你的 anon public API key
5. 點擊 **Deploy**

#### 選項 B：使用 Vercel CLI

```bash
# 安裝 Vercel CLI
npm i -g vercel

# 登入
vercel login

# 在專案目錄中部署
cd my-app
vercel --prod
```

部署時會提示輸入環境變數。

---

## ✅ 部署完成後

### 網站連結
部署完成後，Vercel 會提供一個網址，例如：
```
https://hair-salon-scheduler.vercel.app
```

### 登入帳密
- 帳號：你在步驟 4 設定的電子郵件
- 密碼：你在步驟 4 設定的密碼

### Supabase 專案資訊
- 專案名稱：hair-salon-scheduler
- 專案 URL：https://supabase.com/dashboard/project/[你的專案ID]
- 地區：Southeast Asia (Singapore)

---

## 📋 功能說明

### 排班月曆 (/dashboard)
- 點擊日期格子新增排班
- 平日可選：早班 (12:00-17:00, 5hr) 或晚班 (19:00-23:00, 4hr)
- 假日可選：全日班 (11:30-23:30, 12hr)
- 點擊已排班的項目可刪除

### 員工管理 (/employees)
- 新增/編輯員工姓名
- 停用/啟用員工
- 停用的員工不會出現在排班選項中

### 薪資計算 (/payroll)
- 選擇月份查看薪資
- 自動計算每位員工的總時數和金額
- 可匯出 CSV 檔案

---

## 💰 薪資設定

- **時薪**：$200/小時
- **平日早班**：12:00-17:00 = 5小時 = $1,000
- **平日晚班**：19:00-23:00 = 4小時 = $800
- **假日全日班**：11:30-23:30 = 12小時 = $2,400

---

## 🔧 修改設定

如需修改時薪或班段時間，請編輯 `src/lib/types.ts`：

```typescript
export const HOURLY_RATE = 200; // 修改時薪

export const SHIFT_TYPES = {
  WEEKDAY: {
    MORNING: { start: '12:00', end: '17:00', hours: 5, label: '早班 (12:00-17:00)' },
    EVENING: { start: '19:00', end: '23:00', hours: 4, label: '晚班 (19:00-23:00)' },
  },
  WEEKEND: {
    FULL: { start: '11:30', end: '23:30', hours: 12, label: '全日班 (11:30-23:30)' },
  },
};
```

修改後重新部署即可。

---

## 📞 支援

如有問題，請檢查：
1. Supabase 專案是否正常運作
2. 環境變數是否正確設定
3. 資料庫表格是否正確建立
4. 店長帳號是否已建立
