# DESIGN.md — 手配まとめ

> この文書の中の `遠征の手配` は、参照HTML（`design/ensei.html`）に書かれている
> とおりの文言。アプリの名前は後から **手配まとめ** に変えたので、
> 見出し・タブ・ホーム画面の3箇所だけが実装と異なる。それ以外は参照HTMLのまま。

**正解は `design/ensei.html`。** この文書はその棚卸しであり、上書きではない。
実装中に判断に迷ったら、この文書ではなく参照HTMLの実物を見ること。

参照HTMLの `<style>`（L11–143）は**一字も変えずに** `app/globals.css` へ移植する。
Tailwind / shadcn / MUI は導入しない。

---

## 1. デザイントークン

### 1-1. CSS変数（参照HTML `:root` L12–15、そのまま）

| 変数 | 値 | 用途 |
|---|---|---|
| `--bg` | `#EEEDF4` | 画面の背景。半券の丸い切り欠きの色にも使う |
| `--paper` | `#FFFFFF` | カード・シート・丸の地 |
| `--ink` | `#221F33` | 文字、主ボタン、枠線（濃） |
| `--muted` | `#6E6A82` | 補助文字、当落待ちの点線・「待」 |
| `--line` | `#DCDAE6` | 罫線、入力欄の枠、点線の切り取り線 |
| `--danger` | `#C0392B` | 削除 |
| `--font` | `'Zen Maru Gothic','Hiragino Maru Gothic ProN','Hiragino Sans','Noto Sans JP',system-ui,sans-serif` | 全体 |

`<meta name="theme-color">` = `#EEEDF4`。

### 1-2. フォント

- Zen Maru Gothic、ウェイトは **500 / 700 / 900 の3つだけ**。
- `body` の既定は `font-weight:500`。太字はすべて `700` か `900` を明示。
- 参照HTMLは Google Fonts の `<link>`。実装では **`next/font/google`** で
  `Zen_Maru_Gothic({ weight:['500','700','900'], subsets:['latin'] })` を読み、
  `--font` の先頭をそのフォント変数に差し替える。代替以降の並びは変えない。
  （`subsets` に日本語はない。`display:'swap'` で参照と同じ挙動）

### 1-3. 推し色 9色（参照HTML `COLORS` L151–161、順序どおり）

| # | id | name | hex | on（上に載る文字色） |
|---|---|---|---|---|
| 1 | `red` | 赤 | `#E5484D` | `#fff` |
| 2 | `pink` | ピンク | `#F76FA8` | `#fff` |
| 3 | `orange` | オレンジ | `#F7934C` | `#fff` |
| 4 | `yellow` | 黄 | `#F5C400` | `#221F33` |
| 5 | `green` | 緑 | `#30A46C` | `#fff` |
| 6 | `sky` | 水色 | `#3DB6E8` | `#fff` |
| 7 | `blue` | 青 | `#3E63DD` | `#fff` |
| 8 | `purple` | 紫 | `#8E4EC6` | `#fff` |
| 9 | `white` | 白 | `#FFFFFF` | `#221F33` |

**既定は `purple`。** 不明なidが来たときのフォールバックも `COLORS[7]`＝`purple`（L197）。

色の当て方（`oshiStyle()` L198）。カード単位に**インラインstyleで3変数**を流す：

```
--oshi: <hex>
--on-oshi: <on>
--oshi-edge: white のときだけ #221F33、それ以外は hex と同じ
```

`--oshi-edge` は白い推し色が白い紙の上で消えないための縁色。白以外では本体色と同じなので見た目に出ない。

半券の地は `color-mix(in srgb, var(--oshi) 22%, #fff)`。

### 1-4. 寸法・形

