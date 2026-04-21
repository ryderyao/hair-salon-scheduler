export type ShiftSlot = 'morning' | 'evening'

export const SHIFT_SLOT_LABEL: Record<ShiftSlot, string> = {
  morning: '早班',
  evening: '晚班',
}

export type HandoverCleaningKeys = {
  clean_service_area: boolean
  clean_smart_unit: boolean
  clean_styling_seating: boolean
  clean_trash_restroom: boolean
  clean_consumables_tools: boolean
  clean_water_light_audio: boolean
  clean_evening_close: boolean
}

/** 清潔項目（第一版：不含每週項目、不含毛巾／耗材庫存盤點） */
export const HANDOVER_CLEANING_ITEMS: { key: keyof HandoverCleaningKeys; label: string }[] = [
  { key: 'clean_service_area', label: '洗頭／服務區地面與洗頭台（含台面、鏡面、水龍頭）' },
  { key: 'clean_smart_unit', label: '智能洗頭設備外觀清潔與簡易運作確認' },
  { key: 'clean_styling_seating', label: '整髮區桌面、鏡面與座椅／沙發表面' },
  { key: 'clean_trash_restroom', label: '各區垃圾與洗手間清潔（含垃圾袋）' },
  { key: 'clean_consumables_tools', label: '現場洗護補充與工具齊全（不盤點庫存）' },
  { key: 'clean_water_light_audio', label: '飲水機、紙杯、照明與音響確認' },
]

/** 僅晚班顯示 */
export const HANDOVER_EVENING_ONLY = {
  key: 'clean_evening_close' as const,
  label: '晚班關店：設備關閉、門窗與店內安全確認',
}

export function emptyCleaningState(): HandoverCleaningKeys {
  return {
    clean_service_area: false,
    clean_smart_unit: false,
    clean_styling_seating: false,
    clean_trash_restroom: false,
    clean_consumables_tools: false,
    clean_water_light_audio: false,
    clean_evening_close: false,
  }
}
