#!/usr/bin/env node
// Claude Code の PostToolUse フックから呼ばれる。
// 記事Markdownが保存されるたびに 検証 → 合格なら再ビルド を自動で回す。
// 検証に落ちると exit 2 でAIに差し戻され、AIがその場で直す（自己修復ループ）。

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS = path.dirname(fileURLToPath(import.meta.url));
const POSTS = path.join(TOOLS, '..', 'content', 'posts');

const readStdin = () =>
  new Promise((resolve) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (buf += c));
    process.stdin.on('end', () => resolve(buf));
    setTimeout(() => resolve(buf), 3000).unref();
  });

const payload = await readStdin();

let filePath = '';
try {
  const json = JSON.parse(payload || '{}');
  filePath = json.tool_input?.file_path || json.tool_input?.filePath || '';
} catch {
  process.exit(0);
}

if (!filePath) process.exit(0);

const abs = path.resolve(filePath);
const isPost = abs.endsWith('.md') && abs.startsWith(path.resolve(POSTS));
const isRules = abs.endsWith('blog.rules.json');
if (!isPost && !isRules) process.exit(0);

const run = (script, args = []) =>
  spawnSync(process.execPath, [path.join(TOOLS, script), ...args], { encoding: 'utf8' });

const validate = run('validate.mjs', isPost ? [abs] : []);

if (validate.status !== 0) {
  console.error('【ブログ品質ゲート】記事が取り決めを満たしていません。以下を直してから次に進んでください。\n');
  console.error(validate.stderr || validate.stdout);
  process.exit(2); // exit 2 = Claudeに差し戻す
}

const build = run('build.mjs');
if (build.status !== 0) {
  console.error('【ブログビルド失敗】\n' + (build.stderr || build.stdout));
  process.exit(2);
}

console.log('✅ ブログ品質ゲート通過 → 再ビルド済み');
process.exit(0);
