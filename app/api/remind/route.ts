import { NextResponse, type NextRequest } from 'next/server'
import { collect, send } from '@/lib/remind'

/**
 * 出発が近いのに、まだ済んでいない手配があることを知らせる。1日1回。
 *
 * Vercel Cron 以外から叩かれないように守る。開けっ放しにすると、
 * 外から連打されてメールの無料枠を使い切られる。
 *
 * 何を送ったかは記録に残さない。旅の題名は本人のものなので、
 * 運営の記録に積み上げない（件数だけ数える）。
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  /**
   * 送らずに中身だけ返す口。試験でしか使わない。
   * 本番では絶対に開かない。開けるとメールの中身が外から読めてしまう。
   */
  const dry =
    process.env.NODE_ENV !== 'production' &&
    new URL(request.url).searchParams.get('dry') === '1'

  const secret = process.env.CRON_SECRET
  if (!dry && secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const mails = await collect()
    if (dry) return NextResponse.json({ ok: true, mails })
    let sent = 0
    for (const m of mails) if (await send(m)) sent++
    return NextResponse.json({ ok: true, targets: mails.length, sent })
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: e instanceof Error ? e.message : '不明' },
      { status: 500 },
    )
  }
}
