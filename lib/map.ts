import type { Item, Trip } from './types'
import type { ItemDraft } from '@/components/ItemSheet'
import type { TripDraft } from '@/components/TripSheet'

/* DBの列名 ⇄ 参照HTMLのキー名 */

type TripRow = {
  id: string
  title: string
  place: string | null
  start_date: string
  end_date: string
  color: string
  memo: string | null
  is_sample: boolean
  arrangements?: ItemRow[]
}

type ItemRow = {
  id: string
  type: string
  status: string
  name: string | null
  from_place: string | null
  to_place: string | null
  depart_at: string | null
  arrive_at: string | null
  check_in: string | null
  check_out: string | null
  memo: string | null
  position: number
}

/** 'YYYY-MM-DDTHH:mm:ss' を datetime-local が扱う 'YYYY-MM-DDTHH:mm' に詰める */
const toLocalInput = (s: string | null) => (s ? s.slice(0, 16) : '')

export const toItem = (r: ItemRow): Item => ({
  id: r.id,
  type: r.type as Item['type'],
  status: r.status as Item['status'],
  name: r.name ?? '',
  from: r.from_place ?? '',
  to: r.to_place ?? '',
  dep: toLocalInput(r.depart_at),
  arr: toLocalInput(r.arrive_at),
  checkIn: r.check_in ?? '',
  checkOut: r.check_out ?? '',
  memo: r.memo ?? '',
})

export const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  title: r.title,
  place: r.place ?? '',
  start: r.start_date,
  end: r.end_date,
  color: r.color as Trip['color'],
  memo: r.memo ?? '',
  isSample: r.is_sample,
  items: (r.arrangements ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(toItem),
})

export const TRIP_SELECT =
  'id,title,place,start_date,end_date,color,memo,is_sample,arrangements(id,type,status,name,from_place,to_place,depart_at,arrive_at,check_in,check_out,memo,position)'

/** 空文字は DB では null にする */
const orNull = (v?: string) => (v && v.trim() ? v.trim() : null)

export const tripFields = (t: TripDraft) => ({
  title: t.title,
  place: orNull(t.place),
  start_date: t.start,
  end_date: t.end,
  color: t.color,
  memo: orNull(t.memo),
})

export const itemFields = (i: ItemDraft) => ({
  type: i.type,
  status: i.status,
  name: orNull(i.name),
  from_place: orNull(i.from),
  to_place: orNull(i.to),
  depart_at: orNull(i.dep),
  arrive_at: orNull(i.arr),
  check_in: orNull(i.checkIn),
  check_out: orNull(i.checkOut),
  memo: orNull(i.memo),
})
