import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/LoginForm'
import { checkInvite } from '@/lib/invites'
import { createClient } from '@/lib/supabase/server'

const MESSAGE = {
  used: 'この招待はすでに使われています。',
  expired: 'この招待は期限が切れています。',
  unknown: 'この招待は見つかりませんでした。',
}

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params

  // すでにログインしている人を招待画面で迷わせない
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  const state = await checkInvite(code)
  if (state !== 'ok') {
    return (
      <>
        <header className="top"><h1>手配まとめ</h1></header>
        <section className="empty">
          <p>{MESSAGE[state]}<br />招待した人に、もう一度<br />リンクを出してもらってください。</p>
        </section>
      </>
    )
  }

  return <LoginForm inviteCode={code} />
}
