import { validateProject, TILE_SIZE } from './model.js';
import { createZip, decodeZip, crc32 } from './zip.js';

const JSON_LIMIT = 128 * 1024 * 1024;
const IMAGE_LIMIT = 32 * 1024 * 1024;
const IMAGE_PIXELS = 16 * 1024 * 1024;
export const AUTOSAVE_DB = 'CodaPixelStudioV1';
const encoder = new TextEncoder(), decoder = new TextDecoder('utf-8', { fatal: true });
const asJSON = value => JSON.stringify(value, null, 2);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

export function safeName(value, fallback = 'project') {
  const name = String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 72);
  return name || fallback;
}
function uniqueName(name, extension) {
  const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 17);
  const id = globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10);
  return `${safeName(name)}-${stamp}-${id}${extension}`;
}
function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > IMAGE_PIXELS) throw new Error('Images must be at most 8192 pixels per side and 16 megapixels. Resize the image before importing.');
  return { width, height };
}
export function imageHeader(bytes) {
  const d = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset, length) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  if (bytes.length >= 33 && bytes[0] === 137 && ascii(1, 3) === 'PNG' && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10 && d.getUint32(8) === 13 && ascii(12, 4) === 'IHDR') {
    return { ...dimensions(d.getUint32(16), d.getUint32(20)), type: 'image/png' };
  }
  if (bytes.length > 12 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) throw new Error('Malformed JPEG image.');
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      if (offset + 2 > bytes.length) break;
      const size = d.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) throw new Error('Truncated JPEG image.');
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && size >= 8) return { ...dimensions(d.getUint16(offset + 5), d.getUint16(offset + 3)), type: 'image/jpeg' };
      offset += size;
    }
  }
  if (bytes.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    if (d.getUint32(4, true) + 8 !== bytes.length) throw new Error('Truncated WebP image.');
    const format = ascii(12, 4);
    if (format === 'VP8X') return { ...dimensions(1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16), 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16)), type: 'image/webp' };
    if (format === 'VP8 ' && bytes[23] === 157 && bytes[24] === 1 && bytes[25] === 42) return { ...dimensions(d.getUint16(26, true) & 16383, d.getUint16(28, true) & 16383), type: 'image/webp' };
    if (format === 'VP8L' && bytes[20] === 47) return { ...dimensions(1 + bytes[21] + ((bytes[22] & 63) << 8), 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 15) << 10)), type: 'image/webp' };
  }
  throw new Error('Choose a valid local PNG, JPEG, or WebP image.');
}
export function decodeDataURL(dataURL) {
  const match = typeof dataURL === 'string' && /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataURL);
  if (!match || !match[2] || match[2].length % 4 || match[2].length > Math.ceil(IMAGE_LIMIT / 3) * 4) throw new Error('Asset image must be a bounded PNG, JPEG, or WebP data URL.');
  let raw;
  try { raw = atob(match[2]); } catch { throw new Error('Asset image contains invalid base64.'); }
  const bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
  const header = imageHeader(bytes);
  if (header.type !== match[1]) throw new Error('Asset image type does not match its bytes.');
  return { bytes, ...header };
}
async function openBitmap(blob) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
    catch { throw new Error('The image could not be decoded. Its data may be damaged.'); }
  }
  if (typeof Image === 'undefined') return null;
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('The image could not be decoded.')); img.src = url; });
  } finally { URL.revokeObjectURL(url); }
}
async function validateImages(project) {
  let total = 0;
  for (const asset of project.assets) {
    const header = decodeDataURL(asset.dataURL);
    if ((total += header.bytes.length) > JSON_LIMIT) throw new Error('The project contains too much image data.');
    if (header.width !== asset.width || header.height !== asset.height) throw new Error(`Asset dimensions do not match its image: ${asset.name}`);
    const bitmap = await openBitmap(new Blob([header.bytes], { type: header.type }));
    if (bitmap) {
      try { if (bitmap.width !== asset.width || bitmap.height !== asset.height) throw new Error(`Asset dimensions do not match its decoded image: ${asset.name}`); }
      finally { bitmap.close?.(); }
    }
  }
  return project;
}
function parseJSON(bytes) {
  if (bytes.length > JSON_LIMIT) throw new Error('Project JSON exceeds the 128 MiB import limit.');
  try { return JSON.parse(decoder.decode(bytes)); } catch { throw new Error('The project file is not valid JSON.'); }
}
export async function readProject(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('Choose a native project JSON or studio ZIP.');
  if (file.size > 520 * 1024 * 1024) throw new Error('Project file is too large.');
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  let data;
  if (signature[0] === 80 && signature[1] === 75) {
    const entries = await decodeZip(file);
    const native = entries.get('project.coda-studio.json');
    if (!native) throw new Error('This ZIP does not contain project.coda-studio.json.');
    data = parseJSON(native);
  } else {
    if (file.size > JSON_LIMIT) throw new Error('Project JSON exceeds the 128 MiB import limit.');
    data = parseJSON(new Uint8Array(await file.arrayBuffer()));
  }
  // Complete validation and image decoding happens before the caller replaces its document.
  return validateImages(validateProject(data));
}
function makeCanvas(width, height) {
  if (typeof document === 'undefined') throw new Error('Image rendering requires a browser.');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  return canvas;
}
function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('The browser could not encode this PNG.')), 'image/png'));
}
export async function readImage(file) {
  if (!file || !Number.isFinite(file.size) || file.size > IMAGE_LIMIT) throw new Error('Choose a PNG, JPEG, or WebP image smaller than 32 MiB.');
  const bytes = new Uint8Array(await file.arrayBuffer()), header = imageHeader(bytes);
  const bitmap = await openBitmap(new Blob([bytes], { type: header.type }));
  if (!bitmap) throw new Error('Image import requires a browser.');
  const size = dimensions(bitmap.width, bitmap.height), canvas = makeCanvas(size.width, size.height);
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    return { name: String(file.name || 'Imported image').replace(/\.[^.]+$/, ''), ...size, data: ctx.getImageData(0, 0, size.width, size.height).data, dataURL: canvas.toDataURL('image/png') };
  } finally { bitmap.close?.(); canvas.width = canvas.height = 1; }
}
export function downloadBlob(blob, filename) {
  if (!(blob instanceof Blob)) throw new Error('Download is missing its data.');
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.hidden = true; document.body.append(link); link.click(); link.remove();
  // Keep object URLs alive until the browser has begun reading a large download.
  const timer = setTimeout(() => URL.revokeObjectURL(url), 60000);
  timer.unref?.();
  return { filename, size: blob.size };
}
export async function downloadProject(store) {
  const revision = store.getState().revision, project = store.serialize();
  const blob = new Blob([asJSON(project)], { type: 'application/json' });
  const info = downloadBlob(blob, uniqueName(project.name, '.coda-studio.json'));
  if (store.getState().revision === revision) store.markSaved();
  return info;
}
function pngChunk(type, bytes) {
  const tag = encoder.encode(type), head = new Uint8Array(8), checksum = new Uint8Array(4);
  new DataView(head.buffer).setUint32(0, bytes.length); head.set(tag, 4);
  new DataView(checksum.buffer).setUint32(0, crc32(bytes, crc32(tag)));
  return [head, bytes, checksum];
}
// Stream zlib-compressed scanlines into PNG IDAT chunks, retaining no full-scene pixel buffer.
export async function pngFromRows(width, height, rows) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192) throw new Error('Invalid PNG dimensions.');
  const ihdr = new Uint8Array(13), view = new DataView(ihdr.buffer);
  view.setUint32(0, width); view.setUint32(4, height); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), ...pngChunk('IHDR', ihdr)];
  let count = 0;
  async function* checkedRows() {
    for await (const row of rows) {
      if (!(row instanceof Uint8Array) && !(row instanceof Uint8ClampedArray) || row.length !== width * 4 || ++count > height) throw new Error('PNG scanline dimensions do not match.');
      const scan = new Uint8Array(1 + row.length); scan.set(row, 1); yield scan;
    }
    if (count !== height) throw new Error('PNG is missing scanlines.');
  }
  if (typeof CompressionStream === 'function') {
    const stream = new CompressionStream('deflate'), writer = stream.writable.getWriter(), reader = stream.readable.getReader();
    const reading = (async () => { while (true) { const result = await reader.read(); if (result.done) break; parts.push(...pngChunk('IDAT', result.value)); } })();
    try { for await (const scan of checkedRows()) await writer.write(scan); await writer.close(); await reading; }
    catch (error) { await writer.abort(error).catch(() => {}); await reading.catch(() => {}); throw error; }
    finally { writer.releaseLock(); reader.releaseLock(); }
  } else {
    // Standards-compatible bounded fallback: uncompressed DEFLATE blocks.
    parts.push(...pngChunk('IDAT', new Uint8Array([120, 1])));
    let a = 1, b = 0;
    for await (const scan of checkedRows()) {
      for (const value of scan) { a = (a + value) % 65521; b = (b + a) % 65521; }
      for (let offset = 0; offset < scan.length; offset += 65535) {
        const data = scan.subarray(offset, offset + 65535), header = new Uint8Array(5), dv = new DataView(header.buffer);
        dv.setUint16(1, data.length, true); dv.setUint16(3, (~data.length) & 65535, true);
        parts.push(...pngChunk('IDAT', header), ...pngChunk('IDAT', data));
      }
    }
    const ending = new Uint8Array(9); ending[0] = 1; ending[3] = ending[4] = 255;
    new DataView(ending.buffer).setUint32(5, ((b << 16) | a) >>> 0);
    parts.push(...pngChunk('IDAT', ending));
  }
  parts.push(...pngChunk('IEND', new Uint8Array()));
  return new Blob(parts, { type: 'image/png' });
}
async function renderPNG(viewport, scene, options = {}) {
  if (scene.width * scene.height <= IMAGE_PIXELS) {
    const canvas = await viewport.renderRegion({ sceneId: scene.id, ...options, rect: { x: 0, y: 0, w: scene.width, h: scene.height }, scale: 1, objects: true });
    try { return await canvasBlob(canvas); } finally { canvas.width = canvas.height = 1; }
  }
  async function* rows() {
    for (let y = 0; y < scene.height; y += 64) {
      const height = Math.min(64, scene.height - y), stripe = new Uint8Array(scene.width * height * 4);
      for (let x = 0; x < scene.width; x += 512) {
        const width = Math.min(512, scene.width - x);
        const canvas = await viewport.renderRegion({ sceneId: scene.id, ...options, rect: { x, y, w: width, h: height }, scale: 1, objects: true });
        try {
          const pixels = canvas.getContext('2d').getImageData(0, 0, width, height).data;
          for (let row = 0; row < height; row++) stripe.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), (row * scene.width + x) * 4);
        } finally { canvas.width = canvas.height = 1; }
      }
      for (let row = 0; row < height; row++) yield stripe.subarray(row * scene.width * 4, (row + 1) * scene.width * 4);
      await tick();
    }
  }
  return pngFromRows(scene.width, scene.height, rows());
}
export async function exportPNG({ store, viewport, sceneId, layerId }) {
  const revision = store.getState().revision;
  const project = store.getProject(), scene = project.scenes.find(s => s.id === (sceneId || store.getState().activeSceneId));
  if (!scene) throw new Error('Choose a scene to export.');
  if (layerId && !scene.layers.some(l => l.id === layerId)) throw new Error('Choose a valid layer to export.');
  const blob = await renderPNG(viewport, scene, layerId ? { layerId } : {});
  if (store.getState().revision !== revision) throw new Error('Project changed during export. Export again after finishing the edit.');
  return downloadBlob(blob, uniqueName(scene.name + (layerId ? '-layer' : ''), '.png'));
}
function opaqueChunks(layer, width, height) {
  const chunks = new Set();
  if ((layer.baseColor & 255) !== 0) {
    for (let y = 0; y < height; y += 512) for (let x = 0; x < width; x += 512) chunks.add(`${x},${y}`);
  } else for (const [key, tile] of Object.entries(layer.tiles)) {
    let visible = false;
    if (tile instanceof Uint32Array) visible = tile.some(color => (color & 255) !== 0);
    else visible = tile.some(run => (run[2] & 255) !== 0);
    if (!visible) continue;
    const [tx, ty] = key.split(',').map(Number), x = Math.floor(tx * TILE_SIZE / 512) * 512, y = Math.floor(ty * TILE_SIZE / 512) * 512;
    if (x < width && y < height) chunks.add(`${x},${y}`);
  }
  return [...chunks].map(key => key.split(',').map(Number)).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}
