/**
 * 招待の流れを通しで確かめる。
 * Supabase ダッシュボードの Invite user と同じ経路（type=invite のリンク）を使う。
 * メールは送らず、管理APIでリンクだけ作る。
 */
import { chromium } from '@playwright/test'

const APP = process.env.PROD_APP_URL || 'http://localhost:3001'
const API = process.env.PROD_SUPABASE_URL || 'http://127.0.0.1:54321'
const SECRET = process.env.SUPABASE_SECRET
const ANON = process.env.PROD_ANON || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const EMAIL = `invite+${Date.now()}@example.com`

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const admin = (p, b, m = 'POST') => fetch(`${API}${p}`, {
  method: m,
  headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
  ...(b ? { body: JSON.stringify(b) } : {}),
})

step('1. 招待する（ダッシュボードの Invite user と同じ）')
const link = await (await admin('/auth/v1/admin/generate_link', { type: 'invite', email: EMAIL })).json()
ok(!!link.action_link, '招待リンクが発行される')

const users = await (await admin('/auth/v1/admin/users', null, 'GET')).json()
const invited = users.users.find((u) => u.email === EMAIL)
ok(!!invited, 'ユーザーが作られる')
ok(!invited?.email_confirmed_at, 'この時点ではまだ未確認')

step('2. 招待された人がリンクを踏む')
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
await page.goto(link.action_link)
await page.waitForTimeout(6000)

ok(!page.url().includes('access_token'), 'URLにトークンが残らない')
ok(!page.url().endsWith('/login'), 'ログイン画面で行き止まりにならない', page.url().replace(APP, ''))
ok((await ctx.cookies()).some((c) => /auth-token(\.\d+)?$/.test(c.name)), 'セッションCookieが作られる')
ok((await page.content()).includes('遠征の予定を登録すると'), '空の一覧が出る（＝ログイン済み）')

step('3. 確認済みになっているか')
const after = await (await admin('/auth/v1/admin/users', null, 'GET')).json()
const u2 = after.users.find((x) => x.email === EMAIL)
ok(!!u2?.email_confirmed_at, 'リンクを踏むと確認済みになる')

step('4. 閉じて開き直してもログインが保たれるか')
const state = await ctx.storageState()
await ctx.close()
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: state })
const page2 = await ctx2.newPage()
await page2.goto(`${APP}/`)
await page2.waitForTimeout(2000)
ok(!page2.url().endsWith('/login'), 'ログインが保たれる')
await b.close()

step('5. 招待していないアドレスは入れないこと')
const res = await fetch(`${API}/auth/v1/otp`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: `stranger+${Date.now()}@example.com`, create_user: false }),
})
const body = await res.json().catch(() => ({}))
ok(res.status === 422 && /otp_disabled|signup/.test(body.error_code || ''), '未招待は拒否される', { status: res.status, ...body })

step('後片付け')
for (const x of (await (await admin('/auth/v1/admin/users', null, 'GET')).json()).users || []) {
  if (x.email?.startsWith('invite+') || x.email?.startsWith('invite-')) {
    await admin(`/auth/v1/admin/users/${x.id}`, null, 'DELETE')
    console.log(`  消した: ${x.email}`)
  }
}

console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
