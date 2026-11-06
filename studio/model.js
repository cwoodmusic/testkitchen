/** Sparse native document engine. Pixel words are unsigned 0xRRGGBBAA. */
export const TILE_SIZE = 64;
const TILE_PIXELS = TILE_SIZE * TILE_SIZE;
const HISTORY_LIMIT = 64 * 1024 * 1024;
const MAX_RASTER_BYTES = 256 * 1024 * 1024;
const MAX_IMAGE_BYTES = 32 * 1024 * 1024;
const MAX_DIMENSION = 8192;
const KINDS = ['map', 'interior', 'asset', 'customization'];
const BLENDS = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
const PRESETS = { map: [1672, 941], village: [6800, 5100], interior: [960, 720], asset: [128, 128], customization: [80, 96] };
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const fail = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
function object(value, label) { if (!plain(value)) fail(`${label} must be an object.`); return value; }
function number(value, label, min, max, integer = false) { if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(`${label} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`); return value; }
function text(value, label, max = 160) { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) fail(`${label} must be a nonempty string of at most ${max} characters.`); return value; }
function id(value, label = 'ID') { if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(value)) fail(`${label} is invalid.`); return value; }
function uint(value, label = 'Color') { return number(value, label, 0, 0xffffffff, true) >>> 0; }
function boolean(value, label) { if (typeof value !== 'boolean') fail(`${label} must be true or false.`); return value; }
function choice(value, values, label) { if (!values.includes(value)) fail(`${label} is invalid.`); return value; }
function array(value, label, max) { if (!Array.isArray(value) || value.length > max) fail(`${label} must be an array with at most ${max} entries.`); return value; }
function point(value, label, maxX, maxY, defaults) { const v = object(value ?? defaults, label); return { x: number(v.x, `${label} x`, 0, maxX), y: number(v.y, `${label} y`, 0, maxY) }; }
function newId(prefix) { return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`; }

export function packColor(hex) {
  if (typeof hex === 'number') return uint(hex);
  if (typeof hex !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(hex)) fail('Use a hexadecimal color such as #cc8844ff.');
  let value = hex.slice(1);
  if (value.length < 5) value = [...value].map(char => char + char).join('');
  if (value.length === 6) value += 'ff';
  return parseInt(value, 16) >>> 0;
}
export function unpackColor(value) { return `#${uint(value).toString(16).padStart(8, '0')}`; }

function assetCollision(value, width, height) {
  return array(value ?? [], 'Asset collision', 4096).map((raw, index) => {
    const rect = Array.isArray(raw) ? { x: raw[0], y: raw[1], w: raw[2], h: raw[3] } : object(raw, 'Asset collision rectangle');
    const x = number(rect.x, `Collider ${index} x`, 0, width), y = number(rect.y, `Collider ${index} y`, 0, height);
    return { x, y, w: number(rect.w, `Collider ${index} width`, 0.001, width - x), h: number(rect.h, `Collider ${index} height`, 0.001, height - y) };
  });
}
function normalizeAsset(raw) {
  const a = object(raw, 'Asset');
  const width = number(a.width, 'Asset width', 1, MAX_DIMENSION, true), height = number(a.height, 'Asset height', 1, MAX_DIMENSION, true);
  if (width * height > 16 * 1024 * 1024) fail('An asset may contain at most 16 million pixels.');
  const dataURL = a.dataURL;
  if (typeof dataURL !== 'string' || dataURL.length > MAX_IMAGE_BYTES * 4 / 3 + 128 || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataURL) || dataURL.slice(dataURL.indexOf(',') + 1).length % 4 !== 0) fail('Asset image must be a PNG, JPEG, or WebP data URL smaller than 32 MiB.');
  return { id: id(a.id), name: text(a.name, 'Asset name'), width, height, dataURL, anchor: point(a.anchor, 'Asset anchor', width, height, { x: width / 2, y: height }), collision: assetCollision(a.collision, width, height), tags: array(a.tags ?? [], 'Asset tags', 64).map(tag => text(tag, 'Tag', 64)) };
}
function normalizeObject(raw, assets) {
  const o = object(raw, 'Object');
  const assetId = id(o.assetId, 'Object asset ID');
  if (!assets.has(assetId)) fail(`Object refers to missing asset ${assetId}.`);
  const asset = assets.get(assetId);
  return { id: id(o.id), assetId, x: number(o.x ?? 0, 'Object x', -MAX_DIMENSION * 4, MAX_DIMENSION * 4), y: number(o.y ?? 0, 'Object y', -MAX_DIMENSION * 4, MAX_DIMENSION * 4), w: number(o.w ?? asset.width, 'Object width', 0.01, MAX_DIMENSION * 4), h: number(o.h ?? asset.height, 'Object height', 0.01, MAX_DIMENSION * 4), rotation: number(o.rotation ?? 0, 'Object rotation', -360000, 360000), flipX: boolean(o.flipX ?? false, 'Object horizontal flip'), flipY: boolean(o.flipY ?? false, 'Object vertical flip'), opacity: number(o.opacity ?? 1, 'Object opacity', 0, 1), depthOffset: number(o.depthOffset ?? 0, 'Object depth offset', -MAX_DIMENSION * 4, MAX_DIMENSION * 4), anchor: point(o.anchor, 'Object anchor', 1, 1, { x: asset.anchor.x / asset.width, y: asset.anchor.y / asset.height }) };
}
function encodeTile(tile, baseColor) {
  const runs = [];
  for (let offset = 0; offset < TILE_PIXELS;) {
    const color = tile[offset] >>> 0;
    if (color === baseColor) { offset++; continue; }
    let end = offset + 1;
    while (end < TILE_PIXELS && tile[end] === color) end++;
    runs.push([offset, end - offset, color]);
    offset = end;
  }
  return runs;
}
function decodeTile(raw, baseColor) {
  if (raw instanceof Uint32Array) {
    if (raw.length !== TILE_PIXELS) fail('A raster tile must contain exactly 4096 pixels.');
    return raw.slice();
  }
  const runs = array(raw, 'Tile runs', TILE_PIXELS), tile = new Uint32Array(TILE_PIXELS);
  tile.fill(baseColor);
  let end = 0;
  for (const run of runs) {
    if (!Array.isArray(run) || run.length !== 3) fail('A tile run must be [offset,length,color].');
    const offset = number(run[0], 'Tile run offset', end, TILE_PIXELS - 1, true);
    const length = number(run[1], 'Tile run length', 1, TILE_PIXELS - offset, true);
    tile.fill(uint(run[2]), offset, offset + length);
    end = offset + length;
  }
  return tile;
}
function tileCoords(key, width, height) {
  if (!/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(key)) fail(`Invalid tile coordinate ${key}.`);
  const [x, y] = key.split(',').map(Number);
  if (x >= Math.ceil(width / TILE_SIZE) || y >= Math.ceil(height / TILE_SIZE)) fail(`Tile ${key} is outside its scene.`);
  return [x, y];
}
function normalizeLayer(raw, scene, assets, context, runtime) {
  const l = object(raw, 'Layer'), type = choice(l.type ?? 'raster', ['raster', 'objects'], 'Layer type');
  const baseColor = uint(l.baseColor ?? 0), tiles = {};
  const inputTiles = object(l.tiles ?? {}, 'Layer tiles');
  if (type === 'objects' && Object.keys(inputTiles).length) fail('Object layers cannot contain raster tiles.');
  for (const [key, encoded] of Object.entries(inputTiles)) {
    tileCoords(key, scene.width, scene.height);
    context.rasterBytes += TILE_PIXELS * 4;
    if (context.rasterBytes > MAX_RASTER_BYTES) fail('Project raster storage exceeds 256 MiB.');
    const tile = decodeTile(encoded, baseColor), runs = encodeTile(tile, baseColor);
    if (runs.length) tiles[key] = runtime ? tile : runs;
  }
  const objects = array(l.objects ?? [], 'Layer objects', 10000).map(o => normalizeObject(o, assets));
  if (type === 'raster' && objects.length) fail('Raster layers cannot contain placed objects.');
  context.objects += objects.length;
  if (context.objects > 50000) fail('A project may contain at most 50000 placed objects.');
  return { id: id(l.id), name: text(l.name, 'Layer name'), type, role: choice(l.role ?? 'world', ['background', 'world', 'foreground'], 'Layer role'), visible: boolean(l.visible ?? true, 'Layer visibility'), locked: boolean(l.locked ?? false, 'Layer lock'), opacity: number(l.opacity ?? 1, 'Layer opacity', 0, 1), blend: choice(l.blend ?? 'source-over', BLENDS, 'Layer blend'), baseColor: type === 'raster' ? baseColor : 0, tiles, objects };
}
function normalizeCollision(raw, width, height) {
  const collision = object(raw ?? { cellSize: 10, cells: {} }, 'Scene collision'), cellSize = number(collision.cellSize ?? 10, 'Collision cell size', 1, 1024, true), cells = {};
  const inputCells = object(collision.cells ?? {}, 'Collision cells');
  if (Object.keys(inputCells).length > 1000000) fail('A scene may contain at most one million collision overrides.');
  for (const [key, value] of Object.entries(inputCells)) {
    if (!/^(0|[1-9]\d*),(0|[1-9]\d*)$/.test(key)) fail(`Invalid collision coordinate ${key}.`);
    const [col, row] = key.split(',').map(Number);
    if (col >= Math.ceil(width / cellSize) || row >= Math.ceil(height / cellSize)) fail(`Collision cell ${key} is outside its scene.`);
    cells[key] = choice(value, [0, 1], 'Collision cell');
  }
  return { cellSize, cells };
}
function sceneMetadata(s) {
  const width = number(s.width, 'Scene width', 1, MAX_DIMENSION, true), height = number(s.height, 'Scene height', 1, MAX_DIMENSION, true);
  if (s.pixelScale !== undefined && s.pixelScale !== 1) fail('Scene pixelScale must be 1; scene coordinates are native pixels.');
  return { id: id(s.id), name: text(s.name, 'Scene name'), kind: choice(s.kind ?? 'map', KINDS, 'Scene kind'), width, height, pixelScale: 1, anchor: point(s.anchor, 'Scene anchor', width, height, { x: width / 2, y: height }), facing: s.facing == null ? null : choice(s.facing, ['down', 'left', 'up', 'right'], 'Facing') };
}
function normalizeScene(raw, assets, context, runtime) {
  const s = object(raw, 'Scene'), scene = sceneMetadata(s);
  scene.collision = normalizeCollision(s.collision, scene.width, scene.height);
  scene.layers = array(s.layers, 'Scene layers', 128).map(layer => normalizeLayer(layer, scene, assets, context, runtime));
  if (!scene.layers.length) fail('Every scene needs at least one layer.');
  return scene;
}
function normalizeProject(data, runtime) {
  const p = object(data, 'Project');
  if (p.format !== 'CodaPixelStudio' || p.version !== 1) fail('This is not a supported Coda Pixel Studio project (version 1).');
  const assets = array(p.assets ?? [], 'Project assets', 512).map(normalizeAsset);
  let imageBytes = 0;
  for (const asset of assets) { imageBytes += asset.dataURL.length * 0.75; if (imageBytes > 64 * 1024 * 1024) fail('Project asset images exceed 64 MiB.'); }
  const assetsById = new Map(assets.map(asset => [asset.id, asset])), context = { rasterBytes: 0, objects: 0 };
  const scenes = array(p.scenes, 'Project scenes', 64).map(scene => normalizeScene(scene, assetsById, context, runtime));
  if (!scenes.length) fail('A project needs at least one scene.');
  const ids = new Set();
  function unique(value) { if (ids.has(value)) fail(`Duplicate document ID ${value}.`); ids.add(value); }
  unique(id(p.id));
  assets.forEach(asset => unique(asset.id));
  scenes.forEach(scene => { unique(scene.id); scene.layers.forEach(layer => { unique(layer.id); layer.objects.forEach(object => unique(object.id)); }); });
  if (!scenes.some(scene => scene.id === p.activeSceneId)) fail('The active scene does not exist.');
  return { format: 'CodaPixelStudio', version: 1, id: p.id, name: text(p.name, 'Project name'), activeSceneId: p.activeSceneId, scenes, assets };
}
/** Return a detached, validated native JSON document. Runtime tiles are accepted. */
export function validateProject(data) { return normalizeProject(data, false); }

