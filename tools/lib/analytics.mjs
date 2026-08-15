import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './posts.mjs';

const SITE_PATH = path.join(ROOT, 'content', 'site.json');

export function loadSite() {
  if (!fs.existsSync(SITE_PATH)) return { ga4: {}, searchConsole: {} };
  return JSON.parse(fs.readFileSync(SITE_PATH, 'utf8'));
}

/**
 * 計測タグのHTMLを組み立てる。値が空なら何も出さない。
 * 出力先は <head> 内の ANALYTICS マーカーの間（静的ページ）と、
 * ブログテンプレートの <head>（生成ページ）。
 */
export function analyticsHead(site = loadSite()) {
  const out = [];
  const token = site.searchConsole?.verificationToken?.trim();
  const gid = site.ga4?.measurementId?.trim();

  if (token) out.push(`<meta name="google-site-verification" content="${token}">`);

  if (gid) {
    out.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${gid}"></script>`);
    out.push(`<script>
window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('js',new Date());gtag('config','${gid}');
document.addEventListener('click',function(e){
  var a=e.target&&e.target.closest?e.target.closest('a'):null;if(!a)return;
  var h=a.getAttribute('href')||'',from=location.pathname;
  if(h.indexOf('/recruit/')===0||h.indexOf('#entry')===0)gtag('event','recruit_click',{link_url:h,from:from});
  if(h.indexOf('lin.ee')>-1||h.indexOf('line.me')>-1)gtag('event','line_click',{from:from});
  if(h.indexOf('tel:')===0)gtag('event','tel_click',{from:from});
},{passive:true});
</script>`);
  }

  return out.join('\n');
}

const START = '<!-- ANALYTICS:START -->';
const END = '<!-- ANALYTICS:END -->';

/** 静的HTMLのマーカー間を差し替える。変更があれば true。 */
export function syncStaticPage(relPath, block) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) return false;

  const html = fs.readFileSync(abs, 'utf8');
  const si = html.indexOf(START);
  const ei = html.indexOf(END);

  if (si === -1 || ei === -1) {
    console.warn(`⚠ ${relPath} に ANALYTICS マーカーがありません。計測タグは差し込まれません。`);
    return false;
  }

  const next = `${html.slice(0, si + START.length)}\n${block}${block ? '\n' : ''}${html.slice(ei)}`;
  if (next === html) return false;
  fs.writeFileSync(abs, next, 'utf8');
  return true;
}

export const STATIC_PAGES = ['index.html', 'recruit/index.html', 'privacy/index.html'];
