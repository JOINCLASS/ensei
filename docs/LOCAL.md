# ローカルで動かす

Supabase を Docker で丸ごとローカルに立てて開発する。クラウドのプロジェクトは要らない。

## 用意するもの

- Docker Desktop（起動しておく）
- Supabase CLI … `brew install supabase/tap/supabase`
- Node.js 20 以上

## はじめかた

```bash
supabase start        # 初回は Docker イメージの取得で数分かかる
cp .env.local.example .env.local
npm install
npm run dev           # http://localhost:3000
```

3000番がふさがっていると 3001番などにずれる。起動時の出力を見ること。
```

`supabase start` は最後に鍵の一覧を出す。`.env.local.example` の値はその出力と同じで、
**ローカルは誰の環境でも固定値**なので、書き換えずにコピーするだけでよい。

## つなぎ先

| | URL |
|---|---|
| アプリ | http://localhost:3000 |
| Supabase Studio（表の中身を見る） | http://127.0.0.1:54323 |
| メール受信箱 Mailpit（**ログインコードはここに届く**） | http://127.0.0.1:54324 |
| API | http://127.0.0.1:54321 |
| Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

## ログインのしかた

本物のメールは飛ばない。

1. ログイン画面でメールアドレスを入れる（何でもよい。例 `me@example.com`）
2. **Mailpit** http://127.0.0.1:54324 を開く
3. 届いたメールの6桁のコードをアプリに入れる

**別のユーザーで試すとき**は、違うメールアドレスを入れるだけでよい。
`me@example.com` と `you@example.com` で、お互いの旅が見えないことを確かめられる。

## 見た目と動きを確かめる

開発サーバーを立てた状態で。

```bash
npm run verify      # 参照HTMLと同じサンプルを入れて 390×844 で撮り、画素単位で見比べる
npm run behaviour   # 状態の切り替え・入力シート・削除・保存などを通しで動かす
```

`npm run verify` は `shots/` に画像を出す。`diff-*.png` は違うところが赤く出る。
3000番以外で動かしているときは `APP_URL=http://localhost:3001 npm run verify`。

## よく使うコマンド

```bash
supabase start           # 起動
supabase stop            # 停止（データは残る）
supabase stop --no-backup  # 停止してデータも消す
supabase status          # 状態と鍵の一覧
supabase db reset        # DBを作り直して supabase/migrations/ を全部あて直す
```

`supabase/migrations/` の SQL を直したら `supabase db reset` で反映する。

## 本番の Supabase に上げるとき

```bash
supabase link --project-ref <プロジェクトのID>
supabase db push
```

同じマイグレーションがそのまま通る。テーブルの作成・権限（GRANT）・RLS・
自動4項目のトリガまで、すべて `supabase/migrations/` に入っている。

本番では、認証メールのテンプレートに6桁コード `{{ .Token }}` を載せる設定が要る
（既定のテンプレートはリンクだけでコードが載らない）。
中身は `supabase/templates/magic_link.html` と同じでよい。

---

# 本番

| | |
|---|---|
| アプリ | https://ensei-nu.vercel.app （Vercel `githubkyos-projects/ensei`） |
| Supabase | `qxyubrqtelvciwoszjlc`（東京 ap-northeast-1） |
| メール | Resend（送信専用キー `supabase-auth-ensei`） |

## 本番に変更を反映する

```bash
supabase db push          # テーブル・RLS・トリガ
supabase config diff      # ★ config push の前に必ず見る
supabase config push
vercel deploy --prod      # アプリ
```

**`supabase config push` は config.toml が宣言している項目をすべて押す。**
使っていない設定を宣言に残すと、本番の設定を巻き込んで壊す。
（実際に MFA の無効化や pooler の接続数半減が起きかけた）
必ず `supabase config diff` で「押される項目」を確認してから実行すること。

## 本番の確認

```bash
npm run prod:check      # ログイン・登録・保存・現地時刻を通しで
npm run prod:security   # RLS への攻撃20種
```

## ログイン状態の確認

```bash
npm run session   # Cookie の属性・ブラウザ再起動・トークン更新・ログアウト
```

