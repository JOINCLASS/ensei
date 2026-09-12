'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAccount } from '@/lib/account'
import { fetchTrips } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { itemLabel, itemSub, md, nights, STATUS, TYPES } from '@/lib/logic'
import { toast } from '@/lib/toast'
import { DeleteButton } from './Sheet'

/** 参照HTMLにない画面。既存のトークンと部品だけで組む。 */
export function AboutView({ signedIn }: { signedIn: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  /** 入力した内容を、そのまま読めるテキストにして書き出す */
  async function exportData() {
    if (busy) return
    setBusy(true)
    try {
      const trips = await fetchTrips()
      const lines = trips.flatMap((t) => {
        const n = nights(t.start, t.end)
        return [
          `■ ${t.title}`,
          `　${t.place || '行き先なし'}　${md(t.start)}〜${md(t.end)}　${n > 0 ? `${n}泊` : '日帰り'}`,
          ...(t.memo ? [`　メモ：${t.memo}`] : []),
          ...t.items.map((i) => {
            const sub = itemSub(i)
            return `　・${itemLabel(i)}：${STATUS[i.status]}${i.name ? `　${i.name}` : ''}${sub ? `　${sub}` : ''}${i.memo ? `　（${i.memo}）` : ''}`
          }),
          '',
        ]
      })
      const text = ['手配まとめ　書き出し', `旅 ${trips.length}件`, '', ...lines].join('\n')
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'ensei.txt'
      a.click()
      URL.revokeObjectURL(url)
      toast('書き出しました')
    } catch {
      toast('書き出せませんでした。もう一度お試しください')
    }
    setBusy(false)
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    const res = await deleteAccount()
    if (res.error) {
      setBusy(false)
      return toast(res.error)
    }
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <>
      <div className="bar">
        <button className="linkbtn" onClick={() => router.push(signedIn ? '/' : '/login')}>
          ‹ もどる
        </button>
      </div>
      <header className="top"><h1>このアプリについて</h1></header>

      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          遠征の予定を、どの旅の何がまだかで<br />ひと目で見られるようにする道具です。
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>預かるもの</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          ・ログインに使うメールアドレス<br />
          ・入力した旅と手配の内容<br /><br />
          これだけです。名前も電話番号も要りません。<b>パスワードは預かりません。</b>
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>ログインのしかた</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          メールアドレスを入れると6桁のコードが届くので、それを入れてログインします。
          パスワードを覚える必要はありません。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>一度ログインすれば、ログアウトするまで入ったままです。</b>
          毎回コードを受け取る必要はありません。
        </p>
        <p style={{ textAlign: 'left' }}>
          コードが必要になるのは、次のときだけです。<br />
          ・はじめて使うとき<br />
          ・自分でログアウトしたとき<br />
          ・別の端末やブラウザで開いたとき<br />
          ・長く使わず、端末がログイン情報を消したとき
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>どこに置いているか</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          東京にあるデータベース（Supabase）に保存しています。<br /><br />
          <b>あなたのデータは、あなたにしか見えません。</b>
          他の人のアカウントからは読めない仕組みにしています。友だちを招待しても、旅の中身は共有されません。
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>外に渡すもの</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          ログイン用のメールを送るために、メールアドレスを配信サービス（Resend）に渡します。
          それ以外の用途には使いません。広告にも使いません。
        </p>
      </section>

      {signedIn && (
        <>
          <p className="summary" style={{ marginTop: 24 }}><b>持ち出す</b></p>
          <section className="empty">
            <p>入力した内容を、読めるかたちで<br />ファイルに書き出せます。</p>
            <div className="btns">
              <button className="btn ghost" onClick={exportData} disabled={busy}>
                {busy ? '書き出しています…' : '内容を書き出す'}
              </button>
            </div>
          </section>

          <p className="summary" style={{ marginTop: 24 }}><b>やめる</b></p>
          <section className="empty">
            <p>
              退会すると、旅も手配もすべて消えます。<br />
              <b>元にはもどせません。</b><br />
              残しておきたい内容は、先に書き出してください。
            </p>
            <div className="btns">
              <DeleteButton onConfirm={remove} label="退会する" armedLabel="もう一度押すと退会" />
            </div>
          </section>
        </>
      )}

      <p className="note">
        <button className="linkbtn" onClick={() => router.push(signedIn ? '/' : '/login')}>
          ‹ もどる
        </button>
      </p>
    </>
  )
}
