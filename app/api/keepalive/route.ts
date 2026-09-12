import { NextResponse } from 'next/server'

/**
 * Supabase を起こしておくための定期アクセス。
 *
 * 無料プランは、一定期間まったくアクセスが無いとプロジェクトが一時停止する。
 * 遠征アプリは毎日開くものではないので、誰も開かない週があると止まり、
 * 次に開いた人がエラーに当たる。1日1回ここを叩いて起こしておく。
 *
 * 認証は要らない。RLS があるので、公開鍵で読めるのは自分の行だけ
 * （ログインしていないので実際には0件）。件数も中身も外に出さない。
 */
export const dynamic = 'force-dynamic'

export async function GET() {
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
      },
    )
    const ok = res.ok
    return NextResponse.json(
      { ok, status: res.status, ms: Date.now() - started },
      { status: ok ? 200 : 503 },
    )
  } catch {
    return NextResponse.json({ ok: false, ms: Date.now() - started }, { status: 503 })
  }
}