- 画面幅 `max-width:480px`、`margin:0 auto`。
- `.app` の余白：`padding: max(16px, env(safe-area-inset-top)) 16px calc(48px + env(safe-area-inset-bottom))`
- 角丸：カード/シート内カード `14px`、シート上端 `18px 18px 0 0`、入力欄 `10px`、
  タグ・チップ `6px`、ボタン・丸 `999px` / `50%`
- 影は `box-shadow: inset` の擬似ボーダーのみ（`.btn.ghost`、`.seg span`、`.sw` など）。
  **落ち影・グラデーション・アイコンフォント・装飾は一切足さない。**

---

## 2. 部品

### 2-1. ボタン（L26–32）

| class | 見た目 |
|---|---|
| `.btn` | 塗り `--ink` / 白文字 / `border-radius:999px` / `padding:10px 16px` / `font-size:15px` / `font-weight:700` |
| `.btn.ghost` | 透明地、`--ink` 文字、`inset 0 0 0 1.5px var(--line)` |
| `.btn.danger` | 透明地、`--danger` 文字、`inset 0 0 0 1.5px #E9C3BE` |
| `.btn.danger[data-armed]` | 塗り `--danger` / 白文字 / 影なし（＝2回押しの1回目のあと） |
| `.btn.wide` | `flex:1`、`padding:13px 16px` |
| `.linkbtn` | 地なし・枠なし、`font-weight:700`、`padding:10px 0`、`font-size:15px` |

フォーカス可視：`:focus-visible{outline:3px solid var(--ink);outline-offset:2px}`（全体共通）

### 2-2. 旅カード＝半券（`.ticket` L40–52、`ticketHTML()` L226–251）

崩してはいけない骨格：

- `display:grid; grid-template-columns:76px 1fr`、`background:var(--paper)`、`border-radius:14px`、`margin:0 0 16px`
- **丸い切り欠き**：`::before` / `::after`。`position:absolute; left:76px; width:18px; height:18px;
  border-radius:50%; background:var(--bg); transform:translateX(-50%)`。
  `::before{top:-9px}` / `::after{bottom:-9px}` ＝カードの上下に半分ずつはみ出す。
- **左の半券 `.stub`（幅76px）**：地は `color-mix(...22%...)`、
  左辺に `border-left:6px solid var(--oshi-edge)`、
  右辺に **`border-right:2px dashed var(--line)` ＝切り取り線**、`border-radius:14px 0 0 14px`
- 半券の中身（上から）：`◯月`(12px/700/muted) → `日`(36px/900/tabular-nums) → `曜`(12px/700) → `◯泊` or `日帰り`(11px/700/muted, margin-top:8px)
- 右 `.tbody`：`padding:14px 14px 14px 18px`（左だけ18px＝切り取り線からの逃げ）
- 終わった旅は `.ticket.past{opacity:.55}`

**手配状況の丸 `.pch i`（26px、カード内）** — 3状態：

| 状態 | 丸 | 文字色 |
|---|---|---|
| `s-todo`（まだ） | 白地 `--paper` ＋ `2px solid var(--ink)`、中身なし | `--ink` |
| `s-done`（手配済み） | 塗り `--oshi`、枠 `--oshi-edge`、`::after` に **`✓`**（14px/900/`--on-oshi`） | `--muted` |
| `s-wait`（当落待ち） | 白地、**点線** `border-style:dashed` 枠 `--muted`、`::after` に **`待`**（11px/900/`--muted`） | `--muted` |

丸の下にラベル（10.5px/700）。表示は**先頭6件まで**、超過分は `.pch.more` に `+N`。

### 2-3. 手配状況の丸ボタン（`.punch-btn` 44px、詳細画面 L92–97）

