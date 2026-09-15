import { chromium } from '@playwright/test'
import { APP, VP, clearMail, login, tap } from './lib.mjs'

/**
 * ホーム画面に追加の案内が、端末ごとに正しく出るかを見る。
 * 中身は navigator.userAgent と display-mode だけで決まるので、
 * 名乗りを変えて開けば確かめられる。
 */
const UA = {
  iPhone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  'Xの中のブラウザ':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.50',
  Android:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
  パソコン:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
}

// Supabaseはアドレスを小文字にそろえるので、こちらも小文字で作る
const mail = (tag) => `install-${tag}-${Date.now()}@example.com`.toLowerCase()
const browser = await chromium.launch()
let ng = 0

for (const [name, ua] of Object.entries(UA)) {
  const ctx = await browser.newContext({ viewport: VP, userAgent: ua })
  const page = await ctx.newPage()
  await clearMail()
  await login(page, mail(name.replace(/[^a-z]/gi, '') || 'x'))
  // ホーム画面に追加は設定（/about）へ移した
  await page.goto(`${APP}/about`)
  await page.waitForSelector('text=できること')

  const shown = await page.getByRole('button', { name: 'ホーム画面に追加', exact: true }).count()
  if (!shown) {
    console.log(`✗ ${name}: 入口のボタンが出ない`)
    ng++
    await ctx.close()
    continue
  }
  await tap(page, 'ホーム画面に追加')
  await page.waitForSelector('.sheet')
  await page.waitForTimeout(450) // せり上がりが終わってから撮る
  const text = (await page.locator('.sheet').innerText()).replace(/\s+/g, ' ')

  const want = {
    iPhone: '「ホーム画面に追加」を選びます',
    'Xの中のブラウザ': 'ここからは追加できません',
    Android: '「ホーム画面に追加」を選びます',
    パソコン: '携帯で',
  }[name]
  const ok = text.includes(want)
  console.log(`${ok ? '✓' : '✗'} ${name}: ${text.slice(0, 76)}…`)
  if (!ok) ng++
  await page.screenshot({ path: `shots/install-${name}.png` })
  await ctx.close()
}

// Androidの1タップ。beforeinstallprompt はページを開いた直後に一度だけ飛ぶので、
// シートを開いてから聞き始めたのでは間に合わない。読み込み直後に飛ばして確かめる。
{
  const ctx = await browser.newContext({ viewport: VP, userAgent: UA.Android })
  await ctx.addInitScript(() => {
    window.addEventListener('load', () => {
      const e = new Event('beforeinstallprompt')
      Object.assign(e, {
        prompt: () => {
          window.__prompted = true
        },
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      })
      window.dispatchEvent(e)
    })
  })
  const page = await ctx.newPage()
  await clearMail()
  await login(page, mail('oneTap'))
  await page.goto(`${APP}/about`)
  await page.waitForSelector('text=できること')
  await tap(page, 'ホーム画面に追加')
  await page.waitForSelector('.sheet')
  const text = await page.locator('.sheet').innerText()
  const hasButton = text.includes('下のボタンを押すだけで追加できます')
  console.log(`${hasButton ? '✓' : '✗'} Android: 1タップのボタンが出る`)
  if (!hasButton) ng++
  else {
    await page.locator('.sheet').getByRole('button', { name: 'ホーム画面に追加', exact: true }).click()
    const fired = await page.evaluate(() => window.__prompted === true)
    const closed = (await page.locator('.sheet').count()) === 0
    console.log(`${fired ? '✓' : '✗'} Android: 押すと追加の確認が出る`)
    console.log(`${closed ? '✓' : '✗'} Android: 押したあとシートが閉じる`)
    if (!fired) ng++
    if (!closed) ng++
  }
  await ctx.close()
}

// ホーム画面から開いている人には出さない
const ctx = await browser.newContext({ viewport: VP, userAgent: UA.iPhone })
await ctx.addInitScript(() => {
  Object.defineProperty(window.navigator, 'standalone', { value: true })
})
const page = await ctx.newPage()
await clearMail()
await login(page, mail('standalone'))
await page.goto(`${APP}/about`)
await page.waitForSelector('text=できること')
const hidden = (await page.getByRole('button', { name: 'ホーム画面に追加', exact: true }).count()) === 0
console.log(`${hidden ? '✓' : '✗'} 追加済みの人には入口を出さない`)
if (!hidden) ng++
await ctx.close()

await browser.close()
console.log(ng ? `\n${ng}件 だめでした` : '\nすべて通りました')
process.exit(ng ? 1 : 0)
