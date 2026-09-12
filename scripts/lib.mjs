/** E2E で使い回す道具（メール・ログイン・録画） */
import { mkdirSync, renameSync, rmSync } from 'node:fs'

export const APP = process.env.APP_URL || 'http://localhost:3001'
export const MAILPIT = 'http://127.0.0.1:54324'
export const VIDEO_DIR = 'shots/video'
export const VP = { width: 390, height: 844 }

export const recordOpts = () => {
  mkdirSync(VIDEO_DIR, { recursive: true })
  return { recordVideo: { dir: VIDEO_DIR, size: VP } }
}

/** コンテキストを閉じて、録画に分かりやすい名前を付ける */
export async function saveVideo(ctx, page, name) {
  const v = page.video()
  await ctx.close()
  if (!v) return
  renameSync(await v.path(), `${VIDEO_DIR}/${name}.webm`)
  console.log(`  録画: ${VIDEO_DIR}/${name}.webm`)
}

export const resetVideos = () => rmSync(VIDEO_DIR, { recursive: true, force: true })

export const clearMail = () => fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' })

/** Mailpit から6桁のログインコードを取る。本物のメールは飛ばない。 */
export async function codeFor(email) {
  for (let i = 0; i < 30; i++) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json()
    const hit = list.messages?.find((m) => m.To?.some((t) => t.Address === email))
    if (hit) {
      const msg = await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()
      const code = (msg.Text || msg.HTML || '').match(/\b\d{6}\b/)
      if (code) return code[0]
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error(`コードが届かない: ${email}`)
}

/**
 * ボタンを名前で正確に押す。
 * `text=ログインする` のような部分一致だと、本文の「ログインすると…」にも当たってしまう。
 */
export const tap = (page, name) =>
  page
    .getByRole('button', { name, exact: true })
    .or(page.getByRole('link', { name, exact: true }))
    .first()
    .click()

/**
 * 検証用のユーザーを作る。新規登録は閉じてあるので、アプリからは作れない。
 * 本番と同じ構成でテストするための下ごしらえ。
 */
export async function createUser(email) {
  const { execSync } = await import('node:child_process')
  const out = execSync('supabase status -o json', { encoding: 'utf8' })
  const st = JSON.parse(out.slice(out.indexOf('{')))
  await fetch(`${st.API_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      apikey: st.SERVICE_ROLE_KEY,
      Authorization: `Bearer ${st.SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, email_confirm: true }),
  })
}

export async function login(page, email) {
  await createUser(email)
  await page.goto(`${APP}/login`)
  await page.fill('input[name=email]', email)
  await tap(page, 'コードを送る')
  await page.fill('input[name=code]', await codeFor(email))
  await tap(page, 'ログインする')
  await page.waitForURL(`${APP}/`, { timeout: 15000 })
}

/** ラジオは参照HTMLの設計どおり見えない位置にあるので、実ユーザーと同じくラベルを押す */
export const pick = (page, name, value) =>
  page.locator(`label:has(input[name=${name}][value=${value}]) > span`).click()
