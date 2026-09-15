import { chromium } from '@playwright/test'
import { APP, VP, clearMail, login, tap, pick } from './lib.mjs'
import { readFileSync } from 'node:fs'

/**
 * 書き出し。データベースに自動バックアップが無いので、これが唯一の保険になる。
 * 3つの形が本当に開けるかを、中身を見て確かめる。PCとスマホの両方で。
 */
const browser = await chromium.launch()
let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

async function run(label, tag, viewport) {
  console.log(`\n========== ${label} ==========`)
  const ctx = await browser.newContext({ viewport, acceptDownloads: true })
  const page = await ctx.newPage()
  await clearMail()
  await login(page, `exp-${tag}-${Date.now()}@example.com`.toLowerCase())

  // 区切り文字や引用符が混ざっても壊れないことを見たいので、わざと入れる
  await tap(page, '＋ 最初の旅を追加')
  await page.waitForSelector('.sheet')
  await page.fill('input[name=title]', 'ASIA TOUR 大阪, 2日目')
  await page.fill('input[name=place]', '大阪・京セラドーム')
  await page.fill('input[name=start]', '2026-11-20')
  await page.fill('input[name=end]', '2026-11-21')
  // CSVで逃がす必要があるのは半角の " のほう。全角の「」では確かめられない
  await page.fill('textarea[name=memo]', '"昼公演" 2日目\nキャンセル期限に注意')
  await tap(page, '追加する')
  await page.waitForURL(/\/trips\//, { timeout: 15000 })

  await tap(page, '＋ 手配を追加')
  await page.waitForSelector('.sheet')
  await pick(page, 'type', 'other')
  await page.fill('input[name=name]', 'レンタカー')
  await tap(page, '追加する')
  await page.waitForTimeout(800)

  step('0. その他に付けた名前が、詳細でも種類になる')
  const types = await page.locator('.item-type').allInnerTexts()
  ok(types.includes('レンタカー'), '「その他」ではなく「レンタカー」と出る', types)
  ok(!types.includes('その他'), '「その他」は残らない', types)
  const shown = await page.locator('.items').innerText()
  ok((shown.match(/レンタカー/g) ?? []).length === 1, '同じ名前を2度出さない')

  await page.goto(`${APP}/about`)
  await page.waitForSelector('text=持ち出す')

  const grab = async (name) => {
    const [d] = await Promise.all([page.waitForEvent('download'), tap(page, name)])
    return readFileSync(await d.path(), 'utf8')
  }

  step('1. 読めるかたち（テキスト）')
  const text = await grab('読めるかたちで（テキスト）')
  ok(text.includes('ASIA TOUR 大阪, 2日目'), '旅の名前が入る')
  ok(text.includes('レンタカー'), '足した手配も入る')
  ok(text.includes('キャンセル期限に注意'), 'メモも入る')

  step('2. 表計算で開ける形（CSV）')
  const csv = await grab('表計算で開ける形で（CSV）')
  ok(csv.charCodeAt(0) === 0xfeff, 'Excelで文字化けしない印がある')
  const head = csv.replace(/^﻿/, '').split('\r\n')[0]
  ok(head.startsWith('"旅","行き先"'), '見出しの行がある', head.slice(0, 40))
  ok(csv.includes('"ASIA TOUR 大阪, 2日目"'), '区切り文字が入った名前でも壊れない')
  ok(csv.includes('""昼公演""'), '引用符は2つにして逃がしてある', csv.split('\r\n')[1]?.slice(0, 120))
  const rows = csv.replace(/^﻿/, '').split('\r\n').length
  ok(rows === 6, '見出し1行＋手配5行', rows)

  step('3. そっくり残す形（JSON）')
  const json = JSON.parse(await grab('そっくり残す形で（JSON）'))
  ok(json.app === '手配まとめ', 'どのアプリのものか分かる')
  ok(json.version === 1, '形の版が入っている')
  ok(json.trips.length === 1, '旅が1件')
  ok(json.trips[0].items.length === 5, '手配が5件', json.trips[0].items.length)
  ok(json.trips[0].memo.includes('\n'), '改行もそのまま残る')

  await ctx.close()
}

await run('スマホ', 'phone', VP)
await run('PC', 'pc', { width: 1280, height: 900 })

console.log(`\n通った ${pass} / 落ちた ${fail}`)
await browser.close()
process.exit(fail ? 1 : 0)
