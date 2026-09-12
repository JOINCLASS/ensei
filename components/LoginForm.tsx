'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { redeemInvite } from '@/lib/invites'
import { oshiStyle } from '@/lib/logic'
import type { ColorId, Status } from '@/lib/types'

/**
 * 参照HTMLにない画面。既存のトークンと部品だけで組む。
 * 新しいCSSは1行も足していない（.top / .ticket / .empty / .field / .btn / .err）。
 */

/** 一覧の半券をそのまま見本として置く。何をする道具かが一目で伝わるように。 */
type Sample = {
  color: ColorId; month: string; day: string; week: string; nights: string
  title: string; place: string; punches: [string, Status][]
  todo?: string; wait?: string
}

const SAMPLES: Sample[] = [
  {
    color: 'sky', month: '9月', day: '21', week: '月', nights: '2泊',
    title: 'ASIA TOUR 大阪公演', place: '大阪・京セラドーム　9/21〜9/23',
    punches: [['チケット', 'done'], ['行き', 'done'], ['帰り', 'todo'], ['ホテル', 'todo']],
    todo: '帰り、ホテル',
  },
  {
    color: 'pink', month: '10月', day: '6', week: '火', nights: '1泊',
    title: 'ファンミーティング 福岡', place: '福岡・マリンメッセ　10/6〜10/7',
    punches: [['チケット', 'wait'], ['行き', 'todo'], ['帰り', 'todo'], ['ホテル', 'done']],
    todo: '行き、帰り', wait: 'チケット',
  },
]

function SampleTicket({ s }: { s: Sample }) {
  return (
    <div className="ticket" style={oshiStyle(s.color)} aria-hidden="true">
      <span className="stub">
        <span className="stub-m">{s.month}</span>
        <span className="stub-d">{s.day}</span>
        <span className="stub-w">{s.week}</span>
        <span className="stub-n">{s.nights}</span>
      </span>
      <span className="tbody">
        <span className="t-title">{s.title}</span>
        <span className="place">{s.place}</span>
        <span className="punches">
          {s.punches.map(([label, status]) => (
            <span className={`pch s-${status}`} key={label}><i />{label}</span>
          ))}
        </span>
        <span className="todo-line">
          {s.todo && <><span className="chip-todo">まだ</span><span>{s.todo}</span></>}
          {s.wait && <><span className="chip-wait">当落待ち</span><span>{s.wait}</span></>}
        </span>
      </span>
    </div>
  )
}

/**
 * PKCE の途中で作られる使い捨てCookieを片づける。
 * 検証が済めば不要なのに、既定では400日残り、ログインのたびに増えていく。
 */
function clearFlowCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0].trim()
    if (name.endsWith('-code-verifier')) {
      document.cookie = `${name}=; Max-Age=0; Path=/`
    }
  }
}

