import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/**
 * アプリのアイコン。参照HTMLのトークン（推し色の紫と紙の白）だけで作る。
 *
 * 考え方：
 *  - かたちは「半券」。上下の縁を丸く噛み切り、そのあいだをミシン目でつなぐ。
 *    穴とミシン目は地の色で抜いてあるので、本当に切り取れそうに見える。
 *  - ✓ は「手配済み」。このアプリが何をする道具かを一目で伝える。
 *  - 小さくしたときに最初に消えるのは細い線なので、ミシン目は太く粗く打つ。
 *  - 地は既定の推し色の紫。29px でも輪郭が立つよう、白との明度差を大きく取る。
 */
const PAPER = '#FFFFFF'
const MID = '#8E4EC6'   // 既定の推し色。これが基準
// ICON_FLAT=1 を付けると、紫の単色になる（参照HTMLのトークンそのまま）
const FLAT = process.env.ICON_FLAT === '1'
const TOP = FLAT ? MID : '#A066D8'      // 紫を挟む上下の色。差はわずかに留める
const BOTTOM = FLAT ? MID : '#7C3EAE'

/** scale: 1 で塗り足しなし。maskable 用に中身を縮めるときに使う */
function svg(scale = 1) {
  const S = 512
  const W = 360 * scale, H = 244 * scale
  const X = (S - W) / 2, Y = (S - H) / 2
  const cut = X + 108 * scale          // 半券の切り取り線
  const nr = 28 * scale                // 切り欠き
  const r = 32 * scale                 // 角丸
  const cx = (cut + X + W) / 2, cy = S / 2   // 本体側の中心
  const k = 1 * scale

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${TOP}"/><stop offset="1" stop-color="${BOTTOM}"/>
    </linearGradient>
    <mask id="cut">
      <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="${r}" fill="#fff"/>
      <circle cx="${cut}" cy="${Y}" r="${nr}" fill="#000"/>
      <circle cx="${cut}" cy="${Y + H}" r="${nr}" fill="#000"/>
    </mask>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="${r}" fill="${PAPER}" mask="url(#cut)"/>
  <line x1="${cut}" y1="${Y + nr + 10 * k}" x2="${cut}" y2="${Y + H - nr - 10 * k}"
    stroke="${MID}" stroke-width="${15 * k}" stroke-linecap="round" stroke-dasharray="${4 * k} ${27 * k}"/>
  <path d="M ${cx - 48 * k} ${cy + 2 * k} l ${30 * k} ${32 * k} l ${66 * k} ${-74 * k}"
    fill="none" stroke="${MID}" stroke-width="${28 * k}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

mkdirSync('public', { recursive: true })
mkdirSync('app', { recursive: true })

const browser = await chromium.launch()
const shoot = async (path, size, scale) => {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 })
  await page.setContent(`<body style="margin:0">${svg(scale)}</body>`)
  await page.screenshot({ path })
  await page.close()
}

await shoot('public/icon-192.png', 192, 1)
await shoot('public/icon-512.png', 512, 1)
// maskable は円で抜かれても角が欠けないよう縮める。
// 半券の角までの距離 = √((360·k/2)² + (244·k/2)²)。これが安全域の半径 204.8px 未満になる
// 最大の縮尺が 0.9（→ 196px）。それ以上縮めると小さく見えるだけで得がない。
await shoot('public/icon-maskable-512.png', 512, 0.9)
await shoot('app/icon.png', 256, 1)         // ブラウザのタブ
await shoot('app/apple-icon.png', 180, 1)   // iOS のホーム画面

/* 小さいサイズで読めるかの確認用 */
const s = svg(1)
const sizes = [180, 120, 96, 60, 40, 29, 16]
const page = await browser.newPage({ viewport: { width: 720, height: 260 }, deviceScaleFactor: 2 })
await page.setContent(`<body style="margin:0;background:#EEEDF4;padding:24px;font:500 11px system-ui;color:#6E6A82">
  <div style="display:flex;align-items:flex-end;gap:18px;background:#fff;border-radius:14px;padding:20px">
  ${sizes.map((n) => `<div style="text-align:center">
    <div style="width:${n}px;height:${n}px;border-radius:${n * 0.22}px;overflow:hidden">${s.replace('width="512" height="512"', `width="${n}" height="${n}"`)}</div>
    <div style="margin-top:6px">${n}</div></div>`).join('')}
  </div>
  <div style="display:flex;align-items:center;gap:18px;background:#221F33;border-radius:14px;padding:20px;margin-top:14px">
    <div style="width:96px;height:96px;border-radius:21px;overflow:hidden">${s.replace('width="512" height="512"', 'width="96" height="96"')}</div>
    <div style="width:96px;height:96px;border-radius:50%;overflow:hidden">${svg(0.9).replace('width="512" height="512"', 'width="96" height="96"')}</div>
    <div style="color:#EEEDF4">左：iOS の角丸　右：Android の円マスク（maskable）</div>
  </div>
</body>`)
await page.screenshot({ path: 'shots/icons/_最終.png', fullPage: true })
await browser.close()
console.log('アイコンを書き出した')
