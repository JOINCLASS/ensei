'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteAccount } from '@/lib/account'
import { setRemind } from '@/lib/notify-pref'
import { fetchTrips } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { build, FILENAME, type Format } from '@/lib/export'
import { toast } from '@/lib/toast'
import { DeleteButton } from './Sheet'
import { InviteSheet } from './InviteSheet'
import { InstallSheet, useInstalled } from './InstallSheet'

/** 参照HTMLにない画面。既存のトークンと部品だけで組む。 */
export function AboutView({ signedIn, remind = true }: { signedIn: boolean; remind?: boolean }) {
  const router = useRouter()
  // どのボタンを押したかで文言を変えるため、真偽ではなく種類を持つ
  const [busy, setBusy] = useState<false | Format | 'delete'>(false)
  const [on, setOn] = useState(remind)
  const [invite, setInvite] = useState(false)
  const [install, setInstall] = useState(false)
  // ホーム画面から開いている人には、追加の案内を出さない
  const installed = useInstalled()

  async function signOut() {
    await createClient().auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  /** 入力した内容を手元に持ち出す。データベースに自動バックアップが無いので、これが唯一の保険 */
  async function exportData(format: Format) {
    if (busy) return
    setBusy(format)
    try {
      const url = URL.createObjectURL(build(await fetchTrips(), format))
      const a = document.createElement('a')
      a.href = url
      a.download = FILENAME[format]
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
    setBusy('delete')
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
      <header className="top"><h1>{signedIn ? '設定' : 'このアプリについて'}</h1></header>

      {signedIn ? (
        <>
      {signedIn && (
        <>
          <p className="summary" style={{ marginTop: 24 }}><b>お知らせ</b></p>
          <section className="empty" style={{ textAlign: 'left' }}>
            <p style={{ textAlign: 'left' }}>
              出発の<b>7日前</b>と<b>前日</b>に、まだ済んでいない手配があれば
              メールでお知らせします。済んでいれば送りません。
            </p>
            <div className="btns">
              <button
                className={on ? 'btn wide' : 'btn ghost wide'}
                aria-pressed={on}
                onClick={async () => {
                  const next = !on
                  setOn(next)
                  const res = await setRemind(next)
                  if (res.error) {
                    setOn(!next)
                    toast(res.error)
                  }
                }}
              >
                {on ? 'お知らせを受け取る（オン）' : 'お知らせを受け取らない（オフ）'}
              </button>
            </div>
          </section>

          <p className="summary" style={{ marginTop: 24 }}><b>できること</b></p>
          <section className="empty">
            <div className="btns">
              {installed === false && (
                <button className="btn ghost wide" onClick={() => setInstall(true)}>
                  ホーム画面に追加
                </button>
              )}
              <button className="btn ghost wide" onClick={() => setInvite(true)}>
                友だちを招待
              </button>
              <button className="btn ghost wide" onClick={signOut}>
                ログアウト
              </button>
            </div>
          </section>

          <p className="summary" style={{ marginTop: 24 }}><b>持ち出す</b></p>
          <section className="empty">
            <p>
              入力した内容を、ファイルに書き出せます。<br />
              <b>ときどき書き出して、手元にも残してください。</b>
            </p>
            <div className="btns" style={{ flexDirection: 'column' }}>
              <button className="btn ghost wide" onClick={() => exportData('text')} disabled={!!busy}>
                {busy === 'text' ? '書き出しています…' : '読めるかたちで（テキスト）'}
              </button>
              <button className="btn ghost wide" onClick={() => exportData('csv')} disabled={!!busy}>
                {busy === 'csv' ? '書き出しています…' : '表計算で開ける形で（CSV）'}
              </button>
              <button className="btn ghost wide" onClick={() => exportData('json')} disabled={!!busy}>
                {busy === 'json' ? '書き出しています…' : 'そっくり残す形で（JSON）'}
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

      {signedIn && (
        <p className="summary" style={{ marginTop: 4 }}><b>このアプリについて</b></p>
      )}
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
          入り方は2つあります。<b>Googleで続ける</b>か、
          メールアドレスに届く<b>6桁のコード</b>を入れるかです。
          どちらでもパスワードは要りません。
        </p>
        <p style={{ textAlign: 'left' }}>
          同じメールアドレスなら、どちらで入っても同じ場所に入ります。
          旅が2つに分かれることはありません。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>一度ログインすれば、ログアウトするまで入ったままです。</b>
          毎回コードを受け取る必要はありません。
        </p>
        <p style={{ textAlign: 'left' }}>
          コードが必要になるのは、メールで入る場合の、次のときだけです。<br />
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
        <p style={{ textAlign: 'left' }}>
          Googleで入る場合、Googleは「そのアドレスの本人かどうか」だけを確かめて返します。
          こちらからGoogleに渡すものはありません。<b>旅の中身はGoogleには見えません。</b>
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>困ったとき</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          うまく動かないときや、消えてしまったものがあるときは、
          <a className="linkbtn" href="mailto:support@tehaimatome.com" style={{ padding: 0 }}>
            support@tehaimatome.com
          </a> まで送ってください。
        </p>
        <p style={{ textAlign: 'left' }}>
          ひとりで作って動かしているので、返事に数日いただくことがあります。
          いつ・どの画面で・何をしたときかを書いてもらえると助かります。
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>おことわり</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          いまは無料で使えます。個人で作って動かしています。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>だまって終わらせることはしません。</b>
          料金をいただく形にするときや、どうしても続けられなくなったときは、
          必ず前もってお知らせして、書き出していただく時間をとります。
        </p>
        <p style={{ textAlign: 'left' }}>
          入力した内容は、いつでも手元に書き出せます。
          不具合を直すのにお時間をいただくことがあるので、
          お気づきのことは「困ったとき」からお知らせください。
        </p>
        <p style={{ textAlign: 'left' }}>
          手配そのものは代行しません。チケットや宿の申し込み、支払い、
          当落の確認は、それぞれの公式のところで行ってください。
          ここに書いた予定や状態はあくまで<b>控え</b>です。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>大事な予定は、公式の画面やメールでも確かめてください。</b>
          ここに書いた内容をもとに動いた結果については、責任を負いかねます。
        </p>
      </section>

        </>
      ) : (
        <>
      {signedIn && (
        <p className="summary" style={{ marginTop: 4 }}><b>このアプリについて</b></p>
      )}
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
          入り方は2つあります。<b>Googleで続ける</b>か、
          メールアドレスに届く<b>6桁のコード</b>を入れるかです。
          どちらでもパスワードは要りません。
        </p>
        <p style={{ textAlign: 'left' }}>
          同じメールアドレスなら、どちらで入っても同じ場所に入ります。
          旅が2つに分かれることはありません。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>一度ログインすれば、ログアウトするまで入ったままです。</b>
          毎回コードを受け取る必要はありません。
        </p>
        <p style={{ textAlign: 'left' }}>
          コードが必要になるのは、メールで入る場合の、次のときだけです。<br />
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
        <p style={{ textAlign: 'left' }}>
          Googleで入る場合、Googleは「そのアドレスの本人かどうか」だけを確かめて返します。
          こちらからGoogleに渡すものはありません。<b>旅の中身はGoogleには見えません。</b>
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>困ったとき</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          うまく動かないときや、消えてしまったものがあるときは、
          <a className="linkbtn" href="mailto:support@tehaimatome.com" style={{ padding: 0 }}>
            support@tehaimatome.com
          </a> まで送ってください。
        </p>
        <p style={{ textAlign: 'left' }}>
          ひとりで作って動かしているので、返事に数日いただくことがあります。
          いつ・どの画面で・何をしたときかを書いてもらえると助かります。
        </p>
      </section>

      <p className="summary" style={{ marginTop: 24 }}><b>おことわり</b></p>
      <section className="empty" style={{ textAlign: 'left' }}>
        <p style={{ textAlign: 'left' }}>
          いまは無料で使えます。個人で作って動かしています。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>だまって終わらせることはしません。</b>
          料金をいただく形にするときや、どうしても続けられなくなったときは、
          必ず前もってお知らせして、書き出していただく時間をとります。
        </p>
        <p style={{ textAlign: 'left' }}>
          入力した内容は、いつでも手元に書き出せます。
          不具合を直すのにお時間をいただくことがあるので、
          お気づきのことは「困ったとき」からお知らせください。
        </p>
        <p style={{ textAlign: 'left' }}>
          手配そのものは代行しません。チケットや宿の申し込み、支払い、
          当落の確認は、それぞれの公式のところで行ってください。
          ここに書いた予定や状態はあくまで<b>控え</b>です。
        </p>
        <p style={{ textAlign: 'left' }}>
          <b>大事な予定は、公式の画面やメールでも確かめてください。</b>
          ここに書いた内容をもとに動いた結果については、責任を負いかねます。
        </p>
      </section>

        </>
      )}

      <p className="note">
        <button className="linkbtn" onClick={() => router.push(signedIn ? '/' : '/login')}>
          ‹ もどる
        </button>
      </p>

      {invite && <InviteSheet onClose={() => setInvite(false)} />}
      {install && <InstallSheet onClose={() => setInstall(false)} />}
    </>
  )
}
