import type { NextConfig } from 'next'

/**
 * セキュリティヘッダ。
 * いちばん効くのは frame-ancestors 'none'（クリックジャッキングを止める）と
 * connect-src の絞り込み（万一XSSが通っても、データを外に持ち出せない）。
 *
 * script-src に 'unsafe-inline' が残るのは、Next.js が
 * ハイドレーション用のインラインスクリプトを撒くため。
 * nonce で締めるにはページを毎回サーバーで描くことになり、
 * いまの静的配信を捨てることになるので、ここでは取らない。
 */
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseWs = supabase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:')
const dev = process.env.NODE_ENV === 'development'

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  // 開発中は HMR が eval を使う
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  `connect-src 'self' ${supabase} ${supabaseWs}`.trim(),
  "manifest-src 'self'",
  // 圏外用の Service Worker（public/sw.js）。同じ置き場のものだけ許す
  "worker-src 'self'",
  ...(dev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const nextConfig: NextConfig = {
  // AGENTS.md / CLAUDE.md を勝手に作らせない
  agentRules: false,
  // 開発中の丸いバッジを出さない（画面の見た目を参照HTMLと比べるため）
  devIndicators: false,

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          // frame-ancestors を読まない古いブラウザ向けの保険
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
          // 2年。独自ドメインを足すときは includeSubDomains の影響を確かめること
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
