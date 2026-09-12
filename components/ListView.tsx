'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isPast, stats } from '@/lib/logic'
import { clearSample, createTrip, insertSample } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast'
import type { Trip } from '@/lib/types'
import { TripCard } from './TripCard'
import { TripSheet, type TripDraft } from './TripSheet'
import { InviteSheet } from './InviteSheet'

/** 参照HTMLの renderList() */
export function ListView({ initialTrips }: { initialTrips: Trip[] }) {
  const router = useRouter()
  const [trips, setTrips] = useState(initialTrips)
  const [showPast, setShowPast] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [invite, setInvite] = useState(false)
  const [busy, setBusy] = useState(false)

  const sorted = [...trips].sort((a, b) => a.start.localeCompare(b.start))
  const up = sorted.filter((t) => !isPast(t))
  const past = sorted.filter(isPast).reverse()

  async function save(d: TripDraft) {
    if (busy) return
    setBusy(true)
    try {
      const t = await createTrip(d)
      setSheet(false)
      toast('旅を追加しました')
      router.push(`/trips/${t.id}`)
    } catch {
      toast('保存できませんでした。もう一度お試しください')
      setBusy(false)
    }
  }

  async function sample() {
    if (busy) return
    setBusy(true)
    try {
      // insertSample() が入れ直したあとの全件を返すので、手元のデータで足りる。
      // ここで router.refresh() を呼ぶとサーバー再描画が走り、
      // 直前の25回の書き込みと重なって一瞬ログイン画面が見えることがあった。
      setTrips(await insertSample())
    } catch {
      toast('保存できませんでした。もう一度お試しください')
    }
    setBusy(false)
  }

  async function tidySample() {
    if (busy) return
    setBusy(true)
    try {
      await clearSample()
      setTrips((all) => all.filter((t) => !t.isSample))
    } catch {
      toast('保存できませんでした。もう一度お試しください')
    }
    setBusy(false)
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  const head = (
    <header className="top">
      <h1>遠征の手配</h1>
      {trips.length > 0 && (
        <button className="btn" onClick={() => setSheet(true)}>＋ 旅を追加</button>
      )}
    </header>
  )

  const footer = (
    <p className="note">
      {trips.some((t) => t.isSample) && (
        <>
          <button className="linkbtn" onClick={tidySample} disabled={busy}>
            {busy ? '片づけています…' : 'サンプルを片づける'}
          </button>
          <br />
        </>
      )}
      <button className="linkbtn" onClick={() => setInvite(true)}>友だちを招待</button>
      <br />
      <button className="linkbtn" onClick={signOut}>ログアウト</button>
    </p>
  )

  if (!trips.length) {
    return (
      <>
        {head}
        <section className="empty">
          <p>遠征の予定を登録すると、<br />どの旅の何が手配済みで、何がまだかが<br />ここにひと目で並びます。</p>
          <div className="btns">
            <button className="btn" onClick={() => setSheet(true)}>＋ 最初の旅を追加</button>
            <button className="linkbtn" onClick={sample} disabled={busy}>
              {busy ? '入れています…' : 'サンプルで見てみる'}
            </button>
          </div>
        </section>
        {footer}
        {sheet && <TripSheet trip={null} onClose={() => setSheet(false)} onSave={save} />}
        {invite && <InviteSheet onClose={() => setInvite(false)} />}
      </>
    )
  }

  let todo = 0, wait = 0, withTodo = 0
  up.forEach((t) => {
    const s = stats(t)
    todo += s.todo
    wait += s.wait
    if (s.todo) withTodo++
  })

  let summary
  if (!up.length) summary = <>これからの遠征は登録されていません。</>
  else if (todo) summary = <><b>{withTodo}つの旅で、まだの手配が{todo}件</b>あります。{wait ? `当落待ちは${wait}件です。` : ''}</>
  else if (wait) summary = <>まだの手配はありません。当落待ちが{wait}件あります。</>
  else summary = <>これからの遠征{up.length}件は、すべて手配済みです。</>

  return (
    <>
      {head}
      <p className="summary">{summary}</p>
      <section aria-label="これからの遠征">
        {up.map((t) => <TripCard key={t.id} trip={t} past={false} />)}
      </section>
      {past.length > 0 && (
        <>
          <button className="past-toggle" onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
            {showPast ? '▾' : '▸'} 終わった旅（{past.length}）
          </button>
          {showPast && (
            <section aria-label="終わった旅">
              {past.map((t) => <TripCard key={t.id} trip={t} past={true} />)}
            </section>
          )}
        </>
      )}
      {footer}
      {sheet && <TripSheet trip={null} onClose={() => setSheet(false)} onSave={save} />}
        {invite && <InviteSheet onClose={() => setInvite(false)} />}
    </>
  )
}