- `44px × 44px`、`border-radius:50%`、`border:2.5px solid var(--ink)`、地 `--paper`、`font-size:19px`、`font-weight:900`
- 手配済み：地 `--oshi` / 枠 `--oshi-edge` / 文字 `--on-oshi`、中身は **`✓`**
- 当落待ち：点線枠 `--muted`、文字 `--muted`、`font-size:13px`、中身は **`待ち`**（カード内の「待」とは別の文字列）
- まだ：中身は空文字
- `transition: background-color .18s`
- **タップで縮んで戻る**：`.pop` クラス付与 → `@keyframes pop{0%{scale(1)}35%{scale(.8)}100%{scale(1)}}` `.3s ease`
  再描画後に丸へ `.pop` を付け、`focus({preventScroll:true})` でフォーカスを戻す（L499–506）
- `prefers-reduced-motion:reduce` で `pop` とシートのアニメ、`punch-btn`/`prog-bar` の transition を停止

### 2-4. 進み具合のバー（`.prog-bar` L85–86）

`height:8px`、地 `--bg`、`border-radius:99px`、中身 `span` は `background:var(--oshi)` ＋
`inset 0 0 0 1px var(--oshi-edge)`、`transition:width .25s`。幅は `Math.round(done/total*100)%`。

### 2-5. 旅の見出し（`.trip-head` L79）

`background:var(--paper)`、`border-radius:14px`、`padding:26px 18px 18px`、
**`box-shadow: inset 0 8px 0 var(--oshi-edge)`（上辺の推し色の帯）**。

### 2-6. 手配項目リスト（`.items` / `.item` L89–108）

`ul` に紙地＋角丸14px。各 `li` は `display:flex; gap:14px; padding:14px`、
`border-bottom:1px solid var(--line)`（最後だけなし）。
行の中身は「丸ボタン」＋「押せる本文 `.item-main`」の2つのボタン。

タグ（`.tag`）：
- `tag-todo` = `--ink` 塗り / 白文字
- `tag-wait` = `inset 0 0 0 1.5px var(--muted)` / `--muted`
- `tag-done` = 文字 `--muted` のみ、`padding-left:0`

`.add-item`：全幅・`border:2px dashed var(--line)`・角丸14px・地なし・`--muted`。

### 2-7. 入力シート（`.overlay` / `.sheet` L111–134）

- 覆い：`position:fixed; inset:0; background:rgba(34,31,51,.45)`、`align-items:flex-end`（＝**下寄せ**）、`z-index:10`
- シート：`max-width:480px`、`max-height:92vh`、`overflow:auto`、`border-radius:18px 18px 0 0`、
  `padding:20px 18px calc(18px + env(safe-area-inset-bottom))`
- **下から出る**：`@keyframes up{from{translateY(28px);opacity:.5} to{none;opacity:1}}` `.22s ease`
- 入力欄：`border:1.5px solid var(--line)`、角丸10px、`padding:11px 12px`、
  **`font-size:16px`（iOSの自動ズーム回避）**、`min-height:46px`、フォーカスで枠が `--ink`
- `.row` = `grid-template-columns:1fr 1fr; gap:10px`（2列）
- `.seg`：ラジオを丸ピルに。未選択は `inset 0 0 0 1.5px var(--line)`、選択は `--ink` 塗り・白文字
- `.swatches`/`.sw`：34pxの丸。選択時は `0 0 0 3px var(--paper), 0 0 0 5px var(--ink)` の二重リング
- 覆いの余白クリックで閉じる。Escでも閉じる。
- 開いたとき、最初の `input:not([type=radio])` か `textarea` に 50ms 後フォーカス

### 2-8. トースト（`.toast` L136–137）

画面下中央固定、`--ink` 塗り・白文字・`border-radius:999px`、`padding:10px 18px`、
`font-size:14px/700`、`z-index:20`、`role="status"`。**1800ms で消える。**

---

## 3. 文言（変更禁止・全文）

### 3-1. 固定辞書

```
TYPES  = { ticket:'チケット', go:'行き', back:'帰り', hotel:'ホテル', other:'その他' }
STATUS = { todo:'まだ', wait:'当落待ち', done:'手配済み' }
WD     = '日月火水木金土'
```

