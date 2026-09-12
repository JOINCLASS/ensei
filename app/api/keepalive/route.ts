import { NextResponse } from 'next/server'
import { checkDatabase } from '@/lib/health'

/**
 * 1日1回の定期アクセス。目的は2つ。
 *
 * 1. Supabase を起こしておく。無料プランは、一定期間まったくアクセスが無いと
 *    プロジェクトが一時停止する。遠征アプリは毎日開くものではないので、
 *    誰も開かない週があると止まり、次に開いた人がエラーに当たる。
 * 2. 落ちていたら自分にメールで知らせる。今までは誰も気づけなかった。
 *
 * Vercel Cron 以外から叩かれないように CRON_SECRET で守る。
 * 開けっ放しにすると、外から連打されてメールの無料枠を食い潰される。
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const health = await checkDatabase()
  if (!health.ok) await notify(health.reason ?? '不明なエラー')

  return NextResponse.json(health, { status: health.ok ? 200 : 503 })
}

async function notify(reason: string) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.ALERT_EMAIL
  if (!key || !to) return

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: '手配まとめ <noreply@tehaimatome.com>',
      to,
      subject: '［手配まとめ］アプリがデータベースにつながりません',
      text: [
        '定期確認で、アプリからデータベースに届きませんでした。',
        '',
        `理由: ${reason}`,
        '',
        '確認するところ:',
        '  アプリ          https://tehaimatome.com',
        '  死活確認        https://tehaimatome.com/api/health',
        '  Supabase        https://supabase.com/dashboard/project/qxyubrqtelvciwoszjlc',
        '',
        'プロジェクトが一時停止していた場合は、上の画面から再開できます。',
      ].join('\n'),
    }),
  }).catch(() => {})
}
