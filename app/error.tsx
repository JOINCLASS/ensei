'use client'

import { useEffect } from 'react'

/**
 * 画面の描画でつまずいたときの受け皿。
 * これが無いと Next.js の素のエラー画面（英語）が出る。
 * 参照HTMLに無い画面なので、既存のトークンと部品だけで組む。
 */
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    // 記録が残らないと調べようがないので、せめてコンソールには出す
    console.error(error)
  }, [error])

  return (
    <>
      <header className="top"><h1>手配まとめ</h1></header>
      <section className="empty">
        <p>
          うまく表示できませんでした。<br />
          少し待ってから、もう一度お試しください。
        </p>
        <div className="btns">
          <button className="btn" onClick={reset}>もう一度読み込む</button>
          <a className="linkbtn" href="/" style={{ textDecoration: 'none' }}>一覧にもどる</a>
        </div>
      </section>
    </>
  )
}
