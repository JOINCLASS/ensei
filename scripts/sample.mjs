import { chromium } from '@playwright/test'
import { tap, VP, recordOpts, saveVideo } from './lib.mjs'
const APP = process.env.APP_URL || 'http://localhost:3001'
const MAILPIT = 'http://127.0.0.1:54324'
const EMAIL = 'sample@example.com'

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }

async function code(email) {
  for (let i = 0; i < 30; i++) {
    const l = await (await fetch(`${MAILPIT}/api/v1/messages`)).json()
    const h = l.messages?.find((m) => m.To?.some((t) => t.Address === email))
    if (h) {
      const m = await (await fetch(`${MAILPIT}/api/v1/message/${h.ID}`)).json()
      const c = (m.Text || m.HTML || '').match(/\b\d{6}\b/)
      if (c) return c[0]
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('コードが届かない')
}

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: VP, ...recordOpts() })
const p = await ctx.newPage()
await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })
await p.goto(`${APP}/login`)
await p.fill('input[name=email]', EMAIL)
await tap(p, 'コードを送る')
await p.fill('input[name=code]', await code(EMAIL))
await tap(p, 'ログインする')
await p.waitForURL(`${APP}/`)

console.log('\n[サンプルを入れる]')
ok(await p.locator('text=サンプルで見てみる').isVisible(), '空の画面に「サンプルで見てみる」がある')
ok((await p.locator('text=サンプルを片づける').count()) === 0, 'この時点では「片づける」は出ない')
await tap(p, 'サンプルで見てみる')
await p.waitForTimeout(3000)
ok((await p.locator('.ticket').count()) === 3, 'これからの旅が3件', await p.locator('.ticket').count())
ok(await p.locator('text=サンプルを片づける').isVisible(), '「サンプルを片づける」が出る')

console.log('\n[自分で作った旅は巻き込まない]')
await tap(p, '＋ 旅を追加')
await p.fill('input[name=title]', '自分で作った旅')
await p.fill('input[name=start]', '2026-12-01')
await p.fill('input[name=end]', '2026-12-02')
await tap(p, '追加する')
await p.waitForURL(/\/trips\//)
await tap(p, '‹ 一覧にもどる')
await p.waitForTimeout(1500)
ok((await p.locator('.ticket').count()) === 4, '自分の旅を足して4件', await p.locator('.ticket').count())

await tap(p, 'サンプルを片づける')
await p.waitForTimeout(2500)
const titles = await p.locator('.t-title').allTextContents()
ok(JSON.stringify(titles) === JSON.stringify(['自分で作った旅']), '自分の旅だけ残る', titles)
ok((await p.locator('text=サンプルを片づける').count()) === 0, '片づけたら導線も消える')
ok((await p.locator('.past-toggle').count()) === 0, '終わった旅（サンプル）も消えた')

console.log('\n[空の画面にもどる]')
await p.click('.ticket')
await p.waitForURL(/\/trips\//)
await tap(p, '旅を編集')
await p.waitForTimeout(300)
await p.click('.btn.danger')
await p.click('.btn.danger')
await p.waitForURL(`${APP}/`, { timeout: 10000 })
await p.waitForTimeout(1200)
ok(await p.locator('text=遠征の予定を登録すると').isVisible(), '空の画面にもどった')
ok(await p.locator('text=サンプルで見てみる').isVisible(), '「サンプルで見てみる」がまた使える')

console.log('\n[もう一度入れて、片づけて、空にもどる]')
await tap(p, 'サンプルで見てみる')
await p.waitForTimeout(3000)
ok((await p.locator('.ticket').count()) === 3, 'また3件入った')
await tap(p, 'サンプルを片づける')
await p.waitForTimeout(2500)
ok(await p.locator('text=遠征の予定を登録すると').isVisible(), '1回押すだけで空の画面にもどる')

await p.screenshot({ path: 'shots/after-tidy.png' })
console.log('')
await saveVideo(ctx, p, '5-サンプルを入れて片づける')
await b.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