### 3-2. 一覧

| 場所 | 文言 |
|---|---|
| 見出し | `遠征の手配` |
| 追加ボタン | `＋ 旅を追加` |
| 要約・まだあり | `<b>◯つの旅で、まだの手配が◯件</b>あります。` ＋ 当落待ちがあれば `当落待ちは◯件です。` |
| 要約・まだなし当落待ちあり | `まだの手配はありません。当落待ちが◯件あります。` |
| 要約・全部済み | `これからの遠征◯件は、すべて手配済みです。` |
| 要約・これからなし | `これからの遠征は登録されていません。` |
| カード内チップ | `まだ` / `当落待ち`（後ろに項目名を `、` 区切りで） |
| カード内・全部済み | `すべて手配済み` |
| カード内・項目0 | `手配の項目がありません` |
| 終わった旅 | `▸ 終わった旅（◯）` / 開いているとき `▾ 終わった旅（◯）` |
| 半券 | `◯月` / `◯` / `曜` / `◯泊` または `日帰り` |
| aria-label（カード） | `{title}、{range}。まだの手配{n}件` |

**空のとき：**
```
遠征の予定を登録すると、
どの旅の何が手配済みで、何がまだかが
ここにひと目で並びます。
```
（`<br>` の位置もそのまま）
ボタン：`＋ 最初の旅を追加` ／ `サンプルで見てみる`

### 3-3. 旅の詳細

| 場所 | 文言 |
|---|---|
| 左上 | `‹ 一覧にもどる` |
| 右上 | `旅を編集` |
| 日付行 | `{M/D} {曜} 〜 {M/D} {曜}　{◯泊 or 日帰り}`（全角スペース1つ前置き） |
| 進み具合 | `◯つのうち◯つ手配済み` ＋ 当落待ちがあれば `、当落待ち◯つ` |
| 項目なし | `手配の項目がありません。下のボタンから追加できます。` |
| 追加ボタン | `＋ 手配を追加` |
| 未入力の行 | `タップして詳細を入力` |
| 丸の中身 | 手配済み `✓` ／ 当落待ち `待ち` ／ まだ 空 |
| 丸の aria-label | `{項目名}：{状態}。タップで「{次の状態}」にする` |

### 3-4. 旅のシート

| 場所 | 文言 |
|---|---|
| 見出し | `旅を追加` / `旅を編集` |
| 公演・イベント名 | placeholder `例：ツアー大阪公演` |
| 行き先・会場 | placeholder `例：大阪・京セラドーム` |
| 出発する日 / 帰る日 | （type=date） |
| 推し色 | legend。各色は視覚的に隠した `<em class="vh">` に色名 |
| メモ | placeholder `例：2日目は昼公演`、rows=2 |
| 新規時の注記 | `チケット・行き・帰り・ホテルの4項目が自動で入ります。` |
| ボタン | `削除`（編集時のみ） / `やめる` / `追加する` or `保存する` |

**入力エラー（`.err`、上から順に判定）：**
```
公演・イベント名を入れてください。
出発する日を選んでください。
帰る日は、出発する日と同じか後の日にしてください。
```

### 3-5. 手配のシート

| 場所 | 文言 |
|---|---|
| 見出し | `手配を追加` / `手配を編集` |
| 種類（seg） | `チケット` `行き` `帰り` `ホテル` `その他` |
| 状態（seg） | `まだ` `当落待ち` `手配済み` — **`当落待ち` は種類がチケットのときだけ表示** |
| 出発 / 到着（地名） | placeholder：行きは `例：東京` / `例：新大阪`、帰りは `例：新大阪` / `例：東京` |
| メモ | placeholder `予約番号、座席、キャンセル期限など`、rows=2 |
| ボタン | `削除`（編集時のみ） / `やめる` / `追加する` or `保存する` |

**名前欄のラベルとplaceholder（`NAME_LABEL` L164–170）：**

