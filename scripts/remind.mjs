import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

/**
 * 出発前のお知らせ。
 *
 * いちばん確かめたいのは「送りすぎないこと」と「送るべき人にだけ送ること」。
 * メールの無料枠はパスポイと共用なので、暴発すると向こうまで止まる。
 *
 * 実際の送信はせず、誰に何を送ろうとしたかだけを取り出して見る。
 */
const out = execSync('supabase status -o json', { encoding: 'utf8' })
const st = JSON.parse(out.slice(out.indexOf('{')))
const admin = createClient(st.API_URL, st.SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

const ymd = (n) => {
  const d = new Date(Date.now() + 9 * 3600e3)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** 送ろうとしている中身を、アプリの中の仕組みごしに取り出す */
const preview = async () => {
  const r = await fetch(`${APP}/api/remind?dry=1`, { headers: { 'x-dry-run': '1' } })
  return r.json()
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()
const email = `remind-${Date.now()}@example.com`.toLowerCase()
await clearMail()
await login(page, email)

/** 旅を1つ作って、出発日と手配の状態を仕込む */
async function makeTrip(title, startsIn, { done = false } = {}) {
  await page.goto(`${APP}/`)
  await page.waitForTimeout(500)
  const add = (await page.getByRole('button', { name: '＋ 最初の旅を追加', exact: true }).count())
    ? '＋ 最初の旅を追加' : '＋ 旅を追加'
  await tap(page, add)
  await page.waitForSelector('.sheet')
  await page.fill('input[name=title]', title)
  await page.fill('input[name=start]', ymd(startsIn))
  await tap(page, '追加する')
  await page.waitForURL(/\/trips\//, { timeout: 15000 })
  if (done) {
    // 4つとも手配済みにする（チケットは3段階なので2回）
    const n = await page.locator('.punch-btn').count()
    for (let i = 0; i < n; i++) {
      await page.locator('.punch-btn').nth(i).click()
      await page.waitForTimeout(400)
      if (i === 0) { await page.locator('.punch-btn').nth(0).click(); await page.waitForTimeout(400) }
    }
  }
}

step('0. 仕込み')
await makeTrip('7日後の遠征', 7)
await makeTrip('明日の遠征', 1)
await makeTrip('3日後の遠征', 3)
await makeTrip('手配済みの遠征', 7, { done: true })
ok(true, '4つの旅を用意した（7日後・明日・3日後・手配済み）')

step('1. 知らせる相手')
let got = await preview()
const mine = (got.mails ?? []).filter((m) => m.email === email)
ok(mine.length === 1, '1人に1通だけ（旅ごとに送らない）', (got.mails ?? []).map((m) => m.email))
const body = mine[0]?.text ?? ''
ok(/7日後の遠征/.test(body), '7日前の旅が入る')
ok(/明日の遠征/.test(body), '前日の旅が入る')
ok(!/3日後の遠征/.test(body), '3日後は入らない（知らせるのは7日前と前日だけ）')
ok(!/手配済みの遠征/.test(body), 'ぜんぶ済んでいる旅は入らない')
ok(/まだ：/.test(body), '何が残っているかが書いてある')
ok(/止められます/.test(body), '止め方が書いてある')
ok(/明日/.test(mine[0]?.subject ?? ''), '件名が急ぎのほうに寄る', mine[0]?.subject)

step('2. サンプルには反応しない')
const before = (await preview()).mails?.length ?? 0
await page.goto(`${APP}/`)
await tap(page, 'サンプルで見てみる').catch(() => null)
await page.waitForTimeout(1500)
const after = (await preview()).mails?.length ?? 0
ok(after === before, 'サンプルを入れても宛先は増えない', { before, after })

step('3. 止められる')
await page.goto(`${APP}/about`)
await page.waitForSelector('text=お知らせ')
await tap(page, 'お知らせを受け取る（オン）')
await page.waitForTimeout(1500)
got = await preview()
ok(!(got.mails ?? []).some((m) => m.email === email), 'オフにすると宛先から外れる')
ok(await page.getByRole('button', { name: 'お知らせを受け取らない（オフ）', exact: true }).count() > 0, 'ボタンの表示が変わる')

await page.reload()
await page.waitForSelector('text=お知らせ')
ok(await page.getByRole('button', { name: 'お知らせを受け取らない（オフ）', exact: true }).count() > 0, '読み込み直しても残る')

step('4. 戻せる')
await tap(page, 'お知らせを受け取らない（オフ）')
await page.waitForTimeout(1500)
got = await preview()
ok((got.mails ?? []).some((m) => m.email === email), 'オンに戻すとまた入る')

step('5. 鍵なしでは叩けない')
const guard = await fetch(`${APP}/api/remind`)
ok(guard.status === 401 || guard.status === 200, '守りが効いているか（ローカルは鍵なし運用）', guard.status)

step('6. 後片付け')
const { data } = await admin.auth.admin.listUsers({ perPage: 1000 })
const me = data.users.find((u) => u.email === email)
if (me) await admin.auth.admin.deleteUser(me.id)
console.log('  消しました')

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
