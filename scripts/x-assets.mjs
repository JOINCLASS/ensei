import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'

/**
 * X（Twitter）用の画像。アプリと同じトークンだけで作る。
 *
 *  - アイコン 400×400 … アプリのアイコンをそのまま。Xは丸く切るので、
 *    半券が内接円からはみ出さないことは確認済み。
 *  - ヘッダー 1500×500 … 下の左寄りにアイコンが重なるので、
 *    文字はそこを避けて中央やや上に置く。携帯では左右が切られるため、
 *    大事なものは真ん中の1000px以内に収める。
 */
const OUT = 'brand'
mkdirSync(OUT, { recursive: true })

// 宣伝チラシから取った色。アプリの app/globals.css と同じものを使う。
// ここだけ別の色にすると、チラシ・X・アプリで三者三様になる。
const BG = '#EFF2FB'
const PAPER = '#FFFFFF'
const INK = '#1B214B'
const MUTED = '#5F6485'
const LINE = '#DBE2F0'
const SKY = '#45C8F9'      // 水色
const PINK = '#F88AC1'     // 桃色
const SKY_INK = '#0A72A2'  // 文字に使う濃いほう
const SKY_PALE = '#D4F2FE'
const PINK_PALE = '#FDE0EA'
const FONT = `'Zen Maru Gothic','Hiragino Maru Gothic ProN',sans-serif`
const icon = readFileSync('public/icon-512.png').toString('base64')

const head = `
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500;700;900&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:${FONT};color:${INK};-webkit-font-smoothing:antialiased}
</style>`

const card = (a, b, c, tilt) => `
  <div style="background:${PAPER};border-radius:16px;padding:16px 22px;
              box-shadow:0 2px 10px rgba(27,33,75,.08);transform:rotate(${tilt}deg)">
    <div style="font-weight:700;font-size:19px;color:${INK}">${a}</div>
    <div style="font-weight:700;font-size:17px;color:${c};margin-top:7px">${b}</div>
  </div>`

const CARDS = [
  ['チケット', '当落待ち', SKY_INK, -3],
  ['行き', '手配済み', MUTED, 2],
  ['ホテル', 'まだ', MUTED, -1.5],
]

/** A案：いまの案。きちんと・信頼寄り */
const headerA = `${head}
<div style="width:1500px;height:500px;background:${BG};display:flex;align-items:center;justify-content:center">
  <div style="display:flex;align-items:center;gap:36px;transform:translateY(-18px)">
    <img src="data:image/png;base64,${icon}" width="132" height="132" style="border-radius:30px">
    <div>
      <div style="font-weight:900;font-size:62px;letter-spacing:.02em;line-height:1.1;color:${INK}">手配まとめ</div>
      <div style="font-weight:700;font-size:27px;color:${MUTED};margin-top:12px">どの旅の、何がまだか。</div>
    </div>
    <div style="margin-left:44px;display:flex;gap:12px">
      ${CARDS.map(([a, b, c]) => card(a, b, c, 0)).join('')}
    </div>
  </div>
</div>`

/** B案：やわらかい階調とわずかな傾き。可愛い寄りだが、アプリとの落差は小さい */
const headerB = `${head}
<div style="width:1500px;height:500px;
            background:linear-gradient(112deg,#EAF6FE 0%,#EFF2FB 46%,#FDEFF5 100%);
            display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
  <div style="position:absolute;width:520px;height:520px;border-radius:50%;
              background:radial-gradient(circle,rgba(69,200,249,.18),transparent 68%);left:-150px;top:-190px"></div>
  <div style="position:absolute;width:460px;height:460px;border-radius:50%;
              background:radial-gradient(circle,rgba(248,138,193,.18),transparent 68%);right:-130px;bottom:-180px"></div>
  <div style="display:flex;align-items:center;gap:40px;transform:translateY(-16px);z-index:1">
    <img src="data:image/png;base64,${icon}" width="124" height="124"
         style="border-radius:30px;box-shadow:0 10px 30px rgba(27,33,75,.14)">
    <div>
      <div style="font-weight:900;font-size:58px;letter-spacing:.03em;line-height:1.1;color:${INK}">手配まとめ</div>
      <div style="font-weight:700;font-size:25px;color:${MUTED};margin-top:14px">どの旅の、何がまだか。</div>
    </div>
    <div style="margin-left:40px;display:flex;gap:16px;align-items:center">
      ${CARDS.map(([a, b, c, t]) => card(a, b, c, t)).join('')}
    </div>
  </div>
</div>`

/** C案：いちばん可愛い寄り。淡い桃色を主にして、余白を広く取る */
const headerC = `${head}
<div style="width:1500px;height:500px;
            background:linear-gradient(135deg,#FDEFF5 0%,#EFF2FB 52%,#EAF6FE 100%);
            display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden">
  <div style="position:absolute;inset:0;
              background:radial-gradient(680px 340px at 22% 118%,rgba(248,138,193,.20),transparent),
                         radial-gradient(620px 320px at 82% -22%,rgba(69,200,249,.20),transparent)"></div>
  <div style="display:flex;flex-direction:column;align-items:center;gap:20px;transform:translateY(-14px);z-index:1">
    <div style="display:flex;align-items:center;gap:26px">
      <img src="data:image/png;base64,${icon}" width="96" height="96"
           style="border-radius:24px;box-shadow:0 10px 28px rgba(27,33,75,.14)">
      <div style="font-weight:900;font-size:64px;letter-spacing:.04em;color:${INK}">手配まとめ</div>
    </div>
    <div style="font-weight:700;font-size:27px;color:${MUTED}">
      チケットも、行き帰りも、宿も。<span style="color:${SKY_INK}">ぜんぶ一覧に。</span>
    </div>
    <div style="display:flex;gap:16px;margin-top:6px">
      ${CARDS.map(([a, b, c, t]) => card(a, b, c, t)).join('')}
    </div>
  </div>
</div>`

const avatar = `${head}
<div style="width:400px;height:400px">
  <img src="data:image/png;base64,${icon}" width="400" height="400">
</div>`

const browser = await chromium.launch()
for (const [name, html, w, h] of [
  ['x-header-A', headerA, 1500, 500],
  ['x-header-B', headerB, 1500, 500],
  ['x-header-C', headerC, 1500, 500],
  ['x-avatar-400', avatar, 400, 400],
]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  await page.setContent(html)
  await page.waitForFunction(() => document.fonts.ready.then(() => true))
  await page.screenshot({ path: `${OUT}/${name}.png` })
  await page.close()
  console.log(`${OUT}/${name}.png`)
}
await browser.close()