| 種類 | ラベル | placeholder |
|---|---|---|
| ticket | 公演・席など | 例：FC先行 スタンド |
| go | 便名・列車名 | 例：のぞみ21号 7号車 |
| back | 便名・列車名 | 例：のぞみ48号 |
| hotel | ホテル名 | 例：〇〇ホテル梅田 |
| other | 内容 | 例：レンタカー、ツアーバス |

**日時欄のラベル（種類で変わる）：** ticket→`開演日時`、other→`日時`、go/back→`出発日時`。到着側は常に `到着日時`。
ホテルは `チェックイン` / `チェックアウト`。

**種類ごとの欄の出し分け（`VIS` L404）：**

| 欄 | 出る種類 |
|---|---|
| `fromto`（出発・到着の地名） | go, back |
| `dep`（日時） | go, back, ticket, other |
| `arr`（到着日時） | go, back |
| `hotel`（チェックイン/アウト） | hotel |

種類をチケット以外に変えたとき、状態が `当落待ち` なら `まだ` に戻す。

### 3-6. 削除（2回押し）

`削除` を押す → ボタンの文字が **`もう一度押すと削除`** に変わり `data-armed` が付く（`.btn.danger[data-armed]` で赤塗り）→ もう一度押すと確定。

### 3-7. トースト

```
旅を追加しました / 保存しました / 旅を削除しました
手配を追加しました / 手配を削除しました
```
（参照HTMLの `保存できませんでした。もう一度お試しください` はローカル保存用。
Supabase版では通信失敗時のトーストとして同じ文言を使う。）

### 3-8. 実装で出さない文言

`試作版のため、このページを閉じると入力した内容は消えます。`
— 参照HTMLで `persistent === false` のときだけ出る注記。Supabaseに保存する実装では**常に出さない**。

---

## 4. 表示ロジック（そのまま移植）

| 関数 | 中身 |
|---|---|
| `md(s)` | `M/D`（ゼロ埋めなし） |
| `wd(s)` | `日月火水木金土` から1文字 |
| `nights(a,b)` | `(b - a) / 86400000` を四捨五入。0なら `日帰り` |
| `isPast(t)` | `(end ?? start) < 今日` |
| `dtParts(s)` | `'YYYY-MM-DDTHH:mm'` を `{d, t}` に。時刻は先頭の `0` を1つ落とす（`08:30`→`8:30`） |
| `nextStatus(i)` | ticket: `todo→wait→done→todo`、それ以外: `todo⇄done` |
| `stats(t)` | 項目を状態別に数える |

**並び順：** 一覧は `start` の昇順。これからの旅はその順、終わった旅は `reverse()`（＝新しい順）で下に。

**`itemSub(i)`（行の2段目）：**
- go / back：`{出発日 M/D}　{出発地 時刻} → {到着地 時刻}`。両側とも空なら日付だけ。片側が空なら `—`
- hotel：`{M/D}〜{M/D}　◯泊`（チェックインがなければ空）
- ticket：`開演 {M/D} {H:mm}`
- other：`{M/D} {H:mm}`

**日付の扱い：** `parseD()` は `new Date(y, m-1, d)` ＝**ローカル時刻**で組む。UTCパースは使わない。

---

## 5. データの対応づけ

参照HTMLのキー名と、Supabaseの列名の対応。**画面側は参照HTMLのキー名で扱い、境界で変換する。**

### trips

| 参照HTML | Supabase |
|---|---|
| `id` | `id` (uuid) |
| — | `user_id` (既定 `auth.uid()`) |
| `title` | `title` (必須) |
| `place` | `place` |
| `start` | `start_date` (必須) |
| `end` | `end_date` (必須) |
| `color` | `color` (既定 `'purple'`) |
| `memo` | `memo` |
| `items[]` | → `arrangements` テーブル |

