#!/usr/bin/env node
// アルデコ・ブログの品質ゲート(依存ゼロ)。
//   node tools/validate.mjs             … content/posts/*.md を全部検証
//   node tools/validate.mjs <file.md>   … 指定ファイルだけ検証(フックから呼ばれる)
// エラーが1件でもあれば exit 1 = ビルドも公開もされない。
// 取り決めの実体は content/blog.rules.json にある。ルールを変えたいときはそっちを直す。

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, POSTS_DIR, loadRules, listPostFiles, loadPost, loadPublishedPosts } from './lib/posts.mjs';
import { toPlainText } from './lib/markdown.mjs';

const rules = loadRules();
const errors = [];
const warnings = [];

const err = (file, msg, hint) => errors.push({ file, msg, hint });
const warn = (file, msg, hint) => warnings.push({ file, msg, hint });

const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const targets = args.length
  ? args.map((a) => path.resolve(a)).filter((f) => f.endsWith('.md') && f.startsWith(POSTS_DIR))
  : listPostFiles();

if (!args.length && !targets.length) {
  console.log('記事がまだありません（content/posts/*.md）。');
  process.exit(0);
}
if (args.length && !targets.length) process.exit(0); // 記事以外のファイルは対象外

const len = (s) => String(s ?? '').replace(/\s/g, '').length;
const asArray = (v) => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

