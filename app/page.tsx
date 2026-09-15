import { redirect } from 'next/navigation'
import { ListView } from '@/components/ListView'
import { TRIP_SELECT, toTrip } from '@/lib/map'
import { createClient, getUser } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  // 直列に待つと往復が2回分かかる。RLS があるので、ログインしていなければ
  // trips は空で返る。並行に投げて、あとから判定する。
  const [user, trips] = await Promise.all([
    getUser(supabase),
    supabase.from('trips').select(TRIP_SELECT).order('start_date'),
  ])
  if (!user) redirect('/login')

  // 取れなかったことを空扱いにしない。
  // ?? [] で流すと「遠征の予定を登録すると…」という、まだ何も無い人向けの
  // 画面が出る。旅が全部消えたようにしか見えない。
  // 投げれば error.tsx が受けて「もう一度読み込む」を出す。
  if (trips.error) throw new Error(`旅の一覧を取れませんでした: ${trips.error.message}`)

  return <ListView initialTrips={(trips.data ?? []).map(toTrip)} />
}
