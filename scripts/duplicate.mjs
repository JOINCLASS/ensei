import { chromium, devices } from '@playwright/test'
import { APP, VP, clearMail, login, tap, pick } from './lib.mjs'

/**
 * 旅の複製。ツアーの2公演目を作る手間を減らすためのもの。
 * PC（マウス）とスマホ（指）の両方で確かめる。
 */
const browser = await chromium.launch()
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

async function run(label, contextOptions) {
  console.log(`\n========== ${label} ==========`)
  const ctx = await browser.newContext(contextOptions)
  const page = await ctx.newPage()
  await clearMail()
  await login(page, `dup-${label}-${Date.now()}@example.com`.toLowerCase().replace(/[^a-z0-9@.+-]/g, ''))

  step('1. もとの旅をつくる')
  await tap(page, '＋ 最初の旅を追加')
  await page.waitForSelector('.sheet')
  await page.fill('input[name=title]', 'ASIA TOUR 大阪公演')
  await page.fill('input[name=place]', '大阪・京セラドーム')
  await page.fill('input[name=start]', '2026-11-20')
  await page.fill('input[name=end]', '2026-11-21')
  await page.fill('textarea[name=memo]', '2日目は昼公演')
  await tap(page, '追加する')
  await page.waitForURL(/\/trips\//, { timeout: 15000 })
  const origin = new URL(page.url()).pathname

  // 手配を1件足して、並びが引き継がれることを見る
  await tap(page, '＋ 手配を追加')
  await page.waitForSelector('.sheet')
  await pick(page, 'type', 'other')
  await page.fill('input[name=name]', '前乗りの高速バス')
  await tap(page, '追加する')
  await page.waitForTimeout(800)

  // チケットは まだ→当落待ち→手配済み の3つ。2回押して手配済みにする
  await page.locator('.punch-btn').first().click()
  await page.waitForTimeout(500)
  await page.locator('.punch-btn').first().click()
  await page.waitForTimeout(700)
  // 行きも当落待ちにできないので、手配済みにして2件にする
  await page.locator('.punch-btn').nth(1).click()
  await page.waitForTimeout(700)
  ok((await page.locator('.prog').innerText()).includes('2つ手配済み'), 'もとの旅で2件を手配済みにした', await page.locator('.prog').innerText())
  ok((await page.locator('.items li').count()) === 5, '手配は5件（自動4件＋足した1件）', await page.locator('.items li').count())

  step('2. 複製する')
  await tap(page, 'この旅を複製（次の公演をつくる）')
  await page.waitForSelector('.sheet')
  ok((await page.locator('h2').innerText()) === '旅を複製', '「旅を複製」として開く')
  ok((await page.inputValue('input[name=title]')) === 'ASIA TOUR 大阪公演', '公演名を引き継ぐ')
  ok((await page.inputValue('input[name=place]')) === '大阪・京セラドーム', '会場を引き継ぐ')
  ok((await page.inputValue('textarea[name=memo]')) === '2日目は昼公演', 'メモを引き継ぐ')
  ok((await page.inputValue('input[name=start]')) === '', '日付は引き継がない（出発）')
  ok((await page.inputValue('input[name=end]')) === '', '日付は引き継がない（帰り）')

  await page.fill('input[name=title]', 'ASIA TOUR 東京公演')
  await page.fill('input[name=place]', '東京・東京ドーム')
  await page.fill('input[name=start]', '2026-12-05')
  await page.fill('input[name=end]', '2026-12-06')
  await tap(page, '複製する')
  await page.waitForURL((u) => /\/trips\//.test(u.pathname) && u.pathname !== origin, { timeout: 15000 })

  step('3. 複製されたもの')
  ok(page.url() !== `${APP}${origin}`, 'べつの旅として作られる')
  ok(await page.locator('h1', { hasText: 'ASIA TOUR 東京公演' }).count() > 0, '新しい題名になっている')
  const items = await page.locator('.items li').count()
  ok(items === 5, '手配の並びをそのまま引き継ぐ（5件）', items)
  ok(await page.locator('.items', { hasText: '前乗りの高速バス' }).count() > 0, '足した項目も引き継ぐ')
  const prog = await page.locator('.prog').innerText()
  ok(prog.includes('5つのうち0つ手配済み'), '手配済みを引き継がない', prog)
  ok(!/当落待ち/.test(prog), '当落待ちも引き継がない', prog)

  step('4. もとの旅は変わっていない')
  await page.goto(`${APP}${origin}`)
  await page.waitForSelector('.items')
  ok(await page.locator('h1', { hasText: 'ASIA TOUR 大阪公演' }).count() > 0, 'もとの題名のまま')
  ok((await page.locator('.prog').innerText()).includes('2つ手配済み'), 'もとの手配済みは残っている', await page.locator('.prog').innerText())

  step('5. 一覧に2つ並ぶ')
  await tap(page, '‹ 一覧にもどる')
  await page.waitForURL(`${APP}/`, { timeout: 15000 })
  ok((await page.locator('.ticket').count()) === 2, '一覧に2件', await page.locator('.ticket').count())

  await ctx.close()
}

await run('スマホ', { viewport: VP, ...devices['iPhone 14'], browserName: undefined })
await run('PC', { viewport: { width: 1280, height: 900 } })

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
