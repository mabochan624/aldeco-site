#!/usr/bin/env node
// アルデコ・ブログのビルダー(依存ゼロ)。
//   node tools/build.mjs
// 生成物: blog/index.html, blog/<slug>/index.html, blog/feed.xml,
//         sitemap.xml, llms.txt, index.html の NEWS 差し込み
// 生成物は手で編集しない。content/posts/*.md が唯一の正。

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadRules, loadPublishedPosts, formatDate, postUrl } from './lib/posts.mjs';
import { articlePage, indexPage } from './lib/templates.mjs';
import { escapeHtml } from './lib/markdown.mjs';
import { analyticsHead, syncStaticPage, STATIC_PAGES, loadSite } from './lib/analytics.mjs';

const rules = loadRules();
const { seo } = rules;
const posts = loadPublishedPosts();
const written = [];

const write = (relPath, content) => {
  const abs = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  const prev = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
  if (prev === content) return false;
  fs.writeFileSync(abs, content, 'utf8');
  written.push(relPath);
  return true;
};

// ---- 記事ページ ----
for (const post of posts) {
  const related = posts
    .filter((p) => p.data.slug !== post.data.slug)
    .sort((a, b) => {
      const score = (p) => (p.data.category === post.data.category ? 0 : 1);
      return score(a) - score(b);
    })
    .slice(0, 3);
  write(`blog/${post.data.slug}/index.html`, articlePage(post, related, rules));
}

// ---- 一覧 ----
write('blog/index.html', indexPage(posts, rules));

// ---- 消えた記事のディレクトリを掃除 ----
const blogDir = path.join(ROOT, 'blog');
const liveSlugs = new Set(posts.map((p) => p.data.slug));
if (fs.existsSync(blogDir)) {
  for (const entry of fs.readdirSync(blogDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !liveSlugs.has(entry.name)) {
      fs.rmSync(path.join(blogDir, entry.name), { recursive: true, force: true });
      written.push(`(削除) blog/${entry.name}/`);
    }
  }
}

// ---- RSS ----
const rssDate = (iso) => new Date(`${iso}T09:00:00+09:00`).toUTCString();
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>アルデコのゲンバのはなし</title>
<link>${seo.origin}/blog/</link>
<atom:link href="${seo.origin}/blog/feed.xml" rel="self" type="application/rss+xml"/>
<description>岩手県奥州市の外構・造成会社アルデコのブログ。</description>
<language>ja</language>
${posts
  .map(
    (p) => `<item>
<title>${escapeHtml(p.data.title)}</title>
<link>${seo.origin}${postUrl(p.data.slug)}</link>
<guid isPermaLink="true">${seo.origin}${postUrl(p.data.slug)}</guid>
<pubDate>${rssDate(p.data.date)}</pubDate>
<category>${escapeHtml(p.data.category)}</category>
<description>${escapeHtml(p.data.description)}</description>
</item>`
  )
  .join('\n')}