function sceneSpec(spec = {}) {
  const preset = spec.preset ?? spec.kind ?? 'map', dimensions = PRESETS[preset] ?? PRESETS.map;
  const kind = spec.kind ?? (preset === 'village' ? 'map' : KINDS.includes(preset) ? preset : 'map');
  const width = spec.width ?? dimensions[0], height = spec.height ?? dimensions[1];
  return { id: spec.id ?? newId('scene'), name: spec.name ?? (kind === 'customization' ? 'Character · down' : 'Scene 1'), kind, width, height, pixelScale: 1, anchor: spec.anchor ?? (kind === 'customization' && width === 80 && height === 96 ? { x: 40, y: 80 } : { x: width / 2, y: height }), facing: spec.facing ?? (kind === 'customization' ? 'down' : null), collision: spec.collision ?? { cellSize: 10, cells: {} }, layers: spec.layers ?? [{ id: newId('layer'), name: 'Pixels', type: 'raster', role: 'world', visible: true, locked: false, opacity: 1, blend: 'source-over', baseColor: 0, tiles: {}, objects: [] }] };
}
export function createProject(options = {}) {
  object(options, 'Project options');
  const scene = sceneSpec(options);
  const scenes = options.fourFacings && scene.kind === 'customization' ? ['down', 'left', 'up', 'right'].map(facing => sceneSpec({ ...options, id: undefined, name: `Character · ${facing}`, facing })) : [scene];
  return validateProject({ format: 'CodaPixelStudio', version: 1, id: newId('project'), name: options.name ?? 'Untitled project', activeSceneId: scenes[0].id, scenes, assets: [] });
}

