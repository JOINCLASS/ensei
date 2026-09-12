/**
 * ログイン状態が保たれるかを確かめる。
 * ローカルにも本番にも当てられる（PROD_* を渡すと本番）。
 */
import { chromium } from '@playwright/test'
import { APP, clearMail, login } from './lib.mjs'

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

await clearMail()
await login(page, `sess+${Date.now()}@example.com`)
await page.waitForTimeout(1200)

const authCookie = () => ctx.cookies().then((cs) => cs.find((c) => /auth-token(\.\d+)?$/.test(c.name)))

step('[Cookieの設定]')
const c = await authCookie()
const days = Math.round((c.expires * 1000 - Date.now()) / 86400000)
ok(c.sameSite === 'Lax', 'sameSite=Lax', c.sameSite)
ok(days > 300, `期限が十分長い（あと約${days}日）`, days)
ok(c.httpOnly === false, 'httpOnly=false（ライブラリの制約。ブラウザから読める必要がある）')
const https = APP.startsWith('https')
ok(c.secure === https, `secure=${https}（${https ? 'https なので付く' : 'localhost は http なので付かない'}）`, c.secure)

step('[セッションの保存先]')
ok((await page.evaluate(() => Object.keys(localStorage))).length === 0, 'localStorage にトークンを置いていない')
const verifiers = (await ctx.cookies()).filter((x) => x.name.endsWith('-code-verifier'))
ok(verifiers.length === 0, '使い捨てCookieが残っていない', verifiers.map((v) => v.name))

step('[ログイン中に /login を開く]')
await page.goto(`${APP}/login`)
await page.waitForTimeout(1500)
ok(!page.url().endsWith('/login'), '一覧にリダイレクトされる', page.url().replace(APP, ''))

step('[ブラウザを閉じて開き直す]')
const state = await ctx.storageState()
await ctx.close()
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, storageState: state })
const page2 = await ctx2.newPage()
await page2.goto(`${APP}/`)
await page2.waitForTimeout(1500)
ok(!page2.url().endsWith('/login'), 'ログインが保たれている')
ok((await page2.content()).includes('遠征の手配'), 'サーバーコンポーネントがユーザーを取得できている')

step('[アクセストークンの期限が切れた後]')
const dec = (v) => JSON.parse(Buffer.from(v.replace(/^base64-/, ''), 'base64url').toString())
const enc = (o) => 'base64-' + Buffer.from(JSON.stringify(o)).toString('base64url')
const cur = (await ctx2.cookies()).find((x) => /auth-token(\.\d+)?$/.test(x.name))
const sess = dec(cur.value)
const oldToken = sess.access_token
sess.expires_at = Math.floor(Date.now() / 1000) - 3600
sess.expires_in = 0
await ctx2.addCookies([{ ...cur, value: enc(sess) }])
await page2.goto(`${APP}/`)
await page2.waitForTimeout(2500)
ok(!page2.url().endsWith('/login'), '1時間放置しても締め出されない')
const after = dec((await ctx2.cookies()).find((x) => /auth-token(\.\d+)?$/.test(x.name)).value)
ok(after.access_token !== oldToken, 'トークンが自動で更新された')

step('[ログアウトは効くか]')
await page2.getByRole('button', { name: 'ログアウト', exact: true }).click()
await page2.waitForTimeout(2000)
ok(page2.url().endsWith('/login'), 'ログアウトするとログイン画面にもどる', page2.url().replace(APP, ''))
await page2.goto(`${APP}/`)
await page2.waitForTimeout(1200)
ok(page2.url().endsWith('/login'), 'ログアウト後は一覧を開けない')

await b.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