// ---------- 記事ごとの検証 ----------
for (const file of targets) {
  const post = loadPost(file);
  const rel = post.relPath;
  const d = post.data;

  if (!post.hasFrontmatter) {
    err(rel, 'frontmatter（--- で囲んだ先頭ブロック）がありません。', 'content/posts/_template.md をコピーして書き始めてください。');
    continue;
  }

  // --- frontmatter: 必須 ---
  for (const key of rules.frontmatter.required) {
    const v = d[key];
    const empty = v == null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) err(rel, `frontmatter の "${key}" が未設定です。`, `blog.rules.json の frontmatter.required を参照。`);
  }

  // --- frontmatter: 未知のキー ---
  const known = new Set([...rules.frontmatter.required, ...rules.frontmatter.optional, 'updated']);
  for (const key of Object.keys(d)) {
    if (!known.has(key)) warn(rel, `frontmatter に見慣れないキー "${key}" があります。`, 'タイプミスでなければ blog.rules.json の optional に足してください。');
  }

  // --- 列挙値 ---
  for (const [key, allowed] of Object.entries(rules.frontmatter.enums)) {
    if (d[key] && !allowed.includes(d[key])) {
      err(rel, `"${key}" の値 "${d[key]}" は許可されていません。`, `使えるのは: ${allowed.join(' / ')}`);
    }
  }

  // --- 形式 ---
  for (const [key, pattern] of Object.entries(rules.frontmatter.patterns)) {
    if (d[key] && !new RegExp(pattern).test(String(d[key]))) {
      err(rel, `"${key}" の形式が不正です（${d[key]}）。`, `期待する形式: ${pattern}`);
    }
  }

  // --- 文字数 ---
  for (const [key, range] of Object.entries(rules.frontmatter.lengths)) {
    if (d[key] == null || d[key] === '') continue;
    const n = len(d[key]);
    if (n < range.min) err(rel, `"${key}" が短すぎます（${n}字 / 最低${range.min}字）。`, key === 'description' ? '検索結果とAIの要約にそのまま出る文です。何をした話か具体的に。' : undefined);
    if (n > range.max) err(rel, `"${key}" が長すぎます（${n}字 / 最大${range.max}字）。`);
  }

  // --- 個数 ---
  for (const [key, range] of Object.entries(rules.frontmatter.counts)) {
    const n = asArray(d[key]).length;
    if (n < range.min) err(rel, `"${key}" は${range.min}個以上必要です（現在${n}個）。`);
    if (n > range.max) err(rel, `"${key}" は${range.max}個までです（現在${n}個）。`);
  }

  // --- タイトル総長（検索結果で切れない） ---
  if (d.title) {
    const total = len(d.title) + len(rules.seo.titleSuffix);
    if (total > rules.seo.maxTitleWithSuffix) {
      warn(rel, `title＋サイト名が${total}字で、検索結果で末尾が切れます（目安${rules.seo.maxTitleWithSuffix}字）。`);
    }
  }

  // --- ファイル名と slug / date の整合 ---
  const base = path.basename(file, '.md');
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(base);
  if (!m) {
    err(rel, 'ファイル名は「YYYY-MM-DD-slug.md」の形にしてください。');
  } else {
    if (d.date && d.date !== m[1]) err(rel, `ファイル名の日付(${m[1]})と frontmatter の date(${d.date})が違います。`);
    if (d.slug && d.slug !== m[2]) err(rel, `ファイル名の slug(${m[2]})と frontmatter の slug(${d.slug})が違います。`);
  }

  // --- summary の中身 ---
  asArray(d.summary).forEach((s, i) => {
    const n = len(s);
    if (n < 12) err(rel, `summary[${i}] が短すぎます（${n}字）。`, '要点はAIと読者が最初に読む3行。それだけで内容が分かるように。');
    if (n > 70) err(rel, `summary[${i}] が長すぎます（${n}字 / 最大70字）。`);
  });

  // --- facts（AIOの核）---
  const fr = rules.factRules;
  asArray(d.facts).forEach((f, i) => {
    const n = len(f);
    if (n < fr.minChars) err(rel, `facts[${i}] が短すぎます（${n}字 / 最低${fr.minChars}字）。`);
    if (n > fr.maxChars) err(rel, `facts[${i}] が長すぎます（${n}字 / 最大${fr.maxChars}字）。`);
    if (fr.requireNumberOrProperNoun) {
      // カタカナは長音符「ー」を含めて数える。含めないと「バール」「コンクリート」が
      // 固有名詞と認識されず、正しい一次情報が弾かれる。
      const hasEvidence = /[0-9０-９]/.test(f) || /[ァ-ヶーA-Za-z]{3,}/.test(f) || /[市町村県]/.test(f);
      if (hasEvidence === false) {
        err(rel, `facts[${i}] に数字も固有名詞もありません。`, 'AIに引用されるのは一次情報だけです。「3人で2週間」「金ヶ崎第14期」のように具体的に。');
      }
    }
  });

  // --- FAQ ---
  asArray(d.faq).forEach((x, i) => {
    if (typeof x !== 'object' || !x.q || !x.a) err(rel, `faq[${i}] は q: と a: の両方が必要です。`);
    else if (len(x.a) < 30) err(rel, `faq[${i}].a が短すぎます（${len(x.a)}字 / 最低30字）。`, 'AIがそのまま答えに使える長さ（30〜200字）で。');
  });

  // --- 本文 ---
  const b = rules.body;
  const body = post.body;

  if (post.charCount < b.minChars) err(rel, `本文が短すぎます（${post.charCount}字 / 最低${b.minChars}字）。`, '薄い記事は検索にもAIにも拾われません。');
  if (post.charCount > b.maxChars) warn(rel, `本文が長すぎます（${post.charCount}字 / 目安${b.maxChars}字）。`, '分割を検討してください。');

  const h2s = body.match(/^##\s+.+$/gm) || [];
  if (h2s.length < b.minH2) err(rel, `## 見出しが${h2s.length}個しかありません（最低${b.minH2}個）。`, '見出しはAIが構造を読む手がかりです。');
  if (h2s.length > b.maxH2) warn(rel, `## 見出しが${h2s.length}個あります（目安${b.maxH2}個まで）。`);

  if (b.forbidH1InBody && /^#\s+/m.test(body)) {
    err(rel, '本文に # 見出し（H1）があります。', 'H1は記事タイトルが自動で使います。本文は ## から始めてください。');
  }

  // 内部リンク
  const links = [...body.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((x) => x[2]);
  const internal = links.filter((h) => h.startsWith('/') || h.includes('aldeco.co.jp') || h.includes('genroku.app') || h.includes('nambo.app'));
  if (internal.length < b.minInternalLinks) {
    err(rel, `サイト内リンクが${internal.length}本しかありません（最低${b.minInternalLinks}本）。`, `例: [採用情報](/recruit/)。リンク先候補: ${b.internalLinkTargets.join(' / ')}`);
  }

  // リンク切れ（ローカルの絶対パス）
  for (const href of links.filter((h) => h.startsWith('/') && !h.startsWith('//'))) {
    const clean = href.split('#')[0].split('?')[0];
    if (!clean || clean === '/') continue;
    const abs = path.join(ROOT, clean);
    const ok = fs.existsSync(abs) || fs.existsSync(path.join(abs, 'index.html'));
    const isFuturePost = /^\/blog\/[^/]+\/$/.test(clean) && listPostFiles().some((f) => path.basename(f, '.md').endsWith(clean.split('/')[2]));
    if (!ok && !isFuturePost) err(rel, `リンク先が存在しません: ${href}`);
  }

  // 画像の alt とファイル存在
  for (const img of body.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    if (b.requireImageAlt && !img[1].trim()) err(rel, `画像の説明（alt）が空です: ${img[2]}`, '![ブロックを積む様子](/img/genba-block.jpg) のように書いてください。');
    if (img[2].startsWith('/') && !fs.existsSync(path.join(ROOT, img[2]))) err(rel, `画像が見つかりません: ${img[2]}`);
  }
  if (d.hero && !fs.existsSync(path.join(ROOT, d.hero))) err(rel, `hero 画像が見つかりません: ${d.hero}`);
  if (d.hero && !d.heroAlt) err(rel, 'hero を指定したら heroAlt（画像の説明）も必要です。');

  // 長すぎる段落
  body
    .split(/\n{2,}/)
    .filter((p) => p.trim() && !/^[#>\-*\d]/.test(p.trim()))
    .forEach((p) => {
      if (len(p) > b.maxParagraphChars) warn(rel, `${b.maxParagraphChars}字を超える段落があります（${len(p)}字）。`, 'スマホで壁になります。改行か見出しで割ってください。');
    });

  // 未対応のMarkdown記法
  if (/^\s*\|.*\|\s*$/m.test(body)) warn(rel, '表（テーブル）記法は未対応です。', '箇条書きに置き換えてください。');
  if (/^```/m.test(body)) warn(rel, 'コードブロックは未対応です。', '`インラインコード` を使ってください。');

  // 禁止表現 / 借り物構文
  const plain = toPlainText(body) + ' ' + [d.title, d.description, ...asArray(d.summary)].join(' ');
  for (const w of rules.banned.words) {
    if (plain.includes(w)) err(rel, `禁止表現「${w}」が含まれています。`, '誇大・断定は信頼を落とし、AIにも敬遠されます。');
  }
  for (const w of rules.clicheGuard.words) {
    if (plain.includes(w)) warn(rel, `借り物構文「${w}」が含まれています。`, '「言葉のエッセンス集」の作り方の型: 概念より実話の手触り。自分の言葉に置き換えてください。');
  }
}

// ---------- 記事全体の検証 ----------
if (!args.length) {
  const all = loadPublishedPosts();

  const bySlug = new Map();
  for (const p of all) {
    if (!p.data.slug) continue;
    if (bySlug.has(p.data.slug)) err(p.relPath, `slug "${p.data.slug}" が ${bySlug.get(p.data.slug)} と重複しています。`);
    else bySlug.set(p.data.slug, p.relPath);
  }

  // 北極星ガード: 求職者向けが過半を切っていないか
  for (const [audience, rule] of Object.entries(rules.audienceMix)) {
    if (audience.startsWith('$')) continue;
    const ratio = all.length ? all.filter((p) => p.data.audience === audience).length / all.length : 1;
    if (ratio < rule.minRatio) {
      warn('(全体)', `${audience}向けの記事が${Math.round(ratio * 100)}%です（目標${Math.round(rule.minRatio * 100)}%以上）。`, `北極星: ${rules.northStar.statement}`);
    }
  }
}

// ---------- 出力 ----------
const show = (list, mark) => {
  const byFile = new Map();
  for (const e of list) {
    if (!byFile.has(e.file)) byFile.set(e.file, []);
    byFile.get(e.file).push(e);
  }
  for (const [file, items] of byFile) {
    console.error(`\n${file}`);
    for (const it of items) {
      console.error(`  ${mark} ${it.msg}`);
      if (it.hint) console.error(`      → ${it.hint}`);
    }
  }
};

if (warnings.length) {
  console.error(`\n──── 警告 ${warnings.length}件（公開は止めません）────`);
  show(warnings, '⚠');
}

if (errors.length) {
  console.error(`\n──── エラー ${errors.length}件（直すまで公開されません）────`);
  show(errors, '✖');
  console.error('\n取り決めの中身: content/blog.rules.json\n');
  process.exit(1);
}

console.log(`✅ 検証OK（記事 ${targets.length} 本 / 警告 ${warnings.length}件）`);
