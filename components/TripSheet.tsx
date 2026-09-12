'use client'

import { useState } from 'react'
import { COLORS } from '@/lib/logic'
import type { ColorId, Trip } from '@/lib/types'
import { DeleteButton, Sheet } from './Sheet'

export type TripDraft = Pick<Trip, 'title' | 'place' | 'start' | 'end' | 'color' | 'memo'>

export function TripSheet({
  trip,
  onClose,
  onSave,
  onDelete,
}: {
  trip: Trip | null
  onClose: () => void
  onSave: (d: TripDraft) => void | Promise<void>
  onDelete?: () => void
}) {
  const isNew = !trip
  const [title, setTitle] = useState(trip?.title ?? '')
  const [place, setPlace] = useState(trip?.place ?? '')
  const [start, setStart] = useState(trip?.start ?? '')
  const [end, setEnd] = useState(trip?.end ?? '')
  const [color, setColor] = useState<ColorId>(trip?.color ?? 'purple')
  const [memo, setMemo] = useState(trip?.memo ?? '')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    const t = title.trim()
    const s = start.trim()
    let e = end.trim()
    if (!t) return setErr('公演・イベント名を入れてください。')
    if (!s) return setErr('出発する日を選んでください。')
    if (!e) e = s
    if (e < s) return setErr('帰る日は、出発する日と同じか後の日にしてください。')
    // 押してから画面が変わるまで1秒以上かかる。無反応だと二度押しを誘う。
    setSaving(true)
    await onSave({ title: t, place: place.trim(), start: s, end: e, color, memo: memo.trim() })
    setSaving(false)
  }

  return (
    <Sheet id="tripSheet" labelledBy="tsTitle" onClose={onClose}>
      <h2 id="tsTitle">{isNew ? '旅を追加' : '旅を編集'}</h2>
      <label className="field">
        <span>公演・イベント名</span>
        <input name="title" value={title} placeholder="例：ツアー大阪公演" onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="field">
        <span>行き先・会場</span>
        <input name="place" value={place} placeholder="例：大阪・京セラドーム" onChange={(e) => setPlace(e.target.value)} />
      </label>
      <div className="row">
        <label className="field">
          <span>出発する日</span>
          <input type="date" name="start" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>帰る日</span>
          <input type="date" name="end" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      <fieldset className="field">
        <legend>推し色</legend>
        <div className="swatches">
          {COLORS.map((c) => (
            <label className="sw" key={c.id}>
              <input
                type="radio"
                name="color"
                value={c.id}
                checked={c.id === color}
                onChange={() => setColor(c.id)}
              />
              <span style={{ background: c.hex }} />
              <em className="vh">{c.name}</em>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        <span>メモ</span>
        <textarea name="memo" rows={2} placeholder="例：2日目は昼公演" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      {isNew && (
        <p className="note" style={{ margin: '0 0 12px', textAlign: 'left' }}>
          チケット・行き・帰り・ホテルの4項目が自動で入ります。
        </p>
      )}
      <p className="err" hidden={!err}>{err}</p>
      <div className="sheet-actions">
        {!isNew && onDelete && <DeleteButton onConfirm={onDelete} />}
        <button type="button" className="btn ghost" onClick={onClose}>やめる</button>
        <button type="button" className="btn wide" onClick={save} disabled={saving}>
          {saving ? (isNew ? '追加しています…' : '保存しています…') : isNew ? '追加する' : '保存する'}
        </button>
      </div>
    </Sheet>
  )
}
