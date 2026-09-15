import { itemLabel, itemSub, md, nights, STATUS } from '@/lib/logic'
import type { Trip } from '@/lib/types'

/**
 * 入力した内容を手元に持ち出すための書き出し。
 *
 * このアプリのデータベースは無料プランで、自動バックアップが無い。
 * 消えたときに取り返せる唯一の手段がこれなので、
 * 「読んで分かる」「表で開ける」「そっくり戻せる」の3通りを用意する。
 */
export type Format = 'text' | 'csv' | 'json'

export const FILENAME: Record<Format, string> = {
  text: 'tehaimatome.txt',
  csv: 'tehaimatome.csv',
  json: 'tehaimatome.json',
}

const TYPE: Record<Format, string> = {
  text: 'text/plain;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  json: 'application/json;charset=utf-8',
}

/** 人が読むためのもの */
function toText(trips: Trip[]) {
  const lines = trips.flatMap((t) => {
    const n = nights(t.start, t.end)
    return [
      `■ ${t.title}`,
      `　${t.place || '行き先なし'}　${md(t.start)}〜${md(t.end)}　${n > 0 ? `${n}泊` : '日帰り'}`,
      ...(t.memo ? [`　メモ：${t.memo}`] : []),
      ...t.items.map((i) => {
        const sub = itemSub(i)
        return `　・${itemLabel(i)}：${STATUS[i.status]}${i.name ? `　${i.name}` : ''}${sub ? `　${sub}` : ''}${i.memo ? `　（${i.memo}）` : ''}`
      }),
      '',
    ]
  })
  return ['手配まとめ　書き出し', `旅 ${trips.length}件`, '', ...lines].join('\n')
}

/**
 * 表計算で開くためのもの。
 * 中身に , や " や改行が混ざっても壊れないよう、必ず " で囲って " は2つにする。
 */
const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`

function toCsv(trips: Trip[]) {
  const head = ['旅', '行き先', '出発', '帰り', '泊数', '旅のメモ', '手配', '状態', '名前', '出発地', '到着地', '日時', '手配のメモ']
  const rows = trips.flatMap((t) =>
    (t.items.length ? t.items : [null]).map((i) => [
      t.title, t.place, t.start, t.end, nights(t.start, t.end), t.memo,
      i ? itemLabel(i) : '', i ? STATUS[i.status] : '', i?.name ?? '',
      i?.from ?? '', i?.to ?? '', i ? itemSub(i) : '', i?.memo ?? '',
    ]),
  )
  // Excel が UTF-8 と分かるように先頭へ印を置く。これが無いと日本語が化ける。
  return '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

/** そっくり戻せるようにするためのもの */
const toJson = (trips: Trip[]) =>
  JSON.stringify({ app: '手配まとめ', version: 1, trips }, null, 2)

export function build(trips: Trip[], format: Format) {
  const body = format === 'csv' ? toCsv(trips) : format === 'json' ? toJson(trips) : toText(trips)
  return new Blob([body], { type: TYPE[format] })
}