function pathIds(items) {
  const used = new Set();
  return new Map(items.map((item, index) => {
    const base = safeName(item.id, `item-${index + 1}`); let value = base, suffix = 1;
    while (used.has(value.toLowerCase())) value = `${base}-${++suffix}`;
    used.add(value.toLowerCase()); return [item.id, value];
  }));
}
export async function exportBundle({ store, viewport }) {
  // Capture a native snapshot. Edits made while rendering abort the handoff instead of mixing revisions.
  const revision = store.getState().revision, project = store.serialize();
  const assertStable = () => { if (store.getState().revision !== revision) throw new Error('Project changed during export. Export again after finishing the edit.'); };
  const entries = new Map([['project.coda-studio.json', asJSON(project)]]), scenePaths = pathIds(project.scenes), assetPaths = pathIds(project.assets);
  const manifest = { format: 'CodaPixelStudioBundle', version: 1, projectId: project.id, name: project.name, createdAt: new Date().toISOString(), nativeProject: 'project.coda-studio.json', chunkSize: 512, coordinateSystem: 'source pixels; object x/y are top-left', depthRule: 'y + h * anchor.y + depthOffset', collisionValues: { 0: 'blocked', 1: 'open', absent: 'open' }, scenes: [], assets: [], integration: { status: 'native-handoff-requires-game-integration', originalWorldSize: { width: 1672, height: 941 }, note: 'Dimensions alone do not make a game-importable world. Rooms have a different schema. No game files are overwritten by this bundle.' } };
  for (const scene of project.scenes) {
    const folder = `scenes/${scenePaths.get(scene.id)}`, layerPaths = pathIds(scene.layers);
    const metadata = { ...scene, layers: scene.layers.map(layer => ({ ...layer, tiles: undefined, chunks: [], missingChunks: 'transparent', chunkCompositing: 'raw source pixels; apply layer opacity and blend once when composing' })) };
    for (let index = 0; index < scene.layers.length; index++) {
      const layer = scene.layers[index];
      if (layer.type !== 'raster') continue;
      for (const [x, y] of opaqueChunks(layer, scene.width, scene.height)) {
        assertStable();
        const w = Math.min(512, scene.width - x), h = Math.min(512, scene.height - y), path = `${folder}/layers/${layerPaths.get(layer.id)}/${x}-${y}.png`;
        const canvas = await viewport.renderRegion({ sceneId: scene.id, layerId: layer.id, rect: { x, y, w, h }, scale: 1, objects: false, rawLayer: true });
        try { entries.set(path, await canvasBlob(canvas)); } finally { canvas.width = canvas.height = 1; }
        metadata.layers[index].chunks.push({ path, x, y, width: w, height: h });
        await tick();
      }
    }
    assertStable();
    const scale = Math.min(1, 1024 / Math.max(scene.width, scene.height));
    const preview = await viewport.renderRegion({ sceneId: scene.id, rect: { x: 0, y: 0, w: scene.width, h: scene.height }, scale, objects: true });
    try { entries.set(`${folder}/preview.png`, await canvasBlob(preview)); } finally { preview.width = preview.height = 1; }
    entries.set(`${folder}/scene.json`, asJSON(metadata));
    manifest.scenes.push({ id: scene.id, name: scene.name, kind: scene.kind, width: scene.width, height: scene.height, metadata: `${folder}/scene.json`, preview: `${folder}/preview.png`, originalWorldDimensions: scene.width === 1672 && scene.height === 941 });
  }
  for (const asset of project.assets) {
    assertStable();
    const source = decodeDataURL(asset.dataURL), path = `assets/${assetPaths.get(asset.id)}.png`;
    if (source.type === 'image/png') entries.set(path, new Blob([source.bytes], { type: 'image/png' }));
    else {
      const bitmap = await openBitmap(new Blob([source.bytes], { type: source.type }));
      if (!bitmap) throw new Error('Asset PNG export requires a browser.');
      const canvas = makeCanvas(asset.width, asset.height);
      try { canvas.getContext('2d').drawImage(bitmap, 0, 0); entries.set(path, await canvasBlob(canvas)); }
      finally { bitmap.close?.(); canvas.width = canvas.height = 1; }
    }
    manifest.assets.push({ ...asset, dataURL: undefined, path });
  }
  entries.set('manifest.json', asJSON(manifest));
  entries.set('README.txt', `Coda Pixel Studio integration handoff\n\nOpen project.coda-studio.json (or this ZIP) in Pixel Studio to retain all editable layers, sparse pixels, reusable assets, object placements, collision cells, anchors, facing, and scene bounds.\n\nmanifest.json lists scenes and assets. Each scene.json records layer order, roles (background/world/foreground), visibility, lock, opacity/blend, objects, collision grid, anchor and dimensions. Raster PNG chunks are 512 source pixels at most; x/y in scene.json place them without scaling. Omitted chunks are transparent. Layer PNGs contain raw pixels; apply opacity/blend once. Previews contain visible artwork only. Objects reference original asset IDs; match them with manifest.assets. Object depth is y + h * anchor.y + depthOffset. PNG files contain no editor grid, collision overlay or selection.\n\nThis native bundle is a complete integration handoff, not an automatic game patch. The original Coda world is exactly 1672x941 pixels with 10-pixel collision cells. Other map sizes, including the 6800x5100 village, need explicit integration. Rooms use a separate schema. No adapter or live game import compatibility is claimed. Review collision semantics and foreground depth when adding artwork to the game. Nothing is uploaded or deployed.\n`);
  assertStable();
  const blob = await createZip(entries); assertStable();
  return { ...downloadBlob(blob, uniqueName(project.name, '-integration.zip')), entries: entries.size, scenes: project.scenes.length, assets: project.assets.length };
}

