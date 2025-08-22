// ABIF（ABI サンガーシーケンス .ab1）簡易パーサ（クライアント側）
// 本ビューアで使用する主要タグを抽出します:
//  - 波形: DATA9..12（なければ DATA1..4）
//  - 塩基: PBAS2/PBAS1
//  - 位置: PLOC2/PLOC1
//  - 品質: PCON2/PCON1

function parseDirectoryEntry(view, offset) {
  // ABIF ディレクトリエントリ（ビッグエンディアン、28 バイト）
  // 構造: name[4], number(u32), type(u16), elemSize(u16), numElements(u32), dataSize(u32), dataOffset(u32), handle(u32)
  const name = String.fromCharCode(
    view.getUint8(offset + 0),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
  const number = view.getUint32(offset + 4, false);
  const elementType = view.getUint16(offset + 8, false);
  const elementSize = view.getUint16(offset + 10, false);
  const numElements = view.getUint32(offset + 12, false);
  const dataSize = view.getUint32(offset + 16, false);
  const dataOffset = view.getUint32(offset + 20, false);
  const handle = view.getUint32(offset + 24, false);
  return { name, number, elementType, elementSize, numElements, dataSize, dataOffset, handle, _offset: offset };
}

function readBytes(view, start, length) {
  const out = new Uint8Array(length);
  for (let i = 0; i < length; i++) out[i] = view.getUint8(start + i);
  return out;
}

function readDataBytes(view, dir) {
  // dataSize が 4 以下の場合、dataOffset フィールド内にインライン格納されています
  if (dir.dataSize <= 4) {
    const start = dir._offset + 20;
    const end = Math.min(start + dir.dataSize, view.byteLength);
    if (end <= start) return new Uint8Array();
    return readBytes(view, start, end - start);
  }
  const start = dir.dataOffset;
  const end = Math.min(start + dir.dataSize, view.byteLength);
  if (end <= start) return new Uint8Array();
  return readBytes(view, start, end - start);
}

function bytesToAscii(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

function bytesToIntArray(bytes, elementSize) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = Math.floor(bytes.length / elementSize);
  const out = new Array(n);
  if (elementSize === 1) {
    for (let i = 0; i < n; i++) out[i] = view.getUint8(i);
  } else if (elementSize === 2) {
    for (let i = 0; i < n; i++) out[i] = view.getUint16(i * 2, false); // BE（ビッグエンディアン）
  } else if (elementSize === 4) {
    for (let i = 0; i < n; i++) out[i] = view.getInt32(i * 4, false); // BE（ビッグエンディアン）
  } else {
    // フォールバック: 単純にバイト列として扱う
    for (let i = 0; i < n; i++) out[i] = view.getUint8(i);
  }
  return out;
}

function parseAb1FromBuffer(buf, filename = 'uploaded.ab1') {
  // 引数 buf は ArrayBuffer または Uint8Array
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);

  // ヘッダ: 'ABIF'(0..3), version(u16)(4..5), ルートディレクトリエントリ(6..33, 28B)
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'ABIF') {
    throw new Error('Not an ABIF file');
  }
  // const version = view.getUint16(4, false);
  const root = parseDirectoryEntry(view, 6);

  // ディレクトリ一覧は root.dataOffset から 28B 単位で並ぶ
  const dirTableOffset = root.dataOffset;
  let dirCount = root.numElements;
  const dirSize = 28;
  // dataSize から安全な上限件数を導出
  const maxCountBySize = Math.floor(root.dataSize / dirSize);
  if (!Number.isFinite(dirCount) || dirCount <= 0 || dirCount > maxCountBySize) {
    dirCount = maxCountBySize;
  }
  const tags = new Map(); // キー: NAME+number, 値: エントリ

  for (let i = 0; i < dirCount; i++) {
    const off = dirTableOffset + i * dirSize;
    if (off + dirSize > view.byteLength) break; // 安全のため境界チェック
    const dir = parseDirectoryEntry(view, off);
    tags.set(dir.name + dir.number, dir);
  }

  function getTag(name, number) {
    return tags.get(name + (number ?? ''));
  }

  function readTagArray(name, number) {
    const dir = getTag(name, number);
    if (!dir) return null;
    const bytes = readDataBytes(view, dir);
    return bytesToIntArray(bytes, dir.elementSize);
  }

  function readTagText(name, number) {
    const dir = getTag(name, number);
    if (!dir) return null;
    const bytes = readDataBytes(view, dir);
    // 多くの文字列は C 文字列のため、末尾のヌルを除去
    return bytesToAscii(bytes).replace(/\0+$/, '');
  }

  // 波形トレース（G,A,T,C）。通常は DATA9..12、なければ DATA1..4 を使用
  const dataG = readTagArray('DATA', 9) || readTagArray('DATA', 1) || [];
  const dataA = readTagArray('DATA', 10) || readTagArray('DATA', 2) || [];
  const dataT = readTagArray('DATA', 11) || readTagArray('DATA', 3) || [];
  const dataC = readTagArray('DATA', 12) || readTagArray('DATA', 4) || [];

  const lengths = [dataG.length, dataA.length, dataT.length, dataC.length].filter(Boolean);
  const npoints = lengths.length ? Math.min.apply(null, lengths) : 0;
  const G = dataG.slice(0, npoints);
  const A = dataA.slice(0, npoints);
  const T = dataT.slice(0, npoints);
  const C = dataC.slice(0, npoints);

  // 塩基コールと位置/品質
  let bases = readTagText('PBAS', 2) || readTagText('PBAS', 1) || '';
  bases = (bases || '').toString().toUpperCase().replace(/[^A-Z]/g, '');

  let positions = readTagArray('PLOC', 2) || readTagArray('PLOC', 1) || [];
  positions = Array.isArray(positions) ? positions : [];

  let quality = readTagArray('PCON', 2) || readTagArray('PCON', 1) || [];
  quality = Array.isArray(quality) ? quality : [];

  const nBase = Math.min(bases.length, positions.length);
  const qvals = (quality.length >= nBase) ? quality.slice(0, nBase) : Array(nBase).fill(30);

  const lines = ["base_symbol\tbase_location\tbase_quality"];
  for (let i = 0; i < nBase; i++) {
    lines.push(`${bases[i]}\t${positions[i]}\t${qvals[i]}`);
  }
  const tsv = lines.join("\n");

  const summary = [{
    'file name': filename,
    'base count': nBase,
    'trace length': npoints,
  }];

  const peakData = {
    length: npoints,
    channels: ['G', 'A', 'T', 'C'],
    G, A, T, C,
  };

  return { summary, baseData: tsv, peakData };
}

export function parseAb1(buffer, filename) {
  return parseAb1FromBuffer(buffer, filename);
}

export default { parseAb1 };
