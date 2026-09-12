import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // すでにログインしている人にログイン画面を見せない
  if (user) redirect('/')

  return <LoginForm />
}
