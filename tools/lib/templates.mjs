import { escapeHtml, renderMarkdown, renderInline } from './markdown.mjs';
import { formatDate, postUrl } from './posts.mjs';

const AUTHORS = {
  佐藤将希: {
    role: '株式会社アルデコ 代表取締役',
    photo: '/img/daihyo.jpg',
    bio: '岩手県奥州市で外構・造成の会社をやっています。ブロックを積み、道具を発明し、現場アプリまで自分たちで作る。「きつい仕事を、割に合う最高の仕事に変える。」が口ぐせです。',
  },
};

const NAV = `
<header>
  <div class="container nav">
    <a href="/" class="logo"><img src="/img/mark-allorange.png" alt="ALDECO ロゴ"><span>ALDECO</span></a>
    <nav class="nav-links">
      <a href="/#business" class="hide-sp">事業内容</a>
      <a href="/#works" class="hide-sp">施工実績</a>
      <a href="/blog/">ゲンバのはなし</a>
      <a href="/recruit/" class="btn">採用情報</a>
    </nav>
  </div>
</header>`;

const FOOTER = `
<footer>
  <div class="container foot">
    <img src="/img/logo-allwhite.png" alt="株式会社アルデコ" class="logo-img">
    <nav class="foot-nav">
      <a href="/#contact">仕事のご相談</a>
      <a href="/recruit/">採用情報</a>
      <a href="/blog/">ゲンバのはなし</a>
      <a href="https://genroku.app" target="_blank" rel="noopener">GENROKU</a>
      <a href="https://nambo.app" target="_blank" rel="noopener">なんぼ計算機</a>
      <a href="/privacy/">プライバシーポリシー</a>
    </nav>
    <span>© 株式会社アルデコ All Rights Reserved.</span>
  </div>
</footer>`;

const organizationLd = (seo) => ({
  '@type': 'Organization',
  '@id': `${seo.origin}/#organization`,
  name: '株式会社アルデコ',
  alternateName: 'ALDECO',
  url: `${seo.origin}/`,
  logo: `${seo.origin}/img/logo-black.png`,
  telephone: '080-4402-3343',
  address: {
    '@type': 'PostalAddress',
    addressCountry: 'JP',
    addressRegion: '岩手県',
    addressLocality: '奥州市',
    streetAddress: '水沢真城東五郎兵衛2',
  },
  areaServed: '岩手県',
  knowsAbout: ['外構工事', 'ブロック積み', '宅地造成', '土間コンクリート'],
});

export function layout({ title, description, canonical, ogImage, ogType = 'article', jsonLd, body, bodyClass = '' }) {
  const ld = jsonLd ? `\n<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : '';
  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="株式会社アルデコ（ALDECO）">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="alternate" type="application/rss+xml" title="アルデコのゲンバのはなし" href="/blog/feed.xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
<link rel="stylesheet" href="/blog.css">${ld}
</head>
<body class="${bodyClass}">
${NAV}
${body}
${FOOTER}
</body>
</html>
`;
}

function ctaBand(cta) {
  return `
<div class="cta-band">
  <div class="container">
    <h2>${escapeHtml(cta.heading)}</h2>
    <p>${escapeHtml(cta.text)}</p>
    <a href="${cta.primary.href}" class="btn big">${escapeHtml(cta.primary.label)}</a>
  </div>
</div>`;
}

function factsBlock(facts) {
  if (!facts || !facts.length) return '';
  return `
<aside class="post-facts">
  <p class="post-facts-title">この記事の一次データ</p>
  <ul>${facts.map((f) => `<li>${renderInline(f)}</li>`).join('')}</ul>
  <p class="post-facts-note">すべてアルデコの実際の現場・実績にもとづく数字です。</p>
</aside>`;
}

function faqBlock(faq) {
  if (!faq || !faq.length) return '';
  return `
<section class="post-faq">
  <h2>よくある質問</h2>
  <dl>${faq.map((x) => `<dt>${escapeHtml(x.q)}</dt><dd>${renderInline(x.a)}</dd>`).join('')}</dl>
</section>`;
}

function authorBlock(name) {
  const a = AUTHORS[name];
  if (!a) return '';
  return `
<aside class="post-author">
  <img src="${a.photo}" alt="${escapeHtml(name)}" loading="lazy">
  <div>
    <p class="post-author-name">${escapeHtml(name)}<span>${escapeHtml(a.role)}</span></p>
    <p class="post-author-bio">${escapeHtml(a.bio)}</p>
  </div>
</aside>`;
}

function relatedBlock(related) {
  if (!related.length) return '';
  return `
<section class="post-related">
  <h2>あわせて読む</h2>
  <ul>${related
    .map((p) => `<li><a href="${postUrl(p.data.slug)}"><span class="rel-cat">${escapeHtml(p.data.category)}</span><span class="rel-title">${escapeHtml(p.data.title)}</span></a></li>`)
    .join('')}</ul>
</section>`;
}

