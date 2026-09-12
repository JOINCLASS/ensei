#!/bin/bash
# 録画(webm)を mp4 に変換し、アプリと参照HTMLを左右に並べた動画も作る。
# 使い方: npm run e2e && npm run video
set -e
cd "$(dirname "$0")/../shots/video"
for f in *.webm; do
  [ -e "$f" ] || continue
  ffmpeg -y -loglevel error -i "$f" -c:v libx264 -pix_fmt yuv420p -crf 24 -movflags +faststart "${f%.webm}.mp4"
  rm "$f"
done
if [ -e "1-アプリ_一覧と詳細と編集シート.mp4" ] && [ -e "2-参照HTML_同じ操作.mp4" ]; then
  ffmpeg -y -loglevel error \
    -i "1-アプリ_一覧と詳細と編集シート.mp4" -i "2-参照HTML_同じ操作.mp4" \
    -filter_complex "[0:v]scale=390:844,pad=400:844:0:0:0x333333[l];[1:v]scale=390:844,pad=400:844:10:0:0x333333[r];[l][r]hstack=inputs=2" \
    -shortest "0-見比べ_左アプリ_右参照HTML.mp4"
fi
ls -la *.mp4
