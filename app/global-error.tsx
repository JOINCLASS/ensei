'use client'

/**
 * 土台（layout）ごと壊れたときの最後の受け皿。
 * ここでは globals.css が読み込まれないので、色と形は直接書く。
 * 値は参照HTMLのトークンと同じもの。
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: '#EEEDF4', color: '#221F33',
        fontFamily: "'Hiragino Maru Gothic ProN','Hiragino Sans','Noto Sans JP',sans-serif" }}>
        <main style={{ maxWidth: 480, margin: '0 auto', padding: 16 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '8px 0 20px' }}>手配まとめ</h1>
          <section style={{ background: '#fff', borderRadius: 14, padding: '32px 20px', textAlign: 'center' }}>
            <p style={{ margin: '0 0 20px', lineHeight: 1.8, color: '#6E6A82', fontSize: 14 }}>
              うまく表示できませんでした。<br />少し待ってから、もう一度お試しください。
            </p>
            <button onClick={reset}
              style={{ border: 'none', borderRadius: 999, padding: '10px 16px', fontWeight: 700,
                background: '#221F33', color: '#fff', fontSize: 15, cursor: 'pointer' }}>
              もう一度読み込む
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
