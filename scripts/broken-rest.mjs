/**
 * データベースの読み書きだけが落ちている状態を作るための代理サーバー。
 *
 * サーバー側の取得はブラウザを通らないので、Playwright の route() では止められない。
 * ログイン（/auth/*）はそのまま通し、/rest/* だけ 503 を返す。
 */
import http from 'node:http'

const UP = 'http://127.0.0.1:54321'
const PORT = Number(process.env.BROKEN_PORT ?? 54399)

http
  .createServer(async (req, res) => {
    if (req.url.startsWith('/rest/')) {
      res.writeHead(503, { 'content-type': 'application/json' })
      return res.end('{"message":"database is down"}')
    }
    const body = []
    for await (const c of req) body.push(c)
    const up = await fetch(UP + req.url, {
      method: req.method,
      headers: { ...req.headers, host: '127.0.0.1:54321' },
      body: body.length ? Buffer.concat(body) : undefined,
      redirect: 'manual',
    })
    res.writeHead(up.status, Object.fromEntries(up.headers))
    res.end(Buffer.from(await up.arrayBuffer()))
  })
  .listen(PORT, () => console.log(`壊れたREST: http://127.0.0.1:${PORT}`))
