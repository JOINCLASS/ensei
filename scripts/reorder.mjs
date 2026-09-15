import { chromium } from '@playwright/test'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

/**
 * 手配の並べ替え。PC（マウス）・スマホ（指）・キーボードの3通りで確かめる。
 * 引っぱる方式にしなかった理由がここにある：どれでも同じように動くこと。
 */
const browser = await chromium.launch()
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

const labels = (page) => page.locator('.item-type').allInnerTexts()

async function setup(ctx, tag) {
  const page = await ctx.newPage()
  await clearMail()
  await login(page, `order-${tag}-${Date.now()}@example.com`.toLowerCase())
  await tap(page, '＋ 最初の旅を追加')
  await page.waitForSelector('.sheet')
  await page.fill('input[name=title]', '並べ替えの旅')
  await page.fill('input[name=start]', '2026-11-20')
  await tap(page, '追加する')
  await page.waitForURL(/\/trips\//, { timeout: 15000 })
  return page
}

async function run(label, tag, viewport) {
  console.log(`\n========== ${label} ==========`)
  const ctx = await browser.newContext({ viewport })
  const page = await setup(ctx, tag)

  step('1. はじめの並び')
  const start = await labels(page)
  ok(start.join(',') === 'チケット,行き,帰り,ホテル', '4項目が既定の順で並ぶ', start)

  step('2. 下へ動かす')
  await page.locator('.item').first().locator('.movebtn').nth(1).click()
  await page.waitForTimeout(800)
  const moved = await labels(page)
  ok(moved.join(',') === '行き,チケット,帰り,ホテル', 'チケットが1つ下がる', moved)

  step('3. 読み込み直しても残る')
  await page.reload()
  await page.waitForSelector('.items')
  const kept = await labels(page)
  ok(kept.join(',') === '行き,チケット,帰り,ホテル', '並びが保存されている', kept)

  step('4. 上へ動かす')
  await page.locator('.item').nth(1).locator('.movebtn').first().click()
  await page.waitForTimeout(800)
  const back = await labels(page)
  ok(back.join(',') === 'チケット,行き,帰り,ホテル', 'もとに戻る', back)

  step('5. 端では押せない')
  const top = page.locator('.item').first().locator('.movebtn').first()
  const bottom = page.locator('.item').last().locator('.movebtn').nth(1)
  ok(await top.isDisabled(), 'いちばん上の「↑」は押せない')
  ok(await bottom.isDisabled(), 'いちばん下の「↓」は押せない')

  step('6. 指で押せる大きさか')
  const box = await page.locator('.movebtn').first().boundingBox()
  ok(box.width >= 44, `幅が44px以上（${Math.round(box.width)}px）`, box.width)
  ok(box.height >= 24, `高さが24px以上（${Math.round(box.height)}px）`, box.height)

  step('7. 手配を押す邪魔をしていない')
  await page.locator('.item').first().locator('.punch-btn').click()
  await page.waitForTimeout(700)
  ok((await page.locator('.prog').innerText()).includes('当落待ち'), '状態の切り替えは今までどおり', await page.locator('.prog').innerText())

  await ctx.close()
  return page
}

await run('スマホ', 'phone', VP)
await run('PC', 'pc', { width: 1280, height: 900 })

console.log('\n========== キーボードだけで ==========')
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await setup(ctx, 'key')
  const before = await labels(page)
  // 「↓」に辿り着くまで送り、Enterで押す
  const down = page.locator('.item').first().locator('.movebtn').nth(1)
  await down.focus()
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label'))
  ok(/下へ/.test(focused ?? ''), 'キーボードで「下へ」に移れる', focused)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  const after = await labels(page)
  ok(after.join(',') !== before.join(','), 'Enterで並びが変わる', { before, after })
  await ctx.close()
}

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
