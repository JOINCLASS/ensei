import { chromium } from '@playwright/test'
import { VP, tap } from './lib.mjs'

/**
 * Googleログインを、押してから一覧に入るまで通しで試す。
 *
 * scripts/fake-google.mjs を挟んだ開発サーバーに対して走らせる。
 * 「ボタンを押すと出ていく」ところまでしか見ないと、戻ってきて
 * セッションが立つかが試せない。そこが一番壊れやすい。
 */
const APP = process.env.APP_URL || 'http://localhost:3001'
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)))

step('1. 押すと、正しい行き先へ出ていく')
await page.goto(`${APP}/login`)
const sent = []
page.on('request', (r) => {
  if (r.url().includes('/auth/v1/authorize')) sent.push(r.url())
})
await tap(page, 'Googleで続ける')
await page.waitForURL(`${APP}/`, { timeout: 20000 })

ok(sent.length > 0, 'Googleの窓口へ送り出している', sent[0])
ok(sent[0]?.includes('provider=google'), 'providerがgoogle')
ok(
  decodeURIComponent(sent[0] ?? '').includes(`${APP}/auth/callback`),
  '戻り先を /auth/callback にしている',
  decodeURIComponent(sent[0] ?? '').slice(0, 120),
)

step('2. 戻ってきて、ログインできている')
ok(page.url() === `${APP}/`, '一覧に入れた', page.url())
ok(await page.locator('text=遠征の予定を登録すると').isVisible(), 'その人の（まっさらな）一覧が出る')
ok(!/login/.test(page.url()), 'ログイン画面に跳ね返されない')
ok(errors.length === 0, 'JSのエラーが出ない', errors)

step('3. セッションが残る')
await page.reload()
await page.waitForLoadState('domcontentloaded')
ok(!/\/login/.test(page.url()), '読み込み直してもログインしたまま', page.url())

const cookies = await ctx.cookies()
ok(cookies.some((c) => /^sb-/.test(c.name)), 'セッションのCookieが立っている')
ok(
  cookies.filter((c) => /code-verifier/.test(c.name)).length === 0,
  '使い捨てのCookieが残っていない',
  cookies.filter((c) => /code-verifier/.test(c.name)).map((c) => c.name),
)

step('4. Googleで入った人も、自分の旅を作れる')
await tap(page, '＋ 最初の旅を追加')
await page.waitForSelector('.sheet')
await page.fill('input[name=title]', 'Googleで入った人の旅')
await page.fill('input[name=start]', '2026-12-01')
await tap(page, '追加する')
await page.waitForURL(/\/trips\//, { timeout: 15000 })
ok(await page.locator('h1', { hasText: 'Googleで入った人の旅' }).count() > 0, '旅が作れる')

step('5. 別のGoogleの人には見えない')
const ctx2 = await browser.newContext({ viewport: VP })
const page2 = await ctx2.newPage()
await page2.goto(`${APP}/login`)
await tap(page2, 'Googleで続ける')
await page2.waitForURL(`${APP}/`, { timeout: 20000 })
const body = await page2.locator('body').innerText()
ok(!/Googleで入った人の旅/.test(body), '他の人の旅は出ない')
ok(/遠征の予定を登録すると/.test(body), 'その人の一覧はまっさら')

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
