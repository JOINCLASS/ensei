/**
 * Xに載せる文章と、その文字数。
 *
 *   npm run x-copy
 *
 * Xの数え方は2通りあって紛らわしい。
 *   ・画面の表示   … 日本語1文字=1、上限140（URLは23文字ぶん）
 *   ・内部の重み   … 日本語1文字=2、上限280
 * どちらでも収まることを確かめる。
 */
const LIGHT = [[0x0000, 0x10ff], [0x2000, 0x200d], [0x2010, 0x201f], [0x2032, 0x2037]]
const URL_RE = /https?:\/\/\S+/g

/** Xが実際に使う重み。URLは中身によらず23 */
const weighted = (text) => {
  const urls = text.match(URL_RE) ?? []
  let rest = text
  for (const u of urls) rest = rest.replace(u, '')
  let n = urls.length * 23
  for (const ch of rest) {
    const cp = ch.codePointAt(0)
    n += LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2
  }
  return n
}
const plain = (text) => {
  let n = 0
  for (const u of text.match(URL_RE) ?? []) n += 23 - [...u].length
  return [...text].length + n
}

const BIO = `遠征の予定、こんがらがってませんか？
チケット・行き・帰り・宿を旅ごとに一覧に。当落待ちのままの旅もひと目で。
Googleですぐ始められます。広告なし／入れたものは自分だけに見えます。`

const PINNED = `遠征の手配、何がまだか分かりますか？

チケット・行き・帰り・宿を、旅ごとに一覧に。
チケットは「当落待ち」にも。
広告なし／入れたものは自分だけ。

Googleですぐ始められます🙏
https://tehaimatome.com`

const POSTS = [
  `はじめまして。遠征の手配をまとめるアプリを作りました。
どの旅の、何がまだか。それだけが分かります。
https://tehaimatome.com`,

  `チケットだけは「まだ→当落待ち→手配済み」の3つにしています。
当落待ちのまま止まっている旅が、一覧で沈んで見えます。`,

  `パスワードはありません。Googleで続けるか、メールに届く6桁のコードだけ。
一度入れば、ログアウトしない限りそのままです。`,

  `ツアーの2公演目は、旅を複製して作れます。
手配の並びはそのまま、日付と手配の状態だけ空にして渡します。`,

  `入れた内容は、いつでも書き出せます。文章・表計算（CSV）・まるごと（JSON）の3つ。
合わなかったら、持って帰ってください。`,

  `名前も電話番号もいただきません。広告も出しません。
入れたものは、ご本人にしか見えないようにしています。`,
]

const show = (label, text, bioLimit = false) => {
  const w = weighted(text)
  const p = plain(text)
  const limit = bioLimit ? 160 : 140
  const ok = bioLimit ? p <= 160 : p <= 140 && w <= 280
  console.log(`\n── ${label}　${p}/${limit}文字${bioLimit ? '' : `（重み ${w}/280）`}　${ok ? 'OK' : '超過'}`)
  console.log(text.split('\n').map((l) => '   ' + l).join('\n'))
}

show('bio（160文字）', BIO, true)
show('固定ポスト', PINNED)
POSTS.forEach((t, i) => show(`ポスト${i + 1}`, t))
console.log()
