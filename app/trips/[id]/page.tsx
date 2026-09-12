import { notFound, redirect } from 'next/navigation'
import { TripView } from '@/components/TripView'
import { TRIP_SELECT, toTrip } from '@/lib/map'
import { createClient } from '@/lib/supabase/server'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('trips').select(TRIP_SELECT).eq('id', id).maybeSingle()
  if (!data) notFound()

  return <TripView initialTrip={toTrip(data)} />
}