function estimate(value, seen = new Set()) {
  if (value == null) return 8;
  if (typeof value === 'string') return value.length * 2 + 16;
  if (typeof value !== 'object') return 8;
  if (seen.has(value)) return 0;
  seen.add(value);
  if (ArrayBuffer.isView(value)) return value.byteLength;
  return 32 + Object.entries(value).reduce((sum, [key, item]) => sum + key.length * 2 + estimate(item, seen), 0);
}
function estimatePatch(patch, seen) {
  if (Array.isArray(patch.before) && Array.isArray(patch.after)) {
    const before = new Set(patch.before), after = new Set(patch.after);
    let bytes = 96 + 8 * (patch.before.length + patch.after.length);
    for (const item of before) if (!after.has(item)) bytes += estimate(item, seen);
    for (const item of after) if (!before.has(item)) bytes += estimate(item, seen);
    return bytes;
  }
  return 96 + estimate(patch.before, seen) + estimate(patch.after, seen);
}
function sameValue(a, b) {
  if (a === b) return true;
  if (a instanceof Uint32Array && b instanceof Uint32Array && a.length === b.length) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
  return false;
}
function allowedPatch(patch, keys, label) { object(patch, label); for (const key of Object.keys(patch)) if (!keys.includes(key)) fail(`${label}: ${key} cannot be changed here.`); }
function layerMetadata(layer) {
  return { name: text(layer.name, 'Layer name'), role: choice(layer.role, ['background', 'world', 'foreground'], 'Layer role'), visible: boolean(layer.visible, 'Layer visibility'), locked: boolean(layer.locked, 'Layer lock'), opacity: number(layer.opacity, 'Layer opacity', 0, 1), blend: choice(layer.blend, BLENDS, 'Layer blend') };
}

