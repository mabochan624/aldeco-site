#!/usr/bin/env node
// 生成済みHTMLをCSS・画像ごと1ファイルに固めて、ユーザーに送れるプレビューを作る。
//   node tools/preview.mjs             … 一覧ページ
//   node tools/preview.mjs <slug>      … 記事ページ
// 出力: ALDECO_ブログ_*.html（.gitignore済み）

import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/posts.mjs';

const slug = process.argv[2];
const src = slug ? path.join(ROOT, 'blog', slug, 'index.html') : path.join(ROOT, 'blog', 'index.html');

if (!fs.existsSync(src)) {
  console.error(`見つかりません: ${path.relative(ROOT, src)}\n先に node tools/build.mjs を実行してください。`);
  process.exit(1);
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' };

const dataUri = (relPath) => {
  const abs = path.join(ROOT, relPath.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return null;
  const mime = MIME[path.extname(abs).toLowerCase()];
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(abs).toString('base64')}`;
};

let html = fs.readFileSync(src, 'utf8');

// CSSをインライン化（CSS内の画像URLも差し替える）
html = html.replace(/<link rel="stylesheet" href="(\/[^"]+\.css)">/g, (m, href) => {
  const abs = path.join(ROOT, href.replace(/^\//, ''));
  if (!fs.existsSync(abs)) return m;
  const css = fs.readFileSync(abs, 'utf8').replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (mm, q, url) => {
    const uri = dataUri(url);
    return uri ? `url(${uri})` : mm;
  });
  return `<style>\n${css}\n</style>`;
});

// 画像をインライン化
html = html.replace(/(src|href)="(\/img\/[^"]+)"/g, (m, attr, url) => {
  const uri = dataUri(url);
  return uri ? `${attr}="${uri}"` : m;
});

const out = path.join(ROOT, `ALDECO_ブログ_${slug || '一覧'}_プレビュー.html`);
fs.writeFileSync(out, html, 'utf8');
console.log(out);
