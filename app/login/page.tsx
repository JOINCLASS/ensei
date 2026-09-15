import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { createClient, getUser } from '@/lib/supabase/server'
import { inviteOnly } from '@/lib/gate'

const ERROR = {
  google: 'Googleでのログインができませんでした。もう一度お試しください。',
  nocode: 'ログインの途中で情報が失われました。もう一度お試しください。',
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>
}) {
  const supabase = await createClient()
  // すでにログインしている人にログイン画面を見せない
  if (await getUser(supabase)) redirect('/')

  const { err } = await searchParams
  return <LoginForm inviteOnly={inviteOnly()} initialError={ERROR[err as keyof typeof ERROR]} />
}
