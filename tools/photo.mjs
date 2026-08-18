#!/usr/bin/env node
// 現場写真をブログに載せられる形にする。
//
//   node tools/photo.mjs recent [分数]      … チャットに添付されたばかりの写真を探す
//   node tools/photo.mjs list [件数]        … 受け取り箱の写真を新しい順に一覧
//   node tools/photo.mjs add <slug> <画像...> … 整えて img/blog/<slug>-N.jpg に保存
//   node tools/photo.mjs doctor             … この環境で写真を処理できるか調べる
//
// 「整える」= 向きを直す / 長辺を縮める / メタデータを落とす。
// 生のスマホ写真には **EXIF（GPSの位置情報＝お客様の家の座標）** が入っている。
// これを消さずに公開してはいけない。この処理は環境によって手段が変わる:
//
//   1. Windows        … tools/photo.ps1（.NETのWIC）。JPEG/PNG/HEIC対応
//   2. ImageMagick    … Linux等
//   3. Python Pillow  … tools/photo.py。Linuxのクラウド環境で一番よく入っている
//   4. ffmpeg         … 上記が無いとき
//   5. どれも無い時   … tools/lib/jpeg.mjs で位置情報だけ落とす（縮小も回転もできない）
//
// 1〜4なら縮小も回転補正もできる。5に落ちたときは縮小されずページが重くなるが、
// それでもGPSは必ず消える。消せない形式（HEIC等）は処理せずエラーで止まる。

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ROOT, loadRules } from './lib/posts.mjs';
import { readOrientation, stripMetadata, hasGps } from './lib/jpeg.mjs';

const rules = loadRules();
const cfg = rules.photos;
const OUT_DIR = path.join(ROOT, cfg.outDir);
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.heic']);

