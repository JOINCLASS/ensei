/**
 * 本番（Vercel + Supabase）で通しの動作を確かめる。
 * メールは送らず、管理APIでワンタイムコードを生成して使う。
 * 終わったらテスト用のユーザーとデータを消す。
 */
import { chromium } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'

const APP = process.env.PROD_APP_URL
const API = process.env.PROD_SUPABASE_URL
const ANON = process.env.PROD_ANON
const SECRET = process.env.PROD_SECRET
const EMAIL = `prod-check+${Date.now()}@example.com`

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const admin = (path, body, method = 'POST') =>
  fetch(`${API}${path}`, {
    method,
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

/** メールを送らずに6桁コードを作る。本番は新規登録を閉じているので、先に管理APIで作る。 */
async function otpFor(email) {
  await admin('/auth/v1/admin/users', { email, email_confirm: true })
  const r = await admin('/auth/v1/admin/generate_link', { type: 'magiclink', email })
  const j = await r.json()
  if (!j.email_otp) throw new Error('コードを作れない: ' + JSON.stringify(j).slice(0, 200))
  return { code: j.email_otp, userId: j.user_id ?? j.id }
}

const tap = (page, name) => page.getByRole('button', { name, exact: true }).click()

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
const fails = []
page.on('pageerror', (e) => fails.push(String(e).slice(0, 200)))
page.on('response', (r) => r.status() >= 500 && fails.push(`${r.status()} ${r.url().slice(0, 120)}`))

step('1. ログイン')
await page.goto(`${APP}/login`)
ok(await page.locator('text=これは見本です').isVisible(), 'ログイン画面が出る')

// Resend がテストモードで、登録アドレス以外には送れない。
// 余計なメールを送らないよう、コードは管理APIで作り、
// セッションCookieは @supabase/ssr 自身に作らせて流し込む（自前で符号化しない）。
const { code } = await otpFor(EMAIL)
const jar = new Map()
const shadow = createServerClient(API, ANON, {
  cookies: {
    getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
    setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
  },
})
const { error } = await shadow.auth.verifyOtp({ email: EMAIL, token: code, type: 'email' })
ok(!error, '本番のSupabaseがコードを受け付けた', error?.message)
await ctx.addCookies(
  [...jar.entries()].map(([name, value]) => ({
    name, value, domain: new URL(APP).hostname, path: '/', secure: true, sameSite: 'Lax',
  })),
)
await page.goto(`${APP}/`)
await page.waitForTimeout(1500)
ok(!page.url().endsWith('/login'), '本番アプリがセッションを認識した', page.url())

step('2. 旅を登録する')
await tap(page, '＋ 最初の旅を追加')
await page.waitForTimeout(600)
await page.fill('input[name=title]', '本番確認 大阪公演')
await page.fill('input[name=place]', '大阪・京セラドーム')
await page.fill('input[name=start]', '2026-11-14')
await page.fill('input[name=end]', '2026-11-16')
await tap(page, '追加する')
await page.waitForURL(/\/trips\//, { timeout: 20000 })
await page.waitForTimeout(1500)
const labels = await page.locator('.item-type').allTextContents()
ok(JSON.stringify(labels) === JSON.stringify(['チケット', '行き', '帰り', 'ホテル']), '4項目が自動で入る', labels)

step('3. 状態の切り替えと保存')
const row = (n) => page.locator('li.item').filter({ has: page.locator('.item-type', { hasText: new RegExp(`^${n}$`) }) })
await row('チケット').locator('.punch-btn').click()
await page.waitForTimeout(1200)
ok((await row('チケット').locator('.tag').textContent()) === '当落待ち', 'まだ → 当落待ち')
await page.reload()
await page.waitForTimeout(1500)
ok((await row('チケット').locator('.tag').textContent()) === '当落待ち', '読み込み直しても残る（本番DBに保存された）')

step('4. 現地時刻がずれないか')
await row('行き').locator('.item-main').click()
await page.waitForTimeout(600)
await page.fill('input[name=name]', 'BR189')
await page.fill('input[name=dep]', '2026-11-14T09:15')
await tap(page, '保存する')
await page.waitForTimeout(1500)
await page.reload()
await page.waitForTimeout(1500)
ok((await row('行き').locator('.item-sub').textContent())?.includes('9:15'), '9:15 のまま', await row('行き').locator('.item-sub').textContent())

step('5. 一覧にもどる')
await tap(page, '‹ 一覧にもどる')
await page.waitForURL(`${APP}/`, { timeout: 20000 })
await page.waitForTimeout(1200)
ok((await page.locator('.t-title').first().textContent()) === '本番確認 大阪公演', '一覧に出る')

ok(fails.length === 0, 'JSエラーと5xxが無い', fails)
await page.screenshot({ path: 'shots/prod.png' })
await browser.close()

step('後片付け')
const users = await (await admin('/auth/v1/admin/users', null, 'GET')).json()
for (const u of users.users || []) {
  if (u.email?.startsWith('prod-check+')) {
    await admin(`/auth/v1/admin/users/${u.id}`, null, 'DELETE')
    console.log(`  消した: ${u.email}`)
  }
}
const left = await (await fetch(`${API}/rest/v1/trips?select=id`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` } })).json()
console.log(`  残った旅: ${left.length}件`)

console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