参照HTMLでは `end` が空なら `start` を入れていた（L429）。DBの `end_date` は必須なので同じ規則をそのまま使う。

### arrangements

| 参照HTML | Supabase |
|---|---|
| `id` | `id` (uuid) |
| — | `trip_id`（旅を消したら一緒に消える）, `user_id` |
| `type` | `type` (`ticket`/`go`/`back`/`hotel`/`other`) |
| `status` | `status` (`todo`/`wait`/`done`) |
| `name` | `name` |
| `from` | `from_place` |
| `to` | `to_place` |
| `dep` | `depart_at` |
| `arr` | `arrive_at` |
| `checkIn` | `check_in` |
| `checkOut` | `check_out` |
| `memo` | `memo` |
| （配列の順） | `position` |

**`depart_at` / `arrive_at` は入力した現地時刻をそのまま保存する。**
`datetime-local` が返す `'YYYY-MM-DDTHH:mm'` を、タイムゾーン変換なしで保存し、
読み出したら先頭16文字を入力欄に戻す。海外遠征で「現地の9:15発」が
端末のタイムゾーンでずれないようにするため。列の型は `timestamp`（without time zone）。

**新規作成時の自動4項目**（`defaultItems()` L216）：
`ticket`, `go`, `back`, `hotel` を `status:'todo'` で、この順に `position` 0..3。

---

## 6. 画面の構成（Next.js App Router）

| ルート | 中身 | 参照HTMLの対応 |
|---|---|---|
| `/login` | メールのワンタイムコード（Supabase Auth）。**参照HTMLにない画面**なので、既存のトークンと部品（`.empty` の枠 + `.field` + `.btn` + `.err` + `.toast`）だけで組む | なし |
| `/` | 一覧 | `renderList()` |
| `/trips/[id]` | 旅の詳細 | `renderTrip()` |
| （シート） | 旅の追加/編集・手配の追加/編集 | `tripSheet()` / `itemSheet()` |

- シートは画面遷移ではなく、参照HTMLと同じく同一画面上のオーバーレイ。
- PWA：`app/manifest.ts` に name `遠征の手配`、`display:'standalone'`、
  `background_color`/`theme_color` を `#EEEDF4`、アイコンを用意。

---

## 7. 作らないもの

AIでのメール読み取り、通知、持ち物リスト、友だちとの共有、課金。

---

## 8. 提案（実装はしない。指示があれば入れる）

参照HTMLに忠実であることを優先し、以下は**今は入れない**。気づいた点として挙げるだけ。

1. **`サンプルで見てみる`** — 参照HTMLでは空のときだけ出る。Supabase版ではログイン中の本人のデータとして
   サンプル4件を実際に作ることになる。参照どおり残す予定だが、実データに混ざるのを嫌うなら外せる。
2. **`.punches` の6件上限** — 参照HTMLは `slice(0,6)` で7件目以降を `+N` に畳む。自動4項目＋αなら
   ほぼ当たらないので、そのまま移植する。
3. **ネットワーク待ちの表示** — 参照HTMLはローカル保存なので即座に反映される。Supabase版は
   通信が挟まる。参照HTMLにスピナーの類がないので、**楽観的更新**（先に画面を変え、失敗したら戻して
   `保存できませんでした。もう一度お試しください` を出す）で見た目を変えずに合わせるつもり。
4. **`丸ボタン`のaria-label** — 状態名が「まだ→当落待ち→手配済み→まだ」と循環するため、
   チケットの `手配済み` の行は「タップで『まだ』にする」と読み上げる。参照どおり。
5. **ログアウト導線** — 参照HTMLにない。一覧の下（`.note` の位置）に `.linkbtn` で
   目立たない `ログアウト` を1つ置くのが最小だと考えているが、指示があれば場所を変える。

---

**ここで一度止まります。** 内容を確認いただけたら、ステップ2（SupabaseのテーブルとRLSのSQL）に進みます。