export function LoginForm({ inviteCode }: { inviteCode?: string } = {}) {
  const router = useRouter()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  /**
   * 招待リンクから来た場合の受け取り。
   * Supabase の招待メールは、確認後に #access_token=... を付けてここへ戻してくる。
   * URLの「#」以降はサーバーに送られないので、ブラウザ側で拾うしかない。
   * 拾わないと「リンクを踏んだのにログイン画面が出る」行き止まりになる。
   *
   * detectSessionInUrl には任せられない。@supabase/ssr は PKCE 方式（?code=）で
   * 動くため、招待リンクが返す「#」形式のトークンを受け付けない。
   * 自分で読み取って setSession に渡す。
   */
  useEffect(() => {
    const hash = window.location.hash
    if (!hash || hash.length < 2) return
    const params = new URLSearchParams(hash.slice(1))
    const clean = () => window.history.replaceState(null, '', window.location.pathname)

    const problem = params.get('error_description') || params.get('error')
    if (problem) {
      clean()
      return setErr('招待の期限が切れているようです。下のメールアドレスからコードをお送りします。')
    }

    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return

    setBusy(true)
    createClient()
      .auth.setSession({ access_token, refresh_token })
      .then(({ data, error }) => {
        clean()
        if (error || !data.session) {
          setBusy(false)
          return setErr('招待の確認に失敗しました。メールアドレスを入れてコードを受け取ってください。')
        }
        router.replace('/')
        router.refresh()
      })
  }, [router])

  async function sendCode() {
    const value = email.trim()
    if (!value) return setErr('メールアドレスを入れてください。')
    setBusy(true)
    setErr('')

    // 招待から来た人は、コードを送る前にアカウントを作る
    if (inviteCode) {
      const res = await redeemInvite(inviteCode, value)
      if (res.error) {
        setBusy(false)
        return setErr(res.error)
      }
    }

    // 本番は新規登録を閉じている。shouldCreateUser を true にすると、
    // 既に登録済みの人でも「登録しようとした」と見なされて弾かれる。
    const { error } = await createClient().auth.signInWithOtp({
      email: value,
      options: { shouldCreateUser: false },
    })
    setBusy(false)
    if (error) {
      // 未登録のアドレスと、それ以外の失敗を書き分ける
      const notRegistered = /signup|not found|disabled/i.test(error.message)
      return setErr(
        notRegistered
          ? 'このメールアドレスは登録されていません。招待を受けとったアドレスをお確かめください。'
          : 'コードを送れませんでした。もう一度お試しください。',
      )
    }
    setStep('code')
  }

  async function verify() {
    const value = code.trim()
    if (!value) return setErr('コードを入れてください。')
    setBusy(true)
    setErr('')
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim(), token: value, type: 'email',
    })
    if (error) {
      setBusy(false)
      return setErr('コードが合いません。もう一度お確かめください。')
    }
    clearFlowCookies()
    router.replace('/')
    router.refresh()
  }

  return (
    <>
      <header className="top"><h1>遠征の手配</h1></header>

      <p className="summary">これは見本です。ログインすると、あなたの旅がこんなふうに並びます。</p>

      {/* コード入力に進んでも見本は出したまま。消すと画面が跳ねる */}
      {SAMPLES.map((s) => <SampleTicket key={s.title} s={s} />)}

      <section className="empty">
        {step === 'email' ? (
          <>
            {inviteCode ? (
              <p>招待されています。<br />パスワードはありません。<br />メールアドレスを入れると、<br />6桁のコードをお送りします。</p>
            ) : (
              <p>このアプリは招待制です。<br />パスワードはありません。<br />登録されたメールアドレスに、<br />6桁のコードをお送りします。</p>
            )}
            <label className="field" style={{ textAlign: 'left' }}>
              <span>メールアドレス</span>
              <input
                type="email"
                name="email"
                value={email}
                autoComplete="email"
                placeholder="例：me@example.com"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendCode()}
              />
            </label>
            <p className="err" hidden={!err}>{err}</p>
            <div className="btns">
              <button className="btn" onClick={sendCode} disabled={busy}>
                {busy ? '送っています…' : inviteCode ? 'はじめる' : 'コードを送る'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p>{email} に<br />6桁のコードを送りました。</p>
            <label className="field" style={{ textAlign: 'left' }}>
              <span>コード</span>
              <input
                type="text"
                name="code"
                value={code}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && verify()}
              />
            </label>
            <p className="err" hidden={!err}>{err}</p>
            <div className="btns">
              <button className="btn" onClick={verify} disabled={busy}>
                {busy ? '確認しています…' : 'ログインする'}
              </button>
              <button className="linkbtn" onClick={() => { setStep('email'); setCode(''); setErr('') }}>
                メールアドレスを入れなおす
              </button>
            </div>
          </>
        )}
      </section>

      <p className="note">
        <button className="linkbtn" onClick={() => router.push('/about')}>このアプリについて</button>
      </p>
    </>
  )
}
