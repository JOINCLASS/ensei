/**
 * ローカル開発用。ログインの6桁コードを取ってきて表示する。
 *   npm run code me@example.com
 * 本物のメールは飛ばない。Docker の中の Mailpit が全部受け取る。
 */
const MAILPIT = 'http://127.0.0.1:54324'
const API = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const email = process.argv[2]
if (!email) {
  console.error('使い方: npm run code <メールアドレス>')
  process.exit(1)
}
if (!ANON) {
  console.error('.env.local の NEXT_PUBLIC_SUPABASE_ANON_KEY が読めない')
  process.exit(1)
}

const before = await (await fetch(`${MAILPIT}/api/v1/messages`)).json()
const seen = new Set((before.messages || []).map((m) => m.ID))

const res = await fetch(`${API}/auth/v1/otp`, {
  method: 'POST',
  headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, create_user: true }),
})
if (!res.ok) {
  console.error(`コードを送れなかった: ${res.status} ${await res.text()}`)
  process.exit(1)
}

for (let i = 0; i < 40; i++) {
  const list = await (await fetch(`${MAILPIT}/api/v1/messages`)).json()
  const hit = (list.messages || []).find(
    (m) => !seen.has(m.ID) && m.To?.some((t) => t.Address === email),
  )
  if (hit) {
    const msg = await (await fetch(`${MAILPIT}/api/v1/message/${hit.ID}`)).json()
    const code = (msg.Text || msg.HTML || '').match(/\b\d{6}\b/)
    if (code) {
      console.log(`\n  ${email} のログインコード\n\n      ${code[0]}\n\n  （1時間で切れる）\n`)
      process.exit(0)
    }
  }
  await new Promise((r) => setTimeout(r, 300))
}
console.error('コードが届かない。supabase start しているか確かめて。')
process.exit(1)
