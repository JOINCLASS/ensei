'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getUser } from '@/lib/supabase/server'

/**
 * お知らせを受け取るかどうか。
 *
 * データベースの表は増やさない。Supabase が持っているユーザー情報の
 * user_metadata に置けば、移行を一度も走らせずに済む。
 * 既定は「受け取る」。入れ忘れた人に届かないほうが困るため。
 */
export async function getRemind() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  return user?.user_metadata?.remind !== false
}

export async function setRemind(on: boolean) {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) return { error: 'ログインしていません。' }

  // 本人のぶんだけ書き換える。id はセッションから取るので、他人のは触れない。
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, remind: on },
  })
  return error ? { error: '変えられませんでした。もう一度お試しください。' } : { ok: true }
}
