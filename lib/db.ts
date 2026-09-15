'use client'

import { createClient } from '@/lib/supabase/client'
import { TRIP_SELECT, itemFields, toItem, toTrip, tripFields } from '@/lib/map'
import { addDays } from '@/lib/logic'
import type { Json } from '@/lib/database.types'
import type { Item, Trip } from '@/lib/types'
import type { ItemDraft } from '@/components/ItemSheet'
import type { TripDraft } from '@/components/TripSheet'

const db = () => createClient()

function check<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<T>
}

/** 旅を作る。チケット・行き・帰り・ホテルの4項目はDB側のトリガが作る。 */
export async function createTrip(d: TripDraft, isSample = false): Promise<Trip> {
  const row = check(
    await db().from('trips').insert({ ...tripFields(d), is_sample: isSample }).select('id').single(),
  )
  const full = check(await db().from('trips').select(TRIP_SELECT).eq('id', row.id).single())
  return toTrip(full)
}

/**
 * 旅を複製する。ツアーの2公演目のように、同じ形で日付だけ違うものを作るため。
 *
 * 引き継ぐのは、手配の並びと種類・名前・区間・メモ。
 * 日付と手配の状態は引き継がない。前の公演の「手配済み」を持ち込むと、
 * まだ何もしていないのに済んだように見えて、取り返しのつかない見落としになる。
 */
export async function duplicateTrip(sourceId: string, d: TripDraft): Promise<Trip> {
  const source = check(
    await db()
      .from('arrangements')
      .select('type,name,from_place,to_place,memo,position')
      .eq('trip_id', sourceId)
      .order('position'),
  )

  const row = check(
    await db().from('trips').insert(tripFields(d)).select('id').single(),
  )

  // 旅を作るとDBのトリガが4項目を入れる。複製では元の並びをそのまま使うので、
  // いったん取り除いてから入れ直す。
  check(await db().from('arrangements').delete().eq('trip_id', row.id).select('id'))
  if (source.length) {
    check(
      await db()
        .from('arrangements')
        .insert(source.map((a) => ({ ...a, trip_id: row.id, status: 'todo' as const })))
        .select('id'),
    )
  }

  const full = check(await db().from('trips').select(TRIP_SELECT).eq('id', row.id).single())
  return toTrip(full)
}

export async function updateTrip(id: string, d: TripDraft) {
  check(await db().from('trips').update(tripFields(d)).eq('id', id).select('id'))
}

export async function deleteTrip(id: string) {
  check(await db().from('trips').delete().eq('id', id).select('id'))
}

export async function createItem(tripId: string, d: ItemDraft, position: number): Promise<Item> {
  const row = check(
    await db()
      .from('arrangements')
      .insert({ trip_id: tripId, position, ...itemFields(d) })
      .select('*')
      .single(),
  )
  return toItem(row)
}

export async function updateItem(id: string, d: ItemDraft) {
  check(await db().from('arrangements').update(itemFields(d)).eq('id', id).select('id'))
}

export async function deleteItem(id: string) {
  check(await db().from('arrangements').delete().eq('id', id).select('id'))
}

export async function setItemStatus(id: string, status: Item['status']) {
  check(await db().from('arrangements').update({ status }).eq('id', id).select('id'))
}

export async function fetchTrips(): Promise<Trip[]> {
  const rows = check(await db().from('trips').select(TRIP_SELECT).order('start_date'))
  return rows.map(toTrip)
}

/* ---------- サンプル（参照HTMLの sampleTrips()） ---------- */

type Sample = TripDraft & { items: Partial<Item>[] }

function sampleTrips(): Sample[] {
  const a = addDays(9), a2 = addDays(11)
  const b = addDays(24), b2 = addDays(25)
  const c = addDays(40), c2 = addDays(43)
  const p = addDays(-20), p2 = addDays(-19)
  return [
    { title: 'ASIA TOUR 大阪公演', place: '大阪・京セラドーム', start: a, end: a2, color: 'sky', memo: '2日目は昼公演', items: [
      { type: 'ticket', status: 'done', name: '2日間とも当選 スタンド', dep: `${a}T17:00` },
      { type: 'go', status: 'done', name: 'のぞみ21号 7号車', from: '東京', to: '新大阪', dep: `${a}T08:30`, arr: `${a}T11:00` },
      { type: 'back', status: 'todo' },
      { type: 'hotel', status: 'todo', memo: '会場まで電車で20分以内で探す' }] },
    { title: 'ファンミーティング 福岡', place: '福岡・マリンメッセ', start: b, end: b2, color: 'pink', memo: '', items: [
      { type: 'ticket', status: 'wait', name: 'FC先行 当落は来週' },
      { type: 'go', status: 'todo' },
      { type: 'back', status: 'todo' },
      { type: 'hotel', status: 'done', name: '博多駅前のホテル', checkIn: b, checkOut: b2, memo: '前日までキャンセル無料' }] },
    { title: 'ASIA TOUR 台北公演', place: '台北', start: c, end: c2, color: 'sky', memo: '', items: [
      { type: 'ticket', status: 'done', name: '1日目のみ' },
      { type: 'go', status: 'done', name: 'BR189', from: '羽田', to: '台北松山', dep: `${c}T09:15`, arr: `${c}T12:05` },
      { type: 'back', status: 'done', name: 'BR190', from: '台北松山', to: '羽田', dep: `${c2}T13:30`, arr: `${c2}T17:20` },
      { type: 'hotel', status: 'done', name: '中山駅近くのホテル', checkIn: c, checkOut: c2 }] },
    { title: 'ASIA TOUR 名古屋公演', place: '名古屋・バンテリンドーム', start: p, end: p2, color: 'sky', memo: '', items: [
      { type: 'ticket', status: 'done', name: 'アリーナ' },
      { type: 'go', status: 'done', name: 'ひかり503号', from: '東京', to: '名古屋' },
      { type: 'back', status: 'done', name: 'のぞみ52号', from: '名古屋', to: '東京' },
      { type: 'hotel', status: 'done', name: '名駅のホテル', checkIn: p, checkOut: p2 }] },
  ]
}

/** サンプルで入れた旅だけをまとめて消す。手配は旅と一緒に消える。 */
export async function clearSample() {
  // RLS だけに頼らず、本人の行であることをここでも縛る
  const { data: { user } } = await db().auth.getUser()
  if (!user) throw new Error('ログインしていない')
  check(
    await db().from('trips').delete().eq('is_sample', true).eq('user_id', user.id).select('id'),
  )
}

/**
 * サンプルを入れる。
 *
 * 中身は決まっているので、まるごとDBの関数に渡して1回の通信で済ませる。
 * 以前は旅ごとに「登録 → 自動で入った4項目を取り直す → 1件ずつ書き込む」と
 * していたので、4つの旅で25回の往復になっていた。
 * 関数は入れ終わった全件を返すので、取り直しも要らない。
 */
export async function insertSample(): Promise<Trip[]> {
  const rows = check(
    await db().rpc('create_sample_trips', { samples: sampleTrips() as unknown as Json }),
  )
  return (rows as unknown as Parameters<typeof toTrip>[0][]).map(toTrip)
}
