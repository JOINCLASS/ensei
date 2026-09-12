import 'server-only'

export type Health = {
  ok: boolean
  /** データベースの応答（ミリ秒）。失敗したときは reason に理由が入る */
  ms: number
  reason?: string
}

/**
 * データベースに届いているかだけを見る。
 * ログインしていないので RLS により中身は返らない（0件）。件数も外には出さない。
 */
export async function checkDatabase(): Promise<Health> {
  const started = Date.now()
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/trips?select=id&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(10_000),
      },
    )
    const ms = Date.now() - started
    if (!res.ok) return { ok: false, ms, reason: `データベースが ${res.status} を返しました` }
    return { ok: true, ms }
  } catch (e) {
    const reason = e instanceof Error ? e.message : '不明なエラー'
    return { ok: false, ms: Date.now() - started, reason }
  }
}
