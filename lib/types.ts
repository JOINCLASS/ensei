export type ColorId =
  | 'red' | 'pink' | 'orange' | 'yellow' | 'green' | 'sky' | 'blue' | 'purple' | 'white'

export type ItemType = 'ticket' | 'go' | 'back' | 'hotel' | 'other'
export type Status = 'todo' | 'wait' | 'done'

/** 参照HTMLと同じキー名で画面側は扱う。DBの列名との変換は lib/map.ts でやる。 */
export type Item = {
  id: string
  type: ItemType
  status: Status
  name?: string
  from?: string
  to?: string
  /** 'YYYY-MM-DDTHH:mm' — 現地時刻そのまま */
  dep?: string
  arr?: string
  /** 'YYYY-MM-DD' */
  checkIn?: string
  checkOut?: string
  memo?: string
}

export type Trip = {
  id: string
  title: string
  place?: string
  /** 'YYYY-MM-DD' */
  start: string
  end: string
  color: ColorId
  memo?: string
  /** サンプルで入れた旅か */
  isSample?: boolean
  items: Item[]
}
