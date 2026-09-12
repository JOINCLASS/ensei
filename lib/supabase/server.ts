import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'
import { cookieOptions } from './cookies'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions,
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(list) {
          try {
            list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Component からは書けない。更新は proxy.ts 側でやっている。
          }
        },
      },
    },
  )
}

/**
 * ログイン中の人を取る。
 *
 * getUser() は Supabase へ問い合わせるので、混んでいると失敗しうる。
 * 失敗を「ログインしていない」と見なすと、書き込み直後などに
 * 一瞬ログイン画面へ飛ばしてしまう。通信都合の失敗は一度だけやり直す。
 */
export async function getUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  for (let i = 0; i < 2; i++) {
    const { data, error } = await supabase.auth.getUser()
    if (data.user) return data.user
    // セッションが無いのが確実なときは、やり直さずにそのまま返す
    if (!error || error.name !== 'AuthRetryableFetchError') return null
  }
  return null
}
