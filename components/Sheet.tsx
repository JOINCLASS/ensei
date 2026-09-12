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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" id={id} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={sheet}>
        {children}
      </div>
    </div>
  )
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
