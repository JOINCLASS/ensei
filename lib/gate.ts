import 'server-only'

/**
 * 招待制にするかどうか。既定は「しない」。
 *
 * もともとは Supabase 側で新規登録を閉じて止めていたが、それだとアプリから
 * 切り替えられず、ダッシュボードを触らないと戻せなかった。
 * Supabase は常に開いておき、判定はここに一本化する。
 *
 * 招待制に戻したいときだけ INVITE_ONLY=true を明示する。
 * 環境変数を入れ忘れた環境（プレビューなど）が、誰も登録できない状態で
 * 立ち上がらないように、既定は開いておく。
 */
export const inviteOnly = () => process.env.INVITE_ONLY === 'true'
