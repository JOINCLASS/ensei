import type { CSSProperties } from 'react'
import type { ColorId, Item, Status, Trip } from './types'

/* 参照HTML design/ensei.html の COLORS / TYPES / STATUS / 小道具 をそのまま移植 */

export const COLORS: { id: ColorId; name: string; hex: string; on: string }[] = [
  { id: 'red', name: '赤', hex: '#E5484D', on: '#fff' },
  { id: 'pink', name: 'ピンク', hex: '#F76FA8', on: '#fff' },
  { id: 'orange', name: 'オレンジ', hex: '#F7934C', on: '#fff' },
  { id: 'yellow', name: '黄', hex: '#F5C400', on: '#221F33' },
  { id: 'green', name: '緑', hex: '#30A46C', on: '#fff' },
  { id: 'sky', name: '水色', hex: '#3DB6E8', on: '#fff' },
  { id: 'blue', name: '青', hex: '#3E63DD', on: '#fff' },
  { id: 'purple', name: '紫', hex: '#8E4EC6', on: '#fff' },
  { id: 'white', name: '白', hex: '#FFFFFF', on: '#221F33' },
]

export const TYPES = {
  ticket: 'チケット', go: '行き', back: '帰り', hotel: 'ホテル', other: 'その他',
} as const

export const STATUS = { todo: 'まだ', wait: '当落待ち', done: '手配済み' } as const

export const NAME_LABEL = {
  ticket: ['公演・席など', '例：FC先行 スタンド'],
  go: ['便名・列車名', '例：のぞみ21号 7号車'],
  back: ['便名・列車名', '例：のぞみ48号'],
  hotel: ['ホテル名', '例：〇〇ホテル梅田'],
  other: ['内容', '例：レンタカー、ツアーバス'],
} as const

const WD = '日月火水木金土'

export const colorOf = (id: string | undefined) =>
  COLORS.find((c) => c.id === id) || COLORS[7]

export function oshiStyle(id: string | undefined): CSSProperties {
  const c = colorOf(id)
  return {
    '--oshi': c.hex,
    '--on-oshi': c.on,
    '--oshi-edge': c.id === 'white' ? '#221F33' : c.hex,
  } as CSSProperties
}

const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** ローカル時刻で組む。UTCパースは使わない。 */
export function parseD(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const md = (s?: string) => {
  if (!s) return ''
  const d = parseD(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
export const wd = (s?: string) => (s ? WD[parseD(s).getDay()] : '')
export const nights = (a?: string, b?: string) =>
  !a || !b ? 0 : Math.round((parseD(b).getTime() - parseD(a).getTime()) / 86400000)

export function dtParts(s?: string) {
  if (!s) return null
  const [d, t] = s.split('T')
  return { d, t: t ? t.slice(0, 5).replace(/^0/, '') : '' }
}

export const todayStr = () => ymd(new Date())
export function addDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return ymd(d)
}

export const isPast = (t: Trip) => (t.end || t.start) < todayStr()
export const itemLabel = (i: Item) => (i.type === 'other' ? i.name || 'その他' : TYPES[i.type])

export function stats(t: Trip) {
  const c: Record<Status, number> = { todo: 0, wait: 0, done: 0 }
  t.items.forEach((i) => c[i.status]++)
  return c
}

/** チケットは まだ→当落待ち→手配済み→まだ、それ以外は まだ⇔手配済み */
export function nextStatus(i: Item): Status {
  if (i.type === 'ticket') return ({ todo: 'wait', wait: 'done', done: 'todo' } as const)[i.status]
  return i.status === 'done' ? 'todo' : 'done'
}

export function itemSub(i: Item) {
  if (i.type === 'go' || i.type === 'back') {
    const a = dtParts(i.dep)
    const b = dtParts(i.arr)
    const left = [i.from, a && a.t].filter(Boolean).join(' ')
    const right = [i.to, b && b.t].filter(Boolean).join(' ')
    if (!left && !right) return a ? md(a.d) : ''
    return `${a ? md(a.d) + '　' : ''}${left || '—'} → ${right || '—'}`
  }
  if (i.type === 'hotel') {
    if (!i.checkIn) return ''
    const n = nights(i.checkIn, i.checkOut)
    return `${md(i.checkIn)}〜${md(i.checkOut)}${n > 0 ? `　${n}泊` : ''}`
  }
  const a = dtParts(i.dep)
  if (!a) return ''
  return `${i.type === 'ticket' ? '開演 ' : ''}${md(a.d)} ${a.t}`.trim()
}

/** 種類ごとに出す入力欄 */
export const VIS = {
  fromto: ['go', 'back'],
  dep: ['go', 'back', 'ticket', 'other'],
  arr: ['go', 'back'],
  hotel: ['hotel'],
} as const