export function createAutosave({ store, onStatus = () => {} }) {
  let db = null, stopped = false, timer = null, saving = null, requested = false;
  const report = error => onStatus(`Local autosave unavailable: ${error?.message || error}. Download project JSON to keep a backup.`);
  const ready = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') { report('IndexedDB is not supported'); resolve(false); return; }
    const request = indexedDB.open(AUTOSAVE_DB, 1);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('projects')) request.result.createObjectStore('projects', { keyPath: 'id' }); };
    request.onerror = () => { report(request.error || 'database open failed'); resolve(false); };
    request.onblocked = () => { report('another tab is blocking the local library'); resolve(false); };
    request.onsuccess = () => { if (stopped) request.result.close(); else { db = request.result; db.onversionchange = () => { db.close(); db = null; report('database changed in another tab'); }; } resolve(Boolean(db)); };
  });
  async function transaction(mode, action) {
    await ready;
    if (!db || stopped) throw new Error('The local project library is unavailable');
    return new Promise((resolve, reject) => {
      const tx = db.transaction('projects', mode); let result;
      tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error || new Error('Local database transaction failed')); tx.onabort = () => reject(tx.error || new Error('Local database transaction was aborted'));
      const request = action(tx.objectStore('projects'));
      request.onsuccess = () => { result = request.result; };
    });
  }
  async function saveNow() {
    clearTimeout(timer); timer = null;
    if (saving) { requested = true; return saving; }
    saving = (async () => {
      try {
        await ready;
        let result = false;
        do {
          requested = false;
          const state = store.getState();
          if (state.inTransaction) { requested = true; return result; }
          const project = store.serialize(), entry = { id: project.id, name: project.name, updatedAt: new Date().toISOString(), sceneCount: project.scenes.length, revision: state.revision, project };
          await transaction('readwrite', objectStore => objectStore.put(entry));
          result = { id: entry.id, name: entry.name, updatedAt: entry.updatedAt, sceneCount: entry.sceneCount };
        } while (requested && !stopped);
        onStatus('Autosaved locally · download a project backup for safekeeping.');
        return result;
      } catch (error) { report(error); return false; }
      finally { saving = null; if (requested && !stopped) { requested = false; timer = setTimeout(saveNow, 500); } }
    })();
    return saving;
  }
  const unsubscribe = store.subscribe(() => {
    if (stopped || store.getState().inTransaction) return;
    clearTimeout(timer); timer = setTimeout(saveNow, 1000);
  });
  const visibility = () => { if (globalThis.document?.visibilityState === 'hidden') void saveNow(); };
  globalThis.document?.addEventListener('visibilitychange', visibility);
  return {
    ready,
    async list() {
      try {
        await ready;
        if (!db || stopped) throw new Error('The local project library is unavailable');
        const entries = await new Promise((resolve, reject) => {
          const tx = db.transaction('projects', 'readonly'), result = [];
          const cursor = tx.objectStore('projects').openCursor();
          cursor.onsuccess = () => {
            const item = cursor.result;
            if (!item) return;
            const { project, ...entry } = item.value; result.push(entry); item.continue();
          };
          tx.oncomplete = () => resolve(result); tx.onerror = () => reject(tx.error || new Error('Local library could not be read'));
          tx.onabort = () => reject(tx.error || new Error('Local library read was aborted'));
        });
        return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      }
      catch (error) { report(error); return []; }
    },
    async load(id) {
      const entry = await transaction('readonly', objectStore => objectStore.get(id));
      if (!entry) throw new Error('This saved project is no longer in the local library.');
      const project = await validateImages(validateProject(entry.project));
      // Caller replaces only after this promise resolves; a failed recovery cannot clobber its current document.
      return project;
    },
    saveNow,
    destroy() { stopped = true; clearTimeout(timer); unsubscribe(); globalThis.document?.removeEventListener('visibilitychange', visibility); db?.close(); db = null; }
  };
}
