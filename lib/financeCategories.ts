/** 收支科目（與 finance_entries.category_id 對應）；支出四大類各含一個「其他」 */

export type FinanceDirection = 'income' | 'expense'

export type ExpenseGroupId = 'setup' | 'fixed' | 'variable' | 'payroll'

export const INCOME_CATEGORIES = [
  { id: 'income_revenue', label: '營業收入' },
  { id: 'income_other', label: '其他收入' },
] as const

export const EXPENSE_GROUP_META: { id: ExpenseGroupId; label: string }[] = [
  { id: 'setup', label: '前期建置成本' },
  { id: 'fixed', label: '固定成本' },
  { id: 'variable', label: '變動成本' },
  { id: 'payroll', label: '人事成本' },
]

export const EXPENSE_CATEGORIES: Record<ExpenseGroupId, { id: string; label: string }[]> = {
  setup: [
    { id: 'setup_franchise_brand', label: '總代理品牌權利金' },
    { id: 'setup_renovation', label: '裝修及設備' },
    { id: 'setup_store_contract', label: '店面簽約' },
    { id: 'setup_supplies_misc', label: '耗材與其他' },
    { id: 'setup_other', label: '其他（前期建置）' },
  ],
  fixed: [
    { id: 'fixed_rent', label: '房租' },
    { id: 'fixed_system', label: '系統月租' },
    { id: 'fixed_utilities', label: '水電' },
    { id: 'fixed_business_tax', label: '營業税' },
    { id: 'fixed_rental_income_tax', label: '租屋所得稅' },
    { id: 'fixed_franchise_royalty', label: '總代理權利金' },
    { id: 'fixed_other', label: '其他（固定）' },
  ],
  variable: [
    { id: 'variable_supplies_ops', label: '營業耗材' },
    { id: 'variable_supplies_other', label: '其他耗材' },
    { id: 'variable_towel_wash', label: '洗烘毛巾' },
    { id: 'variable_marketing', label: '行銷' },
    { id: 'variable_other', label: '其他（變動）' },
  ],
  payroll: [
    { id: 'payroll_salary', label: '薪資' },
    { id: 'payroll_bonus', label: '獎金' },
    { id: 'payroll_allowance', label: '津貼' },
    { id: 'payroll_other', label: '其他（人事）' },
  ],
}

const ALL_LABELS = new Map<string, string>()
for (const c of INCOME_CATEGORIES) {
  ALL_LABELS.set(c.id, c.label)
}
for (const g of EXPENSE_GROUP_META) {
  for (const c of EXPENSE_CATEGORIES[g.id]) {
    ALL_LABELS.set(c.id, c.label)
  }
}

export function getFinanceCategoryLabel(categoryId: string): string {
  return ALL_LABELS.get(categoryId) ?? categoryId
}

export function isNoteRequired(categoryId: string): boolean {
  return (
    categoryId === 'income_other' ||
    categoryId === 'setup_other' ||
    categoryId === 'fixed_other' ||
    categoryId === 'variable_other' ||
    categoryId === 'payroll_other'
  )
}

export function isValidFinanceEntry(
  direction: FinanceDirection,
  categoryId: string
): boolean {
  if (direction === 'income') {
    return INCOME_CATEGORIES.some((c) => c.id === categoryId)
  }
  for (const g of EXPENSE_GROUP_META) {
    if (EXPENSE_CATEGORIES[g.id].some((c) => c.id === categoryId)) return true
  }
  return false
}

export function getExpenseGroupForCategory(categoryId: string): ExpenseGroupId | null {
  for (const g of EXPENSE_GROUP_META) {
    if (EXPENSE_CATEGORIES[g.id].some((c) => c.id === categoryId)) return g.id
  }
  return null
}
