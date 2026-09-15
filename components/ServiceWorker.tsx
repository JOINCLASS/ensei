'use client'

import { useEffect } from 'react'

/**
 * 圏外で真っ白にしないための登録。
 *
 * ためるのは見た目を作るもの（JS・CSS・アイコン）だけで、旅の中身は一切ためない。
 * 古い「手配済み」を見せるほうが、見られないより危ないため。詳しくは public/sw.js。
 *
 * 開発中は登録しない。作り直すたびに古いものが残って、追いかけにくくなる。
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 登録できなくてもアプリは動く。圏外のときに案内が出ないだけ。
    })
  }, [])

  return null
}
