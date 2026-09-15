import { cookies } from 'next/headers'
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
  if (error) return await sweep(request, NextResponse.redirect(new URL('/login?err=google', url.origin)))

  return await sweep(request, NextResponse.redirect(new URL(next, url.origin)))
}

/**
 * PKCE の途中で作られる使い捨てCookieを片づける。
 * 交換が済めば不要なのに、既定では400日残り、ログインのたびに増えていく。
 * メールのコードで入る側（LoginForm）では消していたが、
 * こちらを通る人の分が残ったままだった。
 */
async function sweep(request: NextRequest, response: NextResponse) {
  // Supabase 自身が書き込むのと同じ置き場を使う。
  // NextResponse 側だけに書くと、あちらの Set-Cookie に上書きされる。
  const store = await cookies()
  for (const { name } of request.cookies.getAll()) {
    if (!name.endsWith('-code-verifier')) continue
    // maxAge: 0 は偽値として落とされ、Set-Cookie に Max-Age が付かない。
    // それだと値が空になるだけで、Cookie自体は残る。期限を明示して消す。
    const gone = { expires: new Date(0), maxAge: 0, path: '/' }
    store.set(name, '', gone)
    response.cookies.set(name, '', gone)
  }
  return response
}

/**
 * 戻り先は自分のサイトの中だけに限る。
 * `//example.com` は「プロトコル相対」で外部に飛ぶので、あわせて弾く。
 */
function safeNext(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/'
  return value
}
