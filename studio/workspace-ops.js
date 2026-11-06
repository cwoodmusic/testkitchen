import { createProject, createStore, packColor, TILE_SIZE } from './model.js';

const MAX_WORK_PIXELS = 8 * 1024 * 1024;
const MAX_RESIZE_HISTORY = 48 * 1024 * 1024;
const MAX_RASTER_BYTES = 256 * 1024 * 1024;
const TILE_BYTES = TILE_SIZE * TILE_SIZE * 4;
const FLOOR = packColor('#929b9dff'), WALL = packColor('#c4c7c8ff'), BASEBOARD = packColor('#7a8587ff');

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192)
    throw new Error('Use whole image dimensions from 1 to 8192 pixels.');
}

/** A neutral, unfurnished room with separate editable floor and wall layers. */
export function createInteriorProject(spec = {}) {
  const width = spec.width ?? 960, height = spec.height ?? 720;
  dimensions(width, height);
  const store = createStore(createProject({ kind: 'interior', width, height, name: spec.name || 'My interior' }));
  const { activeSceneId: sceneId, activeLayerId: floorId } = store.getState();
  store.updateLayer(sceneId, floorId, { name: 'Floor', role: 'background' });
  store.fillLayer(sceneId, floorId, FLOOR);
  const wallId = store.addLayer(sceneId, { name: 'Walls', type: 'raster', role: 'world' });
  const wallHeight = Math.min(height, Math.max(1, Math.round(height * .22)));
  const baseboardHeight = Math.min(wallHeight, Math.max(1, Math.round(height / 240)));
  store.fillRect(sceneId, wallId, { x: 0, y: 0, w: width, h: wallHeight }, WALL);
  store.fillRect(sceneId, wallId, { x: 0, y: wallHeight - baseboardHeight, w: width, h: baseboardHeight }, BASEBOARD);
  return store.serialize();
}

function readRaster(layer, x, y) {
  return layer.tiles[`${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`]?.[(y % TILE_SIZE) * TILE_SIZE + x % TILE_SIZE] ?? layer.baseColor;
}
function resizeCollision(scene, width, height, mode) {
  const cellSize = scene.collision.cellSize, cells = {}, cols = Math.ceil(width / cellSize), rows = Math.ceil(height / cellSize);
  const scaleX = width / scene.width, scaleY = height / scene.height;
  let visits = 0;
  for (const [key, value] of Object.entries(scene.collision.cells)) {
    const [col, row] = key.split(',').map(Number);
    if (mode === 'canvas') {
      if (col < cols && row < rows) cells[key] = value;
      continue;
    }
    const left = Math.max(0, Math.floor(col * cellSize * scaleX / cellSize));
    const top = Math.max(0, Math.floor(row * cellSize * scaleY / cellSize));
    const right = Math.min(cols, Math.ceil(Math.min(scene.width, (col + 1) * cellSize) * scaleX / cellSize));
    const bottom = Math.min(rows, Math.ceil(Math.min(scene.height, (row + 1) * cellSize) * scaleY / cellSize));
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      if (++visits > 1_000_000) throw new Error('This resize would need too many collision cells. Use a smaller size.');
      const destination = `${x},${y}`;
      // Native Coda uses 0 for blocked. A blocked footprint wins overlaps.
      if (cells[destination] !== 0) cells[destination] = value;
    }
  }
  return { cellSize, cells };
}
function objectChanges(scene, width, height, mode) {
  if (mode !== 'scale') return [];
  const sx = width / scene.width, sy = height / scene.height, changes = [];
  if (sx !== sy && scene.layers.some(layer => layer.objects.some(object => ((object.rotation % 180) + 180) % 180 !== 0)))
    throw new Error('Keep the same proportions when resizing rotated assets, or reset their rotation first.');
  for (const layer of scene.layers) for (const object of layer.objects) {
    const patch = { x: object.x * sx, y: object.y * sy, w: object.w * sx, h: object.h * sy, depthOffset: object.depthOffset * sy };
    if (Math.abs(patch.x) > 32768 || Math.abs(patch.y) > 32768 || Math.abs(patch.depthOffset) > 32768 || patch.w < .01 || patch.h < .01 || patch.w > 32768 || patch.h > 32768)
      throw new Error('A placed asset would become too large, too small, or too far outside the canvas. Use a smaller resize.');
    changes.push({ layerId: layer.id, objectId: object.id, patch });
  }
  return changes;
}

