'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { STATUS, TYPES, itemLabel, itemSub, md, nextStatus, nights, oshiStyle, stats, wd } from '@/lib/logic'
import { createItem, deleteItem, deleteTrip, duplicateTrip, reorderItems, setItemStatus, updateItem, updateTrip } from '@/lib/db'
import { toast } from '@/lib/toast'
import type { Item, Trip } from '@/lib/types'
import { ItemSheet, type ItemDraft } from './ItemSheet'
import { TripSheet, type TripDraft } from './TripSheet'

type Sheet = { kind: 'trip' } | { kind: 'copy' } | { kind: 'item'; item: Item | null } | null

/**
 * この画面では router.refresh() を呼ばない。
 * 変更は手元の状態に先に反映しており、一覧へ戻ったときは
 * サーバーで描き直されるので、追加の再描画は要らない。
 *
 * 不要な再描画は速度を落とすだけでなく、書き込み直後に走ると
 * 認証確認が一瞬こけて「ログイン画面が見える」原因にもなっていた。
 */

/** 参照HTMLの renderTrip() */
export function TripView({ initialTrip }: { initialTrip: Trip }) {
  const router = useRouter()
  const [trip, setTrip] = useState(initialTrip)
  const [copying, setCopying] = useState(false)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [leaving, startLeaving] = useTransition()

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
    } catch {
      setTrip(before)
      failed()
    }
  }

  /**
   * 手配の並びを1つ動かす。
   *
   * 引っぱって動かす作りにしなかったのは、マウスと指で挙動が割れやすく、
   * キーボードからも使えなくなるため。上下のボタンなら、PCでもスマホでも、
   * 読み上げを使う人でも同じように動く。
   */
  async function move(id: string, by: -1 | 1) {
    const from = trip.items.findIndex((i) => i.id === id)
    const to = from + by
    if (from < 0 || to < 0 || to >= trip.items.length) return

    const before = trip
    const next = [...trip.items]
    ;[next[from], next[to]] = [next[to], next[from]]
    setTrip((t) => ({ ...t, items: next }))

    try {
      await reorderItems(trip.id, next.map((i) => i.id))
    } catch {
      setTrip(before)
      failed()
    }
  }

  /** ツアーの2公演目のように、同じ形で日付だけ違う旅を作る */
  async function copyTrip(d: TripDraft) {
    if (copying) return
    setCopying(true)
    try {
      const made = await duplicateTrip(trip.id, d)
      setSheet(null)
      toast('旅を複製しました')
      router.push(`/trips/${made.id}`)
    } catch {
      setCopying(false)
      failed()
    }
  }

  return (
    <>
      <div className="bar">
        <button
          className="linkbtn"
          style={leaving ? { opacity: 0.55 } : undefined}
          onClick={() => startLeaving(() => router.push('/'))}
        >
          ‹ 一覧にもどる
        </button>
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
        {trip.items.map((i, at) => (
          <ItemRow
            key={i.id}
            item={i}
            onCycle={cycle}
            onEdit={() => setSheet({ kind: 'item', item: i })}
            onMove={trip.items.length > 1 ? (by) => move(i.id, by) : undefined}
            first={at === 0}
            last={at === trip.items.length - 1}
          />
        ))}
      </ul>
      {!total && <p className="note">手配の項目がありません。下のボタンから追加できます。</p>}
      <button className="add-item" onClick={() => setSheet({ kind: 'item', item: null })}>＋ 手配を追加</button>

      <p className="note">
        <button className="linkbtn" onClick={() => setSheet({ kind: 'copy' })}>
          この旅を複製（次の公演をつくる）
        </button>
      </p>

      {sheet?.kind === 'trip' && (
        <TripSheet trip={trip} onClose={() => setSheet(null)} onSave={saveTrip} onDelete={removeTrip} />
      )}
      {sheet?.kind === 'copy' && (
        <TripSheet trip={trip} mode="copy" onClose={() => setSheet(null)} onSave={copyTrip} />
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
  onMove,
  first,
  last,
}: {
  item: Item
  onCycle: (i: Item, btn: HTMLButtonElement) => void
  onEdit: () => void
  onMove?: (by: -1 | 1) => void
  first: boolean
  last: boolean
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
      {onMove && (
        <span className="item-move">
          <button
            className="movebtn"
            onClick={() => onMove(-1)}
            disabled={first}
            aria-label={`${itemLabel(item)}を上へ`}
          >
            ↑
          </button>
          <button
            className="movebtn"
            onClick={() => onMove(1)}
            disabled={last}
            aria-label={`${itemLabel(item)}を下へ`}
          >
            ↓
          </button>
        </span>
      )}
    </li>
  )
}
