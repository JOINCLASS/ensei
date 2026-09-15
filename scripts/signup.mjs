import { chromium } from '@playwright/test'
import { APP, VP, clearMail, codeFor, tap } from './lib.mjs'

/**
 * 招待制を廃止したあとの入口を確かめる。
 *   ・招待が無くても、はじめての人が登録できる
 *   ・INVITE_ONLY=true に戻すと、また閉じる
 *   ・Googleの受け口（/auth/callback）が、おかしな呼ばれ方をしても事故らない
 *
 * INVITE_ONLY は開発サーバーの環境変数なので、切り替えは
 *   INVITE_ONLY=true npm run dev
 * を別に立てて APP_URL で指す。ここでは今動いているサーバーを見る。
 */
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))

console.log('\n1. ログイン画面')
await page.goto(`${APP}/login`)
const inviteOnly = await page.locator('text=このアプリは招待制です').count() > 0
console.log(`  （いまの設定：${inviteOnly ? '招待制' : '誰でも登録できる'}）`)
ok(await page.locator('text=これは見本です').isVisible(), '見本はそのまま出ている')
ok(await page.locator('.ticket').count() === 2, '見本の旅は2件のまま')
ok(
  (await page.getByRole('button', { name: 'Googleで続ける', exact: true }).count() > 0) !== inviteOnly,
  inviteOnly ? '招待制のときはGoogleを出さない' : 'Googleのボタンが出ている',
)

if (!inviteOnly) {
  console.log('\n2. 招待なしで、はじめての人が登録できる')
  const email = `newcomer-${Date.now()}@example.com`.toLowerCase()
  await clearMail()
  await page.fill('input[name=email]', email)
  await tap(page, 'コードを送る')
  await page.waitForSelector('input[name=code]', { timeout: 15000 }).catch(() => null)
  const sent = await page.locator('input[name=code]').count() > 0
  ok(sent, 'コードの入力欄まで進んだ', sent ? undefined : await page.locator('.err').innerText())
  if (sent) {
    await page.fill('input[name=code]', await codeFor(email))
    await tap(page, 'ログインする')
    await page.waitForURL(`${APP}/`, { timeout: 15000 })
    ok(page.url() === `${APP}/`, '一覧に入れた')
    ok(await page.locator('text=遠征の予定を登録すると').isVisible(), 'まっさらな一覧が出る')
  }
}

if (inviteOnly) {
  console.log('\n2. 招待制のときは、はじめての人を入れない')
  const email = `blocked-${Date.now()}@example.com`.toLowerCase()
  await clearMail()
  await page.fill('input[name=email]', email)
  await tap(page, 'コードを送る')
  await page.waitForTimeout(2500)
  ok(await page.locator('input[name=code]').count() === 0, 'コードの入力欄には進めない')
  const msg = await page.locator('.err').innerText()
  ok(/登録されていません/.test(msg), '理由が画面に出る', msg)
}

console.log('\n3. Googleの受け口')
// ここはログインしていない人として試す。
// ログイン済みだと /login が / に跳ねてしまい、確かめたいものが見えない。
const fresh = await browser.newContext({ viewport: VP })
const page2 = await fresh.newPage()
const r1 = await page2.goto(`${APP}/auth/callback`)
ok(page2.url().includes('/login'), 'code が無ければログイン画面に戻す', page2.url())
ok(r1.status() < 400, '500にはならない', r1.status())
ok(await page2.locator('.err').isVisible(), '理由が画面に出る')

await page2.goto(`${APP}/auth/callback?code=deadbeef&next=//example.com/`)
ok(!page2.url().startsWith('http://example.com'), '外部サイトへは飛ばさない（オープンリダイレクト）', page2.url())
ok(page2.url().startsWith(APP), '自分のサイトに留まる', page2.url())

await page2.goto(`${APP}/auth/callback?code=deadbeef&next=/about`)
ok(page2.url().startsWith(APP), '使えないcodeでも自分のサイトに留まる', page2.url())

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
