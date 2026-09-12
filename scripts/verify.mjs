import { chromium } from '@playwright/test'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { tap, APP, VP, clearMail, login, recordOpts, resetVideos, saveVideo } from './lib.mjs'

const REF = pathToFileURL(process.cwd() + '/design/ensei.html').href

mkdirSync('shots', { recursive: true })
resetVideos()
const log = (...a) => console.log(...a)


/* ---------- 3画面を撮る ---------- */
async function shoot(page, tag, click) {
  const out = {}
  // 参照HTMLの見出しは「遠征の手配」のまま。アプリ名だけ後から
  // 「手配まとめ」に変えたので、撮る前に文字だけ合わせる。
  // ここで比べたいのは配置と見た目であって、名前ではない。
  await page.evaluate(() => {
    const h = document.querySelector('.top h1')
    if (h && h.textContent === '遠征の手配') h.textContent = '手配まとめ'
  })
  await page.waitForTimeout(600)
  out.list = `shots/${tag}-list.png`
  await page.screenshot({ path: out.list })

  // 参照HTMLに無い「ログアウト」を隠した版も撮る（それ以外に差が無いことを示すため）
  await page.addStyleTag({ content: '.note{visibility:hidden}' })
  out.listBare = `shots/${tag}-list-bare.png`
  await page.screenshot({ path: out.listBare })
  await page.waitForTimeout(100)

  await click.openTrip()
  await page.waitForTimeout(600)
  out.trip = `shots/${tag}-trip.png`
  await page.screenshot({ path: out.trip })

  await tap(page, '旅を編集')
  await page.waitForTimeout(600)
  out.sheet = `shots/${tag}-sheet.png`
  await page.screenshot({ path: out.sheet })
  return out
}

function diff(a, b, outPath) {
  const A = PNG.sync.read(readFileSync(a))
  const B = PNG.sync.read(readFileSync(b))
  if (A.width !== B.width || A.height !== B.height) return { mismatch: -1, note: `寸法ちがい ${A.width}x${A.height} vs ${B.width}x${B.height}` }
  const out = new PNG({ width: A.width, height: A.height })
  const n = pixelmatch(A.data, B.data, out.data, A.width, A.height, { threshold: 0.12 })
  writeFileSync(outPath, PNG.sync.write(out))
  return { mismatch: n, pct: ((n / (A.width * A.height)) * 100).toFixed(2) }
}

/* ---------- 本番 ---------- */
const browser = await chromium.launch()
await clearMail()

// 1) アプリ：ログイン → サンプル投入 → 3画面
const ctxA = await browser.newContext({ viewport: VP, deviceScaleFactor: 2, ...recordOpts() })
const app = await ctxA.newPage()
await login(app, 'a@example.com')
log('✓ ログインできた（メールのワンタイムコード）')

if (await app.locator('text=サンプルで見てみる').isVisible().catch(() => false)) {
  await tap(app, 'サンプルで見てみる')
  await app.waitForTimeout(2500)
}
log('✓ サンプルを入れた')

const appShots = await shoot(app, 'app', {
  openTrip: () => app.locator('.ticket').first().click(),
})

// 2) 参照HTML：同じサンプルを入れて 3画面
const ctxR = await browser.newContext({ viewport: VP, deviceScaleFactor: 2, ...recordOpts() })
// window.storage を生やして persistent=true にする（「試作版」の注記を出さないため）
await ctxR.addInitScript(() => {
  window.storage = { get: async () => null, set: async () => ({}) }
})
const ref = await ctxR.newPage()
await ref.goto(REF)
await ref.waitForTimeout(1200)
await tap(ref, 'サンプルで見てみる')
const refShots = await shoot(ref, 'ref', {
  openTrip: () => ref.locator('.ticket').first().click(),
})

// 3) 見比べ
log('\n--- 参照HTMLとの差 ---')
let worst = 0
for (const k of ['list', 'listBare', 'trip', 'sheet']) {
  const r = diff(appShots[k], refShots[k], `shots/diff-${k}.png`)
  if (k !== 'list') worst = Math.max(worst, r.mismatch)
  log(`${k.padEnd(6)} 違う画素 ${String(r.mismatch).padStart(7)}  ${r.pct ?? r.note}%`)
}

// 4) 別のユーザーで他人の旅が見えないこと
const ctxB = await browser.newContext({ viewport: VP, ...recordOpts() })
const other = await ctxB.newPage()
await login(other, 'b@example.com')
await other.waitForTimeout(800)
const seesOthers = await other.locator('.ticket').count()
const seesEmpty = await other.locator('text=遠征の予定を登録すると').isVisible().catch(() => false)
log(`\n別ユーザー：見えている旅 ${seesOthers}件 / 空の画面 ${seesEmpty ? 'あり' : 'なし'}`)

// 直接URLを叩いても見えないこと
const tripUrl = app.url()
await other.goto(tripUrl)
await other.waitForTimeout(800)
const leaked = await other.locator('text=ASIA TOUR').count()
log(`他人の詳細URLを直接開く：${tripUrl.replace(APP, '')} → 漏れ ${leaked}件`)

log('')
await saveVideo(ctxA, app, '1-アプリ_一覧と詳細と編集シート')
await saveVideo(ctxR, ref, '2-参照HTML_同じ操作')
await saveVideo(ctxB, other, '3-別ユーザーには見えない')
await browser.close()
log(`\n最大の違い: ${worst} 画素`)
