'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS, TYPES, itemLabel, itemSub, md, nextStatus, nights, oshiStyle, stats, wd } from '@/lib/logic'
import { createItem, deleteItem, deleteTrip, setItemStatus, updateItem, updateTrip } from '@/lib/db'
import { toast } from '@/lib/toast'
import type { Item, Trip } from '@/lib/types'
import { ItemSheet, type ItemDraft } from './ItemSheet'
import { TripSheet, type TripDraft } from './TripSheet'

type Sheet = { kind: 'trip' } | { kind: 'item'; item: Item | null } | null

/** 参照HTMLの renderTrip() */
export function TripView({ initialTrip }: { initialTrip: Trip }) {
  const router = useRouter()
  const [trip, setTrip] = useState(initialTrip)
  const [sheet, setSheet] = useState<Sheet>(null)

  const s = stats(trip)
  const total = trip.items.length
  const pct = total ? Math.round((s.done / total) * 100) : 0
  const n = nights(trip.start, trip.end)

  const failed = () => toast('保存できませんでした。もう一度お試しください')

  /** 参照HTMLの cycle：先に画面を変え、失敗したら戻す */
  async function cycle(item: Item, btn: HTMLButtonElement) {
    const next = nextStatus(item)
    setTrip((t) => ({ ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, status: next } : i)) }))
    // 参照HTMLと同じく、押すたびに縮んで戻るアニメを頭からやり直す
    btn.classList.remove('pop')
    void btn.offsetWidth
    btn.classList.add('pop')
    try {
      await setItemStatus(item.id, next)
      router.refresh()
    } catch {
      setTrip((t) => ({ ...t, items: t.items.map((i) => (i.id === item.id ? item : i)) }))
      failed()
    }
  }

  async function saveTrip(d: TripDraft) {
    const before = trip
    setTrip((t) => ({ ...t, ...d }))
    setSheet(null)
    try {
      await updateTrip(trip.id, d)
      toast('保存しました')
      router.refresh()
    } catch {
      setTrip(before)
      failed()
    }
  }

  async function removeTrip() {
    try {
      await deleteTrip(trip.id)
      setSheet(null)
      router.replace('/')
      router.refresh()
      toast('旅を削除しました')
    } catch {
      failed()
    }
  }

  async function saveItem(d: ItemDraft) {
    const editing = sheet?.kind === 'item' ? sheet.item : null
    const before = trip
    setSheet(null)
    try {
      if (editing) {
        setTrip((t) => ({ ...t, items: t.items.map((i) => (i.id === editing.id ? { ...i, ...d } : i)) }))
        await updateItem(editing.id, d)
        toast('保存しました')
      } else {
        const created = await createItem(trip.id, d, trip.items.length)
        setTrip((t) => ({ ...t, items: [...t.items, created] }))
        toast('手配を追加しました')
      }
      router.refresh()
    } catch {
      setTrip(before)
      failed()
    }
  }

  async function removeItem(id: string) {
    const before = trip
    setSheet(null)
    setTrip((t) => ({ ...t, items: t.items.filter((i) => i.id !== id) }))
    try {
      await deleteItem(id)
      toast('手配を削除しました')
      router.refresh()
    } catch {
      setTrip(before)
      failed()
    }
  }

  return (
    <>
      <div className="bar">
        <button className="linkbtn" onClick={() => router.push('/')}>‹ 一覧にもどる</button>
        <button className="linkbtn" onClick={() => setSheet({ kind: 'trip' })}>旅を編集</button>
      </div>

      <section className="trip-head" style={oshiStyle(trip.color)}>
        <div className="dates">
          <b>{md(trip.start)}</b>
          <span>{wd(trip.start)}</span>
          {trip.end && trip.end !== trip.start && (
            <><span>〜</span><b>{md(trip.end)}</b><span>{wd(trip.end)}</span></>
          )}
          <span>　{n > 0 ? `${n}泊` : '日帰り'}</span>
        </div>
        <h1>{trip.title}</h1>
        {trip.place && <p className="place">{trip.place}</p>}
        <p className="prog">{total}つのうち{s.done}つ手配済み{s.wait ? `、当落待ち${s.wait}つ` : ''}</p>
        <div className="prog-bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        {trip.memo && <p className="trip-memo">{trip.memo}</p>}
      </section>

      <ul className="items" style={oshiStyle(trip.color)}>
        {trip.items.map((i) => <ItemRow key={i.id} item={i} onCycle={cycle} onEdit={() => setSheet({ kind: 'item', item: i })} />)}
      </ul>
      {!total && <p className="note">手配の項目がありません。下のボタンから追加できます。</p>}
      <button className="add-item" onClick={() => setSheet({ kind: 'item', item: null })}>＋ 手配を追加</button>

      {sheet?.kind === 'trip' && (
        <TripSheet trip={trip} onClose={() => setSheet(null)} onSave={saveTrip} onDelete={removeTrip} />
      )}
      {sheet?.kind === 'item' && (
        <ItemSheet
          key={sheet.item?.id ?? 'new'}
          item={sheet.item}
          onClose={() => setSheet(null)}
          onSave={saveItem}
          onDelete={sheet.item ? () => removeItem(sheet.item!.id) : undefined}
        />
      )}
    </>
  )
}

/** 参照HTMLの itemHTML() */
function ItemRow({
  item,
  onCycle,
  onEdit,
}: {
  item: Item
  onCycle: (i: Item, btn: HTMLButtonElement) => void
  onEdit: () => void
}) {
  const btn = useRef<HTMLButtonElement>(null)
  const glyph = item.status === 'done' ? '✓' : item.status === 'wait' ? '待ち' : ''
  const sub = itemSub(item)

  return (
    <li className={`item s-${item.status}`}>
      <button
        ref={btn}
        className="punch-btn"
        onClick={() => btn.current && onCycle(item, btn.current)}
        onAnimationEnd={() => btn.current?.classList.remove('pop')}
        aria-label={`${itemLabel(item)}：${STATUS[item.status]}。タップで「${STATUS[nextStatus(item)]}」にする`}
      >
        {glyph}
      </button>
      <button className="item-main" onClick={onEdit}>
        <span className="item-head">
          <span className="item-type">{TYPES[item.type]}</span>
          <span className={`tag tag-${item.status}`}>{STATUS[item.status]}</span>
        </span>
        {item.name
          ? <span className="item-name">{item.name}</span>
          : (!sub && <span className="item-name placeholder">タップして詳細を入力</span>)}
        {sub && <span className="item-sub">{sub}</span>}
        {item.memo && <span className="item-memo">{item.memo}</span>}
      </button>
    </li>
  )
}
