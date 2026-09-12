import { notFound, redirect } from 'next/navigation'
import { TripView } from '@/components/TripView'
import { TRIP_SELECT, toTrip } from '@/lib/map'
import { createClient } from '@/lib/supabase/server'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  // 認証確認とデータ取得を並行に投げる（RLS があるので他人の旅は返らない）
  const [auth, trip] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('trips').select(TRIP_SELECT).eq('id', id).maybeSingle(),
  ])
  if (!auth.data.user) redirect('/login')
  if (!trip.data) notFound()

  return <TripView initialTrip={toTrip(trip.data)} />
}
