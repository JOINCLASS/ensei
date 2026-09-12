import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '手配まとめ',
    short_name: '手配まとめ',
    description: '遠征の予定を、どの旅の何がまだかでひと目で見られるようにする。',
    lang: 'ja',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#EEEDF4',
    theme_color: '#EEEDF4',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
