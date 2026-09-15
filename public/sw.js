/*
 * 圏外や電波の悪いところで、真っ白にしないためだけのもの。
 *
 * 考え方：
 *  - 旅の中身は絶対にためない。古い「手配済み」を見せるほうが、
 *    見られないより危ない。遠征で取り返しがつかないのは見落としなので。
 *  - ためるのは、見た目を作るためのもの（JS・CSS・書体・アイコン）だけ。
 *    これらは名前に指紋が入っていて、変われば別の名前になる。
 *  - 画面そのものは必ず取りに行く。取れなかったときだけ、案内を出す。
 */
const VERSION = 'v1'
const SHELL = `shell-${VERSION}`

self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open(SHELL).then((c) => c.add('/offline.html')))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** 名前に指紋が入っていて、中身が変わらないもの */
const isStatic = (url) =>
  url.origin === self.location.origin &&
  (url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.webmanifest'))

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // データベースへの行き来には一切触らない
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) return

  if (isStatic(url)) {
    e.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(SHELL).then((c) => c.put(request, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  // 画面は必ず取りに行く。取れなかったときだけ案内を出す。
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/offline.html')))
  }
})
