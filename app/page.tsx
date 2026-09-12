import { redirect } from 'next/navigation'
import { ListView } from '@/components/ListView'
import { TRIP_SELECT, toTrip } from '@/lib/map'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data } = await supabase.from('trips').select(TRIP_SELECT).order('start_date')
  return <ListView initialTrips={(data ?? []).map(toTrip)} />
}
