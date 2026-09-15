'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * 下の行き先。宣伝チラシの世界観に合わせて置く。
 *
 * チラシは「ホーム／旅一覧／設定」の3つだが、このアプリに「ホーム」は無い。
 * 開いた最初の画面が旅の一覧そのもので、別に作れば中身のない画面が1つ増える。
 * 実際にある行き先だけを並べる。
 *
 * 旅の詳細を開いているあいだも「旅一覧」を選んだ状態にしておく。
 * 同じ流れの中にいることが分かるため。
 */
const TABS = [
  {
    href: '/',
    label: '旅一覧',
    // 半券。アプリのアイコンと同じかたち
    path: 'M3 7.5A1.5 1.5 0 0 1 4.5 6h15A1.5 1.5 0 0 1 21 7.5v2a2.5 2.5 0 0 0 0 5v2a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-2a2.5 2.5 0 0 0 0-5v-2Z',
  },
  {
    href: '/about',
    label: '設定',
    // 歯車
    path: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8.4-2.1.1-1.4-.1-1.4 1.8-1.4-1.7-3-2.2.7a8 8 0 0 0-2.4-1.4L15.5 3h-3.4l-.4 2.5a8 8 0 0 0-2.4 1.4l-2.2-.7-1.7 3 1.8 1.4-.1 1.4.1 1.4-1.8 1.4 1.7 3 2.2-.7a8 8 0 0 0 2.4 1.4l.4 2.5h3.4l.4-2.5a8 8 0 0 0 2.4-1.4l2.2.7 1.7-3-1.8-1.4Z',
  },
]

export function BottomNav() {
  const here = usePathname()

  // ログインの前と、招待を受け取る画面には出さない。行ける先がまだ無いため。
  if (here.startsWith('/login') || here.startsWith('/invite')) return null

  return (
    <nav className="tabbar" aria-label="画面の切り替え">
      <ul>
        {TABS.map((t) => {
          const on = t.href === '/' ? here === '/' || here.startsWith('/trips') : here.startsWith(t.href)
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={on ? 'page' : undefined}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d={t.path} />
                </svg>
                <span>{t.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
