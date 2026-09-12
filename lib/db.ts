'use client'

import { createClient } from '@/lib/supabase/client'
import { TRIP_SELECT, itemFields, toItem, toTrip, tripFields } from '@/lib/map'
import { addDays } from '@/lib/logic'
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
 * サンプルを入れる。旅を作るとトリガが4項目を作るので、
 * 足すのではなく、出来た4項目を種類で突き合わせて中身を書き込む。
 *
 * 1件ずつ送ると25回の往復になり、2秒近くかかっていた。まとめて送る。
 */
export async function insertSample(): Promise<Trip[]> {
  const samples = sampleTrips()

  // ① 旅をまとめて作る（トリガが各旅に4項目を作る）
  const made = check(
    await db()
      .from('trips')
      .insert(samples.map(({ items, ...t }) => ({ ...tripFields(t), is_sample: true })))
      .select('id'),
  )

  // ② 出来た4項目をまとめて取る
  const rows = check(
    await db().from('trips').select(TRIP_SELECT).in('id', made.map((r) => r.id)),
  )

  // ③ 種類で突き合わせて、まとめて書き込む
  const updates = rows.flatMap((row) => {
    const sample = samples.find((s) => s.title === row.title)
    if (!sample) return []
    return (row.arrangements ?? []).flatMap((a) => {
      const want = sample.items.find((i) => i.type === a.type)
      if (!want) return []
      return [{
        id: a.id,
        trip_id: row.id,
        position: a.position,
        ...itemFields({ ...toItem(a), ...want } as ItemDraft),
      }]
    })
  })
  if (updates.length) check(await db().from('arrangements').upsert(updates).select('id'))

  return fetchTrips()
}
