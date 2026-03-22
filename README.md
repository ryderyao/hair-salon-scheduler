# 洗頭店排班系統

一個專為洗頭店設計的店長排班管理系統，使用 Next.js + Supabase + Tailwind CSS 開發。

## 功能特色

- 🔐 店長登入系統（單一帳號管理）
- 👥 員工管理（新增/編輯/停用）
- 📅 月曆排班介面
  - 平日：早班 12:00-17:00 (5hr)、晚班 19:00-23:00 (4hr)
  - 假日：全日班 11:30-23:30 (12hr)
- 📊 班表檢視（月曆顯示每天誰上班）
- 💰 薪資計算（時薪 $200）

## 技術棧

- **前端框架**: Next.js 14 (App Router)
- **樣式**: Tailwind CSS
- **後端/資料庫**: Supabase
- **語言**: TypeScript
- **UI 元件**: shadcn/ui

## 安裝與設定

### 1. 安裝依賴

```bash
npm install
```

### 2. 設定環境變數

複製 `.env.local.example` 為 `.env.local`，並填入你的 Supabase 設定：

```env
NEXT_PUBLIC_SUPABASE_URL=你的_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的_SUPABASE_ANON_KEY
```

### 3. 設定 Supabase 資料庫

在 Supabase SQL Editor 中執行 `supabase/schema.sql` 來建立必要的表格。

### 4. 建立初始店長帳號

執行以下 SQL 來建立預設店長帳號：

```sql
-- 預設帳號: admin / admin123
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@hairsalon.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  now(),
  now()
);
```

### 5. 啟動開發伺服器

```bash
npm run dev
```

開啟 http://localhost:3000 即可使用。

## 預設登入資訊

- **帳號**: admin@hairsalon.com
- **密碼**: admin123

## 專案結構

```
app/
├── (auth)/           # 認證相關頁面
│   └── login/        # 登入頁面
├── dashboard/        # 主要功能頁面
│   ├── employees/    # 員工管理
│   ├── schedule/     # 排班功能
│   └── payroll/      # 薪資計算
├── layout.tsx        # 根佈局
└── page.tsx          # 首頁（導向登入）
components/
├── ui/               # UI 元件（shadcn）
└── calendar/         # 月曆相關元件
lib/
├── supabase/         # Supabase 客戶端
└── utils.ts          # 工具函數
supabase/
└── schema.sql        # 資料庫結構
```

## 授權

MIT License
# Force redeploy Sun Mar 22 22:14:40 CST 2026
