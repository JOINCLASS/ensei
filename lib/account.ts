'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, getUser } from '@/lib/supabase/server'

/**
 * 退会する。旅も手配も招待も、まとめて消える
 * （どれも auth.users を on delete cascade で参照している）。
 *
 * 消すには管理者権限が要るので、サーバー側だけで扱う。
 * 消せるのは「いま自分でログインしている本人」だけ。
 * 対象のIDはセッションから取るので、他人を指定する余地はない。
 */
export async function deleteAccount() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  if (!user) return { error: 'ログインし直してから、もう一度お試しください。' }

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id)
  if (error) return { error: '退会できませんでした。もう一度お試しください。' }
  return { ok: true }
}
