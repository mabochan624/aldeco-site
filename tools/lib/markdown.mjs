// Markdownサブセットのレンダラ(依存ゼロ)。
// 対応: ## 〜 #### 見出し / 段落 / 箇条書き / 番号リスト / 引用 / 水平線 /
//       画像(単独行はfigure) / リンク / **強調** / ==マーカー== / `コード`
// 記事はこのサブセットの範囲で書く取り決め(validate.mjsが逸脱を検出する)。

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isExternal = (href) => /^https?:\/\//.test(href) && !href.includes('aldeco.co.jp');

export function renderInline(src) {
  let s = escapeHtml(src);

  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');

  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
    (_m, alt, url) => `<img src="${url}" alt="${alt}" loading="lazy" decoding="async">`);

  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text, href) =>
    `<a href="${href}"${isExternal(href) ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`);

  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/==([^=]+)==/g, '<mark>$1</mark>');

  return s;
}

const BLOCK_START = /^(#{1,6}\s|>\s?|[-*]\s|\d+\.\s|---\s*$|!\[)/;

export function renderMarkdown(md) {
  const lines = String(md).replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) { i++; continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(6, Math.max(2, heading[1].length));
      out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      i++;
      continue;
    }

    if (/^(---|\*\*\*)\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${renderMarkdown(buf.join('\n'))}</blockquote>`);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) { buf.push(lines[i].replace(/^[-*]\s+/, '')); i++; }
      out.push(`<ul>${buf.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) { buf.push(lines[i].replace(/^\d+\.\s+/, '')); i++; }
      out.push(`<ol>${buf.map((t) => `<li>${renderInline(t)}</li>`).join('')}</ol>`);
      continue;
    }

    const soloImage = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (soloImage) {
      const alt = escapeHtml(soloImage[1]);
      const caption = alt ? `<figcaption>${alt}</figcaption>` : '';
      out.push(`<figure><img src="${soloImage[2]}" alt="${alt}" loading="lazy" decoding="async">${caption}</figure>`);
      i++;
      continue;
    }

    const buf = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) { buf.push(lines[i]); i++; }
    out.push(`<p>${renderInline(buf.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('\n');
}

/** 装飾を落とした素のテキスト。文字数カウントと抜粋に使う。 */
export function toPlainText(md) {
  return String(md)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/[*`=]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
