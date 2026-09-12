import { chromium } from '@playwright/test'
import { tap, APP, VP, clearMail, login, recordOpts, saveVideo } from './lib.mjs'

const EMAIL = 'c@example.com'

let pass = 0, fail = 0
const ok = (cond, msg, got) => {
  if (cond) { pass++; console.log(`  ✓ ${msg}`) }
  else { fail++; console.log(`  ✗ ${msg}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`) }
}


// ラジオは参照HTMLの設計どおり見えない位置にあるので、実ユーザーと同じくラベルを押す
const pick = (page, name, value) =>
  page.locator(`label:has(input[name=${name}][value=${value}]) > span`).click()

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: VP, ...recordOpts() })
const page = await ctx.newPage()

await clearMail()
await login(page, EMAIL)

/* ---------- 旅を追加 ---------- */
console.log('\n[旅を追加]')
await tap(page, '＋ 最初の旅を追加')
await page.fill('input[name=title]', '検証ツアー 台北')
await page.fill('input[name=place]', '台北')
await page.fill('input[name=start]', '2026-10-22')
await page.fill('input[name=end]', '2026-10-25')
await pick(page, 'color', 'green')
await tap(page, '追加する')
await page.waitForURL(/\/trips\//)
const tripUrl = page.url()

const labels = await page.locator('.item-type').allTextContents()
ok(JSON.stringify(labels) === JSON.stringify(['チケット', '行き', '帰り', 'ホテル']), '4項目が自動で入る', labels)
ok((await page.locator('.tag-todo').count()) === 4, '4つとも「まだ」')
ok((await page.locator('.prog').textContent()) === '4つのうち0つ手配済み', '進み具合の文言')

const row = (name) => page.locator('li.item').filter({ has: page.locator('.item-type', { hasText: new RegExp(`^${name}$`) }) })
const punch = (name) => row(name).locator('.punch-btn')
const tag = (name) => row(name).locator('.tag')

/* ---------- 状態の切り替え ---------- */
console.log('\n[状態の切り替え]')
await punch('チケット').click(); await page.waitForTimeout(250)
ok((await tag('チケット').textContent()) === '当落待ち', 'チケット まだ→当落待ち')
ok((await punch('チケット').textContent()) === '待ち', '丸の中身が「待ち」')
await punch('チケット').click(); await page.waitForTimeout(250)
ok((await tag('チケット').textContent()) === '手配済み', 'チケット 当落待ち→手配済み')
ok((await punch('チケット').textContent()) === '✓', '丸の中身が「✓」')
await punch('チケット').click(); await page.waitForTimeout(250)
ok((await tag('チケット').textContent()) === 'まだ', 'チケット 手配済み→まだ（一周する）')

await punch('行き').click(); await page.waitForTimeout(250)
ok((await tag('行き').textContent()) === '手配済み', '行き まだ→手配済み')
await punch('行き').click(); await page.waitForTimeout(250)
ok((await tag('行き').textContent()) === 'まだ', '行き 手配済み→まだ（当落待ちを飛ばす）')

// 縮んで戻るアニメが当たっているか
await punch('ホテル').click()
await page.waitForTimeout(60)
ok(await punch('ホテル').evaluate((el) => el.classList.contains('pop')), 'タップでアニメが当たる')
await page.waitForTimeout(600)

/* ---------- 保存されているか ---------- */
console.log('\n[保存]')
await page.reload(); await page.waitForTimeout(800)
ok((await tag('ホテル').textContent()) === '手配済み', '読み込み直しても手配済みのまま')
ok((await page.locator('.prog').textContent()) === '4つのうち1つ手配済み', '進み具合も合っている')

/* ---------- 現地時刻がずれないか ---------- */
console.log('\n[現地時刻]')
await row('行き').locator('.item-main').click()
await page.waitForTimeout(300)
ok(await page.locator('[data-v=fromto]').isVisible(), '行きでは「出発・到着」欄が出る')
ok(await page.locator('[data-v=hotel]').isHidden(), '行きでは「チェックイン」欄は出ない')
ok(await page.locator('[data-status=wait]').isHidden(), '行きでは「当落待ち」は選べない')
await page.fill('input[name=name]', 'BR189')
await page.fill('input[name=from]', '羽田')
await page.fill('input[name=to]', '台北松山')
await page.fill('input[name=dep]', '2026-10-22T09:15')
await page.fill('input[name=arr]', '2026-10-22T12:05')
await tap(page, '保存する')
await page.waitForTimeout(800)
ok((await row('行き').locator('.item-sub').textContent()) === '10/22　羽田 9:15 → 台北松山 12:05', '出発・到着の行', await row('行き').locator('.item-sub').textContent())
await page.reload(); await page.waitForTimeout(800)
ok((await row('行き').locator('.item-sub').textContent()) === '10/22　羽田 9:15 → 台北松山 12:05', '読み込み直しても 9:15 のまま')

/* ---------- 種類で入力欄が変わる ---------- */
console.log('\n[手配を追加]')
await tap(page, '＋ 手配を追加')
await page.waitForTimeout(300)
ok(await page.locator('[data-status=wait]').isHidden(), '既定（その他）では当落待ちは出ない')
await pick(page, 'type', 'ticket')
ok(await page.locator('[data-status=wait]').isVisible(), 'チケットにすると当落待ちが出る')
ok((await page.locator('[data-l=dep]').textContent()) === '開演日時', 'チケットでは「開演日時」')
await pick(page, 'type', 'hotel')
ok(await page.locator('[data-v=hotel]').isVisible(), 'ホテルではチェックイン欄が出る')
ok(await page.locator('[data-v=dep]').isHidden(), 'ホテルでは日時欄は出ない')
ok((await page.locator('[data-l=name]').textContent()) === 'ホテル名', 'ホテルでは「ホテル名」')
await pick(page, 'type', 'other')
await page.fill('input[name=name]', 'レンタカー')
await tap(page, '追加する')
await page.waitForTimeout(800)
ok((await page.locator('.item-type').count()) === 5, '手配が5つになった')
ok((await page.locator('.prog').textContent()) === '5つのうち1つ手配済み', '進み具合が増えた')

/* ---------- 2回押しで削除 ---------- */
console.log('\n[削除は2回押し]')
await page.locator('li.item').last().locator('.item-main').click()
await page.waitForTimeout(300)
await page.click('.btn.danger')
ok((await page.locator('.btn.danger').textContent()) === 'もう一度押すと削除', '1回目は確認に変わる')
ok((await page.locator('.item-type').count()) === 5, '1回目では消えない')
await page.click('.btn.danger')
await page.waitForTimeout(800)
ok((await page.locator('.item-type').count()) === 4, '2回目で消える')

/* ---------- 一覧にもどる ---------- */
console.log('\n[一覧]')
await tap(page, '‹ 一覧にもどる')
await page.waitForURL(`${APP}/`)
await page.waitForTimeout(600)
ok((await page.locator('.t-title').first().textContent()) === '検証ツアー 台北', '一覧に出ている')
ok((await page.locator('.summary').textContent()).includes('1つの旅で、まだの手配が3件'), '要約の文言', await page.locator('.summary').textContent())
ok((await page.locator('.stub-n').first().textContent()) === '3泊', '半券に泊数')

/* ---------- 旅の削除 ---------- */
console.log('\n[旅の削除]')
await page.goto(tripUrl)
await page.waitForTimeout(600)
await tap(page, '旅を編集')
await page.waitForTimeout(300)
await page.click('.btn.danger')
await page.click('.btn.danger')
await page.waitForURL(`${APP}/`, { timeout: 10000 })
await page.waitForTimeout(800)
ok((await page.locator('.ticket').count()) === 0, '旅が消えた')
ok(await page.locator('text=遠征の予定を登録すると').isVisible(), '空の画面にもどる')

console.log('')
await saveVideo(ctx, page, '4-動きの通し確認')
await browser.close()
console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
