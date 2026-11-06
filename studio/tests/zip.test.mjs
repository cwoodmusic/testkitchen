import test from 'node:test';
import assert from 'node:assert/strict';
import { crc32, encodeZip, createZip, decodeZip, safeZipPath } from '../zip.js';

test('CRC32 supports standard vectors and incremental Blob chunks', () => {
  const bytes = new TextEncoder().encode('123456789');
  assert.equal(crc32(bytes), 0xcbf43926);
  assert.equal(crc32(bytes.subarray(4), crc32(bytes.subarray(0, 4))), 0xcbf43926);
});
test('portable stored ZIP round-trips UTF-8 names, empty entries, binary bytes and browser Blobs', async () => {
  const entries = new Map([['project.coda-studio.json', '{"name":"🎹"}'], ['scenes/café/empty.txt', ''], ['assets/bytes.png', new Uint8Array([0, 128, 255])]]);
  const binary = encodeZip(entries), decoded = await decodeZip(binary);
  assert.equal(new TextDecoder().decode(decoded.get('project.coda-studio.json')), '{"name":"🎹"}');
  assert.equal(decoded.get('scenes/café/empty.txt').length, 0);
  assert.deepEqual([...decoded.get('assets/bytes.png')], [0, 128, 255]);
  const blobZip = await createZip([['asset.png', new Blob([new Uint8Array([1, 2, 3])])]]);
  assert.equal(blobZip.type, 'application/zip');
  assert.deepEqual([...(await decodeZip(blobZip)).get('asset.png')], [1, 2, 3]);
});
test('encoder rejects traversal, absolute paths, ambiguous separators and duplicate names', () => {
  for (const name of ['../evil', '/tmp/file', 'C:/file', 'folder\\file', 'a//b', './file', 'a/../b', 'a/./b', 'a/', 'a\0b']) assert.throws(() => safeZipPath(name), /Unsafe/);
  assert.throws(() => encodeZip([['same', 'one'], ['same', 'two']]), /Duplicate/);
});
test('decoder rejects payload corruption, truncated archives and mismatched headers', async () => {
  const bytes = encodeZip([['a.txt', 'hello']]);
  const corrupted = bytes.slice(); corrupted[35] ^= 1;
  await assert.rejects(() => decodeZip(corrupted), /checksum/);
  await assert.rejects(() => decodeZip(bytes.subarray(0, bytes.length - 1)), /directory/);
  const nameMismatch = bytes.slice(); nameMismatch[30] = 98;
  await assert.rejects(() => decodeZip(nameMismatch), /bounds/);
  const compressed = bytes.slice(); new DataView(compressed.buffer).setUint16(8, 8, true);
  await assert.rejects(() => decodeZip(compressed), /header/);
});
test('decoder validates directory paths, encryption, method and resource limits', async () => {
  const bytes = encodeZip([['ab', '1234']]);
  await assert.rejects(() => decodeZip(bytes, { entryBytes: 3 }), /size limit/);
  await assert.rejects(() => decodeZip(bytes, { totalBytes: 3 }), /size limit/);
  await assert.rejects(() => decodeZip(bytes, { entries: 0 }), /bounds/);
  const d = new DataView(bytes.buffer), directory = d.getUint32(bytes.length - 6, true);
  const traversal = bytes.slice(); traversal[30] = traversal[directory + 46] = 46; traversal[31] = traversal[directory + 47] = 46;
  await assert.rejects(() => decodeZip(traversal), /filename/);
  const encrypted = bytes.slice(); new DataView(encrypted.buffer).setUint16(directory + 8, 1, true);
  await assert.rejects(() => decodeZip(encrypted), /unencrypted/);
});
