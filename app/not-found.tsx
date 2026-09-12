import Link from 'next/link'

/**
 * 見つからなかったときの画面。
 * 参照HTMLに無い画面なので、既存のトークンと部品だけで組む（.top / .empty / .btn）。
 */
export default function NotFound() {
  return (
    <>
      <header className="top"><h1>手配まとめ</h1></header>
      <section className="empty">
        <p>
          このページは見つかりませんでした。<br />
          消された旅か、まちがったリンクかもしれません。
        </p>
        <div className="btns">
          <Link className="btn" href="/" style={{ textDecoration: 'none' }}>一覧にもどる</Link>
        </div>
      </section>
    </>
  )
}
