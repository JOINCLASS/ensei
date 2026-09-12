import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // AGENTS.md / CLAUDE.md を勝手に作らせない
  agentRules: false,
  // 開発中の丸いバッジを出さない（画面の見た目を参照HTMLと比べるため）
  devIndicators: false,
}

export default nextConfig
