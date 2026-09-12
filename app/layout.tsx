import type { Metadata, Viewport } from 'next'
import { Zen_Maru_Gothic } from 'next/font/google'
import { Toast } from '@/components/Toast'
import './globals.css'

// 日本語のサブセットは巨大なので preload はしない。
// unicode-range で必要な分だけブラウザが取りに行く。
const zenMaru = Zen_Maru_Gothic({
  weight: ['500', '700', '900'],
  display: 'swap',
  preload: false,
  variable: '--font-zen-maru',
})

export const metadata: Metadata = {
  title: '手配まとめ',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: '手配まとめ', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#EEEDF4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={zenMaru.variable}>
      <body>
        <main className="app" id="app">{children}</main>
        <Toast />
      </body>
    </html>
  )
}
