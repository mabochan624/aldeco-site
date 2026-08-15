#!/usr/bin/env node
// 北極星の記録簿。目標値は置かず、過去最高を超え続けたかだけを見る。
//   node tools/metrics.mjs                                        … レポート表示
//   node tools/metrics.mjs set 2026-08 clicks=12 brand=3 ai=1     … 月次の数字を記録
// 記録先: content/metrics.json

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, listPostFiles } from './lib/posts.mjs';

const FILE = path.join(ROOT, 'content', 'metrics.json');
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const STAR = data.northStar;

const [cmd, month, ...pairs] = process.argv.slice(2);

// ---- 記録 ----
if (cmd === 'set') {
  if (!/^\d{4}-\d{2}$/.test(month || '')) {
    console.error('月は YYYY-MM の形で指定してください。例: node tools/metrics.mjs set 2026-08 clicks=12');
    process.exit(1);
  }
  let row = data.months.find((m) => m.month === month);
  if (!row) { row = { month }; data.months.push(row); }

  for (const p of pairs) {
    const [k, v] = p.split('=');
    if (!k || v === undefined) continue;
    if (!Object.keys(data.fields).includes(k)) {
      console.error(`知らない項目です: ${k}\n使えるのは: ${Object.keys(data.fields).join(' / ')}`);
      process.exit(1);
    }
    row[k] = Number(v);
  }

  data.months.sort((a, b) => a.month.localeCompare(b.month));
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`✎ ${month} を記録しました。\n`);
}

// ---- その月に公開した記事数を自動で数える ----
const postsByMonth = {};
for (const f of listPostFiles()) {
  const m = /^(\d{4}-\d{2})-\d{2}-/.exec(path.basename(f));
  if (m) postsByMonth[m[1]] = (postsByMonth[m[1]] || 0) + 1;
}

// ---- レポート ----
const months = data.months.filter((m) => m[STAR] != null);

console.log('★ 北極星: アルデコに出会う人を、増やし続ける。');
console.log(`   指標: ${data.fields[STAR]}`);
console.log('   ルール: 目標値は置かない。過去最高を超え続ける。\n');

if (!months.length) {
  console.log('   まだ1件も記録がありません。');
  console.log('   Search Console と GA4 を繋いだら、月に1回ここに数字を入れてください。');
  console.log('   例: node tools/metrics.mjs set 2026-08 clicks=12 brand=3 impressions=430 recruit=8 apply=0 ai=1');
  process.exit(0);
}

const latest = months[months.length - 1];
const past = months.slice(0, -1);
const best = past.length ? Math.max(...past.map((m) => m[STAR])) : null;
const bestMonth = past.find((m) => m[STAR] === best)?.month;

// 連続更新月数
let streak = 0;
for (let i = months.length - 1; i > 0; i--) {
  const prevBest = Math.max(...months.slice(0, i).map((m) => m[STAR]));
  if (months[i][STAR] > prevBest) streak++;
  else break;
}

const bar = (n, max) => '█'.repeat(Math.max(1, Math.round((n / Math.max(max, 1)) * 28)));
const maxAll = Math.max(...months.map((m) => m[STAR]));

console.log('   推移');
for (const m of months) {
  const mark = m[STAR] === maxAll ? ' ← 最高' : '';
  const p = postsByMonth[m.month] ? `  記事${postsByMonth[m.month]}本` : '';
  console.log(`   ${m.month}  ${String(m[STAR]).padStart(5)}  ${bar(m[STAR], maxAll)}${mark}${p}`);
}

console.log('');
if (best === null) {
  console.log(`   初回記録。ここが基準になります。次に超える数字: ${latest[STAR]}`);
} else if (latest[STAR] > best) {
  console.log(`   🔥 過去最高を更新（前回最高 ${best} / ${bestMonth}）`);
  console.log(`   連続更新: ${streak}ヶ月`);
  console.log(`   次に超える数字: ${latest[STAR]}`);
} else {
  console.log(`   今月は更新できず（過去最高 ${best} / ${bestMonth}）`);
  console.log(`   連続更新: 途切れ`);
  console.log(`   次に超える数字: ${best}`);
}

// ---- 等級と診断指標 ----
const show = (key, label) => {
  const vals = data.months.filter((m) => m[key] != null);
  if (!vals.length) return;
  const cur = vals[vals.length - 1];
  const prev = vals.length > 1 ? vals[vals.length - 2][key] : null;
  const diff = prev == null ? '' : ` (前月${prev > cur[key] ? '−' : '+'}${Math.abs(cur[key] - prev)})`;
  console.log(`   ${label.padEnd(22, '　')} ${String(cur[key]).padStart(5)}${diff}`);
};

console.log('\n   等級（名前を覚えられたか）');
show('brand', '指名検索「アルデコ」');

console.log('\n   診断（どこが効いたか）');
show('impressions', '検索表示回数');
show('recruit', '記事→採用ページ');
show('ai', 'AI引用（5問中）');
show('apply', '応募の一歩');

console.log(`\n   今月の公開本数: ${postsByMonth[latest.month] || 0}本`);
console.log('');
