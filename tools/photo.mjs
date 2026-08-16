#!/usr/bin/env node
// 現場写真をブログに載せられる形にする。
//
//   node tools/photo.mjs list [件数]        … 候補になる写真を新しい順に一覧
//   node tools/photo.mjs add <slug> <画像...> … 整えて img/blog/<slug>-N.jpg に保存
//
// 「整える」= 向きを直す / 長辺を縮める / JPEG再エンコード。
// 再エンコードで **EXIF（GPSの位置情報を含む）が消える**。現場写真にはお客様の家の
// 座標が入っているので、これは必須の処理。生の写真をそのまま公開してはいけない。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT, loadRules } from './lib/posts.mjs';

const rules = loadRules();
const cfg = rules.photos;
const OUT_DIR = path.join(ROOT, cfg.outDir);
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic']);

const expand = (p) => p.replace(/^~/, os.homedir()).replace(/%USERPROFILE%/gi, os.homedir());

/** 設定された取り込み元フォルダから、写真を新しい順に集める。 */
function collect() {
  const found = [];
  for (const src of cfg.sources) {
    const dir = expand(src.path);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (!EXTS.has(path.extname(name).toLowerCase())) continue;
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      if (!st.isFile()) continue;
      found.push({ abs, label: src.label, mtime: st.mtimeMs, size: st.size });
    }
  }
  return found.sort((a, b) => b.mtime - a.mtime);
}

const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);
const fmtDate = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

const [cmd, ...rest] = process.argv.slice(2);

// ---- 一覧 ----
if (!cmd || cmd === 'list') {
  const limit = Number(rest[0]) || 20;
  const photos = collect().slice(0, limit);

  if (!photos.length) {
    console.log('候補になる写真が見つかりません。\n');
    console.log('探した場所:');
    for (const s of cfg.sources) console.log(`  ${s.label}: ${expand(s.path)}`);
    console.log('\nスマホの写真を自動でここに届けるには、OneDriveアプリの「カメラのアップロード」をオンにしてください。');
    process.exit(0);
  }

  console.log(`候補の写真 ${photos.length}件（新しい順）\n`);
  photos.forEach((p, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${fmtDate(p.mtime)}  ${fmtSize(p.size).padStart(7)}  [${p.label}]`);
    console.log(`    ${p.abs}`);
  });
  process.exit(0);
}

// ---- 取り込み ----
if (cmd === 'add') {
  const [slug, ...sources] = rest;
  if (!slug || !sources.length) {
    console.error('使い方: node tools/photo.mjs add <slug> <画像1> [画像2 ...]');
    process.exit(1);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    console.error(`slug の形が不正です: ${slug}（英小文字・数字・ハイフンのみ）`);
    process.exit(1);
  }
  if (process.platform !== 'win32') {
    console.error('この写真処理はWindows専用です（.NET の System.Drawing を使っています）。');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const script = path.join(ROOT, 'tools', 'photo.ps1');
  const results = [];

  sources.forEach((src, i) => {
    const abs = path.resolve(expand(src));
    if (!fs.existsSync(abs)) {
      console.error(`✖ 見つかりません: ${abs}`);
      process.exitCode = 1;
      return;
    }

    const outName = `${slug}-${i + 1}.jpg`;
    const outAbs = path.join(OUT_DIR, outName);

    const ps = spawnSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
      '-Source', abs, '-Dest', outAbs,
      '-MaxWidth', String(cfg.maxWidth), '-Quality', String(cfg.quality),
    ], { encoding: 'utf8' });

    if (ps.status !== 0) {
      console.error(`✖ 変換に失敗: ${path.basename(abs)}\n${ps.stderr || ps.stdout}`);
      process.exitCode = 1;
      return;
    }

    const before = fs.statSync(abs).size;
    const after = fs.statSync(outAbs).size;
    const webPath = `/${path.posix.join(cfg.outDir.replace(/\\/g, '/'), outName)}`;
    results.push(webPath);
    console.log(`✎ ${webPath}  ${(ps.stdout || '').trim()}  ${fmtSize(before)} → ${fmtSize(after)}  EXIF削除済み`);
  });

  if (results.length) {
    console.log('\n記事に貼るときのパス:');
    results.forEach((p) => console.log(`  hero: ${p}`));
    console.log('  本文なら ![写真の説明](' + results[0] + ')');
  }
  process.exit(process.exitCode || 0);
}

console.error(`知らないコマンドです: ${cmd}\n使い方:\n  node tools/photo.mjs list [件数]\n  node tools/photo.mjs add <slug> <画像...>`);
process.exit(1);
