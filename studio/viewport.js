import { TILE_SIZE, unpackColor } from './model.js';
import { selectionContains } from './smart-select.js?v=materials-1';

const MAX_OUTPUT_PIXELS = 16 * 1024 * 1024;
const MAX_CACHE_BYTES = 32 * 1024 * 1024;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const textInput = node => !!(node?.isContentEditable || node?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog,[role="dialog"]'));

export function selectionBounds(selection) {
  if (!selection) return null;
  const x = Math.floor(selection.x), y = Math.floor(selection.y);
  return { x, y, w: Math.max(0, Math.ceil(selection.x + selection.w) - x), h: Math.max(0, Math.ceil(selection.y + selection.h) - y) };
}

export function pointInSelection(selection, x, y) {
  return selectionContains(selection, x, y);
}

export function* imageDataToPixels(image, x = 0, y = 0, selection = null) {
  for (let iy = 0; iy < image.height; iy++) for (let ix = 0; ix < image.width; ix++) {
    if (!pointInSelection(selection, x + ix, y + iy)) continue;
    const i = (iy * image.width + ix) * 4, d = image.data;
    yield [x + ix, y + iy, ((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0];
  }
}

export function objectLocalPoint(object, point, asset) {
  let x = point.x - object.x - object.w / 2, y = point.y - object.y - object.h / 2;
  const angle = -(object.rotation || 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  [x, y] = [x * c - y * s, x * s + y * c];
  x = x / object.w + .5; y = y / object.h + .5;
  if (object.flipX) x = 1 - x;
  if (object.flipY) y = 1 - y;
  return { x: x * asset.width, y: y * asset.height };
}

export function collisionBlocksRect(collision, rect) {
  const size = collision.cellSize;
  const left = Math.floor(rect.x / size), right = Math.floor((rect.x + rect.w - .001) / size);
  const top = Math.floor(rect.y / size), bottom = Math.floor((rect.y + rect.h - .001) / size);
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) if (collision.cells[`${x},${y}`] === 0) return true;
  return false;
}

export function createViewport({ canvas, store, onStatus = () => {} }) {
  const context = canvas.getContext('2d', { alpha: false });
  const scratch = document.createElement('canvas'), scratchContext = scratch.getContext('2d');
  const screenSurface = document.createElement('canvas');
  const checker = document.createElement('canvas'); checker.width = 16; checker.height = 16;
  const checkerContext = checker.getContext('2d'); checkerContext.fillStyle = '#c4ccd6'; checkerContext.fillRect(0, 0, 16, 16); checkerContext.fillStyle = '#aab6c4'; checkerContext.fillRect(0, 0, 8, 8); checkerContext.fillRect(8, 8, 8, 8);
  const tileCache = new Map(), imageCache = new Map();
  let cacheBytes = 0, zoom = 1, panX = 0, panY = 0, selection = null, preview = null;
  let grid = false, collision = false, onionSkin = false, background = '#222b38';
  let selectedObjectId = null, frame = 0, destroyed = false, fitted = false, cssWidth = 1, cssHeight = 1;
  let currentSceneId = store.getState().activeSceneId;
  const walk = { enabled: false, x: 0, y: 0, blocked: false, radius: 10, width: 80, height: 96 };
  const keys = new Set();
  let lastTime = 0;
  let maskGeometry = null;
  const scene = id => store.getProject().scenes.find(item => item.id === (id || store.getState().activeSceneId));
  const assetFor = id => store.getProject().assets.find(item => item.id === id);

  function getImage(asset) {
    if (!asset) return null;
    let entry = imageCache.get(asset.id);
    if (entry?.url === asset.dataURL) { imageCache.delete(asset.id); imageCache.set(asset.id, entry); return entry; }
    const image = new Image();
    entry = { url: asset.dataURL, image, ready: false, error: null, pixels: null, bytes: asset.width * asset.height * 4 };
    entry.promise = new Promise((resolve, reject) => {
      image.onload = () => { entry.ready = true; invalidate(); resolve(image); };
      image.onerror = () => { entry.error = new Error(`Could not decode asset: ${asset.name}`); reject(entry.error); invalidate(); };
    });
    // Keep a rejected decode observable to callers without an unhandled rejection.
    entry.promise.catch(() => {});
    image.src = asset.dataURL;
    imageCache.set(asset.id, entry);
    let bytes = [...imageCache.values()].reduce((n, item) => n + item.bytes * (item.pixels ? 2 : 1), 0);
    for (const [id, old] of imageCache) {
      if (bytes <= MAX_CACHE_BYTES || id === asset.id) break;
      imageCache.delete(id); bytes -= old.bytes * (old.pixels ? 2 : 1);
    }
    return entry;
  }

  async function getAssetPixels(id) {
    const asset = assetFor(id);
    if (!asset) throw new Error('Choose an existing asset first.');
    if (asset.width * asset.height > MAX_OUTPUT_PIXELS) throw new Error('Asset exceeds the 16 megapixel editing limit.');
    const entry = getImage(asset);
    await entry.promise;
    if (!entry.pixels) {
      const surface = document.createElement('canvas'); surface.width = asset.width; surface.height = asset.height;
      const ctx = surface.getContext('2d', { willReadFrequently: true }); ctx.drawImage(entry.image, 0, 0);
      entry.pixels = ctx.getImageData(0, 0, asset.width, asset.height);
    }
    return entry.pixels;
  }

  function tileImage(sceneId, layer, tx, ty) {
    const data = store.readTile(sceneId, layer.id, tx, ty);
    if (!data) return null;
    const key = `${sceneId}/${layer.id}/${tx},${ty}`;
    if (tileCache.has(key)) { const value = tileCache.get(key); tileCache.delete(key); tileCache.set(key, value); return value; }
    const tile = document.createElement('canvas'); tile.width = TILE_SIZE; tile.height = TILE_SIZE;
    const ctx = tile.getContext('2d'), pixels = ctx.createImageData(TILE_SIZE, TILE_SIZE), d = pixels.data;
    for (let i = 0; i < data.length; i++) {
      const value = data[i]; d[i * 4] = value >>> 24; d[i * 4 + 1] = value >>> 16 & 255; d[i * 4 + 2] = value >>> 8 & 255; d[i * 4 + 3] = value & 255;
    }
    ctx.putImageData(pixels, 0, 0); tileCache.set(key, tile); cacheBytes += TILE_SIZE * TILE_SIZE * 4;
    while (cacheBytes > MAX_CACHE_BYTES) { const first = tileCache.keys().next().value; tileCache.delete(first); cacheBytes -= TILE_SIZE * TILE_SIZE * 4; }
    return tile;
  }

  function drawRaster(ctx, current, layer, rect) {
    if (layer.baseColor) { ctx.fillStyle = unpackColor(layer.baseColor); ctx.fillRect(0, 0, current.width, current.height); }
    const left = Math.max(0, Math.floor(rect.x / TILE_SIZE)), top = Math.max(0, Math.floor(rect.y / TILE_SIZE));
    const right = Math.min(Math.ceil(current.width / TILE_SIZE), Math.ceil((rect.x + rect.w) / TILE_SIZE));
    const bottom = Math.min(Math.ceil(current.height / TILE_SIZE), Math.ceil((rect.y + rect.h) / TILE_SIZE));
    // Iterate explicit sparse tiles, never a full-map raster or grid of absent tiles.
    for (const key of Object.keys(layer.tiles || {})) {
      const [tx, ty] = key.split(',').map(Number);
      if (tx < left || tx >= right || ty < top || ty >= bottom) continue;
      const tile = tileImage(current.id, layer, tx, ty);
      if (!tile) continue;
      ctx.clearRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      ctx.drawImage(tile, tx * TILE_SIZE, ty * TILE_SIZE);
    }
  }

  function drawObject(ctx, object, loadedEntry = null) {
    const transform = ctx.getTransform(), radius = Math.hypot(object.w, object.h) / 2;
    const centerX = object.x + object.w / 2, centerY = object.y + object.h / 2;
    const screenX = transform.a * centerX + transform.c * centerY + transform.e, screenY = transform.b * centerX + transform.d * centerY + transform.f;
    const screenRadius = radius * Math.max(Math.hypot(transform.a, transform.b), Math.hypot(transform.c, transform.d));
    if (screenX + screenRadius < 0 || screenY + screenRadius < 0 || screenX - screenRadius > ctx.canvas.width || screenY - screenRadius > ctx.canvas.height) return;
    const asset = assetFor(object.assetId), entry = loadedEntry || getImage(asset);
    if (!entry?.ready || object.opacity === 0) return;
    ctx.save(); ctx.globalAlpha *= object.opacity ?? 1;
    ctx.translate(object.x + object.w / 2, object.y + object.h / 2);
    ctx.rotate((object.rotation || 0) * Math.PI / 180); ctx.scale(object.flipX ? -1 : 1, object.flipY ? -1 : 1);
    ctx.drawImage(entry.image, -object.w / 2, -object.h / 2, object.w, object.h); ctx.restore();
  }

  function drawPlayer(ctx) {
    const x = Math.round(walk.x), y = Math.round(walk.y), step = keys.size ? Math.sin(performance.now() / 110) * 3 : 0;
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#11182766'; ctx.beginPath(); ctx.ellipse(0, 0, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
    // Native Coda customization canvas: 80 × 96, feet anchored at (40,80).
    ctx.fillStyle = '#203447'; ctx.fillRect(-13, -25, 10, 25 + step); ctx.fillRect(3, -25, 10, 25 - step);
    ctx.fillStyle = '#e4b187'; ctx.fillRect(-15, -68, 30, 27); ctx.fillRect(-23, -40, 8, 26); ctx.fillRect(15, -40, 8, 26);
    ctx.fillStyle = '#3d2f35'; ctx.fillRect(-17, -73, 34, 14); ctx.fillRect(-18, -61, 6, 12);
    ctx.fillStyle = '#5fc6ab'; ctx.fillRect(-16, -43, 32, 24); ctx.fillRect(-22, -43, 44, 10);
    ctx.fillStyle = '#172c3c'; ctx.fillRect(-7, -56, 3, 3); ctx.fillRect(6, -56, 3, 3);
    ctx.strokeStyle = walk.blocked ? '#ff7777' : '#99f2cd'; ctx.lineWidth = 1; ctx.strokeRect(-10, -5, 20, 10); ctx.restore();
  }

  function composite(ctx, current, rect, scale, width, height, layers, objects, includePlayer = false) {
    if (scratch.width !== width || scratch.height !== height) { scratch.width = width; scratch.height = height; }
    const worldObjects = [];
    const drawLayer = (layer, raster = true, layerObjects = true) => {
      scratchContext.setTransform(1, 0, 0, 1, 0, 0); scratchContext.clearRect(0, 0, width, height);
      scratchContext.imageSmoothingEnabled = false; scratchContext.globalAlpha = 1; scratchContext.globalCompositeOperation = 'source-over';
      scratchContext.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale);
      scratchContext.beginPath(); scratchContext.rect(0, 0, current.width, current.height); scratchContext.clip();
      if (raster && layer.type === 'raster') drawRaster(scratchContext, current, layer, rect);
      if (objects && layerObjects) for (const object of [...(layer.objects || [])].sort(depthSort)) drawObject(scratchContext, object);
      ctx.save(); ctx.globalAlpha *= layer.opacity ?? 1; ctx.globalCompositeOperation = layer.blend || 'source-over'; ctx.drawImage(scratch, 0, 0); ctx.restore();
      // Reset also releases the clip for the next layer.
      scratchContext.resetTransform(); scratchContext.restore();
    };
    for (const role of ['background', 'world', 'foreground']) {
      for (const layer of layers.filter(item => (item.role || 'world') === role)) {
        scratchContext.save();
        if (role === 'world' && objects && layer.objects?.length) { drawLayer(layer, true, false); worldObjects.push(...layer.objects.map(object => ({ object, layer }))); }
        else drawLayer(layer);
      }
      if (role === 'world') {
        const ordered = worldObjects.sort((a, b) => depthSort(a.object, b.object));
        let playerDrawn = !includePlayer;
        ctx.save(); ctx.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale); ctx.beginPath(); ctx.rect(0, 0, current.width, current.height); ctx.clip();
        for (const { object, layer } of ordered) {
          if (!playerDrawn && walk.y < depth(object)) { drawPlayer(ctx); playerDrawn = true; }
          ctx.save(); ctx.globalAlpha *= layer.opacity ?? 1; ctx.globalCompositeOperation = layer.blend || 'source-over'; drawObject(ctx, object); ctx.restore();
        }
        if (!playerDrawn) drawPlayer(ctx); ctx.restore();
      }
    }
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect(), ratio = Math.min(2, window.devicePixelRatio || 1);
    cssWidth = Math.max(1, bounds.width); cssHeight = Math.max(1, bounds.height);
    const width = Math.max(1, Math.round(cssWidth * ratio)), height = Math.max(1, Math.round(cssHeight * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    if (!fitted && cssWidth > 1 && cssHeight > 1) fit();
  }

  function selectionGeometry() {
    if (!selection?.mask) return null;
    const { mask, w, h } = selection;
    if (maskGeometry?.mask === mask) return maskGeometry;
    const clip = new Path2D(), edge = new Path2D();
    for (let y = 0; y < h; y++) {
      const offset = y * w;
      for (let x = 0; x < w;) {
        if (!mask[offset + x]) { x++; continue; }
        const start = x;
        while (x < w && mask[offset + x]) x++;
        clip.rect(start, y, x - start, 1);
        edge.moveTo(start, y); edge.lineTo(start, y + 1);
        edge.moveTo(x, y); edge.lineTo(x, y + 1);
        // Only exposed edges are outlined, including holes inside a selection.
        for (const dy of [-1, 1]) {
          let edgeStart = -1;
          for (let sx = start; sx <= x; sx++) {
            const exposed = sx < x && (y + dy < 0 || y + dy >= h || !mask[(y + dy) * w + sx]);
            if (exposed && edgeStart < 0) edgeStart = sx;
            else if (!exposed && edgeStart >= 0) {
              const ey = y + (dy > 0 ? 1 : 0); edge.moveTo(edgeStart, ey); edge.lineTo(sx, ey); edgeStart = -1;
            }
          }
        }
      }
    }
    maskGeometry = { mask, clip, edge }; return maskGeometry;
  }

  function drawOverlay(ctx, current) {
    const rect = { x: -panX / zoom, y: -panY / zoom, w: cssWidth / zoom, h: cssHeight / zoom };
    if (grid && zoom >= 6) {
      ctx.strokeStyle = '#a8bed42b'; ctx.lineWidth = 1 / zoom; ctx.beginPath();
      for (let x = Math.max(0, Math.ceil(rect.x)); x <= Math.min(current.width, rect.x + rect.w); x++) { ctx.moveTo(x, 0); ctx.lineTo(x, current.height); }
      for (let y = Math.max(0, Math.ceil(rect.y)); y <= Math.min(current.height, rect.y + rect.h); y++) { ctx.moveTo(0, y); ctx.lineTo(current.width, y); } ctx.stroke();
    }
    if (collision) {
      const size = current.collision.cellSize;
      for (const [key, value] of Object.entries(current.collision.cells)) {
        const [x, y] = key.split(',').map(Number), px = x * size, py = y * size;
        if (px + size < rect.x || py + size < rect.y || px > rect.x + rect.w || py > rect.y + rect.h) continue;
        ctx.fillStyle = value === 0 ? '#ef626c66' : '#67d8ab30'; ctx.fillRect(px, py, size, size);
        ctx.strokeStyle = value === 0 ? '#ff939b99' : '#87f2c777'; ctx.lineWidth = 1 / zoom; ctx.strokeRect(px, py, size, size);
      }
      for (const layer of current.layers) if (layer.visible) for (const object of layer.objects || []) {
        const asset = assetFor(object.assetId); if (!asset?.collision?.length) continue;
        ctx.save(); ctx.translate(object.x + object.w / 2, object.y + object.h / 2); ctx.rotate((object.rotation || 0) * Math.PI / 180);
        ctx.scale((object.flipX ? -1 : 1) * object.w / asset.width, (object.flipY ? -1 : 1) * object.h / asset.height); ctx.translate(-asset.width / 2, -asset.height / 2);
        ctx.fillStyle = '#f6ac4266'; ctx.strokeStyle = '#ffcb72'; ctx.lineWidth = 1 / zoom;
        for (const box of asset.collision) { ctx.fillRect(box.x, box.y, box.w, box.h); ctx.strokeRect(box.x, box.y, box.w, box.h); } ctx.restore();
      }
    }
    if (preview) {
      ctx.save(); ctx.globalAlpha = .75; ctx.fillStyle = preview.color || '#7be5c5'; ctx.strokeStyle = preview.color || '#7be5c5'; ctx.lineWidth = (preview.size || 1);
      if (selection && !preview.image) {
        const geometry = selectionGeometry();
        if (geometry) { ctx.translate(selection.x, selection.y); ctx.clip(geometry.clip); ctx.translate(-selection.x, -selection.y); }
        else {
          ctx.beginPath();
          if (selection.points?.length) { selection.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
          else ctx.rect(selection.x, selection.y, selection.w, selection.h);
          ctx.clip();
        }
      }
      if (preview.image) ctx.drawImage(preview.image, preview.x, preview.y);
      else if (preview.pixels) for (const [x, y] of preview.pixels) ctx.fillRect(x, y, 1, 1);
      else if (preview.type === 'line') { ctx.beginPath(); ctx.moveTo(preview.x + .5, preview.y + .5); ctx.lineTo(preview.x2 + .5, preview.y2 + .5); ctx.stroke(); }
      else if (preview.type === 'rectangle') { if (preview.filled) ctx.fillRect(preview.x, preview.y, preview.w, preview.h); else ctx.strokeRect(preview.x + .5, preview.y + .5, preview.w - 1, preview.h - 1); }
      else if (preview.type === 'ellipse') { ctx.beginPath(); ctx.ellipse(preview.x + preview.w / 2, preview.y + preview.h / 2, Math.max(.5, preview.w / 2), Math.max(.5, preview.h / 2), 0, 0, Math.PI * 2); preview.filled ? ctx.fill() : ctx.stroke(); }
      ctx.restore();
    }
    if (selection) {
      ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 / zoom;
      const geometry = selectionGeometry();
      if (geometry) {
        ctx.translate(selection.x, selection.y); ctx.fillStyle = '#71dcc627'; ctx.fill(geometry.clip);
        ctx.setLineDash([4 / zoom, 4 / zoom]); ctx.stroke(geometry.edge);
        ctx.strokeStyle = '#172336'; ctx.lineDashOffset = 4 / zoom; ctx.stroke(geometry.edge);
      } else {
        ctx.setLineDash([4 / zoom, 4 / zoom]); ctx.beginPath();
        if (selection.points?.length) { selection.points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); }
        else ctx.rect(selection.x, selection.y, selection.w, selection.h);
        ctx.stroke(); ctx.strokeStyle = '#172336'; ctx.lineDashOffset = 4 / zoom; ctx.stroke();
      }
      ctx.restore();
    }
    const selected = getSelectedObject();
    if (selected) { ctx.save(); ctx.translate(selected.x + selected.w / 2, selected.y + selected.h / 2); ctx.rotate((selected.rotation || 0) * Math.PI / 180); ctx.strokeStyle = '#80f2d1'; ctx.lineWidth = 2 / zoom; ctx.strokeRect(-selected.w / 2, -selected.h / 2, selected.w, selected.h); ctx.restore(); }
  }

  function render() {
    frame = 0; if (destroyed) return; resize();
    const current = scene(); if (!current) return;
    const ratio = canvas.width / cssWidth;
    context.setTransform(1, 0, 0, 1, 0, 0); context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
    context.save(); context.scale(ratio, ratio); context.translate(panX, panY); context.scale(zoom, zoom);
    context.fillStyle = '#c4ccd6'; context.fillRect(0, 0, current.width, current.height);
    const step = Math.max(8, 16 / zoom);
    // Checkerboard is viewport-sized; huge maps never create a checkerboard surface.
    const pattern = context.createPattern(checker, 'repeat'); if (pattern?.setTransform && typeof DOMMatrix !== 'undefined') pattern.setTransform(new DOMMatrix().scale(step / 8));
    context.fillStyle = pattern; context.fillRect(0, 0, current.width, current.height); context.restore();
    // Composite into a viewport-sized target, then add the editor overlays.
    const target = screenSurface; if (target.width !== canvas.width || target.height !== canvas.height) { target.width = canvas.width; target.height = canvas.height; }
    const tc = target.getContext('2d'); tc.setTransform(1, 0, 0, 1, 0, 0); tc.clearRect(0, 0, target.width, target.height); tc.imageSmoothingEnabled = false;
    const rect = { x: -panX / zoom, y: -panY / zoom, w: cssWidth / zoom, h: cssHeight / zoom };
    if (onionSkin && current.kind === 'customization') {
      const previous = store.getProject().scenes.find(item => item.id !== current.id && item.kind === 'customization');
      if (previous) { tc.globalAlpha = .2; composite(tc, previous, rect, zoom * ratio, target.width, target.height, previous.layers.filter(l => l.visible), true); tc.globalAlpha = 1; }
    }
    composite(tc, current, rect, zoom * ratio, target.width, target.height, current.layers.filter(layer => layer.visible), true, walk.enabled);
    context.imageSmoothingEnabled = false; context.drawImage(target, 0, 0);
    context.save(); context.setTransform(ratio * zoom, 0, 0, ratio * zoom, panX * ratio, panY * ratio); context.beginPath(); context.rect(0, 0, current.width, current.height); context.clip(); drawOverlay(context, current); context.restore();
    context.save(); context.setTransform(ratio, 0, 0, ratio, panX * ratio, panY * ratio); context.strokeStyle = '#92a3b7'; context.lineWidth = 1; context.strokeRect(0, 0, current.width * zoom, current.height * zoom); context.restore();
  }

  function invalidate() { if (!frame && !destroyed) frame = requestAnimationFrame(render); }
  function fit() { const current = scene(); if (!current) return; zoom = clamp(Math.min((cssWidth - 40) / current.width, (cssHeight - 40) / current.height), .025, 64); panX = (cssWidth - current.width * zoom) / 2; panY = (cssHeight - current.height * zoom) / 2; fitted = true; invalidate(); }
  function zoomAt(factor, clientX, clientY) { const b = canvas.getBoundingClientRect(), x = clientX == null ? cssWidth / 2 : clientX - b.left, y = clientY == null ? cssHeight / 2 : clientY - b.top; const next = clamp(zoom * factor, .025, 64), multiplier = next / zoom; panX = x - (x - panX) * multiplier; panY = y - (y - panY) * multiplier; zoom = next; invalidate(); }
  function worldPoint(event) { const bounds = canvas.getBoundingClientRect(); return { x: (event.clientX - bounds.left - panX) / zoom, y: (event.clientY - bounds.top - panY) / zoom }; }
  function getSelectedObject() { for (const layer of scene()?.layers || []) { const object = layer.objects?.find(item => item.id === selectedObjectId); if (object) return object; } return null; }
  function getObjectAt(point) {
    const current = scene(); if (!current) return null;
    const order = [];
    for (const role of ['background', 'world', 'foreground']) {
      const objects = current.layers.filter(l => l.visible && l.role === role).flatMap(layer => (layer.objects || []).map(object => ({ object, layer })));
      if (role === 'world') objects.sort((a, b) => depthSort(a.object, b.object)); order.push(...objects);
    }
    for (let i = order.length - 1; i >= 0; i--) { const { object } = order[i], asset = assetFor(object.assetId); if (!asset || !object.opacity) continue; const p = objectLocalPoint(object, point, asset); if (p.x >= 0 && p.y >= 0 && p.x < asset.width && p.y < asset.height) return order[i]; }
    return null;
  }

  async function renderRegion({ sceneId, layerId, layerIds, rect, scale = 1, objects = true, rawLayer = false }) {
    const current = scene(sceneId); if (!current) throw new Error('Scene was not found.');
    rect = rect || { x: 0, y: 0, w: current.width, h: current.height };
    const width = Math.ceil(rect.w * scale), height = Math.ceil(rect.h * scale);
    if (![rect.x, rect.y, rect.w, rect.h, scale].every(Number.isFinite) || scale <= 0 || width < 1 || height < 1 || width > 32767 || height > 32767 || width * height > MAX_OUTPUT_PIXELS) throw new Error('Render region must fit within 16 megapixels. Export a bundle for larger maps.');
    const ids = layerId ? [layerId] : layerIds;
    let layers = current.layers.filter(layer => ids ? ids.includes(layer.id) : layer.visible);
    if (ids && layers.length !== new Set(ids).size) throw new Error('Export layer was not found.');
    if (rawLayer) layers = layers.map(layer => ({ ...layer, opacity: 1, blend: 'source-over' }));
    const output = document.createElement('canvas'); output.width = width; output.height = height;
    const ctx = output.getContext('2d'); ctx.imageSmoothingEnabled = false;
    // Export decodes assets sequentially. A large library cannot force every native
    // image into memory at once, and eviction cannot drop an awaited image.
    const regionScratch = document.createElement('canvas'); regionScratch.width = width; regionScratch.height = height;
    const regionContext = regionScratch.getContext('2d'); regionContext.imageSmoothingEnabled = false;
    const worldObjects = [];
    const setupWorld = target => { target.setTransform(scale, 0, 0, scale, -rect.x * scale, -rect.y * scale); target.beginPath(); target.rect(0, 0, current.width, current.height); target.clip(); };
    const paintObject = async (target, object) => {
      if (!objectIntersectsRect(object, rect) || object.opacity === 0) return;
      const entry = getImage(assetFor(object.assetId)); if (!entry) return;
      await entry.promise; drawObject(target, object, entry);
    };
    for (const role of ['background', 'world', 'foreground']) {
      for (const layer of layers.filter(item => (item.role || 'world') === role)) {
        regionContext.setTransform(1, 0, 0, 1, 0, 0); regionContext.clearRect(0, 0, width, height); regionContext.save(); setupWorld(regionContext);
        if (layer.type === 'raster') drawRaster(regionContext, current, layer, rect);
        if (objects) {
          if (role === 'world') worldObjects.push(...(layer.objects || []).map(object => ({ object, layer })));
          else for (const object of [...(layer.objects || [])].sort(depthSort)) await paintObject(regionContext, object);
        }
        regionContext.restore(); ctx.save(); ctx.globalAlpha = layer.opacity ?? 1; ctx.globalCompositeOperation = layer.blend || 'source-over'; ctx.drawImage(regionScratch, 0, 0); ctx.restore();
      }
      if (role === 'world' && objects) {
        ctx.save(); setupWorld(ctx);
        for (const { object, layer } of worldObjects.sort((a, b) => depthSort(a.object, b.object))) { ctx.save(); ctx.globalAlpha = layer.opacity ?? 1; ctx.globalCompositeOperation = layer.blend || 'source-over'; await paintObject(ctx, object); ctx.restore(); }
        ctx.restore();
      }
    }
    return output;
  }

  function blockedAt(x, y) {
    const current = scene(); if (!current) return true;
    const rx = walk.radius, ry = walk.radius / 2;
    if (x - rx < 0 || y - ry < 0 || x + rx > current.width || y + ry > current.height) return true;
    if (collisionBlocksRect(current.collision, { x: x - rx, y: y - ry, w: rx * 2, h: ry * 2 })) return true;
    for (const layer of current.layers) if (layer.visible) for (const object of layer.objects || []) {
      const asset = assetFor(object.assetId); if (!asset?.collision?.length) continue;
      // Transform the foot rectangle into asset space, then use polygon/rectangle SAT.
      const feet = [[x - rx, y - ry], [x + rx, y - ry], [x + rx, y + ry], [x - rx, y + ry]].map(([px, py]) => objectLocalPoint(object, { x: px, y: py }, asset));
      for (const box of asset.collision) if (polygonsOverlap(feet, [{ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y }, { x: box.x + box.w, y: box.y + box.h }, { x: box.x, y: box.y + box.h }])) return true;
    }
    return false;
  }

  function setWalkTest(enabled) {
    if (walk.enabled === !!enabled) return;
    walk.enabled = !!enabled; keys.clear();
    if (walk.enabled) {
      const current = scene(); const center = worldPoint({ clientX: canvas.getBoundingClientRect().left + cssWidth / 2, clientY: canvas.getBoundingClientRect().top + cssHeight / 2 });
      walk.x = clamp(center.x, 10, Math.max(10, current.width - 10)); walk.y = clamp(center.y, 5, Math.max(5, current.height - 5));
      if (blockedAt(walk.x, walk.y)) {
        const size = current.collision.cellSize; let found = false;
        const originalX = walk.x, originalY = walk.y;
        for (let r = 1; r < Math.max(current.width, current.height) / size && !found; r++) {
          const candidates = [];
          for (let offset = -r; offset <= r; offset++) { candidates.push([offset, -r], [offset, r]); if (Math.abs(offset) < r) candidates.push([-r, offset], [r, offset]); }
          for (const [dx, dy] of candidates) { const x = originalX + dx * size, y = originalY + dy * size; if (!blockedAt(x, y)) { walk.x = x; walk.y = y; found = true; break; } }
        }
        if (!found) onStatus('No clear spawn point. Erase a collision cell to make a walkable area.');
      }
      walk.blocked = blockedAt(walk.x, walk.y); canvas.focus({ preventScroll: true }); lastTime = performance.now(); requestAnimationFrame(tick);
      onStatus('Walk test: arrows or WASD. Avatar uses native Coda 80×96 pixels; feet collide with 10px cells and asset colliders.');
    }
    invalidate();
  }
  function tick(time) {
    if (!walk.enabled || destroyed) return;
    if (textInput(document.activeElement) || document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')) keys.clear();
    const dt = Math.min(.05, (time - lastTime) / 1000); lastTime = time;
    let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
    let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
    if (dx || dy) {
      const length = Math.hypot(dx, dy), speed = 125 * dt, steps = Math.max(1, Math.ceil(speed / 3)); dx = dx / length * speed / steps; dy = dy / length * speed / steps; walk.blocked = false;
      for (let i = 0; i < steps; i++) { if (!blockedAt(walk.x + dx, walk.y)) walk.x += dx; else if (dx) walk.blocked = true; if (!blockedAt(walk.x, walk.y + dy)) walk.y += dy; else if (dy) walk.blocked = true; }
      const marginX = Math.min(100, cssWidth / 4), marginY = Math.min(110, cssHeight / 3), screenX = panX + walk.x * zoom, screenY = panY + walk.y * zoom;
      if (screenX < marginX) panX += marginX - screenX;
      else if (screenX > cssWidth - marginX) panX -= screenX - (cssWidth - marginX);
      if (screenY < marginY) panY += marginY - screenY;
      else if (screenY > cssHeight - marginY) panY -= screenY - (cssHeight - marginY);
      invalidate();
    }
    requestAnimationFrame(tick);
  }

  const wheel = event => { event.preventDefault(); zoomAt(Math.exp(-event.deltaY * .0015), event.clientX, event.clientY); };
  const downKey = event => { if (walk.enabled && !textInput(event.target) && !document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]') && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(event.key.toLowerCase())) { keys.add(event.key.toLowerCase()); event.preventDefault(); } };
  const upKey = event => keys.delete(event.key.toLowerCase());
  const blur = () => keys.clear();
  canvas.addEventListener('wheel', wheel, { passive: false }); window.addEventListener('keydown', downKey); window.addEventListener('keyup', upKey); window.addEventListener('blur', blur);
  const observer = new ResizeObserver(() => { resize(); invalidate(); }); observer.observe(canvas);
  const unsubscribe = store.subscribe(() => {
    tileCache.clear(); cacheBytes = 0;
    if (currentSceneId !== store.getState().activeSceneId) { currentSceneId = store.getState().activeSceneId; selection = null; maskGeometry = null; selectedObjectId = null; preview = null; setWalkTest(false); fit(); }
    invalidate();
  });
  resize(); invalidate();
  return {
    worldPoint, fit, zoomAt, panBy(dx, dy) { panX += dx; panY += dy; invalidate(); }, invalidate, renderRegion, getAssetPixels, getObjectAt,
    getState: () => ({ zoom, panX, panY, grid, collision, onionSkin, background, cacheBytes, selection, selectedObjectId, walk: { ...walk } }),
    setOptions(options) { if ('grid' in options) grid = !!options.grid; if ('collision' in options) collision = !!options.collision; if ('onionSkin' in options) onionSkin = !!options.onionSkin; if (options.background) background = options.background; invalidate(); },
    setSelection(value) { selection = value ? structuredClone(value) : null; maskGeometry = null; invalidate(); },
    getSelection: ({ copy = true } = {}) => selection ? copy ? structuredClone(selection) : selection : null,
    setPreview(value) { preview = value; invalidate(); }, getSelectedObject,
    setSelectedObject(id) { selectedObjectId = id || null; invalidate(); }, setWalkTest,
    destroy() { destroyed = true; walk.enabled = false; maskGeometry = null; unsubscribe(); observer.disconnect(); cancelAnimationFrame(frame); canvas.removeEventListener('wheel', wheel); window.removeEventListener('keydown', downKey); window.removeEventListener('keyup', upKey); window.removeEventListener('blur', blur); tileCache.clear(); imageCache.clear(); }
  };
}

function depth(object) { return object.y + object.h * (object.anchor?.y ?? 1) + (object.depthOffset || 0); }
function depthSort(a, b) { return depth(a) - depth(b); }

function objectIntersectsRect(object, rect) {
  const angle = (object.rotation || 0) * Math.PI / 180, c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
  const ex = c * object.w / 2 + s * object.h / 2, ey = s * object.w / 2 + c * object.h / 2;
  const x = object.x + object.w / 2, y = object.y + object.h / 2;
  return x + ex > rect.x && y + ey > rect.y && x - ex < rect.x + rect.w && y - ey < rect.y + rect.h;
}

export function polygonsOverlap(a, b) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], axis = { x: -(q.y - p.y), y: q.x - p.x };
    const pa = a.map(v => v.x * axis.x + v.y * axis.y), pb = b.map(v => v.x * axis.x + v.y * axis.y);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}
