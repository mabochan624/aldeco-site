// YAMLサブセットのfrontmatterパーサ(依存ゼロ)。
// 対応: スカラー / 文字列配列(- 形式・[a, b] 形式) / フラットなオブジェクトの配列 / 複数行の | ブロック。
// これ以上の構文は blog.rules.json 側で使わない取り決めにしている。

const stripQuotes = (v) => {
  const s = String(v).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
};

const indentOf = (line) => line.length - line.replace(/^\s*/, '').length;

function parseSequence(block) {
  const items = [];
  let current = null;
  let currentIndent = 0;

  for (const raw of block) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('- ')) {
      const rest = line.slice(2).trim();
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(rest);
      if (kv && kv[2] !== undefined) {
        current = { [kv[1]]: stripQuotes(kv[2]) };
        currentIndent = indentOf(raw);
        items.push(current);
      } else {
        items.push(stripQuotes(rest));
        current = null;
      }
      continue;
    }

    // オブジェクト項目の2行目以降(- より深いインデント)
    if (current && indentOf(raw) > currentIndent) {
      const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
      if (kv) current[kv[1]] = stripQuotes(kv[2]);
    }
  }
  return items;
}

export function parseYamlSubset(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const data = {};
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) { i++; continue; }

    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(raw);
    if (!kv) { i++; continue; }

    const key = kv[1];
    const inlineValue = kv[2].trim();
    i++;

    if (inlineValue && inlineValue !== '|' && inlineValue !== '>') {
      if (inlineValue.startsWith('[') && inlineValue.endsWith(']')) {
        data[key] = inlineValue.slice(1, -1).split(',').map((s) => stripQuotes(s)).filter(Boolean);
      } else if (inlineValue === 'true' || inlineValue === 'false') {
        data[key] = inlineValue === 'true';
      } else {
        data[key] = stripQuotes(inlineValue);
      }
      continue;
    }

    // ブロック(インデントされた続き)を集める
    const block = [];
    while (i < lines.length && (!lines[i].trim() || /^\s+\S/.test(lines[i]))) {
      if (lines[i].trim()) block.push(lines[i]);
      else if (block.length === 0) { /* 先頭の空行は無視 */ }
      else break;
      i++;
    }

    if (inlineValue === '|' || inlineValue === '>') {
      const base = block.length ? indentOf(block[0]) : 0;
      const text = block.map((l) => l.slice(base)).join(inlineValue === '|' ? '\n' : ' ');
      data[key] = text;
    } else {
      data[key] = parseSequence(block);
    }
  }

  return data;
}

export function parseFrontmatter(rawInput) {
  const raw = rawInput.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { data: null, body: raw, frontmatterLines: 0 };
  return {
    data: parseYamlSubset(m[1]),
    body: raw.slice(m[0].length),
    frontmatterLines: m[0].split('\n').length - 1,
  };
}
