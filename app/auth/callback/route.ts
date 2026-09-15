import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Google から戻ってきたところ。
 *
 * @supabase/ssr は PKCE で動くので、ここに ?code= が付いて返ってくる。
 * それを交換してセッションのCookieを立てる。この受け口が無いと、
 * Googleの画面から戻ってきてもログインできない。
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))

  if (!code) {
    const reason = url.searchParams.get('error_description') ?? url.searchParams.get('error')
    return NextResponse.redirect(new URL(`/login?err=${reason ? 'google' : 'nocode'}`, url.origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) return NextResponse.redirect(new URL('/login?err=google', url.origin))

  return NextResponse.redirect(new URL(next, url.origin))
}

/**
 * 戻り先は自分のサイトの中だけに限る。
 * `//example.com` は「プロトコル相対」で外部に飛ぶので、あわせて弾く。
 */
function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
