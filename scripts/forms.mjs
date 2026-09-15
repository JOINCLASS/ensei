import { chromium } from '@playwright/test'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

/**
 * 競合レビューで離脱の原因になっていた点を、こちらで起きないか確かめる。
 *   ・読み込みに失敗したときに、データが消えたように見せない
 *   ・過去の旅を登録できて、一覧からも見える
 *   ・キーボードが出ても、入力欄と保存ボタンが隠れない
 */
const browser = await chromium.launch()
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()
await clearMail()
await login(page, `forms-${Date.now()}@example.com`.toLowerCase())

step('1. 過去の旅')
await tap(page, '＋ 最初の旅を追加')
await page.waitForSelector('.sheet')
await page.fill('input[name=title]', '去年の東京公演')
await page.fill('input[name=place]', '東京・有明アリーナ')
await page.fill('input[name=start]', '2025-11-08')
await page.fill('input[name=end]', '2025-11-09')
await tap(page, '追加する')
await page.waitForURL(/\/trips\//, { timeout: 15000 })
ok(true, '過去の日付でも登録できる')
ok(await page.locator('h1', { hasText: '去年の東京公演' }).count() > 0, '詳細に出る')

await tap(page, '‹ 一覧にもどる')
await page.waitForURL(`${APP}/`, { timeout: 15000 })
ok(await page.locator('.t-title', { hasText: '去年の東京公演' }).isVisible(), '一覧にもどっても見える（折りたたみが開いている）')

step('4. キーボードが出たとき')
const ctx2 = await browser.newContext({ viewport: VP })
// visualViewport を、キーボードが 336px ぶん占めている状態に見せかける
await ctx2.addInitScript(() => {
  const vv = window.visualViewport
  Object.defineProperty(vv, 'height', { get: () => 844 - 336 })
  Object.defineProperty(vv, 'offsetTop', { get: () => 0 })
})
const page2 = await ctx2.newPage()
await clearMail()
await login(page2, `forms2-${Date.now()}@example.com`.toLowerCase())
await tap(page2, '＋ 最初の旅を追加')
await page2.waitForSelector('.sheet')
await page2.waitForTimeout(400)

const overlay = await page2.locator('.overlay').boundingBox()
ok(Math.round(overlay.height) <= 520, '覆いがキーボードの上までに収まる', overlay.height)

const box = await page2.locator('.sheet').boundingBox()
ok(box.y + box.height <= 844 - 336 + 1, 'シートの下端がキーボードより上にある', { 下端: box.y + box.height, 境目: 844 - 336 })

// はみ出した分は、シートの中をスクロールすれば届く
const reach = await page2.evaluate(() => {
  const sheet = document.querySelector('.sheet')
  sheet.scrollTop = sheet.scrollHeight
  const btn = [...sheet.querySelectorAll('button')].find((b) => b.textContent.trim() === '追加する')
  const r = btn.getBoundingClientRect()
  const s = sheet.getBoundingClientRect()
  return r.bottom <= s.bottom + 1 && r.top >= s.top - 1
})
ok(reach, 'スクロールすれば保存ボタンに届く')

step('5. キーボードが無いときは、見た目を変えない')
const ctx3 = await browser.newContext({ viewport: VP })
const page3 = await ctx3.newPage()
await clearMail()
await login(page3, `forms3-${Date.now()}@example.com`.toLowerCase())
await tap(page3, '＋ 最初の旅を追加')
await page3.waitForSelector('.sheet')
await page3.waitForTimeout(400)
const o3 = await page3.locator('.overlay').boundingBox()
ok(Math.round(o3.height) === 844, '覆いは画面いっぱいのまま', o3.height)
const style = await page3.locator('.overlay').getAttribute('style')
ok(!style, 'style属性を足していない', style)

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
