import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

/* 参照HTMLのトークンだけを使う */
const INK='#221F33', PAPER='#FFFFFF', OSHI='#8E4EC6', SKY='#3DB6E8'

/**
 * 1枚のチケット。上下の縁を丸く噛み切り、そのあいだをミシン目でつなぐ。
 * 穴とミシン目は地の色で抜くので、本当に切り取れそうに見える。
 */
function ticket({ id, ground, ground2, paper = PAPER, mark, tilt = 0, notchSide = 'v' }) {
  const S = 512
  const W = 348, H = 236, X = (S - W) / 2, Y = (S - H) / 2
  const cut = X + 104            // 半券の切り取り線
  const nr = 27                  // 切り欠きの大きさ
  const midY = Y + H / 2

  const notches = notchSide === 'v'
    ? `<circle cx="${cut}" cy="${Y}" r="${nr}" fill="#000"/><circle cx="${cut}" cy="${Y + H}" r="${nr}" fill="#000"/>`
    : `<circle cx="${X}" cy="${midY}" r="${nr}" fill="#000"/><circle cx="${X + W}" cy="${midY}" r="${nr}" fill="#000"/>`

  const perf = notchSide === 'v'
    ? `<line x1="${cut}" y1="${Y + nr}" x2="${cut}" y2="${Y + H - nr}"
         stroke="${ground}" stroke-width="13" stroke-linecap="round" stroke-dasharray="4 30"/>`
    : `<line x1="${cut}" y1="${Y + 18}" x2="${cut}" y2="${Y + H - 18}"
         stroke="${ground}" stroke-width="13" stroke-linecap="round" stroke-dasharray="4 30"/>`

  const check = mark
    ? `<path d="M ${cut + 62} ${midY + 4} l 30 32 l 66 -74"
        fill="none" stroke="${ground}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>`
    : ''

  const bg = ground2
    ? `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${ground2}"/><stop offset="1" stop-color="${ground}"/></linearGradient></defs>
       <rect width="${S}" height="${S}" fill="url(#g${id})"/>`
    : `<rect width="${S}" height="${S}" fill="${ground}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${bg}
  <mask id="m${id}">
    <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="30" fill="#fff"/>
    ${notches}
  </mask>
  <g transform="rotate(${tilt} ${S / 2} ${S / 2})">
    <rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="30" fill="${paper}" mask="url(#m${id})"/>
    ${perf}
    ${check}
  </g>
</svg>`
}

const CANDIDATES = {
  'F-切り欠き上下':       ticket({ id: 'f', ground: OSHI, mark: false }),
  'G-切り欠き上下とチェック': ticket({ id: 'g', ground: OSHI, mark: true }),
  'H-すこし傾ける':       ticket({ id: 'h', ground: OSHI, mark: true, tilt: -7 }),
  'I-切り欠き左右':       ticket({ id: 'i', ground: OSHI, mark: true, notchSide: 'h' }),
  'J-濃紺地':           ticket({ id: 'j', ground: INK,  mark: true }),
  'K-紫グラデ':         ticket({ id: 'k', ground: '#7B3EB0', ground2: '#A468DC', mark: true }),
}

mkdirSync('shots/icons', { recursive: true })
const browser = await chromium.launch()
for (const [name, svg] of Object.entries(CANDIDATES)) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } })
  await page.setContent(`<body style="margin:0">${svg}</body>`)
  await page.screenshot({ path: `shots/icons/${name}.png` })
  await page.close()
}

const rows = Object.entries(CANDIDATES).map(([name, svg]) => `
  <tr>
    <td style="padding:8px 14px;font:600 13px system-ui;color:#221F33;white-space:nowrap">${name}</td>
    ${[180, 96, 60, 40, 29].map((s) => `<td style="padding:8px">
      <div style="width:${s}px;height:${s}px;border-radius:${s * 0.22}px;overflow:hidden">${svg.replace('width="512" height="512"', `width="${s}" height="${s}"`)}</div>
      <div style="font:500 10px system-ui;color:#6E6A82;text-align:center;margin-top:3px">${s}</div>
    </td>`).join('')}
  </tr>`).join('')

const page = await browser.newPage({ viewport: { width: 760, height: 100 }, deviceScaleFactor: 2 })
await page.setContent(`<body style="margin:0;background:#EEEDF4;padding:16px">
  <table style="border-collapse:collapse;background:#fff;border-radius:14px;padding:8px">${rows}</table></body>`)
await page.screenshot({ path: 'shots/icons/_小サイズ比較.png', fullPage: true })
await browser.close()
console.log('候補を書き出した')
