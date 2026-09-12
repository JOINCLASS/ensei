import { AboutView } from '@/components/AboutView'
import { createClient, getUser } from '@/lib/supabase/server'

/** ログインしていなくても読める（登録する前に中身を確かめられるように） */
export default async function Page() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  return <AboutView signedIn={!!user} />
}
