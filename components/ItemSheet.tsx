'use client'

import { useState } from 'react'
import { NAME_LABEL, STATUS, TYPES, VIS } from '@/lib/logic'
import type { Item, ItemType, Status } from '@/lib/types'
import { DeleteButton, Sheet } from './Sheet'

export type ItemDraft = Omit<Item, 'id'>

export function ItemSheet({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: Item | null
  onClose: () => void
  onSave: (d: ItemDraft) => void | Promise<void>
  onDelete?: () => void
}) {
  const isNew = !item
  const [type, setType] = useState<ItemType>(item?.type ?? 'other')
  const [status, setStatus] = useState<Status>(item?.status ?? 'todo')
  const [name, setName] = useState(item?.name ?? '')
  const [from, setFrom] = useState(item?.from ?? '')
  const [to, setTo] = useState(item?.to ?? '')
  const [dep, setDep] = useState(item?.dep ?? '')
  const [arr, setArr] = useState(item?.arr ?? '')
  const [checkIn, setCheckIn] = useState(item?.checkIn ?? '')
  const [checkOut, setCheckOut] = useState(item?.checkOut ?? '')
  const [memo, setMemo] = useState(item?.memo ?? '')
  const [saving, setSaving] = useState(false)

  /** 参照HTMLの applyType()：種類を変えると欄と文言が変わり、当落待ちはチケットだけ */
  function changeType(next: ItemType) {
    setType(next)
    if (next !== 'ticket' && status === 'wait') setStatus('todo')
  }

  const shows = (v: keyof typeof VIS) => (VIS[v] as readonly string[]).includes(type)
  const [nameLabel, namePlaceholder] = NAME_LABEL[type]
  const depLabel = type === 'ticket' ? '開演日時' : type === 'other' ? '日時' : '出発日時'

  async function save() {
    const d: ItemDraft = { type, status, name: name.trim(), memo: memo.trim() }
    if (shows('fromto')) { d.from = from.trim(); d.to = to.trim() }
    if (shows('dep')) d.dep = dep.trim()
    if (shows('arr')) d.arr = arr.trim()
    if (shows('hotel')) { d.checkIn = checkIn.trim(); d.checkOut = checkOut.trim() }
    setSaving(true)
    try {
      await onSave(d)
    } finally {
      // 失敗しても「保存しています…」のまま固まらせない
      setSaving(false)
    }
  }

  return (
    <Sheet id="itemSheet" labelledBy="isTitle" onClose={onClose}>
      <h2 id="isTitle">{isNew ? '手配を追加' : '手配を編集'}</h2>

      <div className="seg" role="radiogroup" aria-label="種類">
        {(Object.entries(TYPES) as [ItemType, string][]).map(([k, v]) => (
          <label key={k}>
            <input type="radio" name="type" value={k} checked={k === type} onChange={() => changeType(k)} />
            <span>{v}</span>
          </label>
        ))}
      </div>

      <div className="seg" role="radiogroup" aria-label="状態">
        {(Object.entries(STATUS) as [Status, string][]).map(([k, v]) => (
          <label key={k} data-status={k} hidden={k === 'wait' && type !== 'ticket'}>
            <input type="radio" name="status" value={k} checked={k === status} onChange={() => setStatus(k)} />
            <span>{v}</span>
          </label>
        ))}
      </div>

      <label className="field">
        <span data-l="name">{nameLabel}</span>
        <input name="name" value={name} placeholder={namePlaceholder} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="row" data-v="fromto" hidden={!shows('fromto')}>
        <label className="field">
          <span>出発</span>
          <input name="from" value={from} placeholder={type === 'back' ? '例：新大阪' : '例：東京'} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>到着</span>
          <input name="to" value={to} placeholder={type === 'back' ? '例：東京' : '例：新大阪'} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      <label className="field" data-v="dep" hidden={!shows('dep')}>
        <span data-l="dep">{depLabel}</span>
        <input type="datetime-local" name="dep" value={dep} onChange={(e) => setDep(e.target.value)} />
      </label>

      <label className="field" data-v="arr" hidden={!shows('arr')}>
        <span>到着日時</span>
        <input type="datetime-local" name="arr" value={arr} onChange={(e) => setArr(e.target.value)} />
      </label>

      <div className="row" data-v="hotel" hidden={!shows('hotel')}>
        <label className="field">
          <span>チェックイン</span>
          <input type="date" name="checkIn" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </label>
        <label className="field">
          <span>チェックアウト</span>
          <input type="date" name="checkOut" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </label>
      </div>

      <label className="field">
        <span>メモ</span>
        <textarea name="memo" rows={2} placeholder="予約番号、座席、キャンセル期限など" value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>

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
