import { chromium } from '@playwright/test'
import { VP, clearMail, login, tap } from './lib.mjs'

/**
 * データベースだけが落ちている状態で、消えたように見せないことを確かめる。
 *
 * scripts/broken-rest.mjs を挟んだ開発サーバーに対して走らせる。
 *   node scripts/broken-rest.mjs &
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 npx next dev -p 3001
 *   APP_URL=http://localhost:3001 node scripts/offline.mjs
 */
const APP = process.env.APP_URL || 'http://localhost:3001'
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()

console.log('\nデータベースが落ちている状態で一覧を開く')
await clearMail()
// ログイン（/auth/*）は通るので、ここまでは進める
await login(page, `offline-${Date.now()}@example.com`.toLowerCase()).catch(() => null)
await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const body = await page.locator('body').innerText()

ok(body.trim().length > 0, '白い画面にならない')
ok(!/遠征の予定を登録すると/.test(body), '「まだ何も無い人」の画面を出さない（旅が消えたように見せない）', body.slice(0, 90))
ok(/うまく表示できませんでした/.test(body), '理由が出る', body.slice(0, 90))
ok(await page.getByRole('button', { name: 'もう一度読み込む', exact: true }).count() > 0, '「もう一度読み込む」がある')

console.log('\nデータベースが落ちている状態で詳細を開く')
await page.goto(`${APP}/trips/11111111-1111-1111-1111-111111111111`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(2000)
const body2 = await page.locator('body').innerText()
ok(!/消された旅/.test(body2), '「消された旅」と言わない', body2.slice(0, 90))
ok(/うまく表示できませんでした/.test(body2), '理由が出る', body2.slice(0, 90))

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
