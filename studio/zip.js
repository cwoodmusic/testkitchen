// Portable ZIP32, stored entries only. No network dependencies or decompression.
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: true });
export const ZIP_LIMITS = Object.freeze({ entries: 12000, entryBytes: 256 * 1024 * 1024, totalBytes: 512 * 1024 * 1024 });
const table = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(bytes, seed = 0) {
  let crc = (seed ^ 0xffffffff) >>> 0;
  for (const value of bytes) crc = table[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
export function safeZipPath(name) {
  if (typeof name !== 'string' || !name || name.length > 240 || /[\\\x00-\x1f\x7f:]/.test(name) || name.startsWith('/') || name.endsWith('/') || name.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe ZIP entry path.');
  return name;
}
function bytesOf(value) {
  if (typeof value === 'string') return textEncoder.encode(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error('ZIP entry must contain text, bytes, or a Blob.');
}
function records(entries) {
  const input = entries instanceof Map ? [...entries] : Array.isArray(entries) ? entries.map(e => Array.isArray(e) ? e : [e.name, e.data]) : Object.entries(entries);
  if (input.length > ZIP_LIMITS.entries) throw new Error('Too many ZIP entries.');
  const names = new Set();
  return input.map(([name, data]) => {
    safeZipPath(name);
    if (names.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    names.add(name);
    const filename = textEncoder.encode(name);
    if (filename.length > 65535) throw new Error('ZIP filename is too long.');
    return { name, filename, data };
  });
}
function header(entry, offset, central = false) {
  const bytes = new Uint8Array((central ? 46 : 30) + entry.filename.length);
  const d = new DataView(bytes.buffer);
  d.setUint32(0, central ? 0x02014b50 : 0x04034b50, true);
  if (central) {
    d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x800, true);
    d.setUint32(16, entry.crc, true); d.setUint32(20, entry.size, true); d.setUint32(24, entry.size, true);
    d.setUint16(28, entry.filename.length, true); d.setUint32(42, offset, true);
  } else {
    d.setUint16(4, 20, true); d.setUint16(6, 0x800, true);
    d.setUint32(14, entry.crc, true); d.setUint32(18, entry.size, true); d.setUint32(22, entry.size, true);
    d.setUint16(26, entry.filename.length, true);
  }
  bytes.set(entry.filename, central ? 46 : 30);
  return bytes;
}
function finish(entries) {
  const parts = [], central = [];
  let offset = 0, total = 0;
  for (const entry of entries) {
    if (entry.size > ZIP_LIMITS.entryBytes || (total += entry.size) > ZIP_LIMITS.totalBytes) throw new Error('ZIP exceeds the supported size limit.');
    const local = header(entry, offset);
    parts.push(local, entry.data); central.push(header(entry, offset, true));
    offset += local.length + entry.size;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22), d = new DataView(end.buffer);
  d.setUint32(0, 0x06054b50, true); d.setUint16(8, entries.length, true); d.setUint16(10, entries.length, true);
  d.setUint32(12, centralSize, true); d.setUint32(16, offset, true);
  return [...parts, ...central, end];
}
export function encodeZip(input) {
  const entries = records(input).map(e => {
    const data = bytesOf(e.data);
    return { ...e, data, size: data.length, crc: crc32(data) };
  });
  const parts = finish(entries), out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) { out.set(part, offset); offset += part.length; }
  return out;
}
export async function createZip(input) {
  const entries = records(input);
  let total = 0;
  for (const entry of entries) {
    entry.size = entry.data instanceof Blob ? entry.data.size : bytesOf(entry.data).length;
    if (entry.size > ZIP_LIMITS.entryBytes || (total += entry.size) > ZIP_LIMITS.totalBytes) throw new Error('ZIP exceeds the supported size limit.');
    if (entry.data instanceof Blob) {
      let crc = 0;
      const reader = entry.data.stream().getReader();
      try { while (true) { const next = await reader.read(); if (next.done) break; crc = crc32(next.value, crc); } }
      finally { reader.releaseLock(); }
      entry.crc = crc;
    } else { entry.data = bytesOf(entry.data); entry.crc = crc32(entry.data); }
  }
  return new Blob(finish(entries), { type: 'application/zip' });
}
export async function decodeZip(input, limits = {}) {
  const cap = { ...ZIP_LIMITS, ...limits };
  if (input instanceof Blob && input.size > cap.totalBytes + 8 * 1024 * 1024) throw new Error('ZIP is too large.');
  const bytes = input instanceof Blob ? new Uint8Array(await input.arrayBuffer()) : bytesOf(input);
  if (bytes.length > cap.totalBytes + 8 * 1024 * 1024 || bytes.length < 22) throw new Error('Invalid ZIP size.');
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const bounds = (offset, size) => { if (!Number.isSafeInteger(offset) || offset < 0 || size < 0 || offset + size > bytes.length) throw new Error('Truncated ZIP entry.'); };
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (d.getUint32(i, true) === 0x06054b50 && i + 22 + d.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  }
  if (end < 0 || d.getUint16(end + 4, true) || d.getUint16(end + 6, true)) throw new Error('Unsupported ZIP directory.');
  const count = d.getUint16(end + 10, true), centralSize = d.getUint32(end + 12, true), centralOffset = d.getUint32(end + 16, true);
  if (count !== d.getUint16(end + 8, true) || count > cap.entries || centralOffset + centralSize !== end) throw new Error('Invalid ZIP directory bounds.');
  bounds(centralOffset, centralSize);
  let pos = centralOffset, total = 0;
  const result = new Map(), occupied = [];
  for (let index = 0; index < count; index++) {
    bounds(pos, 46);
    if (d.getUint32(pos, true) !== 0x02014b50) throw new Error('Invalid ZIP central entry.');
    const flags = d.getUint16(pos + 8, true), method = d.getUint16(pos + 10, true), crc = d.getUint32(pos + 16, true);
    const size = d.getUint32(pos + 24, true), compressed = d.getUint32(pos + 20, true);
    const nameLength = d.getUint16(pos + 28, true), extra = d.getUint16(pos + 30, true), comment = d.getUint16(pos + 32, true), local = d.getUint32(pos + 42, true);
    if (flags & ~0x800 || method !== 0 || size !== compressed || d.getUint16(pos + 34, true)) throw new Error('Only unencrypted stored ZIP entries are supported.');
    if (size > cap.entryBytes || (total += size) > cap.totalBytes) throw new Error('ZIP exceeds the supported size limit.');
    bounds(pos + 46, nameLength + extra + comment);
    let name;
    try { name = safeZipPath(textDecoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength))); } catch { throw new Error('Unsafe or invalid ZIP filename.'); }
    if (result.has(name)) throw new Error('Duplicate ZIP entry.');
    bounds(local, 30);
    if (local >= centralOffset || d.getUint32(local, true) !== 0x04034b50 || d.getUint16(local + 6, true) !== flags || d.getUint16(local + 8, true) !== method || d.getUint32(local + 14, true) !== crc || d.getUint32(local + 18, true) !== size || d.getUint32(local + 22, true) !== size) throw new Error('ZIP local header does not match its directory.');
    const localNameLength = d.getUint16(local + 26, true), localExtra = d.getUint16(local + 28, true), start = local + 30 + localNameLength + localExtra;
    bounds(local + 30, localNameLength + localExtra); bounds(start, size);
    if (localNameLength !== nameLength || textDecoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name || start + size > centralOffset) throw new Error('Invalid ZIP entry bounds.');
    const payload = bytes.subarray(start, start + size);
    if (crc32(payload) !== crc) throw new Error(`ZIP checksum failed: ${name}`);
    occupied.push([local, start + size]); result.set(name, payload);
    pos += 46 + nameLength + extra + comment;
  }
  if (pos !== end) throw new Error('ZIP directory size mismatch.');
  occupied.sort((a, b) => a[0] - b[0]);
  if (occupied.some((range, i) => i && range[0] < occupied[i - 1][1])) throw new Error('Overlapping ZIP entries.');
  return result;
}
