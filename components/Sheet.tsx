'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 参照HTMLの openSheet()：下から出るシート。覆いの余白クリックと Esc で閉じる。 */
export function Sheet({
  labelledBy,
  id,
  onClose,
  children,
}: {
  labelledBy: string
  id?: string
  onClose: () => void
  children: ReactNode
}) {
  const sheet = useRef<HTMLDivElement>(null)
  const keyboard = useKeyboard()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    // 参照HTMLと同じく 50ms 後に最初の入力欄へ
    const t = setTimeout(() => {
      const first = sheet.current?.querySelector<HTMLElement>('input:not([type=radio]),textarea')
      first?.focus({ preventScroll: true })
    }, 50)
    return () => {
      document.removeEventListener('keydown', onKey)
      clearTimeout(t)
    }
  }, [onClose])

  return (
    <div
      className="overlay"
      // キーボードが出ているあいだだけ高さを詰める。出ていなければ何も足さない。
      style={keyboard ? { height: keyboard, bottom: 'auto' } : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="sheet"
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        ref={sheet}
        // 覆いを詰めたときは 92vh のままだとはみ出す
        style={keyboard ? { maxHeight: '100%' } : undefined}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * キーボードが出ているときの、見えている高さを返す。出ていなければ null。
 *
 * iOS では、キーボードが出ても position:fixed の要素は画面いっぱいのままなので、
 * 下にある入力欄と保存ボタンがキーボードの裏に隠れる。
 * 縮むのは visualViewport のほうなので、そちらに合わせて覆いを詰める。
 *
 * CSSは触らない。キーボードが無いときは style を付けないので、見た目は変わらない。
 */
function useKeyboard() {
  const [height, setHeight] = useState<number | null>(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      // 隠れている量。アドレスバーの伸縮でも多少変わるので、少しの差は見ない。
      const hidden = window.innerHeight - vv.height - vv.offsetTop
      setHeight(hidden > 80 ? vv.height + vv.offsetTop : null)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  return height
}

/** 参照HTMLの armDelete()：2回押しで確定 */
export function DeleteButton({
  onConfirm,
  label = '削除',
  armedLabel = 'もう一度押すと削除',
}: {
  onConfirm: () => void
  label?: string
  armedLabel?: string
}) {
  const [armed, setArmed] = useState(false)
  return (
    <button
      type="button"
      className="btn danger"
      data-armed={armed ? '1' : undefined}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? armedLabel : label}
    </button>
  )
}
