/**
 * 退会とデータの持ち出しを確かめる。
 * 退会したら、旅も手配も招待も残っていないこと。他人のデータは消えないこと。
 */
import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const out = execSync('supabase status -o json', { encoding: 'utf8' })
const st = JSON.parse(out.slice(out.indexOf('{')))
const h = { apikey: st.SERVICE_ROLE_KEY, Authorization: `Bearer ${st.SERVICE_ROLE_KEY}` }
const count = async (table, col, id) =>
  (await (await fetch(`${st.API_URL}/rest/v1/${table}?select=id&${col}=eq.${id}`, { headers: h })).json()).length
const userId = async (email) =>
  (await (await fetch(`${st.API_URL}/auth/v1/admin/users`, { headers: h })).json())
    .users.find((u) => u.email === email)?.id

const ME = `bye+${Date.now()}@example.com`
const OTHER = `stay+${Date.now()}@example.com`

const b = await chromium.launch()

step('1. 他の人のデータを用意する（巻き添えにならないことの確認用）')
const ctxO = await b.newContext({ viewport: VP })
const other = await ctxO.newPage()
await clearMail(); await login(other, OTHER); await other.waitForTimeout(1000)
await tap(other, 'サンプルで見てみる'); await other.waitForSelector('.ticket', { timeout: 60000 })
const otherId = await userId(OTHER)
ok((await count('trips', 'user_id', otherId)) === 4, '他の人の旅が4件ある')

step('2. 自分のデータを作る')
const ctx = await b.newContext({ viewport: VP })
const p = await ctx.newPage()
await clearMail(); await login(p, ME); await p.waitForTimeout(1000)
await tap(p, 'サンプルで見てみる'); await p.waitForSelector('.ticket', { timeout: 60000 })
await p.waitForTimeout(800)
await tap(p, '友だちを招待')
// 発行は通信を挟むので、リンクが出るまで待つ
await p.waitForFunction(
  () => { const i = document.querySelector('input[readonly]'); return !!i && i.value.includes('/invite/') },
  { timeout: 30000 },
)
await tap(p, 'とじる')
const myId = await userId(ME)
ok((await count('trips', 'user_id', myId)) === 4, '自分の旅が4件')
const mine = await count('invites', 'created_by', myId)
ok(mine === 1, '自分の招待が1枚', mine)

step('3. このアプリについて を開く')
await p.waitForTimeout(600)
await tap(p, 'このアプリについて')
await p.waitForURL(`${APP}/about`, { timeout: 20000 })
await p.waitForTimeout(800)
ok(await p.locator('text=あなたのデータは、あなたにしか見えません').isVisible(), '説明が出ている')
ok(await p.getByRole('button', { name: '内容を書き出す', exact: true }).isVisible(), '書き出しボタンがある')
ok(await p.getByRole('button', { name: '退会する', exact: true }).isVisible(), '退会ボタンがある')

step('4. 内容を書き出す')
const dl = p.waitForEvent('download', { timeout: 20000 })
await tap(p, '内容を書き出す')
const file = await dl
const text = (await (await import('node:fs/promises')).readFile(await file.path(), 'utf8'))
ok(file.suggestedFilename() === 'ensei.txt', 'ファイル名が ensei.txt', file.suggestedFilename())
ok(text.includes('ASIA TOUR 大阪公演'), '旅の題名が入っている')
ok(/チケット：(まだ|当落待ち|手配済み)/.test(text), '手配の状態が入っている')
ok(text.includes('のぞみ21号'), '便名も入っている')

step('5. 退会（2回押し）')
const btn = p.getByRole('button', { name: '退会する', exact: true })
await btn.click()
await p.waitForTimeout(300)
ok((await p.getByRole('button', { name: /退会/ }).first().textContent())?.includes('もう一度'), '1回目は確認に変わる')
ok((await count('trips', 'user_id', myId)) === 4, '1回目では消えない')
await p.getByRole('button', { name: 'もう一度押すと退会', exact: true }).click()
await p.waitForURL(`${APP}/login`, { timeout: 30000 })
await p.waitForTimeout(1500)

step('6. 本当に消えたか')
ok((await userId(ME)) === undefined, 'アカウントが消えた')
ok((await count('trips', 'user_id', myId)) === 0, '旅が残っていない')
ok((await count('arrangements', 'user_id', myId)) === 0, '手配が残っていない')
ok((await count('invites', 'created_by', myId)) === 0, '招待が残っていない')
ok(p.url().endsWith('/login'), 'ログイン画面にもどる')
await p.goto(`${APP}/`); await p.waitForTimeout(1200)
ok(p.url().endsWith('/login'), '退会後は一覧を開けない')

step('7. 他の人は無事か')
ok((await userId(OTHER)) !== undefined, '他の人のアカウントは残っている')
ok((await count('trips', 'user_id', otherId)) === 4, '他の人の旅も残っている')

step('8. ログインしていなくても説明は読めるか')
const ctxA = await b.newContext({ viewport: VP })
const anon = await ctxA.newPage()
await anon.goto(`${APP}/about`); await anon.waitForTimeout(1000)
ok(await anon.locator('text=預かるもの').isVisible(), '未ログインでも説明が読める')
ok((await anon.getByRole('button', { name: '退会する', exact: true }).count()) === 0, '未ログインに退会ボタンは出ない')

await b.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
