# 遠征の手配

遠征の手配を、**どの旅の何がまだか**でひと目で見られるようにするWebアプリ。
Next.js（App Router）＋ Supabase。スマホ最優先、PWA対応。

## 画面

- **一覧** — これからの旅を日付順に。上に「◯つの旅で、まだの手配が◯件」の要約。終わった旅はたたんで下に
- **旅の詳細** — 日付、進み具合のバー、手配項目の一覧。丸をタップすると状態が変わる
- **入力シート** — 下から出るシートで旅と手配を編集。削除は2回押しで確定
- **ログイン** — メールのワンタイムコード（パスワードなし）

手配の状態は3つ。**まだ** / **当落待ち** / **手配済み**。
当落待ちはチケットだけで、チケットは まだ→当落待ち→手配済み→まだ と一周する。

## デザインについて

**`design/ensei.html` が正解。** この1枚のHTMLが見た目・文言・操作の完成形で、
実装はそれを移植したもの。`app/globals.css` は参照HTMLの `<style>` と1行（フォント指定）を除いて同一。

- Tailwind / shadcn / MUI などのUIキットは使わない
- 色・余白・角丸・サイズの値を変えない。影やグラデーションを足さない
- 画面の文言を変えない

トークン・部品・文言の一覧は **[docs/DESIGN.md](docs/DESIGN.md)**。

## はじめかた

Docker と [Supabase CLI](https://supabase.com/docs/guides/cli) が要る。

```bash
supabase start            # ローカルに Supabase 一式を立てる
cp .env.local.example .env.local
npm install
npm run dev               # http://localhost:3000
```

**ログインのコードは実際のメールでは届かない。** ローカルでは Docker の中の
Mailpit がすべて受け取る。http://127.0.0.1:54324 を開くか、こう打つ。

```bash
npm run code me@example.com
```

くわしくは **[docs/LOCAL.md](docs/LOCAL.md)**。

## データ

| テーブル | 中身 |
|---|---|
| `trips` | 旅。題名・行き先・日付・推し色・メモ |
| `arrangements` | 手配。チケット／行き／帰り／ホテル／その他 |

- RLS で本人のデータだけを読み書きできる
- 旅を作ると、チケット・行き・帰り・ホテルの4項目をトリガが自動で作る
- `depart_at` / `arrive_at` は **入力した現地時刻をそのまま保存**する（`timestamp without time zone`）。
  海外遠征で「現地の9:15発」が端末のタイムゾーンでずれないため

SQLは `supabase/migrations/`。本番へは `supabase db push` でそのまま通る。

## 確かめる

開発サーバーを立てた状態で。

```bash
npm run verify        # 参照HTMLと並べて撮り、画素単位で見比べる
npm run behaviour     # 状態の切り替え・入力シート・削除・保存を通しで
npm run sample        # サンプルを入れて片づける往復
npm run walkthrough   # 旅を1つ登録して手配完了まで（録画あり）
npm run walkthrough2  # 旅を2つ登録して一覧で見るまで（録画あり）
npm run e2e           # 上を全部
npm run security      # RLS を直接攻撃して破れないことを確かめる
npm run video         # 録画を mp4 に変換し、参照HTMLとの見比べ動画も作る
```

画像と動画は `shots/` に出る（gitには入れない）。

## そのほか

```bash
npm run build         # 本番ビルド
npm run typecheck     # 型だけ確認
npm run icons         # アプリのアイコンを作り直す（ICON_FLAT=1 で単色版）
```
