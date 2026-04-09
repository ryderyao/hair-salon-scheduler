'use client'

import Image from 'next/image'
import { useState } from 'react'

export const SITE_TITLE = 'HAIRO-桃園經國館'

/** 將 logo 檔放在 public/logo.png；若尚未放置或載入失敗，僅顯示文字 */
const LOGO_PATH = '/logo.png'

type SiteBrandProps = {
  /** 頂欄列（與按鈕同一列） */
  variant?: 'header' | 'login'
}

export function SiteBrand({ variant = 'header' }: SiteBrandProps) {
  const [logoVisible, setLogoVisible] = useState(true)

  const logo =
    logoVisible ? (
      <Image
        src={LOGO_PATH}
        alt={SITE_TITLE}
        width={variant === 'header' ? 32 : 56}
        height={variant === 'header' ? 32 : 56}
        className={
          variant === 'header'
            ? 'h-8 w-8 shrink-0 object-contain'
            : 'h-14 w-14 shrink-0 object-contain'
        }
        onError={() => setLogoVisible(false)}
        priority={variant === 'login'}
      />
    ) : null

  if (variant === 'login') {
    return (
      <div className="flex flex-col items-center gap-3">
        {logo}
        <span className="text-2xl font-bold text-gray-900">{SITE_TITLE}</span>
      </div>
    )
  }

  return (
    <h1 className="flex items-center gap-2 min-w-0 text-lg sm:text-xl font-bold text-gray-900">
      {logo}
      <span className="truncate">{SITE_TITLE}</span>
    </h1>
  )
}
