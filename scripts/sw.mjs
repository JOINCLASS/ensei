import { chromium } from '@playwright/test'
import { VP, clearMail, login, tap } from './lib.mjs'

/**
 * 圏外のときの振る舞い。
 *
 * いちばん確かめたいのは「旅の中身をためていないこと」。
 * 古い手配済みを見せるほうが、見られないより危ない。
 *
 * 開発サーバーでは登録しない作りなので、ここでは組み立て済みのものを
 * next start で動かして試す（本番と同じ条件）。
 */
const APP = process.env.APP_URL || 'http://localhost:3010'
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()

step('1. 登録される')
await clearMail()
await login(page, `sw-${Date.now()}@example.com`.toLowerCase())
await tap(page, 'サンプルで見てみる')
await page.waitForSelector('.ticket')
const ready = await page.evaluate(() =>
  navigator.serviceWorker.ready.then(() => true).catch(() => false),
)
ok(ready, 'Service Worker が動きだす')

step('2. 旅の中身はためていない')
const cached = await page.evaluate(async () => {
  const names = await caches.keys()
  const out = []
  for (const n of names) {
    const c = await caches.open(n)
    out.push(...(await c.keys()).map((r) => new URL(r.url).pathname))
  }
  return out
})
ok(cached.length > 0, `ためているものがある（${cached.length}件）`)
ok(!cached.some((u) => u.startsWith('/trips')), '旅の詳細はためていない', cached.filter((u) => u.startsWith('/trips')))
ok(!cached.includes('/'), '一覧そのものもためていない')
ok(!cached.some((u) => u.startsWith('/api') || u.startsWith('/auth')), 'データのやりとりもためていない')
ok(cached.includes('/offline.html'), '圏外の案内だけは持っている')
ok(cached.every((u) => u.startsWith('/_next/static/') || u.endsWith('.png') || u.endsWith('.webmanifest') || u === '/offline.html'),
  'ためているのは見た目を作るものだけ', cached.slice(0, 8))

step('3. 圏外にしてみる')
await ctx.setOffline(true)
await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' }).catch(() => null)
await page.waitForTimeout(1200)
const body = await page.locator('body').innerText()
ok(body.trim().length > 0, '真っ白にならない')
ok(/電波が届いていない/.test(body), '電波が無いと伝える', body.slice(0, 60))
ok(/消えていません/.test(body), 'データが消えていないと伝える')
ok(await page.getByRole('button', { name: 'もう一度読み込む', exact: true }).count() > 0, 'もう一度読み込める')
ok(!/ASIA TOUR/.test(body), '古い旅の中身を見せない')

step('4. つながればもとどおり')
await ctx.setOffline(false)
await page.goto(`${APP}/`)
await page.waitForSelector('.ticket', { timeout: 20000 })
ok(await page.locator('.ticket').count() > 0, '旅が出る')

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
