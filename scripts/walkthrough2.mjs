/**
 * 旅を2つ登録して、一覧でどう並ぶかまでを通しで撮る。
 * 日付順の並び・旅ごとの推し色・2つ分をまとめた要約を確かめる。
 */
import { chromium } from '@playwright/test'
import { tap, APP, VP, clearMail, login, pick, recordOpts, saveVideo } from './lib.mjs'

const EMAIL = `walkthrough2+${Date.now()}@example.com`
let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const browser = await chromium.launch({ slowMo: 170 })
const ctx = await browser.newContext({ viewport: VP, ...recordOpts() })
const page = await ctx.newPage()
const beat = (ms = 850) => page.waitForTimeout(ms)

const row = (name) => page.locator('li.item').filter({ has: page.locator('.item-type', { hasText: new RegExp(`^${name}$`) }) })
const punch = (name) => row(name).locator('.punch-btn')

async function addTrip({ title, place, start, end, color, memo }) {
  await page.fill('input[name=title]', title)
  await page.fill('input[name=place]', place)
  await page.fill('input[name=start]', start)
  await page.fill('input[name=end]', end)
  await pick(page, 'color', color)
  if (memo) await page.fill('textarea[name=memo]', memo)
  await beat()
  await tap(page, '追加する')
  await page.waitForURL(/\/trips\//)
  await beat(1200)
}

async function fillItem(name, fields) {
  await row(name).locator('.item-main').click()
  await beat()
  for (const [k, v] of Object.entries(fields)) {
    const sel = k === 'memo' ? 'textarea[name=memo]' : `input[name=${k}]`
    await page.fill(sel, v)
  }
  await beat()
  await tap(page, '保存する')
  await beat(1000)
}

await clearMail()

step(`1. ログイン  ${EMAIL}`)
await login(page, EMAIL)
await beat(1100)

/* ---------- 1つめ ---------- */
step('2. 1つめの旅：ASIA TOUR 大阪公演（水色）')
await tap(page, '＋ 最初の旅を追加')
await beat()
await addTrip({ title: 'ASIA TOUR 大阪公演', place: '大阪・京セラドーム', start: '2026-11-14', end: '2026-11-16', color: 'sky', memo: '2日目は昼公演' })

await fillItem('チケット', { name: 'FC先行 スタンド', dep: '2026-11-14T17:00' })
await punch('チケット').click(); await beat(700)   // まだ → 当落待ち
await punch('チケット').click(); await beat(900)   // 当落待ち → 手配済み
await fillItem('行き', { name: 'のぞみ21号 7号車', from: '東京', to: '新大阪', dep: '2026-11-14T08:30', arr: '2026-11-14T11:00' })
await punch('行き').click(); await beat(1000)
ok((await page.locator('.prog').textContent()) === '4つのうち2つ手配済み', '1つめは 4つのうち2つ手配済み')

step('3. 一覧にもどる（まだ1つ）')
await tap(page, '‹ 一覧にもどる')
await page.waitForURL(`${APP}/`)
await beat(1500)
ok((await page.locator('.ticket').count()) === 1, 'カードは1枚')
ok((await page.locator('.summary').textContent()) === '1つの旅で、まだの手配が2件あります。', '要約は1つ分', await page.locator('.summary').textContent())

/* ---------- 2つめ ---------- */
step('4. 2つめの旅：ファンミーティング 福岡（ピンク）')
await tap(page, '＋ 旅を追加')
await beat()
await addTrip({ title: 'ファンミーティング 福岡', place: '福岡・マリンメッセ', start: '2026-12-05', end: '2026-12-06', color: 'pink' })

await fillItem('チケット', { name: 'FC先行 当落は来週' })
await punch('チケット').click(); await beat(1000)  // まだ → 当落待ち
await fillItem('ホテル', { name: '博多駅前のホテル', checkIn: '2026-12-05', checkOut: '2026-12-06', memo: '前日までキャンセル無料' })
await punch('ホテル').click(); await beat(1100)
ok((await page.locator('.prog').textContent()) === '4つのうち1つ手配済み、当落待ち1つ', '2つめは当落待ちが出る', await page.locator('.prog').textContent())

/* ---------- 一覧でまとめて見る ---------- */
step('5. 一覧に2つ並ぶ')
await tap(page, '‹ 一覧にもどる')
await page.waitForURL(`${APP}/`)
await beat(1800)

const titles = await page.locator('.t-title').allTextContents()
ok(JSON.stringify(titles) === JSON.stringify(['ASIA TOUR 大阪公演', 'ファンミーティング 福岡']), '日付の早い順に並ぶ', titles)
ok((await page.locator('.summary').textContent()) === '2つの旅で、まだの手配が4件あります。当落待ちは1件です。', '2つ分をまとめた要約', await page.locator('.summary').textContent())

const stubs = await page.locator('.stub-d').allTextContents()
const nights = await page.locator('.stub-n').allTextContents()
ok(JSON.stringify(stubs) === JSON.stringify(['14', '5']), '半券の日付', stubs)
ok(JSON.stringify(nights) === JSON.stringify(['2泊', '1泊']), '半券の泊数', nights)

// 旅ごとに推し色が違うこと（半券の左の帯の色）
const edges = await page.locator('.ticket').evaluateAll((els) =>
  els.map((el) => getComputedStyle(el.querySelector('.stub')).borderLeftColor))
ok(edges[0] === 'rgb(61, 182, 232)', '1枚目は水色', edges[0])
ok(edges[1] === 'rgb(247, 111, 168)', '2枚目はピンク', edges[1])

const lines = await page.locator('.todo-line').allTextContents()
ok(lines[0] === 'まだ帰り、ホテル', '1枚目のまだ', lines[0])
ok(lines[1] === 'まだ行き、帰り当落待ちチケット', '2枚目のまだと当落待ち', lines[1])

// 2枚目までゆっくり見せる
await page.mouse.wheel(0, 260); await beat(1500)
await page.mouse.wheel(0, 260); await beat(2200)
await page.screenshot({ path: 'shots/two-trips.png', fullPage: true })

console.log('')
await saveVideo(ctx, page, '7-二つの旅を登録して一覧で見る')
await browser.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
