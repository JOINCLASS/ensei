import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * 管理者権限のクライアント。RLSを素通りする。
 *
 * 招待の引き換えにだけ使う。招待された人はまだログインしていないので、
 * 本人の権限では招待レコードを読めず、ユーザーも作れないため。
 *
 * `server-only` を付けてあるので、うっかりクライアント側から読み込むと
 * ビルドが落ちる。鍵がブラウザに出ることはない。
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY が設定されていない')
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
