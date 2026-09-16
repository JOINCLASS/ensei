import { AboutView } from '@/components/AboutView'
import { createClient, getUser } from '@/lib/supabase/server'

/** ログインしていなくても読める（登録する前に中身を確かめられるように） */
export default async function Page() {
  const supabase = await createClient()
  const user = await getUser(supabase)
  // 既定は受け取る。入れ忘れた人に届かないほうが困る
  return <AboutView signedIn={!!user} remind={user?.user_metadata?.remind !== false} />
}
