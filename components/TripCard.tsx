'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { itemLabel, md, nights, oshiStyle, parseD, stats, wd } from '@/lib/logic'
import type { Trip } from '@/lib/types'

/** 参照HTMLの ticketHTML() */
export function TripCard({ trip, past }: { trip: Trip; past: boolean }) {
  const router = useRouter()
  // 詳細が出るまで1秒以上かかる。押した瞬間に薄くして「受け付けた」と分かるようにする。
  // 濃さは終わった旅と同じ 0.55（新しい見た目を持ち込まない）。
  const [opening, startOpening] = useTransition()
  const s = stats(trip)
  const n = nights(trip.start, trip.end)
  const d = parseD(trip.start)

  const shown = trip.items.slice(0, 6)
  const todo = trip.items.filter((i) => i.status === 'todo').map(itemLabel)
  const wait = trip.items.filter((i) => i.status === 'wait').map(itemLabel)
  const range = trip.end && trip.end !== trip.start ? `${md(trip.start)}〜${md(trip.end)}` : md(trip.start)

  return (
    <button
      className={`ticket${past ? ' past' : ''}`}
      style={{ ...oshiStyle(trip.color), ...(opening ? { opacity: 0.55 } : null) }}
      disabled={opening}
      onClick={() => startOpening(() => router.push(`/trips/${trip.id}`))}
      aria-label={`${trip.title}、${range}。まだの手配${s.todo}件`}
    >
      <span className="stub" aria-hidden="true">
        <span className="stub-m">{d.getMonth() + 1}月</span>
        <span className="stub-d">{d.getDate()}</span>
        <span className="stub-w">{wd(trip.start)}</span>
        <span className="stub-n">{n > 0 ? `${n}泊` : '日帰り'}</span>
      </span>
      <span className="tbody">
        <span className="t-title">{trip.title}</span>
        <span className="place">{trip.place ? trip.place + '　' : ''}{range}</span>
        <span className="punches">
          {shown.map((i) => (
            <span className={`pch s-${i.status}`} key={i.id}>
              <i aria-hidden="true" />
              {itemLabel(i)}
            </span>
          ))}
          {trip.items.length > 6 && <span className="pch more">+{trip.items.length - 6}</span>}
        </span>
        <span className="todo-line">
          {todo.length > 0 && <><span className="chip-todo">まだ</span><span>{todo.join('、')}</span></>}
          {wait.length > 0 && <><span className="chip-wait">当落待ち</span><span>{wait.join('、')}</span></>}
          {todo.length === 0 && wait.length === 0 && (
            <span className="all-done">{trip.items.length ? 'すべて手配済み' : '手配の項目がありません'}</span>
          )}
        </span>
      </span>
    </button>
  )
}
