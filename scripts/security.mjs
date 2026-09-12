/**
 * RLS を直接攻撃して確かめる。ブラウザを通さず REST API を素で叩く。
 * 攻撃者は anon key（公開鍵。ブラウザから誰でも読める）と自分のログインを持っている前提。
 */
import { execSync } from 'node:child_process'

// SUPABASE_URL を渡せば本番にも同じ攻撃を仕掛けられる
const API = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

/**
 * 攻撃の下ごしらえ（被害者役のユーザーを作る）にだけ管理者の鍵を使う。
 * 鍵はリポジトリに置かず、動かしているローカルの Supabase から実行時に取る。
 */
function localSecret() {
  if (process.env.SUPABASE_SECRET) return process.env.SUPABASE_SECRET
  if (process.env.SUPABASE_URL) throw new Error('本番を叩くときは SUPABASE_SECRET を渡すこと')
  // 前置きの行が混ざるので、最初の { から後ろだけを読む
  const out = execSync('supabase status -o json', { encoding: 'utf8' })
  return JSON.parse(out.slice(out.indexOf('{'))).SECRET_KEY
}
const SECRET = localSecret()

let pass = 0, fail = 0
const ok = (c, m, g) => { c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}  ← ${JSON.stringify(g)}`)) }
const step = (t) => console.log(`\n${t}`)

async function mkuser(email) {
  await fetch(`${API}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123', email_confirm: true }),
  })
  const r = await (await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'password123' }),
  })).json()
  return { token: r.access_token, id: r.user.id }
}

const rest = async (token, method, path, body) => {
  const res = await fetch(`${API}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

const victim = await mkuser('victim@example.com')
const attacker = await mkuser('attacker@example.com')

// 被害者のデータを作る
const t = await rest(victim.token, 'POST', 'trips', {
  title: '秘密の遠征', place: '極秘', start_date: '2026-12-01', end_date: '2026-12-02', memo: '座席 A-12',
})
const TID = t.body[0].id
const a = await rest(victim.token, 'GET', `arrangements?trip_id=eq.${TID}&select=id&limit=1`)
const AID = a.body[0].id

step('1. ログインしていない人（anon key だけ）')
for (const [name, path] of [['旅の一覧', 'trips?select=*'], ['手配の一覧', 'arrangements?select=*']]) {
  const r = await rest(null, 'GET', path)
  ok(r.status !== 200 || (Array.isArray(r.body) && r.body.length === 0), `${name}が取れない`, r)
}

step('2. 別のログイン済みユーザーが読もうとする')
for (const [name, path] of [
  ['旅を全件', 'trips?select=*'],
  ['ID指定で旅を', `trips?id=eq.${TID}&select=*`],
  ['手配を全件', 'arrangements?select=*'],
  ['ID指定で手配を', `arrangements?id=eq.${AID}&select=*`],
  ['旅ごしに手配を', `trips?select=title,arrangements(*)`],
]) {
  const r = await rest(attacker.token, 'GET', path)
  ok(Array.isArray(r.body) && r.body.length === 0, `${name}読めない`, r.body)
}

step('3. 書き換え・削除')
const writes = [
  ['他人の旅を書き換える', 'PATCH', `trips?id=eq.${TID}`, { title: 'のっとり' }],
  ['他人の旅を消す', 'DELETE', `trips?id=eq.${TID}`, null],
  ['他人の手配を書き換える', 'PATCH', `arrangements?id=eq.${AID}`, { name: 'のっとり' }],
  ['他人の手配を消す', 'DELETE', `arrangements?id=eq.${AID}`, null],
]
for (const [name, m, p, b] of writes) {
  const r = await rest(attacker.token, m, p, b)
  ok(Array.isArray(r.body) && r.body.length === 0, `${name} → 0件`, r.body)
}

step('4. なりすまし（user_id を他人にして作る）')
let r = await rest(attacker.token, 'POST', 'trips', {
  title: '偽造', start_date: '2026-12-01', end_date: '2026-12-01', user_id: victim.id,
})
ok(r.status >= 400, '他人名義の旅を作れない', r.body)

r = await rest(attacker.token, 'POST', 'arrangements', { trip_id: TID, user_id: attacker.id, type: 'other', status: 'todo' })
ok(r.status >= 400, '他人の旅に手配をぶら下げられない', r.body)

r = await rest(attacker.token, 'POST', 'arrangements', { trip_id: TID, user_id: victim.id, type: 'other', status: 'todo' })
ok(r.status >= 400, '他人名義でもぶら下げられない', r.body)

step('5. 乗っ取り（自分のものを他人に付け替える）')
const own = await rest(attacker.token, 'POST', 'trips', { title: '自分の旅', start_date: '2026-12-01', end_date: '2026-12-01' })
const OWN = own.body[0].id
r = await rest(attacker.token, 'PATCH', `trips?id=eq.${OWN}`, { user_id: victim.id })
ok(r.status >= 400 || r.body.length === 0, '自分の旅を他人名義に変えられない', r.body)

const mine = await rest(attacker.token, 'GET', `arrangements?trip_id=eq.${OWN}&select=id&limit=1`)
r = await rest(attacker.token, 'PATCH', `arrangements?id=eq.${mine.body[0].id}`, { trip_id: TID })
ok(r.status >= 400 || r.body.length === 0, '自分の手配を他人の旅に移せない', r.body)

step('6. 被害者のデータが無傷か')
const after = await rest(victim.token, 'GET', `trips?id=eq.${TID}&select=title,memo,arrangements(id)`)
ok(after.body[0]?.title === '秘密の遠征' && after.body[0]?.memo === '座席 A-12', '中身が変わっていない', after.body[0])
ok(after.body[0]?.arrangements.length === 4, '手配が4つのまま', after.body[0]?.arrangements.length)

step('7. 他のスキーマを覗けないか')
for (const [name, path] of [['auth.users', 'users?select=*'], ['ストレージ', 'objects?select=*']]) {
  const r = await rest(attacker.token, 'GET', path)
  ok(r.status >= 400, `${name}は触れない`, r.status)
}

// 後片付け
for (const u of [victim.id, attacker.id]) {
  await fetch(`${API}/auth/v1/admin/users/${u}`, {
    method: 'DELETE', headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
  })
}

console.log(`\n防げた ${pass} / 抜けた ${fail}`)
process.exit(fail ? 1 : 0)
