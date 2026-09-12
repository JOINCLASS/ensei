import { redirect } from 'next/navigation'
import { ListView } from '@/components/ListView'
import { TRIP_SELECT, toTrip } from '@/lib/map'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  // 直列に待つと往復が2回分かかる。RLS があるので、ログインしていなければ
  // trips は空で返る。並行に投げて、あとから判定する。
  const [auth, trips] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('trips').select(TRIP_SELECT).order('start_date'),
  ])
  if (!auth.data.user) redirect('/login')

  return <ListView initialTrips={(trips.data ?? []).map(toTrip)} />
}