/** Resize every scene layer together. The entire operation is one reversible edit. */
export function applySceneResize(store, sceneId, { width, height, mode = 'canvas' } = {}) {
  dimensions(width, height);
  if (!['canvas', 'scale'].includes(mode)) throw new Error('Choose canvas size or scale artwork.');
  const state = store.getState();
  if (state.inTransaction) throw new Error('Finish your current stroke before resizing the image.');
  const project = store.getProject(), scene = project.scenes.find(item => item.id === sceneId);
  if (!scene) throw new Error('Choose an image to resize.');
  if (scene.width === width && scene.height === height) return { width, height, mode, changed: false };
  const rasterLayers = scene.layers.filter(layer => layer.type === 'raster');
  if (rasterLayers.length * (scene.width * scene.height + width * height) > MAX_WORK_PIXELS)
    throw new Error('This resize is too large to keep safely undoable. Use fewer layers or smaller dimensions (up to 8 million combined layer pixels).');
  const collision = resizeCollision(scene, width, height, mode), objects = objectChanges(scene, width, height, mode);
  const anchor = mode === 'scale' ? { x: scene.anchor.x * width / scene.width, y: scene.anchor.y * height / scene.height }
    : { x: Math.min(width, scene.anchor.x), y: Math.min(height, scene.anchor.y) };
  const beforeTileCount = rasterLayers.reduce((sum, layer) => sum + Object.keys(layer.tiles).length, 0);
  let newTileCount = 0;
  const prepared = rasterLayers.map(layer => {
    const baseColor = mode === 'canvas' && (width > scene.width || height > scene.height) ? 0 : layer.baseColor;
    const data = new Uint32Array(width * height), tiles = new Set();
    for (let y = 0; y < height; y++) {
      const sy = mode === 'scale' ? Math.min(scene.height - 1, Math.floor((y + .5) * scene.height / height)) : y;
      for (let x = 0; x < width; x++) {
        const sx = mode === 'scale' ? Math.min(scene.width - 1, Math.floor((x + .5) * scene.width / width)) : x;
        const value = sx < scene.width && sy < scene.height ? readRaster(layer, sx, sy) : 0;
        data[y * width + x] = value;
        if (value !== baseColor) tiles.add(`${Math.floor(x / TILE_SIZE)},${Math.floor(y / TILE_SIZE)}`);
      }
    }
    newTileCount += tiles.size;
    return { layerId: layer.id, baseColor, data };
  });
  if (state.rasterBytes - beforeTileCount * TILE_BYTES + newTileCount * TILE_BYTES > MAX_RASTER_BYTES)
    throw new Error('This resize would exceed the project’s pixel storage. Use smaller dimensions.');
  const historyEstimate = (beforeTileCount + newTileCount) * (TILE_BYTES + 160)
    + (Object.keys(scene.collision.cells).length + Object.keys(collision.cells).length) * 80 + objects.length * 1200 + 4096;
  if (historyEstimate > MAX_RESIZE_HISTORY)
    throw new Error('This resize would be too large to undo safely. Use smaller dimensions or fewer layers.');
  const locks = scene.layers.filter(layer => layer.locked && (layer.type === 'raster' || mode === 'scale')).map(layer => layer.id);
  store.begin(mode === 'scale' ? 'Scale image' : 'Resize canvas');
  try {
    // Resizing the complete image intentionally carries locked layers with it.
    for (const layerId of locks) store.updateLayer(sceneId, layerId, { locked: false });
    // Clear old raster tiles before shrinking scene bounds. Undo retains their values.
    for (const layer of prepared) store.clearLayer(sceneId, layer.layerId);
    store.updateScene(sceneId, { width, height, anchor, collision });
    for (const layer of prepared) {
      store.fillLayer(sceneId, layer.layerId, layer.baseColor);
      store.writePixels(sceneId, layer.layerId, (function* () {
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const value = layer.data[y * width + x];
          if (value !== layer.baseColor) yield [x, y, value];
        }
      })());
    }
    for (const object of objects) store.updateObject(sceneId, object.layerId, object.objectId, object.patch);
    for (const layerId of locks) store.updateLayer(sceneId, layerId, { locked: true });
    store.commit();
    return { width, height, mode, changed: true };
  } catch (error) {
    store.cancel(); throw error;
  }
}
