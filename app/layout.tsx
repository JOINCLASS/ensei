import type { Metadata, Viewport } from 'next'
import { Zen_Maru_Gothic } from 'next/font/google'
import { BottomNav } from '@/components/BottomNav'
import { ServiceWorker } from '@/components/ServiceWorker'
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
  themeColor: '#EFF2FB',
  // キーボードが出たら、その分だけ画面を詰める。
  // Android/Chrome はこれだけで解決する。iOS はまだ効かないので、
  // components/Sheet.tsx の visualViewport 側で受けている。
  interactiveWidget: 'resizes-content',
}

/**
 * Androidの「ホーム画面に追加」の合図は、ページを開いた直後に一度だけ飛ぶ。
 * 画面の組み立て（ハイドレーション）を待ってから聞き始めると取りこぼすので、
 * いちばん早いここで受け取って、取っておく。InstallSheet が後から拾う。
 */
const catchInstallPrompt = `addEventListener('beforeinstallprompt',function(e){
e.preventDefault();window.__bip=e;dispatchEvent(new Event('bip'))});
addEventListener('appinstalled',function(){window.__bip=null;dispatchEvent(new Event('bip'))})`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={zenMaru.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: catchInstallPrompt }} />
      </head>
      <body>
        <main className="app" id="app">{children}</main>
        <BottomNav />
        <ServiceWorker />
        <Toast />
      </body>
    </html>
  )
}
