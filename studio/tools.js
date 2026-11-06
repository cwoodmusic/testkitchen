import { packColor, unpackColor } from './model.js';
import { selectionBounds, pointInSelection, imageDataToPixels } from './viewport.js?v=materials-1';
import { smartSelection, combineSelections } from './smart-select.js?v=materials-1';

const MAX_EDIT_PIXELS = 16 * 1024 * 1024;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const isTextInput = node => !!(node?.isContentEditable || node?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog,[role="dialog"]'));

export function* linePoints(x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy;
  while (true) { yield [x0, y0]; if (x0 === x1 && y0 === y1) break; const twice = 2 * error; if (twice >= dy) { error += dy; x0 += sx; } if (twice <= dx) { error += dx; y0 += sy; } }
}

export function* shapePoints(tool, start, end, filled = false) {
  const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y), right = Math.max(start.x, end.x), bottom = Math.max(start.y, end.y);
  if (tool === 'line') { yield* linePoints(start.x, start.y, end.x, end.y); return; }
  if (tool === 'rectangle') {
    if (filled) { for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) yield [x, y]; }
    else { yield* linePoints(left, top, right, top); yield* linePoints(right, top, right, bottom); yield* linePoints(right, bottom, left, bottom); yield* linePoints(left, bottom, left, top); }
    return;
  }
  const rx = (right - left + 1) / 2, ry = (bottom - top + 1) / 2, cx = left + rx, cy = top + ry;
  if (filled) {
    for (let y = top; y <= bottom; y++) { const extent = rx * Math.sqrt(Math.max(0, 1 - ((y + .5 - cy) / ry) ** 2)); for (let x = Math.ceil(cx - extent - .5); x <= Math.floor(cx + extent - .5); x++) yield [x, y]; }
  } else {
    // Mark the boundary of the discrete filled ellipse, including single-pixel axes.
    const inside = (x, y) => ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= 1;
    for (let y = top; y <= bottom; y++) {
      const extent = rx * Math.sqrt(Math.max(0, 1 - ((y + .5 - cy) / ry) ** 2));
      const a = Math.ceil(cx - extent - .5), b = Math.floor(cx + extent - .5);
      for (let x = a; x <= b; x++) if (x === a || x === b || !inside(x, y - 1) || !inside(x, y + 1)) yield [x, y];
    }
  }
}