export function articlePage(post, related, rules) {
  const { seo, cta } = rules;
  const d = post.data;
  const url = `${seo.origin}${postUrl(d.slug)}`;
  const image = d.hero ? `${seo.origin}${d.hero}` : `${seo.origin}${seo.defaultOgImage}`;
  const author = AUTHORS[d.author] || {};

  const graph = [
    organizationLd(seo),
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      headline: d.title,
      description: d.description,
      datePublished: d.date,
      dateModified: d.updated || d.date,
      inLanguage: 'ja',
      articleSection: d.category,
      keywords: (d.tags || []).join(', '),
      wordCount: post.charCount,
      image,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      author: {
        '@type': 'Person',
        name: d.author,
        jobTitle: author.role,
        worksFor: { '@id': `${seo.origin}/#organization` },
      },
      publisher: { '@id': `${seo.origin}/#organization` },
      about: (d.facts || []).map((f) => ({ '@type': 'Thing', name: f })),
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: `${seo.origin}/` },
        { '@type': 'ListItem', position: 2, name: 'ゲンバのはなし', item: `${seo.origin}/blog/` },
        { '@type': 'ListItem', position: 3, name: d.title, item: url },
      ],
    },
  ];

  if (d.faq && d.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: d.faq.map((x) => ({
        '@type': 'Question',
        name: x.q,
        acceptedAnswer: { '@type': 'Answer', text: x.a },
      })),
    });
  }

  const hero = d.hero
    ? `<figure class="post-hero"><img src="${d.hero}" alt="${escapeHtml(d.heroAlt || d.title)}" loading="eager" decoding="async"></figure>`
    : '';

  const summary = (d.summary || []).map((s) => `<li>${renderInline(s)}</li>`).join('');

  const body = `
<article class="post">
  <div class="post-head">
    <div class="container narrow">
      <nav class="breadcrumb"><a href="/">ホーム</a><span>/</span><a href="/blog/">ゲンバのはなし</a></nav>
      <p class="post-cat">${escapeHtml(d.category)}</p>
      <h1>${escapeHtml(d.title)}</h1>
      <p class="post-meta">
        <time datetime="${d.date}">${formatDate(d.date)}</time>
        <span>${escapeHtml(d.author)}</span>
        <span>約${post.readingMinutes}分</span>
      </p>
    </div>
  </div>
  ${hero}
  <div class="container narrow">
    <div class="post-summary">
      <p class="post-summary-title">この記事の要点</p>
      <ul>${summary}</ul>
    </div>
    <div class="post-body">
${renderMarkdown(post.body)}
    </div>
    ${factsBlock(d.facts)}
    ${faqBlock(d.faq)}
    ${authorBlock(d.author)}
    ${relatedBlock(related)}
    <p class="post-back"><a href="/blog/">← 記事いちらんへ</a></p>
  </div>
</article>
${ctaBand(cta)}`;

  return layout({
    title: `${d.title}${seo.titleSuffix}`,
    description: d.description,
    canonical: url,
    ogImage: image,
    jsonLd: { '@context': 'https://schema.org', '@graph': graph },
    body,
    bodyClass: 'is-blog',
  });
}

export function indexPage(posts, rules) {
  const { seo, cta, northStar } = rules;
  const url = `${seo.origin}/blog/`;

  const cards = posts
    .map((p) => {
      const d = p.data;
      const thumb = d.hero
        ? `<div class="pc-thumb"><img src="${d.hero}" alt="${escapeHtml(d.heroAlt || d.title)}" loading="lazy"></div>`
        : '<div class="pc-thumb pc-thumb-none"><span>ALDECO</span></div>';
      return `<li class="post-card"><a href="${postUrl(d.slug)}">
        ${thumb}
        <div class="pc-body">
          <p class="pc-meta"><span class="pc-cat">${escapeHtml(d.category)}</span><time datetime="${d.date}">${formatDate(d.date)}</time></p>
          <h2 class="pc-title">${escapeHtml(d.title)}</h2>
          <p class="pc-desc">${escapeHtml(d.description)}</p>
        </div>
      </a></li>`;
    })
    .join('\n');

  const graph = [
    organizationLd(seo),
    {
      '@type': 'Blog',
      '@id': `${url}#blog`,
      name: 'アルデコのゲンバのはなし',
      description: northStar.statement,
      url,
      inLanguage: 'ja',
      publisher: { '@id': `${seo.origin}/#organization` },
      blogPost: posts.map((p) => ({
        '@type': 'BlogPosting',
        headline: p.data.title,
        url: `${seo.origin}${postUrl(p.data.slug)}`,
        datePublished: p.data.date,
      })),
    },
  ];

  const body = `
<div class="blog-hero">
  <div class="watermark">GENBA<br>STORIES</div>
  <div class="container">
    <span class="eyebrow">BLOG</span>
    <h1>ゲンバの<span class="em">はなし</span></h1>
    <p class="sub">
      岩手県奥州市の外構屋が、現場で起きたことをそのまま書きます。<br>
      かっこつけない、盛らない。ここで働くって、こういうことです。
    </p>
  </div>
</div>

<section>
  <div class="container">
    <ul class="post-grid">
${cards || '<li class="post-empty">記事はまもなく公開します。</li>'}
    </ul>
  </div>
</section>
${ctaBand(cta)}`;

  return layout({
    title: `ゲンバのはなし｜株式会社アルデコ（ALDECO）`,
    description: '岩手県奥州市の外構・造成会社アルデコのブログ。現場のリアル、道具の話、未経験から育つ仕組みまで、代表が自分で書いています。',
    canonical: url,
    ogImage: `${seo.origin}${seo.defaultOgImage}`,
    ogType: 'website',
    jsonLd: { '@context': 'https://schema.org', '@graph': graph },
    body,
    bodyClass: 'is-blog',
  });
}
