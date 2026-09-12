/**
 * 押してから「何かが起きた」と分かるまでの時間を測る。
 * サーバーとの往復に1秒以上かかるので、押した瞬間に反応が無いと
 * 二度押しを誘って誤操作になる。
 */
import { chromium } from '@playwright/test'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }

/**
 * 押してから、見た目が変わるまでの時間を測る（最大600ms）。
 * 400ms を上限にしている。サーバーとの往復は1.3〜1.9秒かかるので、
 * それを待たずに反応が返ることを担保する。
 */
async function reactsWithin(page, locator, before) {
  const start = Date.now()
  for (let i = 0; i < 60; i++) {
    const now = await locator.textContent().catch(() => null)
    const dim = await locator.evaluate((el) => getComputedStyle(el).opacity).catch(() => null)
    if (now === null) return { ms: Date.now() - start, how: '画面が切り替わった' }
    if (now.trim() !== before) return { ms: Date.now() - start, how: `文言が「${now.trim()}」に変わった` }
    if (dim !== null && Number(dim) < 0.7) return { ms: Date.now() - start, how: '薄くなった' }
    await page.waitForTimeout(10)
  }
  return { ms: -1, how: '600msたっても無反応' }
}

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: VP })
const page = await ctx.newPage()
await clearMail()
await login(page, `fb+${Date.now()}@example.com`)
await page.waitForTimeout(1200)

console.log('\n[サンプルで見てみる]')
let el = page.locator('.empty .linkbtn')
let r = (await Promise.all([reactsWithin(page, el, 'サンプルで見てみる'), el.click()]))[0]
ok(r.ms >= 0 && r.ms < 400, `${r.ms}ms で反応（${r.how}）`, r)
await page.waitForSelector('.ticket', { timeout: 60000 })
await page.waitForTimeout(1500)

console.log('\n[旅カードを押す]')
el = page.locator('.ticket').first()
r = (await Promise.all([reactsWithin(page, el, null), el.click()]))[0]
ok(r.ms >= 0 && r.ms < 400, `${r.ms}ms で反応（${r.how}）`, r)
await page.waitForSelector('.items', { timeout: 60000 })
await page.waitForTimeout(1000)

console.log('\n[一覧にもどる]')
el = page.getByRole('button', { name: '‹ 一覧にもどる', exact: true })
r = (await Promise.all([reactsWithin(page, el, '‹ 一覧にもどる'), el.click()]))[0]
ok(r.ms >= 0 && r.ms < 400, `${r.ms}ms で反応（${r.how}）`, r)
await page.waitForSelector('.ticket', { timeout: 60000 })
await page.waitForTimeout(1200)

console.log('\n[旅を追加する]')
await tap(page, '＋ 旅を追加')
await page.waitForSelector('#tripSheet')
await page.fill('input[name=title]', '反応の確認')
await page.fill('input[name=start]', '2026-12-01')
await page.fill('input[name=end]', '2026-12-02')
el = page.locator('.sheet-actions .btn.wide')
r = (await Promise.all([reactsWithin(page, el, '追加する'), el.click()]))[0]
ok(r.ms >= 0 && r.ms < 400, `${r.ms}ms で反応（${r.how}）`, r)
ok(/追加しています/.test(r.how), '「追加しています…」と出る（二度押ししたくならない）', r.how)
await page.waitForSelector('.items', { timeout: 60000 })

console.log('\n[手配を保存する]')
await page.locator('li.item').first().locator('.item-main').click()
await page.waitForSelector('#itemSheet')
await page.fill('input[name=name]', '反応')
el = page.locator('.sheet-actions .btn.wide')
r = (await Promise.all([reactsWithin(page, el, '保存する'), el.click()]))[0]
ok(r.ms >= 0 && r.ms < 400, `${r.ms}ms で反応（${r.how}）`, r)

await b.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
