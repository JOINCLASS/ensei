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
