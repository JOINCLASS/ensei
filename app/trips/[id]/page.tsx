import { notFound, redirect } from 'next/navigation'
import { TripView } from '@/components/TripView'
import { TRIP_SELECT, toTrip } from '@/lib/map'
import { createClient, getUser } from '@/lib/supabase/server'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  // 認証確認とデータ取得を並行に投げる（RLS があるので他人の旅は返らない）
  const [user, trip] = await Promise.all([
    getUser(supabase),
    supabase.from('trips').select(TRIP_SELECT).eq('id', id).maybeSingle(),
  ])
  if (!user) redirect('/login')

  // 取れなかった（error）と、本当に無い（data が null）を分ける。
  // まとめて notFound() にすると、404の「消された旅か、まちがったリンクか
  // もしれません」が出る。消えていない旅を、消えたと告げることになる。
  if (trip.error) throw new Error(`旅を取れませんでした: ${trip.error.message}`)
  if (!trip.data) notFound()

  return <TripView initialTrip={toTrip(trip.data)} />
}
