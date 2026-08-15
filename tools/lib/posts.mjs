import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './frontmatter.mjs';
import { toPlainText } from './markdown.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const POSTS_DIR = path.join(ROOT, 'content', 'posts');
export const RULES_PATH = path.join(ROOT, 'content', 'blog.rules.json');

export function loadRules() {
  return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
}

export function listPostFiles() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(POSTS_DIR, f))
    .sort();
}

/** 1ファイルを読んで正規化した記事オブジェクトを返す。壊れていてもthrowせず errors に積む。 */
export function loadPost(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const { data, body } = parseFrontmatter(raw);
  const plain = toPlainText(body);

  return {
    file,
    relPath: path.relative(ROOT, file).replace(/\\/g, '/'),
    data: data || {},
    hasFrontmatter: Boolean(data),
    body,
    plain,
    charCount: plain.replace(/\s/g, '').length,
    readingMinutes: Math.max(1, Math.round(plain.replace(/\s/g, '').length / 600)),
  };
}

/** 公開対象の記事を新しい順で返す。draft: true は除外。 */
export function loadPublishedPosts() {
  return listPostFiles()
    .map(loadPost)
    .filter((p) => p.hasFrontmatter && p.data.draft !== true)
    .sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
}

export const formatDate = (iso) => String(iso).replace(/-/g, '.');

export const postUrl = (slug) => `/blog/${slug}/`;
