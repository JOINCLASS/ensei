/**
 * 招待リンクの流れを通しで確かめる。
 *   招待する人がリンクを出す → 渡された人がそれで登録してログイン
 *   → 同じリンクは二度使えない → リンク無しでは登録できない
 */
import { chromium } from '@playwright/test'
import { APP, VP, clearMail, codeFor, login, tap } from './lib.mjs'

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const HOST = `host+${Date.now()}@example.com`
const GUEST = `guest+${Date.now()}@example.com`

const b = await chromium.launch()

step('1. 招待する人がリンクを出す')
const ctxA = await b.newContext({ viewport: VP })
const host = await ctxA.newPage()
await clearMail()
await login(host, HOST)
await host.waitForTimeout(1200)

// 招待は設定（/about）へ移した。下の行き先から行ける
await host.goto(`${APP}/about`)
await host.waitForSelector('text=できること')
ok(await host.getByRole('button', { name: '友だちを招待', exact: true }).isVisible(), '設定に「友だちを招待」がある')
await tap(host, '友だちを招待')
await host.waitForTimeout(2000)
const url = await host.locator('input[readonly]').inputValue()
ok(/\/invite\/[0-9a-f-]{36}$/.test(url), '招待リンクが発行される', url)
// 設定の本文にも同じ言い回しがあるので、シートの中だけを見る
ok(await host.locator('.sheet').getByText('旅の中身は共有されません').isVisible(), '共有されない旨が書いてある')
await tap(host, 'とじる')

// 招待制は廃止した（2026-09-15）。招待リンクは「友だちに教える近道」であって、
// 入口を閉じるためのものではなくなった。リンクが無くても登録できるのが今の意図。
// 閉じたいときは INVITE_ONLY=true に戻す（そちらは scripts/signup.mjs で見ている）。
step('2. 招待されていなくても登録できる（招待制は廃止した）')
const ctxX = await b.newContext({ viewport: VP })
const stranger = await ctxX.newPage()
await stranger.goto(`${APP}/login`)
await stranger.fill('input[name=email]', `nope+${Date.now()}@example.com`.toLowerCase())
await tap(stranger, 'コードを送る')
await stranger.waitForSelector('input[name=code]', { timeout: 15000 }).catch(() => null)
ok(await stranger.locator('input[name=code]').count() > 0, 'リンク無しでもコード入力まで進める')
await ctxX.close()

step('3. 渡された人がリンクを開く')
const ctxB = await b.newContext({ viewport: VP })
const guest = await ctxB.newPage()
await guest.goto(url)
await guest.waitForTimeout(1500)
ok(await guest.locator('text=招待されています').isVisible(), '「招待されています」と出る')
ok(await guest.getByRole('button', { name: 'はじめる', exact: true }).isVisible(), 'ボタンが「はじめる」になる')

await clearMail()
await guest.fill('input[name=email]', GUEST)
await tap(guest, 'はじめる')
await guest.fill('input[name=code]', await codeFor(GUEST))
await tap(guest, 'ログインする')
await guest.waitForURL(`${APP}/`, { timeout: 20000 })
await guest.waitForTimeout(1200)
ok(!guest.url().endsWith('/login'), 'ログインできる')
ok((await guest.content()).includes('遠征の予定を登録すると'), '自分の空の一覧が出る')

step('4. 同じリンクは二度使えない')
const ctxC = await b.newContext({ viewport: VP })
const second = await ctxC.newPage()
await second.goto(url)
await second.waitForTimeout(1500)
ok(await second.locator('text=すでに使われています').isVisible(), '2人目は断られる')
await ctxC.close()

step('5. 招待した人と、された人のデータは混ざらない')
// 招待は設定から出したので、いま host は設定にいる。一覧へ戻して確かめる
await host.goto(`${APP}/`)
await host.waitForTimeout(1200)
ok((await host.content()).includes('遠征の予定を登録すると'), '招待した人の一覧も空のまま（相手の旅は見えない）')

step('6. 未使用の招待は5枚まで')
// 招待は設定にある
await host.goto(`${APP}/about`)
await host.waitForSelector('text=できること')
let capped = false
for (let i = 0; i < 6; i++) {
  await tap(host, '友だちを招待')
  await host.waitForTimeout(1500)
  if (await host.locator('.err').isVisible().catch(() => false)) {
    capped = (await host.locator('.err').textContent())?.includes('5枚') ?? false
    await tap(host, 'とじる')
    break
  }
  await tap(host, 'とじる')
  await host.waitForTimeout(400)
}
ok(capped, '6枚目で上限に当たる')

await b.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
