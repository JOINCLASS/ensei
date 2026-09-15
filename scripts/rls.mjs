/**
 * 誰でも登録できるようになった前提で、他人のデータが取れないことを確かめる。
 *
 * 画面ごしではなく、APIを直接叩く。画面は「出さない」だけかもしれないが、
 * ここで見たいのは「そもそも渡らない」こと。
 */
import { execSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const out = execSync('supabase status -o json', { encoding: 'utf8' })
const st = JSON.parse(out.slice(out.indexOf('{')))
const { API_URL: URL, ANON_KEY: ANON, SERVICE_ROLE_KEY: SECRET } = st

let pass = 0, fail = 0
const ok = (c, m, got) => (c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${got !== undefined ? `  ← ${JSON.stringify(got)}` : ''}`)))
const step = (t) => console.log(`\n${t}`)

const admin = createClient(URL, SECRET, { auth: { persistSession: false } })

/** ログイン済みのふつうの利用者を1人作る */
async function makeUser(tag) {
  const email = `rls-${tag}-${Date.now()}@example.com`.toLowerCase()
  const { data: created } = await admin.auth.admin.createUser({ email, email_confirm: true })
  const { data: link } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const client = createClient(URL, ANON, { auth: { persistSession: false } })
  const { error } = await client.auth.verifyOtp({ email, token: link.properties.email_otp, type: 'email' })
  if (error) throw new Error(`${tag} のログインに失敗: ${error.message}`)
  return { email, id: created.user.id, client }
}

step('0. 下ごしらえ')
const A = await makeUser('a')
const B = await makeUser('b')
ok(!!A.id && !!B.id && A.id !== B.id, '別々の利用者を2人つくった')

const { data: tripA, error: mkErr } = await A.client
  .from('trips')
  .insert({ title: 'Aの旅', start_date: '2026-10-01', end_date: '2026-10-02', color: 'sky' })
  .select('id')
  .single()
ok(!mkErr && !!tripA?.id, 'Aが旅を作れた', mkErr?.message)

// 旅を作ると手配4件が自動で付く
const { data: itemsA } = await A.client.from('arrangements').select('id').eq('trip_id', tripA.id)
ok(itemsA?.length === 4, 'Aの手配が4件できている', itemsA?.length)

step('1. すべての表で RLS が入っているか')
const tables = ['trips', 'arrangements', 'invites']
for (const t of tables) {
  // 鍵を持たない（ログインしていない）人として読む
  const anon = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data, error } = await anon.from(t).select('*').limit(5)
  ok((data ?? []).length === 0, `${t}：ログインしていない人には1件も渡らない`, error?.message ?? data?.length)
}

step('2. Bから、Aのデータが見えないか')
const { data: seen } = await B.client.from('trips').select('id,title')
ok((seen ?? []).length === 0, 'Bの一覧にAの旅は入らない', seen)

const { data: direct } = await B.client.from('trips').select('id,title').eq('id', tripA.id)
ok((direct ?? []).length === 0, 'AのIDを名指しで指定しても取れない', direct)

const { data: itemsSeen } = await B.client.from('arrangements').select('id').eq('trip_id', tripA.id)
ok((itemsSeen ?? []).length === 0, 'Aの手配も取れない', itemsSeen)

step('3. Bから、Aのデータを書き換えられないか')
const { data: upd } = await B.client.from('trips').update({ title: '乗っ取り' }).eq('id', tripA.id).select('id')
ok((upd ?? []).length === 0, 'Aの旅の題名を書き換えられない', upd)

const { data: del } = await B.client.from('trips').delete().eq('id', tripA.id).select('id')
ok((del ?? []).length === 0, 'Aの旅を消せない', del)

const { error: steal } = await B.client
  .from('trips')
  .insert({ title: 'なりすまし', start_date: '2026-10-01', end_date: '2026-10-02', color: 'sky', user_id: A.id })
ok(!!steal, 'Aの持ち物として旅を作れない', steal?.message ?? '作れてしまった')

const { error: attach } = await B.client
  .from('arrangements')
  .insert({ trip_id: tripA.id, kind: 'hotel', status: 'todo', position: 9 })
ok(!!attach, 'Aの旅に手配をぶら下げられない', attach?.message ?? '作れてしまった')

step('4. Aは自分のものを触れる')
const { data: mine } = await A.client.from('trips').select('id').eq('id', tripA.id)
ok((mine ?? []).length === 1, 'Aは自分の旅を読める')
const { data: ok2 } = await A.client.from('trips').update({ title: 'Aの旅（改）' }).eq('id', tripA.id).select('id')
ok((ok2 ?? []).length === 1, 'Aは自分の旅を直せる')

step('5. 後片付け')
await A.client.from('trips').delete().eq('id', tripA.id)
for (const u of [A, B]) await admin.auth.admin.deleteUser(u.id)
console.log('  消しました')

console.log(`\n通った ${pass} / 落ちた ${fail}`)
process.exit(fail ? 1 : 0)
