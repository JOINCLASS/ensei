'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/** 招待を1枚発行して、渡すURLを返す */
export async function createInvite(origin: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.from('invites').insert({}).select('id').single()
  if (error) {
    // 上限に当たったときはそれと分かる文言を返す
    return { error: /5枚/.test(error.message) ? error.message : '招待を作れませんでした。' }
  }
  return { url: `${origin}/invite/${data.id}` }
}

type Invite = { id: string; used_at: string | null; expires_at: string }

/** 招待が使えるかどうかだけを見る。ログインしていない人が呼ぶので管理者権限で読む。 */
export async function checkInvite(code: string): Promise<'ok' | 'used' | 'expired' | 'unknown'> {
  if (!/^[0-9a-f-]{36}$/i.test(code)) return 'unknown'
  const { data } = await createAdminClient()
    .from('invites')
    .select('id,used_at,expires_at')
    .eq('id', code)
    .maybeSingle<Invite>()
  if (!data) return 'unknown'
  if (data.used_at) return 'used'
  if (new Date(data.expires_at) < new Date()) return 'expired'
  return 'ok'
}

/**
 * 招待を使ってアカウントを作る。
 * 新規登録は閉じているので、ここだけが入口。
 */
export async function redeemInvite(code: string, email: string) {
  const state = await checkInvite(code)
  if (state !== 'ok') {
    return {
      error: {
        used: 'この招待はすでに使われています。',
        expired: 'この招待は期限が切れています。',
        unknown: 'この招待は見つかりませんでした。',
      }[state],
    }
  }

  const admin = createAdminClient()
  const address = email.trim().toLowerCase()

  // 既に登録済みなら、招待を消費せずそのままログインしてもらう
  const { data: list } = await admin.auth.admin.listUsers()
  const existing = list?.users.find((u) => u.email?.toLowerCase() === address)
  if (existing) return { ok: true }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: address,
    email_confirm: true,
  })
  if (error || !created.user) return { error: 'アカウントを作れませんでした。' }

  // 使用済みにする。ここで失敗しても登録は済んでいるので、ログインは妨げない。
  await admin
    .from('invites')
    .update({ used_at: new Date().toISOString(), used_by: created.user.id })
    .eq('id', code)
    .is('used_at', null)

  return { ok: true }
}
