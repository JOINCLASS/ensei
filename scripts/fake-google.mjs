/**
 * Googleログインを通しで試すための、にせのGoogle。
 *
 * ローカルのSupabaseには本物のGoogleの資格情報を置けない（置くべきでもない）。
 * かといって「ボタンを押すと出ていく」ところまでしか見ないと、
 * 戻ってきてセッションが立つかが試せない。そこが一番壊れやすいのに。
 *
 * そこで Supabase の手前に立って、2つの窓口だけ差し替える。
 *   /auth/v1/authorize?provider=google … Googleへ行ったことにして、すぐ戻す
 *   /auth/v1/token?grant_type=pkce     … 本物のセッションを1つ作って返す
 * それ以外はそのまま本物へ流す。
 */
import http from 'node:http'
import { execSync } from 'node:child_process'

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 54398)
const out = execSync('supabase status -o json', { encoding: 'utf8' })
const st = JSON.parse(out.slice(out.indexOf('{')))
const UP = st.API_URL
const SECRET = st.SERVICE_ROLE_KEY
const ANON = st.ANON_KEY

/** Googleから返ってきた人のつもり。毎回ちがう人にする */
export const emailFor = (code) => `google-${code}@example.com`

const admin = (path, body) =>
  fetch(UP + path, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

/** 本物のSupabaseから、本物のセッションを1つもらう */
async function realSession(email) {
  await admin('/auth/v1/admin/users', { email, email_confirm: true })
  const link = await (await admin('/auth/v1/admin/generate_link', { type: 'magiclink', email })).json()
  const r = await fetch(`${UP}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, token: link.email_otp, type: 'email' }),
  })
  if (!r.ok) throw new Error(`セッションを作れない: ${r.status} ${await r.text()}`)
  return r.json()
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`)

    // 1. Googleへ送り出すところ。行ったことにして、そのまま戻す
    if (url.pathname === '/auth/v1/authorize' && url.searchParams.get('provider') === 'google') {
      const back = new URL(url.searchParams.get('redirect_to') ?? '/')
      const code = `fake-${Date.now()}`
      back.searchParams.set('code', code)
      res.writeHead(302, { location: back.toString() })
      return res.end()
    }

    // 2. 引き換えるところ。本物のセッションを返す
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const body = []
      for await (const c of req) body.push(c)
      const { auth_code } = JSON.parse(Buffer.concat(body).toString() || '{}')
      try {
        const session = await realSession(emailFor(auth_code))
        res.writeHead(200, { 'content-type': 'application/json' })
        return res.end(JSON.stringify(session))
      } catch (e) {
        res.writeHead(500, { 'content-type': 'application/json' })
        return res.end(JSON.stringify({ error: String(e) }))
      }
    }

    // 3. それ以外は本物へ
    const body = []
    for await (const c of req) body.push(c)
    const up = await fetch(UP + req.url, {
      method: req.method,
      headers: { ...req.headers, host: new URL(UP).host },
      body: body.length ? Buffer.concat(body) : undefined,
      redirect: 'manual',
    })
    res.writeHead(up.status, Object.fromEntries(up.headers))
    res.end(Buffer.from(await up.arrayBuffer()))
  })
  .listen(PORT, () => console.log(`にせのGoogle: http://127.0.0.1:${PORT}（本物は ${UP}）`))
