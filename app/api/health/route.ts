import { NextResponse } from 'next/server'
import { checkDatabase } from '@/lib/health'

/**
 * 死活確認。外部の監視サービスから叩いてもらうために公開している。
 * 返すのは「つながったかどうか」だけで、データも件数も鍵も出さない。
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  const health = await checkDatabase()
  return NextResponse.json(health, {
    status: health.ok ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}
