import type { CookieOptions } from '@supabase/ssr'

/**
 * セッションCookieの設定。
 *
 * @supabase/ssr の既定は path=/ sameSite=lax httpOnly=false maxAge=400日 で、
 * secure が入っていない。https で配るなら付けておくべきなので、ここで足す。
 * localhost は http なので、開発中は付けない（付けるとCookieが保存されない）。
 *
 * httpOnly は付けられない。createBrowserClient が document.cookie で
 * 読み書きするため、付けるとブラウザ側からセッションが読めなくなり、
 * lib/db.ts のDB操作が全部動かなくなる。
 */
export const cookieOptions: CookieOptions = {
  secure: process.env.NODE_ENV === 'production',
}
