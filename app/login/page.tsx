import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { createClient, getUser } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  // すでにログインしている人にログイン画面を見せない
  if (await getUser(supabase)) redirect('/')

  return <LoginForm />
}
