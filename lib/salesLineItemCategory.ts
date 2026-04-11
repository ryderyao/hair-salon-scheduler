/**
 * 結帳項目（line_items）拆項後對應「服務大類」，供圓餅圖合併顯示。
 * 規則與店內約定：一般洗髮（極淨＋紅光）、植萃洗髮、舒活潤養套組，其餘獨立類。
 */

export type LineItemCategoryId =
  | 'general_wash'
  | 'herbal_wash'
  | 'spa_package'
  | 'vip_product'
  | 'addon'
  | 'light_scalp'
  | 'stored_value'
  | 'other'

/** 圓餅圖顯示順序（固定，便於跨月對照） */
export const LINE_ITEM_CATEGORY_ORDER: LineItemCategoryId[] = [
  'general_wash',
  'herbal_wash',
  'spa_package',
  'vip_product',
  'addon',
  'light_scalp',
  'stored_value',
  'other',
]

export const LINE_ITEM_CATEGORY_LABEL: Record<LineItemCategoryId, string> = {
  general_wash: '一般洗髮',
  herbal_wash: '植萃洗髮',
  spa_package: '舒活潤養套組',
  vip_product: 'VIP 方案／商品',
  addon: '加值／加購',
  light_scalp: '光能健髮',
  stored_value: '儲值',
  other: '其他',
}

/**
 * 移除數字千分位逗號，避免拆項時誤切（例：儲值10,000送1000 → 儲值10000送1000）
 */
export function normalizeThousandsInLineItems(raw: string): string {
  let s = raw
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/(\d),(\d{3})/g, '$1$2')
  }
  return s
}

/** 與儀表板一致：逗號／中文逗號拆項 */
export function splitLineItemFragments(raw: string): string[] {
  const s = normalizeThousandsInLineItems(raw.trim())
  return s
    .split(/[,，]/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * 單一拆項文字 → 大類（先後順序會影響命中，維持由特殊到一般）
 */
export function categorizeLineItemFragment(fragment: string): LineItemCategoryId {
  const t = fragment.trim()
  if (!t) return 'other'

  // 誤切殘段（千分位修復後應不會出現；仍歸儲值以免汙染「其他」）
  if (/^000送/.test(t)) return 'stored_value'
  if (/^儲值/i.test(t)) return 'stored_value'

  if (t.startsWith('VIP -') || t.startsWith('VIP-')) return 'vip_product'

  if (t.includes('光能健髮')) return 'light_scalp'

  if (t.startsWith('加值服務') || t.startsWith('其他加購服務')) return 'addon'

  if (t.startsWith('春節限定/')) {
    const rest = t.slice('春節限定/'.length)
    if (rest.startsWith('極淨洗髮')) return 'general_wash'
    if (rest.startsWith('植萃草本洗髮')) return 'herbal_wash'
    if (rest.includes('舒活潤養套組')) return 'spa_package'
    return 'other'
  }

  if (t.startsWith('極淨洗髮') || t.startsWith('紅光活絡洗髮')) return 'general_wash'

  if (t.startsWith('植萃草本洗髮') || t.startsWith('植萃養元潤洗')) return 'herbal_wash'

  if (t.includes('舒活潤養套組')) return 'spa_package'

  return 'other'
}

export function categoryLabel(id: LineItemCategoryId): string {
  return LINE_ITEM_CATEGORY_LABEL[id]
}
