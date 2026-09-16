import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 出発が近いのに、まだ済んでいない手配があることを知らせる。
 *
 * 知らせるのは7日前と前日の2回だけ。競合レビューで「通知を1つしか設定できない」
 * という不満が出ていたので複数回にしてあるが、増やしすぎると読まれなくなる。
 *
 * 送る相手は本人だけ。中身も本人のものだけ。
 * 記録には旅の題名を残さない（何件送ったかだけ数える）。
 */

/** 何日前に知らせるか */
export const LEAD_DAYS = [7, 1] as const

/**
 * 1回の実行で送る上限。
 * Resend の無料枠は1日100通で、パスポイと共用している。
 * 使い切ると正規の利用者もパスポイもログインできなくなるので、半分で止める。
 */
export const MAX_SENDS = 50

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 日本のその日で考える。サーバーがどこにあっても、利用者の「明日」に合わせる */
function tokyoToday() {
  const now = new Date()
  return new Date(now.getTime() + 9 * 60 * 60 * 1000)
}

export const dayAfter = (n: number) => {
  const d = tokyoToday()
  d.setUTCDate(d.getUTCDate() + n)
  return ymd(new Date(d.getTime()))
}

const TYPE_NAME: Record<string, string> = {
  ticket: 'チケット', go: '行き', back: '帰り', hotel: 'ホテル', other: 'その他',
}

type Row = {
  user_id: string
  title: string
  place: string | null
  start_date: string
  arrangements: { type: string; status: string; name: string | null }[]
}

/** 知らせる相手と中身を組み立てる。送信はしない（試しやすくするため分けてある） */
export async function collect() {
  const admin = createAdminClient()
  const targets = LEAD_DAYS.map(dayAfter)

  const { data, error } = await admin
    .from('trips')
    .select('user_id,title,place,start_date,arrangements(type,status,name)')
    .in('start_date', targets)
    .eq('is_sample', false)
  if (error) throw new Error(`旅を取れなかった: ${error.message}`)

  // まだ済んでいない手配がある旅だけ
  const pending = (data as Row[]).filter((t) =>
    t.arrangements.some((a) => a.status === 'todo' || a.status === 'wait'),
  )
  if (!pending.length) return []

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const byId = new Map((list?.users ?? []).map((u) => [u.id, u]))

  // 1人に1通。旅ごとに送ると、同じ日に何通も届く
  const grouped = new Map<string, Row[]>()
  for (const t of pending) {
    const user = byId.get(t.user_id)
    if (!user?.email) continue
    // 止めている人には送らない
    if (user.user_metadata?.remind === false) continue
    grouped.set(user.email, [...(grouped.get(user.email) ?? []), t])
  }

  return [...grouped.entries()].slice(0, MAX_SENDS).map(([email, trips]) => ({
    email,
    subject: subjectFor(trips),
    text: bodyFor(trips),
  }))
}

function subjectFor(trips: Row[]) {
  const soon = trips.some((t) => t.start_date === dayAfter(1))
  return soon
    ? '［手配まとめ］明日の遠征、まだの手配があります'
    : '［手配まとめ］1週間後の遠征、まだの手配があります'
}

function bodyFor(trips: Row[]) {
  const lines: string[] = []
  for (const t of trips) {
    const left = t.arrangements
      .filter((a) => a.status === 'todo' || a.status === 'wait')
      .map((a) => (a.type === 'other' ? a.name || 'その他' : TYPE_NAME[a.type]) + (a.status === 'wait' ? '（当落待ち）' : ''))
    const when = t.start_date === dayAfter(1) ? '明日' : '1週間後'
    lines.push(`■ ${t.title}${t.place ? `（${t.place}）` : ''}`, `　${when} ${t.start_date} 出発`, `　まだ：${left.join('、')}`, '')
  }
  return [
    'まだ済んでいない手配があります。',
    '',
    ...lines,
    'アプリで確かめる：https://tehaimatome.com',
    '',
    '――',
    'この知らせが不要なときは、アプリの「設定」→「お知らせ」から止められます。',
  ].join('\n')
}

/** Resend で送る */
export async function send(mail: { email: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: '手配まとめ <noreply@tehaimatome.com>',
      to: mail.email,
      subject: mail.subject,
      text: mail.text,
    }),
  })
  return res.ok
}
