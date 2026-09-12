'use client'

import { useEffect, useState } from 'react'
import { createInvite } from '@/lib/invites'
import { toast } from '@/lib/toast'
import { Sheet } from './Sheet'

/** 招待リンクを出すシート。参照HTMLに無い画面なので、既存の部品だけで組む。 */
export function InviteSheet({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    createInvite(window.location.origin).then((r) => (r.error ? setErr(r.error) : setUrl(r.url!)))
  }, [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast('リンクをコピーしました')
    } catch {
      toast('コピーできませんでした')
    }
  }

  return (
    <Sheet labelledBy="invTitle" onClose={onClose}>
      <h2 id="invTitle">友だちを招待</h2>
      <p className="note" style={{ margin: '0 0 14px', textAlign: 'left' }}>
        このリンクを渡すと、その人もこのアプリを使えるようになります。
        旅の中身は共有されません。おたがいに見えません。
      </p>

      {err ? (
        <p className="err">{err}</p>
      ) : (
        <label className="field">
          <span>招待リンク</span>
          <input readOnly value={url} placeholder="作成しています…" onFocus={(e) => e.target.select()} />
        </label>
      )}

      <p className="note" style={{ margin: '0 0 12px', textAlign: 'left' }}>
        1人が1回だけ使えます。14日で期限が切れます。
      </p>

      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onClose}>とじる</button>
        <button type="button" className="btn wide" onClick={copy} disabled={!url}>リンクをコピー</button>
      </div>
    </Sheet>
  )
}
