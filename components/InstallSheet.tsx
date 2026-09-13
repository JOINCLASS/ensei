'use client'

import { useEffect, useState } from 'react'
import { Sheet } from './Sheet'

/**
 * ホーム画面に追加するための案内。参照HTMLに無い画面なので、既存の部品だけで組む。
 *
 * iOSは、ボタンから追加を実行する方法が用意されていない（Safariが許していない）。
 * できるのは、迷わないように道順を見せることだけ。
 * Androidは beforeinstallprompt が使えるので、そこは本当に1タップで終わらせる。
 *
 * いちばんつまずくのは、XやLINEの中のブラウザで開いている場合。
 * そこには「ホーム画面に追加」が無いので、先にSafariで開いてもらう必要がある。
 */

type Where = 'ios' | 'android' | 'desktop'
type Prompt = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }

/**
 * 合図は app/layout.tsx のいちばん早い script が受け取って window.__bip に置いている。
 * ここはそれを読むだけ。シートが開いてから聞き始めても、もう鳴り終わっている。
 */
function usePrompt() {
  const read = () => (typeof window === 'undefined' ? null : ((window as { __bip?: Prompt }).__bip ?? null))
  const [prompt, setPrompt] = useState<Prompt | null>(read)
  useEffect(() => {
    const sync = () => setPrompt(read())
    sync()
    window.addEventListener('bip', sync)
    return () => window.removeEventListener('bip', sync)
  }, [])
  return prompt
}

/** ホーム画面から開いているときは、案内そのものが要らない */
export function useInstalled() {
  const [installed, setInstalled] = useState<boolean | null>(null)
  useEffect(() => {
    setInstalled(
      window.matchMedia('(display-mode: standalone)').matches ||
        // iOSはこちら
        (window.navigator as { standalone?: boolean }).standalone === true,
    )
  }, [])
  return installed
}

function detect(): { where: Where; inApp: boolean } {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const where: Where = ios ? 'ios' : /Android/.test(ua) ? 'android' : 'desktop'
  // XやLINE、Instagram、Facebookの中のブラウザ
  const inApp = /Twitter|Line\/|Instagram|FBAN|FBAV/.test(ua)
  return { where, inApp }
}

/** iOSの共有ボタンの形。装飾ではなく、これが無いとどれを押すか分からないため置く。 */
function ShareMark() {
  return (
    <svg
      width="17"
      height="20"
      viewBox="0 0 17 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="共有"
      style={{ verticalAlign: '-4px', margin: '0 2px' }}
    >
      <path d="M8.5 1.6v10.2M4.9 5l3.6-3.4L12.1 5" />
      <path d="M3.2 8.6H1.9v9.5h13.2V8.6h-1.3" />
    </svg>
  )
}

export function InstallSheet({ onClose }: { onClose: () => void }) {
  // このシートは押されて初めて組み立てられるので、最初の描画で判定してよい。
  // useEffect のあとに判定すると、一瞬だけ別の端末向けの文面が出てしまう。
  const [state] = useState(detect)
  const prompt = usePrompt()
  const [busy, setBusy] = useState(false)

  async function install() {
    if (!prompt || busy) return
    setBusy(true)
    prompt.prompt()
    await prompt.userChoice.catch(() => null)
    setBusy(false)
    onClose()
  }

  const p = { textAlign: 'left' as const }

  return (
    <Sheet labelledBy="installTitle" onClose={onClose}>
      <h2 id="installTitle">ホーム画面に追加</h2>

      {state.inApp ? (
        <section className="empty" style={{ textAlign: 'left' }}>
          <p style={p}>
            ホーム画面に置いておくと、ふつうのアプリと同じように、ひとタップで開けます。
          </p>
          <p style={p}>
            いま、他のアプリの中のブラウザで開いています。
            <b>ここからは追加できません。</b>
          </p>
          <p style={p}>
            画面のすみにある「…」から
            <b>{state.where === 'ios' ? '「Safariで開く」' : '「ブラウザで開く」'}</b>
            を選んでから、もう一度おためしください。
          </p>
        </section>
      ) : state.where === 'ios' ? (
        <section className="empty" style={{ textAlign: 'left' }}>
          <p style={p}>
            ホーム画面に置いておくと、ふつうのアプリと同じように、
            <b>ひとタップで開けます。</b>
          </p>
          <p style={p}>
            1. 画面の下にある
            <ShareMark />
            を押します
          </p>
          <p style={p}>2. 出てきた並びから「ホーム画面に追加」を選びます</p>
          <p style={p}>3. 右上の「追加」を押して、おしまいです</p>
        </section>
      ) : state.where === 'android' ? (
        prompt ? (
          <section className="empty">
            <p>
              ホーム画面に置いておくと、ひとタップで開けます。<br />
              下のボタンを押すだけで追加できます。
            </p>
            <div className="btns">
              <button className="btn" onClick={install} disabled={busy}>
                {busy ? '追加しています…' : 'ホーム画面に追加'}
              </button>
            </div>
          </section>
        ) : (
          <section className="empty" style={{ textAlign: 'left' }}>
            <p style={p}>
              ホーム画面に置いておくと、ふつうのアプリと同じように、
              <b>ひとタップで開けます。</b>
            </p>
            <p style={p}>1. 画面の右上にある「⋮」を押します</p>
            <p style={p}>2. 「ホーム画面に追加」を選びます</p>
          </section>
        )
      ) : (
        <section className="empty" style={{ textAlign: 'left' }}>
          <p style={p}>
            携帯で <b>tehaimatome.com</b> を開くと、ホーム画面に追加できます。
            ふつうのアプリと同じように、ひとタップで開けるようになります。
          </p>
        </section>
      )}

      <div className="btns">
        <button className="btn ghost wide" onClick={onClose}>
          とじる
        </button>
      </div>
    </Sheet>
  )
}