const expand = (p) => p.replace(/^~/, os.homedir()).replace(/%USERPROFILE%/gi, os.homedir());
const fmtSize = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`);
const fmtDate = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ');

// ---- この環境で使える手段を調べる ----
// 上から順に試して、最初に見つかったものを使う。
const probe = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return r.status === 0;
};

function detectMethod() {
  if (process.platform === 'win32') return { name: 'windows', label: 'Windows (.NET WIC)', full: true };

  for (const cmd of ['magick', 'convert']) {
    if (probe(cmd, ['-version'])) return { name: 'magick', cmd, label: `ImageMagick (${cmd})`, full: true };
  }
  for (const cmd of ['python3', 'python']) {
    if (probe(cmd, ['-c', 'import PIL'])) return { name: 'python', cmd, label: `Python Pillow (${cmd})`, full: true };
  }
  if (probe('ffmpeg', ['-version'])) return { name: 'ffmpeg', label: 'ffmpeg', full: true };

  return { name: 'jsonly', label: '簡易処理（位置情報の削除のみ・縮小なし）', full: false };
}

// ---- 1枚を整える ----
function convertOne(method, src, dst) {
  if (method.name === 'windows') {
    const ps = spawnSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(ROOT, 'tools', 'photo.ps1'),
      '-Source', src, '-Dest', dst,
      '-MaxWidth', String(cfg.maxWidth), '-Quality', String(cfg.quality),
    ], { encoding: 'utf8' });
    if (ps.status !== 0) throw new Error(ps.stderr || ps.stdout);
    return { detail: (ps.stdout || '').trim(), resized: true };
  }

  if (method.name === 'magick') {
    const r = spawnSync(method.cmd,
      [src, '-auto-orient', '-resize', `${cfg.maxWidth}x>`, '-strip', '-quality', String(cfg.quality), dst],
      { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout);
    return { detail: '', resized: true };
  }

  if (method.name === 'python') {
    const r = spawnSync(method.cmd,
      [path.join(ROOT, 'tools', 'photo.py'), src, dst, String(cfg.maxWidth), String(cfg.quality)],
      { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout);
    return { detail: (r.stdout || '').trim(), resized: true };
  }

  if (method.name === 'ffmpeg') {
    // ffmpegは静止画のEXIF回転を自動では見ないので、こちらで読んで指示する。
    const rot = { 3: 'transpose=1,transpose=1', 6: 'transpose=1', 8: 'transpose=2' };
    const filters = [];
    if (/\.jpe?g$/i.test(src)) {
      const o = readOrientation(fs.readFileSync(src));
      if (rot[o]) filters.push(rot[o]);
    }
    filters.push(`scale='min(${cfg.maxWidth},iw)':-2`);
    const r = spawnSync('ffmpeg',
      ['-y', '-loglevel', 'error', '-i', src, '-vf', filters.join(','), '-map_metadata', '-1', '-q:v', '3', dst],
      { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr || r.stdout);
    return { detail: '', resized: true };
  }

  // 最後の砦: デコードせずに位置情報だけ落とす
  if (!/\.jpe?g$/i.test(src)) {
    throw new Error(
      `この環境ではJPEGしか扱えません（画像処理ツールがありません）。
      HEICやPNGは、スマホ側でJPEGにしてから送ってください。
      iPhoneなら 設定 → カメラ → フォーマット → 「互換性優先」にすると以後JPEGで撮れます。`
    );
  }
  const buf = fs.readFileSync(src);
  const had = hasGps(buf);
  const orientation = readOrientation(buf);
  fs.writeFileSync(dst, stripMetadata(buf));

  if (hasGps(fs.readFileSync(dst))) throw new Error('位置情報を消し切れませんでした。この写真は使わないでください。');

  return { detail: '縮小なし', resized: false, hadGps: had, needsRotation: orientation !== 1 };
}

// ---- 受け取り箱などから写真を集める ----
function collect() {
  const found = [];
  for (const src of cfg.sources) {
    const dir = path.isAbsolute(expand(src.path)) ? expand(src.path) : path.join(ROOT, src.path);
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

const [cmd, ...rest] = process.argv.slice(2);

// ---- この環境の診断 ----
if (cmd === 'doctor') {
  const m = detectMethod();
  console.log(`実行環境: ${process.platform}`);
  console.log(`写真の処理手段: ${m.label}\n`);
  if (m.name === 'jsonly') {
    console.log('⚠ 縮小ができません。GPSは確実に消えますが、写真のサイズは元のままです。');
    console.log('  扱えるのはJPEGのみ。HEIC・PNGは受け付けません。');
    console.log('  ImageMagick・Python Pillow・ffmpeg のどれかが入っていれば、縮小も回転補正もできます。');
  } else {
    console.log('✅ 縮小・回転補正・メタデータ削除のすべてが使えます。');
  }
  process.exit(0);
}

// ---- チャットに添付されたばかりの写真を探す ----
// 添付は ~/.claude/uploads/<セッションID>/ に落ちる。**直近に添付されたものだけ**を対象にする。
// 過去の添付を全部漁ると、現場と関係ない私的なファイルまで拾ってしまうため。
if (cmd === 'recent') {
  const minutes = Number(rest[0]) || 30;
  const uploads = path.join(os.homedir(), '.claude', 'uploads');
  const cutoff = Date.now() - minutes * 60 * 1000;
  const hits = [];

  const walk = (dir, depth) => {
    if (depth > 2 || !fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      let st;
      try { st = fs.statSync(abs); } catch { continue; }
      if (st.isDirectory()) { walk(abs, depth + 1); continue; }
      if (!EXTS.has(path.extname(name).toLowerCase())) continue;
      if (st.mtimeMs < cutoff) continue;
      hits.push({ abs, mtime: st.mtimeMs, size: st.size });
    }
  };
  walk(uploads, 0);
  hits.sort((a, b) => b.mtime - a.mtime);

  if (!hits.length) {
    console.log(`直近${minutes}分に添付された写真はありません。`);
    console.log(`探した場所: ${uploads}`);
    process.exit(0);
  }

  console.log(`直近${minutes}分の添付写真 ${hits.length}件\n`);
  hits.forEach((p, i) => {
    console.log(`${String(i + 1).padStart(2)}. ${fmtDate(p.mtime)}  ${fmtSize(p.size).padStart(7)}`);
    console.log(`    ${p.abs}`);
  });
  console.log('\n取り込むには: node tools/photo.mjs add <slug> "<上のパス>"');
  process.exit(0);
}

// ---- 一覧 ----
if (!cmd || cmd === 'list') {
  const limit = Number(rest[0]) || 20;
  const photos = collect().slice(0, limit);

  if (!photos.length) {
    console.log('候補になる写真が見つかりません。\n');
    console.log('探した場所:');
    for (const s of cfg.sources) console.log(`  ${s.label}: ${s.path}`);
    console.log('\nチャットに添付された写真を探すなら: node tools/photo.mjs recent');
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

  const method = detectMethod();
  console.log(`処理手段: ${method.label}\n`);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const results = [];
  const warnings = [];

  sources.forEach((src, i) => {
    const abs = path.resolve(expand(src));
    if (!fs.existsSync(abs)) {
      console.error(`✖ 見つかりません: ${abs}`);
      process.exitCode = 1;
      return;
    }

    const outName = `${slug}-${i + 1}.jpg`;
    const outAbs = path.join(OUT_DIR, outName);

    let r;
    try {
      r = convertOne(method, abs, outAbs);
    } catch (e) {
      console.error(`✖ 変換に失敗: ${path.basename(abs)}\n      ${e.message}`);
      process.exitCode = 1;
      return;
    }

    const before = fs.statSync(abs).size;
    const after = fs.statSync(outAbs).size;
    const webPath = `/${path.posix.join(cfg.outDir.replace(/\\/g, '/'), outName)}`;
    results.push(webPath);
    console.log(`✎ ${webPath}  ${r.detail}  ${fmtSize(before)} → ${fmtSize(after)}  位置情報の削除ずみ`);

    if (r.hadGps) console.log(`   ↑ この写真には位置情報が入っていました。消しました。`);
    if (r.needsRotation) warnings.push(`${outName} は回転が必要な写真ですが、この環境では直せません。スマホ側で回転させてから送り直してください。`);
    if (!r.resized) warnings.push(`${outName} は縮小できていません（${fmtSize(after)}）。ページが重くなります。`);
  });

  if (warnings.length) {
    console.log('');
    warnings.forEach((w) => console.log(`⚠ ${w}`));
  }

  if (results.length) {
    console.log('\n記事に貼るときのパス:');
    results.forEach((p) => console.log(`  hero: ${p}`));
    console.log('  本文なら ![写真の説明](' + results[0] + ')');
  }
  process.exit(process.exitCode || 0);
}

console.error(`知らないコマンドです: ${cmd}\n使い方:\n  node tools/photo.mjs recent [分数]\n  node tools/photo.mjs list [件数]\n  node tools/photo.mjs add <slug> <画像...>\n  node tools/photo.mjs doctor`);
process.exit(1);
