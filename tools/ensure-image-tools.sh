#!/usr/bin/env bash
# セッション開始時に一度だけ走る。写真を縮小できる道具が無ければ入れる。
#
# クラウドのコンテナは使い捨てなので、何もしないと毎回「位置情報の削除だけ・縮小なし」
# の最下段に落ちる。4MBの写真がそのまま載ってしまうのを防ぐための下ごしらえ。
#
# 何が起きても絶対にセッションを止めない（常に exit 0）。

set -u

# すでに使える道具があるなら、何もしない。
command -v magick  >/dev/null 2>&1 && exit 0
command -v convert >/dev/null 2>&1 && exit 0
command -v ffmpeg  >/dev/null 2>&1 && exit 0
if command -v python3 >/dev/null 2>&1 && python3 -c 'import PIL' >/dev/null 2>&1; then exit 0; fi

# macOS: Homebrew があれば ImageMagick を入れる。
# macOS標準の sips は使わない。メタデータを確実に消せるか検証できていないため。
if command -v brew >/dev/null 2>&1; then
  echo "写真を縮小する道具が無いので ImageMagick を入れます（初回のみ・数分かかることがあります）..."
  if brew install imagemagick >/dev/null 2>&1; then
    echo "✅ ImageMagick を入れました。縮小・回転補正・HEICが使えます。"
  else
    echo "⚠ 入れられませんでした。写真は縮小なしで扱います（位置情報は必ず消えます）。"
  fi
  exit 0
fi

# Linux: apt-get があれば入れる。
# apt-get も brew も無い環境（代表のWindows PCなど）では何もしない。
command -v apt-get >/dev/null 2>&1 || exit 0

SUDO=""
if [ "$(id -u)" -ne 0 ] && command -v sudo >/dev/null 2>&1; then SUDO="sudo"; fi

echo "写真を縮小する道具が無いので ImageMagick を入れます（初回のみ・30秒ほど）..."
$SUDO apt-get update -qq  >/dev/null 2>&1 || exit 0
if $SUDO apt-get install -y -qq imagemagick >/dev/null 2>&1; then
  echo "✅ ImageMagick を入れました。縮小・回転補正・HEICが使えます。"
else
  echo "⚠ 入れられませんでした。写真は縮小なしで扱います（位置情報は必ず消えます）。"
fi
exit 0
