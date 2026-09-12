/**
 * 旅を1つ登録して、最後の手配が済むまでを通しで撮る。
 * 途中で中身も確かめているので、動画であると同時にテストでもある。
 */
import { chromium } from '@playwright/test'
import { tap, APP, VP, clearMail, login, pick, recordOpts, saveVideo } from './lib.mjs'

// 毎回まっさらな状態から始めたいので、実行ごとに別のアドレスを使う
const EMAIL = `walkthrough+${Date.now()}@example.com`
let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${g !== undefined ? `  ← ${JSON.stringify(g)}` : ''}`)) }
const step = (t) => console.log(`\n${t}`)

const browser = await chromium.launch({ slowMo: 180 })  // 見て追えるくらいの速さにする
const ctx = await browser.newContext({ viewport: VP, ...recordOpts() })
const page = await ctx.newPage()
const beat = (ms = 900) => page.waitForTimeout(ms)

const row = (name) => page.locator('li.item').filter({ has: page.locator('.item-type', { hasText: new RegExp(`^${name}$`) }) })
const punch = (name) => row(name).locator('.punch-btn')
const tag = (name) => row(name).locator('.tag')

await clearMail()

step(`1. ログイン（メールのワンタイムコード）  ${EMAIL}`)
await login(page, EMAIL)
await beat(1200)
ok(await page.locator('text=遠征の予定を登録すると').isVisible(), '空の画面から始まる')

step('2. 旅を登録する')
await tap(page, '＋ 最初の旅を追加')
await beat()
await page.fill('input[name=title]', 'ASIA TOUR 大阪公演')
await page.fill('input[name=place]', '大阪・京セラドーム')
await page.fill('input[name=start]', '2026-11-14')
await page.fill('input[name=end]', '2026-11-16')
await pick(page, 'color', 'sky')
await page.fill('textarea[name=memo]', '2日目は昼公演')
await beat()
await tap(page, '追加する')
await page.waitForURL(/\/trips\//)
await beat(1400)
ok(JSON.stringify(await page.locator('.item-type').allTextContents()) === JSON.stringify(['チケット', '行き', '帰り', 'ホテル']), 'チケット・行き・帰り・ホテルが自動で入る')
ok((await page.locator('.prog').textContent()) === '4つのうち0つ手配済み', 'まだ何も手配していない')

step('3. チケット：詳細を入れて、当落待ちにする')
await row('チケット').locator('.item-main').click()
await beat()
await page.fill('input[name=name]', 'FC先行 スタンド')
await page.fill('input[name=dep]', '2026-11-14T17:00')
await beat()
await tap(page, '保存する')
await beat(1200)
ok((await row('チケット').locator('.item-sub').textContent()) === '開演 11/14 17:00', '開演日時が出る')
await punch('チケット').click()
await beat(1200)
ok((await tag('チケット').textContent()) === '当落待ち', 'まだ → 当落待ち')

step('4. 行き：新幹線を登録して手配済みにする')
await row('行き').locator('.item-main').click()
await beat()
await page.fill('input[name=name]', 'のぞみ21号 7号車')
await page.fill('input[name=from]', '東京')
await page.fill('input[name=to]', '新大阪')
await page.fill('input[name=dep]', '2026-11-14T08:30')
await page.fill('input[name=arr]', '2026-11-14T11:00')
await beat()
await tap(page, '保存する')
await beat(1200)
ok((await row('行き').locator('.item-sub').textContent()) === '11/14　東京 8:30 → 新大阪 11:00', '出発と到着が並ぶ')
await punch('行き').click()
await beat(1100)
ok((await tag('行き').textContent()) === '手配済み', '行き 手配済み')

step('5. 帰り')
await row('帰り').locator('.item-main').click()
await beat()
await page.fill('input[name=name]', 'のぞみ48号')
await page.fill('input[name=from]', '新大阪')
await page.fill('input[name=to]', '東京')
await page.fill('input[name=dep]', '2026-11-16T18:00')
await page.fill('input[name=arr]', '2026-11-16T20:33')
await beat()
await tap(page, '保存する')
await beat(1100)
await punch('帰り').click()
await beat(1100)
ok((await tag('帰り').textContent()) === '手配済み', '帰り 手配済み')

step('6. ホテル：泊数が出る')
await row('ホテル').locator('.item-main').click()
await beat()
await page.fill('input[name=name]', '梅田のホテル')
await page.fill('input[name=checkIn]', '2026-11-14')
await page.fill('input[name=checkOut]', '2026-11-16')
await page.fill('textarea[name=memo]', '前日までキャンセル無料')
await beat()
await tap(page, '保存する')
await beat(1200)
ok((await row('ホテル').locator('.item-sub').textContent()) === '11/14〜11/16　2泊', '2泊と出る')
await punch('ホテル').click()
await beat(1100)

step('7. 当落が出た：チケットを手配済みに')
await punch('チケット').click()
await beat(1300)
ok((await tag('チケット').textContent()) === '手配済み', '当落待ち → 手配済み')
ok((await punch('チケット').textContent()) === '✓', '丸が ✓ になる')

step('8. 手配を足す（レンタカー）')
await tap(page, '＋ 手配を追加')
await beat()
await pick(page, 'type', 'other')
await page.fill('input[name=name]', 'レンタカー')
await pick(page, 'status', 'done')
await beat()
await tap(page, '追加する')
await beat(1300)
ok((await page.locator('.item-type').count()) === 5, '手配が5つになった')

step('9. 全部そろった')
ok((await page.locator('.prog').textContent()) === '5つのうち5つ手配済み', '5つのうち5つ手配済み')
const bar = await page.locator('.prog-bar span').evaluate((el) => ({
  style: el.getAttribute('style'),
  filled: Math.round(el.getBoundingClientRect().width),
  track: Math.round(el.parentElement.getBoundingClientRect().width),
}))
ok(bar.filled === bar.track && bar.filled > 0, 'バーが端まで伸びる', bar)
await beat(1600)

step('10. 一覧にもどる')
await tap(page, '‹ 一覧にもどる')
await page.waitForURL(`${APP}/`)
await beat(1600)
ok((await page.locator('.t-title').first().textContent()) === 'ASIA TOUR 大阪公演', '一覧に並ぶ')
ok((await page.locator('.all-done').textContent()) === 'すべて手配済み', 'カードが「すべて手配済み」')
ok((await page.locator('.summary').textContent()) === 'これからの遠征1件は、すべて手配済みです。', '要約が変わる', await page.locator('.summary').textContent())
ok((await page.locator('.stub-n').first().textContent()) === '2泊', '半券に「2泊」')
await beat(2200)

console.log('')
await saveVideo(ctx, page, '6-旅の登録から手配完了まで')
await browser.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
