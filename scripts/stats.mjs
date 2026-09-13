/**
 * 誰がどれだけ使っているかを見る。
 *
 * ページビューの解析では「招待したあの人が使っているか」は分からない。
 * 知りたいことはすべて、もともとデータベースに記録されている。
 *
 *   npm run stats
 *
 * 注意：旅の題名・行き先・メモは絶対に出さない。
 * 「あなたのデータは、あなたにしか見えません」と約束しているので、
 * 運営者が見ていいのは件数と日時だけにする。
 */
// .env.local では、ローカルと本番で鍵の名前が違うので取り違えないこと。
//   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY … ローカルのDocker
//   PROD_SUPABASE_URL        + SUPABASE_SECRET     … 本番
const prod = !process.argv.includes('--local')
const url = prod ? process.env.PROD_SUPABASE_URL : process.env.NEXT_PUBLIC_SUPABASE_URL
const key = prod ? process.env.SUPABASE_SECRET : process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error(prod ? 'PROD_SUPABASE_URL と SUPABASE_SECRET が要ります' : 'ローカルのURLと鍵が要ります')
  process.exit(1)
}

const api = async (path) => {
  const res = await fetch(`${url}${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${path} → ${res.status} ${JSON.stringify(body)}`)
  return body
}

const day = 86_400_000
const ago = (iso) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso)) / day)
  return d === 0 ? '今日' : d === 1 ? '昨日' : `${d}日前`
}
const ymd = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '—')

const [users, trips, items, invites] = await Promise.all([
  api('/auth/v1/admin/users?per_page=200').then((r) => r.users ?? r),
  api('/rest/v1/trips?select=id,user_id,is_sample,created_at,updated_at'),
  api('/rest/v1/arrangements?select=user_id,status,updated_at'),
  api('/rest/v1/invites?select=id,created_at,expires_at,used_at').catch(() => []),
])

console.log(`\n手配まとめ　利用状況　（${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC）\n`)

console.log('■ 人')
console.log('  メールアドレス                    登録       最終ログイン   旅   本物  最後の操作')
for (const u of users.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
  const mine = trips.filter((t) => t.user_id === u.id)
  const real = mine.filter((t) => !t.is_sample)
  const touched = [...mine.map((t) => t.updated_at), ...items.filter((i) => i.user_id === u.id).map((i) => i.updated_at)]
    .sort()
    .pop()
  console.log(
    '  ' +
      u.email.padEnd(34) +
      ymd(u.created_at).padEnd(11) +
      ago(u.last_sign_in_at).padEnd(15) +
      String(mine.length).padStart(2) +
      String(real.length).padStart(6) +
      '  ' +
      ago(touched),
  )
}

// 「使っている」の定義：サンプル以外の旅を1つ以上作った人
const active = users.filter((u) => trips.some((t) => t.user_id === u.id && !t.is_sample))
const week = users.filter((u) => u.last_sign_in_at && Date.now() - new Date(u.last_sign_in_at) < 7 * day)
console.log(`\n  登録 ${users.length}人 ／ 自分の旅を作った人 ${active.length}人 ／ 7日以内にログイン ${week.length}人`)

console.log('\n■ 手配の進みぐあい（本物の旅のみ・中身は見ていません）')
const realIds = new Set(trips.filter((t) => !t.is_sample).map((t) => t.id))
const realItems = items.filter((i) => trips.some((t) => t.id && realIds.has(t.id) && t.user_id === i.user_id))
const tally = { todo: 0, waiting: 0, done: 0 }
for (const i of realItems) if (i.status in tally) tally[i.status]++
console.log(`  まだ ${tally.todo}　当落待ち ${tally.waiting}　手配済み ${tally.done}`)

if (invites.length) {
  const used = invites.filter((i) => i.used_at).length
  const expired = invites.filter((i) => !i.used_at && new Date(i.expires_at) < new Date()).length
  console.log('\n■ 招待')
  console.log(`  発行 ${invites.length}枚　使われた ${used}枚　期限切れ ${expired}枚　まだ使える ${invites.length - used - expired}枚`)
  for (const i of invites.filter((x) => !x.used_at && new Date(x.expires_at) > new Date())) {
    console.log(`    未使用: ${i.id}  （あと${Math.ceil((new Date(i.expires_at) - Date.now()) / day)}日）`)
  }
}
console.log()
