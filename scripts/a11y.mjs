import { chromium } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

/** 読み上げ・コントラストなど、機械で分かる範囲の使いやすさを見る */
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP })
const page = await ctx.newPage()
let total = 0

const scan = async (name) => {
  const { violations } = await new AxeBuilder({ page }).analyze()
  total += violations.length
  console.log(`\n${name}: ${violations.length ? '' : '問題なし'}`)
  for (const v of violations) {
    console.log(`  ✗ ${v.id}（${v.impact}）× ${v.nodes.length}`)
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.html.slice(0, 90)}`)
  }
}

await page.goto(`${APP}/login`)
await scan('ログイン画面')

await clearMail()
await login(page, `a11y-${Date.now()}@example.com`.toLowerCase())
// 下の行き先は、ログイン後どの画面にも出る
await page.waitForSelector('.tabbar')
await scan('一覧（まっさら）')

await tap(page, 'サンプルで見てみる')
await page.waitForSelector('.ticket')
await scan('一覧（旅あり）')

await page.locator('.ticket').first().click()
await page.waitForURL(/\/trips\//)
await scan('旅の詳細')

await page.goto(`${APP}/about`)
await scan('設定')

console.log(`\n合計 ${total} 件`)
await browser.close()
process.exit(total ? 1 : 0)