export function createStore(input) {
  let project = normalizeProject(input, true), activeLayerId = project.scenes.find(scene => scene.id === project.activeSceneId).layers[0].id;
  let transaction = null, revision = 0, stateId = 0, nextStateId = 0, savedStateId = 0, historyBytes = 0;
  const undoStack = [], redoStack = [], listeners = new Set();
  const getScene = sceneId => project.scenes.find(scene => scene.id === sceneId) ?? fail('Scene does not exist.');
  const getLayer = (sceneId, layerId) => getScene(sceneId).layers.find(layer => layer.id === layerId) ?? fail('Layer does not exist.');
  const editable = (sceneId, layerId, type) => { const layer = getLayer(sceneId, layerId); if (layer.locked) fail(`Layer “${layer.name}” is locked.`); if (type && layer.type !== type) fail(`Choose a ${type === 'raster' ? 'pixel' : 'object'} layer for this edit.`); return layer; };
  const assetsMap = () => new Map(project.assets.map(asset => [asset.id, asset]));
  function reconcile() { if (!project.scenes.some(scene => scene.id === project.activeSceneId)) project.activeSceneId = project.scenes[0].id; const scene = getScene(project.activeSceneId); if (!scene.layers.some(layer => layer.id === activeLayerId)) activeLayerId = scene.layers[0].id; }
  function getState() { let rasterBytes = 0; project.scenes.forEach(scene => scene.layers.forEach(layer => { rasterBytes += Object.keys(layer.tiles).length * TILE_PIXELS * 4; })); return { project, activeSceneId: project.activeSceneId, activeLayerId, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, dirty: stateId !== savedStateId || !!transaction?.patches.length, revision, historyBytes, rasterBytes, inTransaction: !!transaction }; }
  function notify() { revision++; reconcile(); const state = getState(); for (const listener of listeners) listener(state); }
  function begin(label = 'Edit') { if (transaction) fail('An edit transaction is already in progress.'); transaction = { label, patches: [], lookup: new WeakMap(), beforeId: stateId }; notify(); }
  function record(target, key, value) {
    if (!transaction) fail('Internal edit is missing a transaction.');
    let keys = transaction.lookup.get(target); if (!keys) { keys = new Map(); transaction.lookup.set(target, keys); }
    if (!keys.has(key)) { const patch = { target, key, beforeExists: own(target, key), before: target[key], afterExists: false, after: undefined }; keys.set(key, patch); transaction.patches.push(patch); }
    if (value === undefined) delete target[key]; else target[key] = value;
  }
  function apply(patches, direction) { const ordered = direction === 'before' ? [...patches].reverse() : patches; for (const patch of ordered) { if (patch[`${direction}Exists`]) patch.target[patch.key] = patch[direction]; else delete patch.target[patch.key]; } }
  function cancel() { if (!transaction) return false; const pending = transaction; transaction = null; apply(pending.patches, 'before'); notify(); return true; }
  function commit() {
    if (!transaction) return false;
    const pending = transaction; transaction = null;
    for (const patch of pending.patches) { patch.afterExists = own(patch.target, patch.key); patch.after = patch.target[patch.key]; }
    pending.patches = pending.patches.filter(patch => patch.beforeExists !== patch.afterExists || !sameValue(patch.before, patch.after));
    if (!pending.patches.length) { notify(); return false; }
    for (const old of redoStack) historyBytes -= old.bytes; redoStack.length = 0;
    pending.afterId = stateId = ++nextStateId;
    const seen = new Set(); pending.bytes = pending.patches.reduce((sum, patch) => sum + estimatePatch(patch, seen), 0);
    delete pending.lookup;
    if (pending.bytes <= HISTORY_LIMIT) { undoStack.push(pending); historyBytes += pending.bytes; }
    else { undoStack.length = 0; historyBytes = 0; }
    while (historyBytes > HISTORY_LIMIT && undoStack.length) historyBytes -= undoStack.shift().bytes;
    notify(); return true;
  }
  function mutate(label, callback) { const automatic = !transaction; if (automatic) begin(label); try { const result = callback(); if (automatic) commit(); else notify(); return result; } catch (error) { if (automatic) cancel(); throw error; } }
  function tileForWrite(layer, key) {
    const patch = transaction.lookup.get(layer.tiles)?.get(key);
    if (patch) { if (!layer.tiles[key]) { const tile = new Uint32Array(TILE_PIXELS); tile.fill(layer.baseColor); record(layer.tiles, key, tile); } return layer.tiles[key]; }
    const tile = layer.tiles[key]?.slice() ?? new Uint32Array(TILE_PIXELS).fill(layer.baseColor);
    record(layer.tiles, key, tile); return tile;
  }
  function readPixel(sceneId, layerId, x, y) { const scene = getScene(sceneId), layer = getLayer(sceneId, layerId); if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= scene.width || y >= scene.height || layer.type !== 'raster') return 0; return layer.tiles[`${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`]?.[(y % TILE_SIZE) * TILE_SIZE + x % TILE_SIZE] ?? layer.baseColor; }
  function readTile(sceneId, layerId, tx, ty) { const layer = getLayer(sceneId, layerId); return layer.type === 'raster' ? layer.tiles[`${tx},${ty}`] ?? null : null; }
  function writePixels(sceneId, layerId, tuples) {
    const scene = getScene(sceneId), layer = editable(sceneId, layerId, 'raster');
    let tileBudget = Math.floor((MAX_RASTER_BYTES - getState().rasterBytes) / (TILE_PIXELS * 4));
    return mutate('Paint pixels', () => { let count = 0; const touched = new Set(); for (const tuple of tuples) { if (++count > MAX_DIMENSION * MAX_DIMENSION) fail('One pixel operation may contain at most 67108864 pixels.'); if (!tuple || tuple.length !== 3) fail('A pixel must be [x,y,color].'); const x = number(tuple[0], 'Pixel x', -MAX_DIMENSION * 4, MAX_DIMENSION * 4, true), y = number(tuple[1], 'Pixel y', -MAX_DIMENSION * 4, MAX_DIMENSION * 4, true), color = uint(tuple[2]); if (x < 0 || y < 0 || x >= scene.width || y >= scene.height) continue; const key = `${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`, index = (y % TILE_SIZE) * TILE_SIZE + x % TILE_SIZE; if ((layer.tiles[key]?.[index] ?? layer.baseColor) === color) continue; if (!layer.tiles[key] && --tileBudget < 0) fail('Project raster storage exceeds 256 MiB.'); tileForWrite(layer, key)[index] = color; touched.add(key); }
      for (const key of touched) { const tile = layer.tiles[key]; if (tile.every(color => color === layer.baseColor)) record(layer.tiles, key, undefined); }
    });
  }
  function fillLayer(sceneId, layerId, color) { const layer = editable(sceneId, layerId, 'raster'); color = uint(color); return mutate('Fill layer', () => { if (layer.baseColor !== color) record(layer, 'baseColor', color); for (const key of Object.keys(layer.tiles)) record(layer.tiles, key, undefined); }); }
  function fillRect(sceneId, layerId, rect, color) { const scene = getScene(sceneId); editable(sceneId, layerId, 'raster'); object(rect, 'Rectangle'); const x = number(rect.x, 'Rectangle x', -MAX_DIMENSION * 4, MAX_DIMENSION * 4, true), y = number(rect.y, 'Rectangle y', -MAX_DIMENSION * 4, MAX_DIMENSION * 4, true), w = number(rect.w, 'Rectangle width', 0, MAX_DIMENSION * 8, true), h = number(rect.h, 'Rectangle height', 0, MAX_DIMENSION * 8, true); color = uint(color); const left = Math.max(0, x), top = Math.max(0, y), right = Math.min(scene.width, x + w), bottom = Math.min(scene.height, y + h); if (left === 0 && top === 0 && right === scene.width && bottom === scene.height) return fillLayer(sceneId, layerId, color); return writePixels(sceneId, layerId, (function* () { for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) yield [px, py, color]; })()); }
  function undo() { if (transaction) return cancel(); const entry = undoStack.pop(); if (!entry) return false; apply(entry.patches, 'before'); stateId = entry.beforeId; redoStack.push(entry); notify(); return true; }
  function redo() { if (transaction) fail('Finish the current edit before redoing.'); const entry = redoStack.pop(); if (!entry) return false; apply(entry.patches, 'after'); stateId = entry.afterId; undoStack.push(entry); notify(); return true; }
  function setActiveScene(sceneId) { getScene(sceneId); project.activeSceneId = sceneId; reconcile(); notify(); }
  function setActiveLayer(layerId) { getLayer(project.activeSceneId, layerId); activeLayerId = layerId; notify(); }
  function ensureUnique(value) { id(value); if (project.id === value || project.assets.some(a => a.id === value) || project.scenes.some(s => s.id === value || s.layers.some(l => l.id === value || l.objects.some(o => o.id === value)))) fail(`Duplicate document ID ${value}.`); }
  function ensureIncomingIds(values) { const seen = new Set(); for (const value of values) { ensureUnique(value); if (seen.has(value)) fail(`Duplicate document ID ${value}.`); seen.add(value); } }
  const objectCount = () => project.scenes.reduce((sum, scene) => sum + scene.layers.reduce((count, layer) => count + layer.objects.length, 0), 0);
  function addScene(spec = {}) { if (project.scenes.length >= 64) fail('A project may contain at most 64 scenes.'); const scene = normalizeScene(sceneSpec(spec), assetsMap(), { rasterBytes: getState().rasterBytes, objects: objectCount() }, true); ensureIncomingIds([scene.id, ...scene.layers.flatMap(layer => [layer.id, ...layer.objects.map(o => o.id)])]); return mutate('Add scene', () => { record(project, 'scenes', [...project.scenes, scene]); record(project, 'activeSceneId', scene.id); activeLayerId = scene.layers[0].id; return scene.id; }); }
  function updateScene(sceneId, patch) {
    allowedPatch(patch, ['name', 'kind', 'width', 'height', 'anchor', 'facing', 'collision'], 'Scene change');
    const scene = getScene(sceneId), candidate = sceneMetadata({ ...scene, ...patch });
    if (own(patch, 'collision') || candidate.width !== scene.width || candidate.height !== scene.height) {
      candidate.collision = normalizeCollision(patch.collision ?? scene.collision, candidate.width, candidate.height);
      for (const layer of scene.layers) for (const key of Object.keys(layer.tiles)) tileCoords(key, candidate.width, candidate.height);
    }
    return mutate('Edit scene', () => { for (const key of Object.keys(patch)) record(scene, key, candidate[key]); });
  }
  function removeScene(sceneId) { getScene(sceneId); if (project.scenes.length === 1) fail('Keep at least one scene.'); return mutate('Remove scene', () => { record(project, 'scenes', project.scenes.filter(scene => scene.id !== sceneId)); if (project.activeSceneId === sceneId) record(project, 'activeSceneId', project.scenes[0].id); }); }
  function addLayer(sceneId, spec = {}) { const scene = getScene(sceneId); if (scene.layers.length >= 128) fail('A scene may contain at most 128 layers.'); const layer = normalizeLayer({ name: spec.type === 'objects' ? 'Objects' : 'Pixels', ...spec, id: spec.id ?? newId('layer') }, scene, assetsMap(), { rasterBytes: getState().rasterBytes, objects: objectCount() }, true); ensureIncomingIds([layer.id, ...layer.objects.map(o => o.id)]); return mutate('Add layer', () => { record(scene, 'layers', [...scene.layers, layer]); if (sceneId === project.activeSceneId) activeLayerId = layer.id; return layer.id; }); }
  function updateLayer(sceneId, layerId, patch) { allowedPatch(patch, ['name', 'role', 'visible', 'locked', 'opacity', 'blend'], 'Layer change'); const layer = getLayer(sceneId, layerId); if (layer.locked && Object.keys(patch).some(key => !['locked', 'visible'].includes(key))) fail(`Layer “${layer.name}” is locked.`); const candidate = layerMetadata({ ...layer, ...patch }); return mutate('Edit layer', () => { for (const key of Object.keys(patch)) if (!sameValue(layer[key], candidate[key])) record(layer, key, candidate[key]); }); }
  function moveLayer(sceneId, layerId, newIndex) { const scene = getScene(sceneId), layer = editable(sceneId, layerId); number(newIndex, 'Layer index', 0, scene.layers.length - 1, true); const layers = scene.layers.filter(item => item !== layer); layers.splice(newIndex, 0, layer); if (scene.layers.every((item, index) => layers[index] === item)) return; return mutate('Reorder layer', () => record(scene, 'layers', layers)); }
  function removeLayer(sceneId, layerId) { const scene = getScene(sceneId); editable(sceneId, layerId); if (scene.layers.length === 1) fail('Keep at least one layer in each scene.'); return mutate('Remove layer', () => record(scene, 'layers', scene.layers.filter(layer => layer.id !== layerId))); }
  function addAsset(spec = {}) { if (project.assets.length >= 512) fail('A project may contain at most 512 assets.'); const asset = normalizeAsset({ ...spec, id: spec.id ?? newId('asset') }); ensureUnique(asset.id); if (project.assets.reduce((sum, item) => sum + item.dataURL.length * .75, asset.dataURL.length * .75) > 64 * 1024 * 1024) fail('Project asset images exceed 64 MiB.'); return mutate('Add asset', () => { record(project, 'assets', [...project.assets, asset]); return asset.id; }); }
  function updateAsset(assetId, patch) { allowedPatch(patch, ['name', 'width', 'height', 'dataURL', 'anchor', 'collision', 'tags'], 'Asset change'); const asset = project.assets.find(item => item.id === assetId) ?? fail('Asset does not exist.'); const candidate = normalizeAsset({ ...asset, ...patch }); if (project.assets.reduce((sum, item) => sum + (item === asset ? candidate : item).dataURL.length * .75, 0) > 64 * 1024 * 1024) fail('Project asset images exceed 64 MiB.'); return mutate('Edit asset', () => { for (const key of Object.keys(patch)) record(asset, key, candidate[key]); }); }
  function removeAsset(assetId) { if (!project.assets.some(asset => asset.id === assetId)) fail('Asset does not exist.'); const layers = project.scenes.flatMap(scene => scene.layers).filter(layer => layer.objects.some(o => o.assetId === assetId)); if (layers.some(layer => layer.locked)) fail('This asset has placements on a locked layer. Unlock it before deleting the asset.'); return mutate('Remove asset', () => { for (const layer of layers) record(layer, 'objects', layer.objects.filter(o => o.assetId !== assetId)); record(project, 'assets', project.assets.filter(asset => asset.id !== assetId)); }); }
  function addObject(sceneId, layerId, spec = {}) { const layer = editable(sceneId, layerId, 'objects'); if (layer.objects.length >= 10000) fail('A layer may contain at most 10000 objects.'); if (objectCount() >= 50000) fail('A project may contain at most 50000 placed objects.'); const placed = normalizeObject({ ...spec, id: spec.id ?? newId('object') }, assetsMap()); ensureUnique(placed.id); return mutate('Place object', () => { record(layer, 'objects', [...layer.objects, placed]); return placed.id; }); }
  function updateObject(sceneId, layerId, objectId, patch) { allowedPatch(patch, ['assetId', 'x', 'y', 'w', 'h', 'rotation', 'flipX', 'flipY', 'opacity', 'depthOffset', 'anchor'], 'Object change'); const layer = editable(sceneId, layerId, 'objects'), placed = layer.objects.find(o => o.id === objectId) ?? fail('Placed object does not exist.'); const candidate = normalizeObject({ ...placed, ...patch }, assetsMap()); return mutate('Edit object', () => { for (const key of Object.keys(patch)) record(placed, key, candidate[key]); }); }
  function removeObject(sceneId, layerId, objectId) { const layer = editable(sceneId, layerId, 'objects'); if (!layer.objects.some(o => o.id === objectId)) fail('Placed object does not exist.'); return mutate('Remove object', () => record(layer, 'objects', layer.objects.filter(o => o.id !== objectId))); }
  function setCollision(sceneId, tuples) { const scene = getScene(sceneId), cols = Math.ceil(scene.width / scene.collision.cellSize), rows = Math.ceil(scene.height / scene.collision.cellSize); return mutate('Paint collision', () => { let count = 0, size = Object.keys(scene.collision.cells).length; for (const tuple of tuples) { if (++count > 1000000) fail('One collision operation may contain at most one million cells.'); if (!tuple || tuple.length !== 3) fail('A collision cell must be [column,row,value].'); const col = number(tuple[0], 'Collision column', 0, cols - 1, true), row = number(tuple[1], 'Collision row', 0, rows - 1, true), value = tuple[2] === null ? undefined : choice(tuple[2], [0, 1], 'Collision value'), key = `${col},${row}`; if (scene.collision.cells[key] !== value || (value === undefined && own(scene.collision.cells, key))) { if (!own(scene.collision.cells, key) && value !== undefined) size++; else if (value === undefined) size--; if (size > 1000000) fail('A scene may contain at most one million collision overrides.'); record(scene.collision.cells, key, value); } } }); }
  function replace(data) { const next = normalizeProject(data, true); project = next; activeLayerId = getScene(project.activeSceneId).layers[0].id; transaction = null; undoStack.length = 0; redoStack.length = 0; historyBytes = 0; stateId = ++nextStateId; savedStateId = stateId; notify(); }
  function markSaved() { savedStateId = stateId; notify(); }
  return { getProject: () => project, getState, subscribe(fn) { if (typeof fn !== 'function') fail('Subscriber must be a function.'); listeners.add(fn); return () => listeners.delete(fn); }, begin, commit, cancel, undo, redo, setActiveScene, setActiveLayer, readPixel, readTile, writePixels, fillRect, fillLayer, clearLayer: (sceneId, layerId) => fillLayer(sceneId, layerId, 0), addScene, updateScene, removeScene, addLayer, updateLayer, moveLayer, removeLayer, addAsset, updateAsset, removeAsset, addObject, updateObject, removeObject, setCollision, serialize: () => validateProject(project), replace, markSaved };
}