export function createTools({ canvas, store, viewport, getSettings, onSelection = () => {}, onColor = () => {}, onStatus = () => {} }) {
  let drag = null, space = false, clipboard = null, destroyed = false, busy = false, transactionOwned = false;
  canvas.style.touchAction = 'none'; if (canvas.tabIndex < 0) canvas.tabIndex = 0;
  const settings = () => getSettings() || {};
  // Internal readers never mutate a selection. Avoid copying large masks for every brush sample.
  const selection = () => viewport.getSelection({ copy: false });
  const currentScene = () => store.getProject().scenes.find(scene => scene.id === store.getState().activeSceneId);
  const activeLayer = () => currentScene()?.layers.find(layer => layer.id === store.getState().activeLayerId);
  const statusError = error => onStatus(error?.message || String(error));
  const point = event => { const p = viewport.worldPoint(event), snap = Math.max(1, Math.round(Number(settings().snap) || 1)); return { x: Math.floor(p.x / snap) * snap, y: Math.floor(p.y / snap) * snap }; };
  const inside = p => { const scene = currentScene(); return p.x >= 0 && p.y >= 0 && p.x < scene.width && p.y < scene.height; };
  const editable = () => { const layer = activeLayer(); if (!layer) throw new Error('Choose a layer.'); if (layer.locked) throw new Error('Unlock this layer before editing.'); if (layer.type !== 'raster') throw new Error('Choose a pixel layer for this tool.'); return layer; };
  const setSelection = value => { viewport.setSelection(value); onSelection(value); };
  const chooseObject = id => { viewport.setSelectedObject(id); if (id) setSelection(null); };
  const begin = label => { if (store.getState().inTransaction) throw new Error('Finish the current edit first.'); store.begin(label); transactionOwned = true; };
  const cancelTransaction = () => { if (transactionOwned && store.getState().inTransaction) store.cancel(); transactionOwned = false; };
  const commitTransaction = () => { if (transactionOwned) { store.commit(); transactionOwned = false; } };

  function selectSmart(p, event) {
    const scene = currentScene(), layer = activeLayer(), previous = selection();
    if (layer?.type !== 'raster') throw new Error('Smart Select reads a paint layer. Choose a pixel layer, or use Edit pixels on an asset first.');
    const large = scene.width * scene.height > MAX_EDIT_PIXELS;
    if (large && !previous) throw new Error('Use Select to mark an area up to 16 million pixels first, then click inside it with Smart Select.');
    // Resolve sparse tiles once. Color probes then avoid allocating tile-key strings per pixel.
    const tiles = new Map(Object.entries(layer.tiles).map(([key, tile]) => {
      const [tx, ty] = key.split(',').map(Number); return [ty * 128 + tx, tile];
    }));
    const next = smartSelection({ width: scene.width, height: scene.height, x: p.x, y: p.y,
      tolerance: settings().tolerance, bounds: large ? selectionBounds(previous) : undefined,
      contains: large ? (x, y) => pointInSelection(previous, x, y) : undefined,
      readPixel: (x, y) => tiles.get((y >> 6) * 128 + (x >> 6))?.[(y & 63) * 64 + (x & 63)] ?? layer.baseColor });
    const operation = event.altKey ? 'subtract' : event.shiftKey ? 'add' : 'replace';
    const selected = combineSelections(previous, next, operation);
    chooseObject(null); setSelection(selected);
    onStatus(selected ? `${selected.count.toLocaleString()} pixels selected on “${layer.name}”. Shift adds; Alt removes. Effects and tile fills follow this shape.` : 'Selection cleared.');
  }

  function* brushPixels(points, color, size = 1, mask = selection()) {
    const scene = currentScene(), width = clamp(Math.round(size), 1, 256), offset = Math.floor(width / 2);
    for (const [px, py] of points) for (let y = py - offset; y < py - offset + width; y++) for (let x = px - offset; x < px - offset + width; x++) {
      if (x >= 0 && y >= 0 && x < scene.width && y < scene.height && pointInSelection(mask, x, y)) yield [x, y, color];
    }
  }
  function paint(points, color, size) { const scene = currentScene(), layer = editable(); store.writePixels(scene.id, layer.id, brushPixels(points, color, size)); }
  function rectangle(a, b) { return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x) + 1, h: Math.abs(b.y - a.y) + 1 }; }
  function clippedRect(rect) { const scene = currentScene(), x = clamp(rect.x, 0, scene.width), y = clamp(rect.y, 0, scene.height); return { x, y, w: Math.max(0, Math.min(scene.width, rect.x + rect.w) - x), h: Math.max(0, Math.min(scene.height, rect.y + rect.h) - y) }; }

  function collisionPaint(a, b) {
    const scene = currentScene(), cellSize = scene.collision.cellSize, radius = clamp(Math.round(settings().collisionSize || 1), 1, 32), value = settings().collisionValue === null ? null : Number(settings().collisionValue) === 1 ? 1 : 0;
    const mask = selection();
    function* cells() {
      for (const [x, y] of linePoints(Math.floor(a.x / cellSize), Math.floor(a.y / cellSize), Math.floor(b.x / cellSize), Math.floor(b.y / cellSize))) {
        for (let dy = 0; dy < radius; dy++) for (let dx = 0; dx < radius; dx++) {
          const cx = x + dx - Math.floor(radius / 2), cy = y + dy - Math.floor(radius / 2);
          if (cx < 0 || cy < 0 || cx * cellSize >= scene.width || cy * cellSize >= scene.height) continue;
          if (pointInSelection(mask, cx * cellSize + cellSize / 2, cy * cellSize + cellSize / 2)) yield [cx, cy, value];
        }
      }
    }
    store.setCollision(scene.id, cells());
  }

  function floodFill(p, color) {
    const scene = currentScene(), layer = editable(), mask = selection();
    if (!pointInSelection(mask, p.x, p.y)) return;
    const target = store.readPixel(scene.id, layer.id, p.x, p.y), tolerance = clamp(Number(settings().tolerance) || 0, 0, 255);
    if (target === color && tolerance === 0) return;
    if (!mask && !Object.keys(layer.tiles).length) { store.fillLayer(scene.id, layer.id, color); return; }
    const bounds = clippedRect(selectionBounds(mask) || { x: 0, y: 0, w: scene.width, h: scene.height });
    const visited = new Uint8Array(Math.ceil(bounds.w * bounds.h / 8)), stack = [p.y * scene.width + p.x];
    let count = 0, batch = [];
    const marked = (x, y) => { const i = (y - bounds.y) * bounds.w + x - bounds.x; return !!(visited[i >> 3] & 1 << (i & 7)); };
    const mark = (x, y) => { const i = (y - bounds.y) * bounds.w + x - bounds.x; visited[i >> 3] |= 1 << (i & 7); };
    const match = (x, y) => {
      if (x < bounds.x || y < bounds.y || x >= bounds.x + bounds.w || y >= bounds.y + bounds.h || marked(x, y) || !pointInSelection(mask, x, y)) return false;
      const value = store.readPixel(scene.id, layer.id, x, y);
      return [0, 8, 16, 24].every(shift => Math.abs((value >>> shift & 255) - (target >>> shift & 255)) <= tolerance);
    };
    while (stack.length) {
      const index = stack.pop(), sy = Math.floor(index / scene.width), sx = index % scene.width;
      if (!match(sx, sy)) continue;
      let left = sx; while (match(left - 1, sy)) left--;
      let above = false, below = false;
      for (let x = left; match(x, sy); x++) {
        mark(x, sy); batch.push([x, sy, color]);
        if (++count > MAX_EDIT_PIXELS) throw new Error('Fill exceeds 16 megapixels. Select a smaller area or use Fill Layer.');
        const up = match(x, sy - 1), down = match(x, sy + 1);
        if (up && !above) stack.push((sy - 1) * scene.width + x); if (down && !below) stack.push((sy + 1) * scene.width + x); above = up; below = down;
        if (batch.length >= 16384) { store.writePixels(scene.id, layer.id, batch); batch = []; }
      }
    }
    if (batch.length) store.writePixels(scene.id, layer.id, batch);
  }

  function capturePixels(selection) {
    const scene = currentScene(), layer = editable(), rect = clippedRect(selectionBounds(selection) || { x: 0, y: 0, w: scene.width, h: scene.height });
    if (!rect.w || !rect.h) throw new Error('Select pixels inside the scene.');
    if (rect.w * rect.h > MAX_EDIT_PIXELS) throw new Error('Select at most 16 megapixels for copy, paste or move.');
    const data = new Uint8ClampedArray(rect.w * rect.h * 4);
    for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
      if (!pointInSelection(selection, rect.x + x, rect.y + y)) continue;
      const value = store.readPixel(scene.id, layer.id, rect.x + x, rect.y + y), i = (y * rect.w + x) * 4;
      data[i] = value >>> 24; data[i + 1] = value >>> 16 & 255; data[i + 2] = value >>> 8 & 255; data[i + 3] = value & 255;
    }
    return { width: rect.w, height: rect.h, data, rect, selection: selection ? structuredClone(selection) : rect };
  }
  function clearPixels(selection) {
    const scene = currentScene(), layer = editable();
    if (!selection) { store.clearLayer(scene.id, layer.id); return; }
    const rect = clippedRect(selectionBounds(selection));
    if (!selection.points?.length && !selection.mask) { store.fillRect(scene.id, layer.id, rect, 0); return; }
    function* pixels() { for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (pointInSelection(selection, x, y)) yield [x, y, 0]; }
    store.writePixels(scene.id, layer.id, pixels());
  }
  function selectionShift(selection, dx, dy) { return { ...selection, x: selection.x + dx, y: selection.y + dy, ...(selection.points ? { points: selection.points.map(([x, y]) => [x + dx, y + dy]) } : {}) }; }
  function objectLayer() {
    const scene = currentScene(), layer = activeLayer();
    if (layer?.locked) throw new Error('Unlock this layer before placing assets.');
    if (layer?.type === 'objects') return layer;
    const existing = [...scene.layers].reverse().find(item => item.type === 'objects' && !item.locked && item.visible);
    if (existing) { store.setActiveLayer(existing.id); return existing; }
    const id = store.addLayer(scene.id, { name: 'Placed assets', type: 'objects', role: 'world' }); store.setActiveLayer(id); return currentScene().layers.find(item => item.id === id);
  }
  async function stamp(p) {
    const asset = store.getProject().assets.find(item => item.id === settings().assetId);
    if (!asset) throw new Error('Choose an asset from the library first.');
    if (settings().stampMode === 'pixels') {
      const layer = editable(), image = await viewport.getAssetPixels(asset.id);
      begin('Stamp pixels');
      try { store.writePixels(currentScene().id, layer.id, imageDataToPixels(image, p.x, p.y, viewport.getSelection())); commitTransaction(); } catch (error) { cancelTransaction(); throw error; }
    } else {
      begin('Place asset');
        try { const layer = objectLayer(); const id = store.addObject(currentScene().id, layer.id, { assetId: asset.id, x: p.x, y: p.y, w: asset.width, h: asset.height }); chooseObject(id); commitTransaction(); } catch (error) { cancelTransaction(); throw error; }
    }
  }

  async function pointerDown(event) {
    if (destroyed || drag || busy || event.button > 1 && event.button !== 2) return;
    canvas.focus({ preventScroll: true });
    const s = { ...settings() }, tool = space || event.button === 1 ? 'hand' : s.tool;
    const rawPoint = tool === 'smart-select' ? viewport.worldPoint(event) : null;
    const p = rawPoint ? { x: Math.floor(rawPoint.x), y: Math.floor(rawPoint.y) } : point(event);
    if (viewport.getState().walk?.enabled && tool !== 'hand') return;
    if (tool !== 'hand' && !inside(p)) return;
    event.preventDefault();
    try {
      if (tool === 'eyedropper') {
        const layer = activeLayer();
        if (layer?.type === 'raster') onColor(unpackColor(store.readPixel(currentScene().id, layer.id, p.x, p.y)));
        else { const sample = await viewport.renderRegion({ sceneId: currentScene().id, rect: { x: p.x, y: p.y, w: 1, h: 1 } }); const d = sample.getContext('2d').getImageData(0, 0, 1, 1).data; onColor(unpackColor(((d[0] << 24) | (d[1] << 16) | (d[2] << 8) | d[3]) >>> 0)); } return;
      }
      if (tool === 'stamp') { busy = true; await stamp(p); busy = false; return; }
      if (tool === 'smart-select') { selectSmart(p, event); return; }
      if (tool === 'fill') { editable(); begin('Flood fill'); try { floodFill(p, packColor(event.button === 2 ? s.secondary : s.color)); commitTransaction(); } catch (error) { cancelTransaction(); throw error; } return; }
      drag = { tool, pointerId: event.pointerId, start: p, last: p, clientX: event.clientX, clientY: event.clientY, settings: s, color: packColor(event.button === 2 ? s.secondary : s.color), originalSelection: viewport.getSelection(), points: [[p.x, p.y]] };
      canvas.setPointerCapture(event.pointerId);
      if (tool === 'hand') { canvas.style.cursor = 'grabbing'; return; }
      if (tool === 'select' || tool === 'lasso') { chooseObject(null); setSelection({ x: p.x, y: p.y, w: 1, h: 1 }); return; }
      if (tool === 'move') {
        const hit = viewport.getObjectAt(p);
        if (hit && !hit.layer.locked) {
          store.setActiveLayer(hit.layer.id); chooseObject(hit.object.id); drag.object = structuredClone(hit.object); drag.layerId = hit.layer.id; begin('Move asset');
        } else if (viewport.getSelection() && pointInSelection(viewport.getSelection(), p.x, p.y)) {
          drag.image = capturePixels(viewport.getSelection()); drag.layerId = activeLayer().id;
          const surface = document.createElement('canvas'); surface.width = drag.image.width; surface.height = drag.image.height;
          surface.getContext('2d').putImageData(new ImageData(drag.image.data, drag.image.width, drag.image.height), 0, 0); drag.surface = surface; begin('Move pixels');
        } else { chooseObject(null); finishDrag(); }
        return;
      }
      if (tool !== 'collision') editable();
      begin(tool === 'collision' ? 'Paint collision' : `Draw ${tool}`);
      if (tool === 'pencil' || tool === 'eraser') paint([[p.x, p.y]], tool === 'eraser' ? 0 : drag.color, s.size || 1);
      else if (tool === 'collision') { viewport.setOptions({ collision: true }); collisionPaint(p, p); }
      else if (['line', 'rectangle', 'ellipse'].includes(tool)) shapePreview(p);
      else throw new Error(`Unknown tool: ${tool}`);
    } catch (error) { busy = false; cancelDrag(); statusError(error); }
  }

  function shapePreview(p) {
    const rect = rectangle(drag.start, p);
    viewport.setPreview({ type: drag.tool, ...rect, x2: p.x, y2: p.y, ...(drag.tool === 'line' ? { x: drag.start.x, y: drag.start.y } : {}), filled: !!drag.settings.filled, size: drag.settings.size || 1, color: unpackColor(drag.color) });
  }
  function pointerMove(event) {
    const p = point(event);
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    try {
      if (drag.tool === 'hand') { viewport.panBy(event.clientX - drag.clientX, event.clientY - drag.clientY); drag.clientX = event.clientX; drag.clientY = event.clientY; }
      else if (drag.tool === 'pencil' || drag.tool === 'eraser') paint(linePoints(drag.last.x, drag.last.y, p.x, p.y), drag.tool === 'eraser' ? 0 : drag.color, drag.settings.size || 1);
      else if (drag.tool === 'collision') collisionPaint(drag.last, p);
      else if (['line', 'rectangle', 'ellipse'].includes(drag.tool)) shapePreview(p);
      else if (drag.tool === 'select') setSelection(clippedRect(rectangle(drag.start, p)));
      else if (drag.tool === 'lasso') {
        if (Math.hypot(p.x - drag.last.x, p.y - drag.last.y) >= 1) drag.points.push([clamp(p.x, 0, currentScene().width), clamp(p.y, 0, currentScene().height)]);
        const xs = drag.points.map(v => v[0]), ys = drag.points.map(v => v[1]); setSelection({ x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1, points: drag.points });
      } else if (drag.tool === 'move') {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
        if (drag.object) store.updateObject(currentScene().id, drag.layerId, drag.object.id, { x: drag.object.x + dx, y: drag.object.y + dy });
        else if (drag.image) viewport.setPreview({ image: drag.surface, x: drag.image.rect.x + dx, y: drag.image.rect.y + dy });
      }
      drag.last = p;
    } catch (error) { cancelDrag(); statusError(error); }
  }
  function pointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    try {
      const p = point(event);
      if (['line', 'rectangle', 'ellipse'].includes(drag.tool)) paint(shapePoints(drag.tool, drag.start, p, drag.settings.filled), drag.color, drag.settings.filled ? 1 : drag.settings.size || 1);
      else if (drag.tool === 'move' && drag.image) {
        const dx = p.x - drag.start.x, dy = p.y - drag.start.y, selection = selectionShift(drag.image.selection, dx, dy);
        if (dx || dy) {
          clearPixels(drag.image.selection);
          store.writePixels(currentScene().id, drag.layerId, imageDataToPixels(drag.image, drag.image.rect.x + dx, drag.image.rect.y + dy, selection));
          setSelection(selection);
        }
      } else if (drag.tool === 'lasso' && drag.points.length < 3) setSelection(null);
      if (store.getState().inTransaction) commitTransaction();
    } catch (error) { cancelTransaction(); statusError(error); }
    finally { finishDrag(); }
  }
  function finishDrag() { const id = drag?.pointerId; drag = null; viewport.setPreview(null); canvas.style.cursor = settings().tool === 'hand' ? 'grab' : 'crosshair'; if (id != null && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id); }
  function cancelDrag() { if (drag?.originalSelection) setSelection(drag.originalSelection); else if (drag && ['select', 'lasso'].includes(drag.tool)) setSelection(null); cancelTransaction(); finishDrag(); }

  async function copy() {
    try {
      const object = viewport.getSelectedObject();
      if (object) { clipboard = { type: 'object', object: structuredClone(object) }; onStatus('Asset copied. Paste creates another placement.'); return true; }
      clipboard = { type: 'pixels', ...capturePixels(viewport.getSelection()) }; onStatus(`Copied ${clipboard.width}×${clipboard.height} pixels.`); return true;
    } catch (error) { statusError(error); return false; }
  }
  async function cut() { if (await copy()) deleteSelection(); }
  async function paste() {
    try {
      if (!clipboard) { onStatus('Copy pixels or an asset in the studio first.'); return; }
      if (clipboard.type === 'object') {
        begin('Paste asset');
        try { const layer = objectLayer(), object = { ...clipboard.object, x: clipboard.object.x + 10, y: clipboard.object.y + 10 }; delete object.id; const id = store.addObject(currentScene().id, layer.id, object); chooseObject(id); commitTransaction(); } catch (error) { cancelTransaction(); throw error; }
      } else {
        const scene = currentScene(), layer = editable(), original = viewport.getSelection();
        const x = clamp(original?.x ?? clipboard.rect.x + 10, 0, Math.max(0, scene.width - clipboard.width)), y = clamp(original?.y ?? clipboard.rect.y + 10, 0, Math.max(0, scene.height - clipboard.height));
        const selection = selectionShift(clipboard.selection, x - clipboard.rect.x, y - clipboard.rect.y);
        begin('Paste pixels');
        try { store.writePixels(scene.id, layer.id, imageDataToPixels(clipboard, x, y, selection)); chooseObject(null); setSelection(selection); commitTransaction(); } catch (error) { cancelTransaction(); throw error; }
      }
    } catch (error) { statusError(error); }
  }
  function selectAll() { chooseObject(null); const scene = currentScene(); setSelection({ x: 0, y: 0, w: scene.width, h: scene.height }); }
  function clearSelection() { chooseObject(null); setSelection(null); }
  function deleteSelection() {
    try {
      const object = viewport.getSelectedObject();
      begin(object ? 'Delete asset' : 'Delete pixels');
      try {
        if (object) { const layer = currentScene().layers.find(item => item.objects?.some(o => o.id === object.id)); store.removeObject(currentScene().id, layer.id, object.id); chooseObject(null); }
        else clearPixels(viewport.getSelection()); commitTransaction();
      } catch (error) { cancelTransaction(); throw error; }
    } catch (error) { statusError(error); }
  }
  const keyDown = event => {
    if (isTextInput(event.target) || document.querySelector('dialog[open],[role="dialog"][aria-modal="true"]')) return;
    if (event.code === 'Space' && !event.ctrlKey && !event.metaKey) { space = true; canvas.style.cursor = 'grab'; event.preventDefault(); return; }
    if (viewport.getState().walk?.enabled) return;
    if (event.key === 'Escape') { if (drag) cancelDrag(); else clearSelection(); event.preventDefault(); return; }
    if ((event.ctrlKey || event.metaKey) && !event.altKey) {
      const action = { c: copy, x: cut, v: paste, a: selectAll }[event.key.toLowerCase()];
      if (action) { event.preventDefault(); action(); }
    } else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelection(); }
  };
  const keyUp = event => { if (event.code === 'Space') { space = false; canvas.style.cursor = settings().tool === 'hand' ? 'grab' : 'crosshair'; } };
  const cancelPointer = event => { if (drag?.pointerId === event.pointerId) cancelDrag(); };
  const lostCapture = event => { if (drag?.pointerId === event.pointerId) cancelDrag(); };
  const blur = () => { space = false; if (drag) cancelDrag(); };
  const contextMenu = event => event.preventDefault();
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove); canvas.addEventListener('pointerup', pointerUp); canvas.addEventListener('pointercancel', cancelPointer); canvas.addEventListener('lostpointercapture', lostCapture); canvas.addEventListener('contextmenu', contextMenu);
  window.addEventListener('keydown', keyDown); window.addEventListener('keyup', keyUp); window.addEventListener('blur', blur);
  return { copy, cut, paste, selectAll, clearSelection, deleteSelection, destroy() { destroyed = true; if (drag) cancelDrag(); canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove); canvas.removeEventListener('pointerup', pointerUp); canvas.removeEventListener('pointercancel', cancelPointer); canvas.removeEventListener('lostpointercapture', lostCapture); canvas.removeEventListener('contextmenu', contextMenu); window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur); } };
}
