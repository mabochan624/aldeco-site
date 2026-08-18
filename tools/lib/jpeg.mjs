// JPEGのメタデータを、画像をデコードせずに直接扱う。
//
// 画像処理ツールが何も無い環境（クラウドのLinuxなど）でも、
// **位置情報だけは絶対に消す**ための最後の砦。
// リサイズはできないが、GPSを残したまま公開するよりはるかにマシ。
//
// JPEGの構造: FFD8(SOI) → [FFxx マーカー + 2バイト長 + 中身] の繰り返し → FFDA(SOS) → 画像データ → FFD9(EOI)

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;

/** 残してよいセグメント。APP0=JFIF(無害)、APP2=ICCカラープロファイル(位置情報を含まない)。 */
const KEEP_APP = new Set([0xe0, 0xe2]);

/** 位置情報が入りうるセグメント。APP1=Exif/XMP、APP13=IPTC、APP3〜15=メーカー独自領域。 */
const isDroppable = (marker) =>
  (marker >= 0xe1 && marker <= 0xef && !KEEP_APP.has(marker)) || marker === 0xfe; // COM

const isJpeg = (buf) => buf.length > 3 && buf[0] === 0xff && buf[1] === SOI;

/** 各セグメントを順に返す。 */
function* segments(buf) {
  let i = 2;
  while (i < buf.length - 1) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === EOI || marker === SOI) { i += 2; continue; }
    if (marker === SOS) { yield { marker, start: i, end: buf.length, isSos: true }; return; }
    const len = buf.readUInt16BE(i + 2);
    yield { marker, start: i, end: i + 2 + len, isSos: false };
    i += 2 + len;
  }
}

/**
 * EXIFのOrientation(回転情報)を読む。1=そのまま、3=180度、6=90度、8=270度。
 * 見つからなければ1を返す。
 */
export function readOrientation(buf) {
  if (!isJpeg(buf)) return 1;

  for (const seg of segments(buf)) {
    if (seg.isSos) break;
    if (seg.marker !== 0xe1) continue;
    const body = seg.start + 4;
    if (buf.toString('latin1', body, body + 6) !== 'Exif\0\0') continue;

    const tiff = body + 6;
    const le = buf.toString('latin1', tiff, tiff + 2) === 'II';
    const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
    const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));

    if (u16(tiff + 2) !== 42) return 1;
    const ifd0 = tiff + u32(tiff + 4);
    if (ifd0 + 2 > buf.length) return 1;

    const count = u16(ifd0);
    for (let n = 0; n < count; n++) {
      const entry = ifd0 + 2 + n * 12;
      if (entry + 12 > buf.length) break;
      if (u16(entry) === 0x0112) return u16(entry + 8) || 1;
    }
    return 1;
  }
  return 1;
}

/**
 * 位置情報を含みうるセグメントを丸ごと落とす。画像データには一切触らない。
 * 戻り値は新しいBuffer。落とした結果、Orientationも一緒に消える点に注意
 * （呼び出し側が readOrientation で事前に読んで、必要なら警告すること）。
 */
export function stripMetadata(buf) {
  if (!isJpeg(buf)) throw new Error('JPEGではありません');

  const parts = [buf.subarray(0, 2)];
  for (const seg of segments(buf)) {
    if (seg.isSos) { parts.push(buf.subarray(seg.start)); break; }
    if (isDroppable(seg.marker)) continue;
    parts.push(buf.subarray(seg.start, seg.end));
  }
  return Buffer.concat(parts);
}

/** 位置情報を持っているかどうか（GPS IFDへのポインタがあるか）。確認用。 */
export function hasGps(buf) {
  if (!isJpeg(buf)) return false;

  for (const seg of segments(buf)) {
    if (seg.isSos) break;
    if (seg.marker !== 0xe1) continue;
    const body = seg.start + 4;
    if (buf.toString('latin1', body, body + 6) !== 'Exif\0\0') continue;

    const tiff = body + 6;
    const le = buf.toString('latin1', tiff, tiff + 2) === 'II';
    const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
    const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));

    if (u16(tiff + 2) !== 42) continue;
    const ifd0 = tiff + u32(tiff + 4);
    if (ifd0 + 2 > buf.length) continue;

    const count = u16(ifd0);
    for (let n = 0; n < count; n++) {
      const entry = ifd0 + 2 + n * 12;
      if (entry + 12 > buf.length) break;
      if (u16(entry) === 0x8825) return true; // GPSInfo
    }
  }
  return false;
}