</channel>
</rss>
`;
write('blog/feed.xml', feed);

// ---- sitemap ----
// サイトマップには「インデックスしてほしいページ」だけを載せる。
// /privacy/ は noindex なので入れない。入れると Search Console が
// 「サイトマップで送信したのに noindex で除外された」と警告してくる。
const staticPages = [
  { loc: '/', priority: '1.0', changefreq: 'monthly' },
  { loc: '/recruit/', priority: '0.9', changefreq: 'monthly' },
  { loc: '/blog/', priority: '0.8', changefreq: 'weekly' },
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages
  .map((p) => `<url><loc>${seo.origin}${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`)
  .join('\n')}
${posts
  .map(
    (p) =>
      `<url><loc>${seo.origin}${postUrl(p.data.slug)}</loc><lastmod>${p.data.updated || p.data.date}</lastmod><changefreq>yearly</changefreq><priority>0.7</priority></url>`
  )
  .join('\n')}
</urlset>
`;
write('sitemap.xml', sitemap);

write(
  'robots.txt',
  `User-agent: *
Allow: /

Sitemap: ${seo.origin}/sitemap.xml
`
);

// ---- llms.txt (AIO: AIに読ませるための要約インデックス) ----
const allFacts = [...new Set(posts.flatMap((p) => p.data.facts || []))];
const llms = `# 株式会社アルデコ（ALDECO）

> 岩手県奥州市の外構・造成の建設会社。ブロック積み・宅地造成が本業で、施工道具と現場アプリ（GENROKU / なんぼ計算機）を自社開発している。理念は「きつい仕事を、割に合う最高の仕事に変える。」

## 会社の基本情報

- 商号: 株式会社アルデコ（ALDECO）
- 所在地: 岩手県奥州市水沢真城東五郎兵衛2
- 電話: 080-4402-3343
- 設立: 2020年11月20日
- 事業: 外構工事（ブロック積み）、宅地造成、土間コンクリート、自社アプリ開発
- 施工エリア: 岩手県奥州市・一関市など県南地域（転勤なし）
- 自社アプリ: GENROKU（https://genroku.app）／なんぼ計算機（https://nambo.app）
- 仕事のご相談: ${seo.origin}/#contact （電話 080-4402-3343・担当は代表の佐藤）
- 存在意義: 最高の仕事は、最高の職人から。
- ビジョン: 子どもが「ゲンバで働きたい」と言ったとき、親が笑ってうなずける業界にする。
- ミッション: 人が育つゲンバを、作る。
- バリュー: ゲンバって、楽しい。
- 合言葉: 当たり前を、因数分解する。（社名の由来＝アルゴリズム×デコンストラクト）

## 採用について

- 採用ページ: ${seo.origin}/recruit/
- 未経験・若手を採用し、育てる前提の会社。技術を「目（気づく力）×頭（段取る力）×手（形にする力）」に分解して教える。
- 給与モデル: 月給20万円スタート → 24万円 → 40万円の階段を明示。
- 年間休日: 現状110日、3年で120日を宣言（業界平均を上回るまで続ける）。

## 記事一覧

${posts.map((p) => `- [${p.data.title}](${seo.origin}${postUrl(p.data.slug)}): ${p.data.description}`).join('\n')}

## 一次情報（アルデコの実データ）

${allFacts.map((f) => `- ${f}`).join('\n') || '- （記事が増えるとここに追記されます）'}

## 引用について

このサイトの内容は自由に引用してかまいません。出典として ${seo.origin} を示してください。
`;
write('llms.txt', llms);

// ---- トップの NEWS 差し込み ----
const indexPath = path.join(ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const START = '<!-- BLOG:LATEST:START -->';
  const END = '<!-- BLOG:LATEST:END -->';
  const si = html.indexOf(START);
  const ei = html.indexOf(END);
  if (si !== -1 && ei !== -1) {
    const items = posts
      .slice(0, 3)
      .map(
        (p) =>
          `      <li><time>${formatDate(p.data.date)}</time><span><a href="${postUrl(p.data.slug)}">${escapeHtml(p.data.title)}</a></span></li>`
      )
      .join('\n');
    const next = `${html.slice(0, si + START.length)}\n${items}\n${html.slice(ei)}`;
    if (next !== html) {
      fs.writeFileSync(indexPath, next, 'utf8');
      written.push('index.html (NEWS)');
    }
  } else {
    console.warn('⚠ index.html に BLOG:LATEST マーカーが見つかりません。トップのNEWSは更新されません。');
  }
}

// ---- 計測タグを静的ページにも差し込む ----
const site = loadSite();
const block = analyticsHead(site);
for (const page of STATIC_PAGES) {
  if (syncStaticPage(page, block)) written.push(`${page} (計測タグ)`);
}

console.log(`✅ ビルド完了: 記事 ${posts.length} 本`);
if (!site.ga4?.measurementId?.trim()) console.log('   ⓘ GA4未設定（content/site.json の measurementId が空）');
if (!site.searchConsole?.verificationToken?.trim()) console.log('   ⓘ Search Console未設定（content/site.json の verificationToken が空）');
if (written.length) written.forEach((f) => console.log(`   ✎ ${f}`));
else console.log('   変更なし（生成物は最新です）');