セッションは **Cookie のみ**に入る（localStorage は使わない）。
`proxy.ts` が毎リクエスト `getUser()` を呼んでトークンを更新するので、
アクセストークンの期限（1時間）が切れても締め出されない。

Cookie は 400日。`secure` は本番だけ付く（localhost は http のため）。
`httpOnly` は付けられない — `createBrowserClient` が `document.cookie` で
読み書きするため、付けるとブラウザ側からセッションが読めなくなり、
`lib/db.ts` のDB操作が動かなくなる。

### iOS の Safari で確かめる

iOS の ITP は **JavaScript が書いた Cookie を7日で消す**ことがある。
`proxy.ts` がサーバーから `Set-Cookie` で書き直しているので回避できている
はずだが、実機で見ないと確証はない。

1. Safari で本番URLを開いてログイン
2. 共有 → ホーム画面に追加
3. Safari を完全に終了し、ホーム画面のアイコンから起動
   （iOS ではPWAとSafariでCookieの保管庫が別。ここで再ログインを求められたら、
     PWAの中でログインし直してから以降を確認する）
4. iPhone を再起動して、もう一度アイコンから起動
5. **1週間後にもう一度開く** ← ITP の本番の確認はここ

5で切れるようなら、書き込みを Server Actions に移して
サーバーから Cookie を書く形にする必要がある。

どちらも `.env.local` の `SUPABASE_SECRET`（Supabaseの秘密鍵）を使う。
`prod:check` はメールを送らず、管理APIでコードを作って検証する。

## メール

送信元は **`noreply@paspoy.com`**（Resend で認証済み）。誰にでも送れる。

`joinclass.jp` を使おうとして詰まった経緯：
`.jp` レジストリは `joinclass.jp` を **ns-rs1/ns-rs2.gmoserver.jp** に委任している。
`01〜04.dnsv.jp`（`joinclass.co.jp` と `paspoy.com` の権威サーバー）に
レコードを入れても、そこへは誰も聞きに来ないので Resend は見つけられない。
`joinclass.jp` で送りたくなったら、gmoserver 側のゾーン
（お名前.com レンタルサーバーのコントロールパネル）に入れること。

## いまの制約
- **新規登録は閉じている**（`auth.enable_signup = false`）。アプリ内に招待機能はない。
  人を増やすときは Supabase ダッシュボードの
  **Authentication → Users → Invite user** から招待する
- アプリ側は `shouldCreateUser: false` で送る。true にすると、
  既存ユーザーでも「登録しようとした」と見なされて弾かれる
- legacy の anon / service_role キーは無効化済み。
  新しい publishable / secret キーだけを使うこと

## 招待について

**アプリの中から招待できる。** 一覧の下の「友だちを招待」でリンクが出るので、
それを渡す。渡された人は自分のメールアドレスで登録してログインできる。

- 1枚につき1人だけ。14日で期限が切れる
- 未使用の招待は1人5枚まで（DBのトリガで止めている）
- **旅の中身は共有されない。** 招待した人とされた人は、互いのデータが見えない

```bash
npm run invite   # 招待リンクの流れを通しで確かめる
```

引き換えには管理者権限の鍵が要る（招待された人はまだログインしていないため）。
`SUPABASE_SECRET_KEY` をサーバー側だけで使っている。`lib/supabase/admin.ts` に
`server-only` を付けてあるので、クライアントから読み込むとビルドが落ちる。

Supabase ダッシュボードから直接招待することもできる。

Authentication → Users → **Invite user** → メールアドレスを入れる

招待された人は、届いたメールのリンクを踏むだけで確認済みになり、
そのままログインした状態でアプリが開く。コードの入力は要らない。

```bash
npm run prod:invite   # 招待の流れを通しで確かめる（メールは送らない）
```

### 注意：招待リンクは「#」でトークンを返す

`/auth/v1/verify` からの戻りは `#access_token=...` という形式で、
URLの「#」以降はサーバーに届かない。**ブラウザ側で拾う必要がある。**

`@supabase/ssr` は PKCE 方式（`?code=`）で動くため、`detectSessionInUrl`
には任せられない（この形式を受け付けない）。`components/LoginForm.tsx` で
フラグメントを自分で読み、`setSession()` に渡している。

これを外すと「リンクを踏んだのにログイン画面が出る」行き止まりに戻る。
