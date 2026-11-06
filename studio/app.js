import { createProject, createStore, packColor, unpackColor } from './model.js';
import { createViewport } from './viewport.js';
import { createTools } from './tools.js';
import { createUI } from './ui.js';
import { applyEffect, transform } from './image-ops.js';
import { openPhotoDialog } from './photo-dialog.js';
import { readProject, readImage, downloadProject, exportPNG, exportBundle,
  createAutosave } from './io.js';

const settings = { tool: 'pencil', color: '#efbb78ff', secondary: '#172831ff',
  size: 1, tolerance: 0, filled: false, snap: 1, assetId: null,
  collisionValue: 0, collisionSize: 1, stampMode: 'objects' };
const store = createStore(createProject({ name: 'My Coda workshop',
  kind: 'interior', width: 960, height: 720 }));
let ui, viewport, tools, autosave, panelFrame = 0, statusText = 'Opening your workshop…';
let selectedAssetId = null, savedProjects = [], pendingImport = 0, starterToken = 0;

function current() {
  const state = store.getState(), project = store.getProject();
  const scene = project.scenes.find(value => value.id === state.activeSceneId) || project.scenes[0];
  const layer = scene?.layers.find(value => value.id === state.activeLayerId) || scene?.layers.at(-1);
  return { state, project, scene, layer };
}
function selectedObject() {
  const selected = viewport?.getSelectedObject();
  if (!selected) return null;
  if (selected.object) return selected;
  const id = typeof selected === 'string' ? selected : selected.id;
  const { scene } = current();
  for (const layer of scene?.layers || []) {
    const object = layer.objects?.find(value => value.id === id);
    if (object) return { object, layer };
  }
  return null;
}
function status(text) {
  statusText = String(text || '');
  ui?.status(statusText);
  schedulePanels();
}
function renderPanels() {
  panelFrame = 0;
  if (!ui || !viewport) return;
  const state = store.getState();
  if (state.inTransaction) return;
  if (!store.getProject().assets.some(asset => asset.id === selectedAssetId)) selectedAssetId = null;
  ui.render({ ...state, project: store.getProject(), settings: { ...settings },
    viewport: viewport.getState(), selectedObject: selectedObject()?.object || null,
    selectedAssetId, statusText, savedProjects });
}
function schedulePanels() {
  if (!panelFrame) panelFrame = requestAnimationFrame(renderPanels);
}
function transaction(label, operation) {
  store.begin(label);
  try { const result = operation(); store.commit(); return result; }
  catch (error) { store.cancel(); throw error; }
}
function replaceProject(data) {
  if (store.getState().inTransaction) throw Error('Finish your current stroke before opening another project.');
  store.replace(data);
}
function ensureLayer(type, role = type === 'objects' ? 'world' : 'background') {
  const { scene, layer } = current();
  if (layer?.type === type && !layer.locked) return layer;
  const existing = scene.layers.find(value => value.type === type && !value.locked);
  const id = existing?.id || store.addLayer(scene.id, {
    name: type === 'objects' ? 'Placed assets' : 'Paint', type, role });
  store.setActiveLayer(id);
  return current().scene.layers.find(value => value.id === id);
}
function imagePixels(image, x = 0, y = 0, mask = null) {
  return (function* () {
    for (let row = 0; row < image.height; row++) for (let col = 0; col < image.width; col++) {
      if (mask && !insideSelection(mask, x + col, y + row)) continue;
      const offset = (row * image.width + col) * 4, data = image.data;
      const value = data[offset + 3] ? ((data[offset] << 24) |
        (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3]) >>> 0 : 0;
      yield [x + col, y + row, value];
    }
  })();
}
function insideSelection(selection, x, y) {
  if (x < selection.x || y < selection.y || x >= selection.x + selection.w || y >= selection.y + selection.h) return false;
  if (!selection.points?.length) return true;
  let inside = false;
  for (let i = 0, j = selection.points.length - 1; i < selection.points.length; j = i++) {
    const [ax, ay] = selection.points[i], [bx, by] = selection.points[j];
    if ((ay > y + .5) !== (by > y + .5) &&
      x + .5 < (bx - ax) * (y + .5 - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
function imageDataURL(image) {
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d');
  context.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  const dataURL = canvas.toDataURL('image/png'); canvas.width = canvas.height = 0; return dataURL;
}
function selectionRect(scene) {
  const selection = viewport.getSelection();
  const raw = selection || { x: 0, y: 0, w: scene.width, h: scene.height };
  const x = Math.max(0, Math.floor(raw.x)), y = Math.max(0, Math.floor(raw.y));
  return { x, y, w: Math.max(1, Math.min(scene.width, Math.ceil(raw.x + raw.w)) - x),
    h: Math.max(1, Math.min(scene.height, Math.ceil(raw.y + raw.h)) - y) };
}
function resetView() {
  tools.clearSelection(); viewport.setSelectedObject(null); viewport.setWalkTest(false);
  viewport.fit(); viewport.invalidate(); schedulePanels();
}
async function refreshSavedProjects() {
  try { savedProjects = await autosave.list(); schedulePanels(); } catch (_) { /* Manual files stay available. */ }
}
async function openNative(file) {
  const token = ++pendingImport; starterToken++;
  status('Checking project…');
  const project = await readProject(file);
  if (token !== pendingImport) return;
  await autosave.saveNow();
  replaceProject(project); selectedAssetId = settings.assetId = null; resetView();
  status('Opened ' + store.getProject().name + '. Layers, assets and collision are ready.');
  void refreshSavedProjects();
}
async function addImageFiles(files) {
  const projectId = store.getProject().id;
  const images = [];
  for (const file of Array.from(files || [])) images.push(await readImage(file));
  if (store.getProject().id !== projectId) return;
  transaction('Import assets', () => {
    for (const image of images) {
      selectedAssetId = store.addAsset({ name: image.name, width: image.width, height: image.height,
        dataURL: image.dataURL, anchor: { x: image.width / 2, y: image.height }, collision: [], tags: ['imported'] });
    }
  });
  settings.assetId = selectedAssetId;
  if (selectedAssetId) { ensureLayer('objects'); settings.tool = 'stamp'; }
  status(images.length + ' asset' + (images.length === 1 ? '' : 's') + ' imported. Click the canvas to place a copy.');
}
async function convertPhoto(file) {
  const projectId = store.getProject().id;
  const result = await openPhotoDialog({ file, onStatus: status });
  if (!result || store.getProject().id !== projectId) return;
  if (result.asAsset) {
    selectedAssetId = store.addAsset({ name: result.name || 'Pixel photo', width: result.width,
      height: result.height, dataURL: result.dataURL || imageDataURL(result),
      anchor: result.anchor || { x: result.width / 2, y: result.height }, collision: [], tags: ['photo', 'pixel-art'] });
    settings.assetId = selectedAssetId; ensureLayer('objects'); settings.tool = 'stamp';
    status('Pixel asset created. Click the canvas to place it, or choose Edit asset to paint its pixels.');
  } else {
    transaction('Create editable pixel image', () => {
      const id = store.addScene({ name: result.name || 'Pixel photo', kind: 'asset',
        width: result.width, height: result.height, pixelScale: result.pixelScale || 1,
        anchor: result.anchor || { x: result.width / 2, y: result.height } });
      store.setActiveScene(id); const layer = ensureLayer('raster');
      store.writePixels(id, layer.id, imagePixels(result));
    });
    settings.tool = 'pencil'; resetView(); status('Your converted image is now editable pixel artwork.');
  }
  schedulePanels();
}
async function editAsset(id = selectedAssetId) {
  const { project } = current(), asset = project.assets.find(value => value.id === id);
  if (!asset) throw Error('Choose an asset first.');
  const image = await viewport.getAssetPixels(id);
  if (!image || store.getProject().id !== project.id) return;
  transaction('Open asset canvas', () => {
    const sceneId = store.addScene({ name: asset.name, kind: 'asset', width: asset.width,
      height: asset.height, anchor: asset.anchor, sourceAssetId: id });
    store.setActiveScene(sceneId); const layer = ensureLayer('raster');
    store.writePixels(sceneId, layer.id, imagePixels(image));
  });
  settings.tool = 'pencil'; resetView();
  status('Editing an asset copy. Export its PNG, or use Make asset to add your painted version to the library.');
}
async function makeAsset() {
  const { scene, project } = current(), rect = selectionRect(scene);
  const canvas = await viewport.renderRegion({ sceneId: scene.id, rect, scale: 1, objects: true });
  if (project.id !== store.getProject().id) { canvas.width = canvas.height = 0; return; }
  const dataURL = canvas.toDataURL('image/png'); canvas.width = canvas.height = 0;
  selectedAssetId = store.addAsset({ name: scene.name + ' asset', width: rect.w, height: rect.h,
    dataURL, anchor: { x: rect.w / 2, y: rect.h }, collision: [], tags: ['created'] });
  settings.assetId = selectedAssetId; schedulePanels(); status('Artwork added to your reusable asset library.');
}
async function applyImageChange(name, options = {}, isTransform = false) {
  const { scene, layer, project } = current(), objectSelection = selectedObject();
  if (objectSelection && layer?.type === 'objects') {
    if (isTransform) {
      const object = objectSelection.object;
      store.updateObject(scene.id, objectSelection.layer.id, object.id, {
        ...(options.flipX ? { flipX: !object.flipX } : {}), ...(options.flipY ? { flipY: !object.flipY } : {}),
        ...(options.rotate ? { rotation: ((object.rotation || 0) + options.rotate) % 360 } : {}) });
    } else {
      const object = objectSelection.object, asset = project.assets.find(value => value.id === object.assetId);
      const input = await viewport.getAssetPixels(asset.id), output = applyEffect(input, name, options);
      if (store.getProject().id !== project.id) return;
      transaction('Apply ' + name, () => {
        const id = store.addAsset({ ...asset, id: undefined, name: asset.name + ' · ' + name,
          width: output.width, height: output.height, dataURL: imageDataURL(output) });
        store.updateObject(scene.id, objectSelection.layer.id, object.id, { assetId: id });
        selectedAssetId = id;
      });
    }
    viewport.invalidate(); status('Applied ' + name + '. Undo is available.'); return;
  }
  if (layer?.type !== 'raster') throw Error('Select a paint layer or a placed asset first.');
  if (layer.locked) throw Error('Unlock this layer before editing it.');
  const rect = selectionRect(scene), mask = viewport.getSelection();
  const canvas = await viewport.renderRegion({ sceneId: scene.id, layerId: layer.id,
    rect, scale: 1, objects: false, rawLayer: true });
  const input = { width: canvas.width, height: canvas.height,
    data: canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data };
  canvas.width = canvas.height = 0;
  let transformedMask = null;
  if (isTransform && mask?.points?.length) {
    const maskData = new Uint8ClampedArray(input.width * input.height * 4);
    for (let y = 0; y < input.height; y++) for (let x = 0; x < input.width; x++) {
      const index = (y * input.width + x) * 4;
      if (insideSelection(mask, rect.x + x, rect.y + y)) maskData[index + 3] = 255;
      else input.data[index + 3] = 0;
    }
    transformedMask = transform({ width: input.width, height: input.height, data: maskData }, options);
  }
  const output = isTransform ? transform(input, options) : applyEffect(input, name, options);
  if (store.getProject().id !== project.id || !current().scene.layers.some(value => value.id === layer.id)) return;
  transaction('Apply ' + name, () => {
    const resizeAsset = isTransform && !mask && scene.kind === 'asset' && scene.layers.length === 1;
    if (resizeAsset) {
      store.clearLayer(scene.id, layer.id);
      store.updateScene(scene.id, { width: output.width, height: output.height,
        anchor: { x: output.width / 2, y: output.height } });
    } else if (isTransform) store.writePixels(scene.id, layer.id,
      (function* () { for (let y = rect.y; y < rect.y + rect.h; y++) for (let x = rect.x; x < rect.x + rect.w; x++) if (!mask || insideSelection(mask, x, y)) yield [x, y, 0]; })());
    if (transformedMask) {
      store.writePixels(scene.id, layer.id, (function* () {
        for (const point of imagePixels(output, rect.x, rect.y)) {
          const index = ((point[1] - rect.y) * output.width + point[0] - rect.x) * 4;
          if (transformedMask.data[index + 3]) yield point;
        }
      })());
    } else store.writePixels(scene.id, layer.id, imagePixels(output, rect.x, rect.y, isTransform ? null : mask));
  });
  if (isTransform && mask) viewport.setSelection({ x: rect.x, y: rect.y, w: output.width, h: output.height });
  if (isTransform && !mask && scene.kind === 'asset' && scene.layers.length === 1) viewport.fit();
  viewport.invalidate(); status('Applied ' + name + '. Undo is available.');
}

function blockFootprint(object, layer) {
  const { scene, project } = current();
  const asset = project.assets.find(value => value.id === object.assetId);
  if (!asset) return;
  if (layer.locked) throw Error('Unlock the object layer first.');
  const rectangles = asset.collision?.length ? asset.collision : [{
    x: asset.width * .12, y: asset.height * .75, w: asset.width * .76, h: Math.max(4, asset.height * .2) }];
  const cell = scene.collision.cellSize;
  const points = [];
  for (const rect of rectangles) {
    const corners = [[rect.x, rect.y], [rect.x + rect.w, rect.y],
      [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]].map(([x, y]) => {
      let dx = (x / asset.width - .5) * object.w, dy = (y / asset.height - .5) * object.h;
      if (object.flipX) dx = -dx; if (object.flipY) dy = -dy;
      const angle = (object.rotation || 0) * Math.PI / 180;
      return { x: object.x + object.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
        y: object.y + object.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle) };
    });
    const left = Math.max(0, Math.floor(Math.min(...corners.map(value => value.x)) / cell));
    const top = Math.max(0, Math.floor(Math.min(...corners.map(value => value.y)) / cell));
    const right = Math.min(Math.ceil(scene.width / cell), Math.ceil(Math.max(...corners.map(value => value.x)) / cell));
    const bottom = Math.min(Math.ceil(scene.height / cell), Math.ceil(Math.max(...corners.map(value => value.y)) / cell));
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) points.push([x, y, 0]);
  }
  store.setCollision(scene.id, points); viewport.setOptions({ collision: true });
  status('Blocked the asset’s foot area. Use the collision brush to refine it.');
}

async function action(name, payload) {
  try {
    const { scene, layer } = current();
    switch (name) {
      case 'new-project': {
        const spec = payload?.kind ? payload : await ui.promptProject(); if (!spec) return;
        await autosave.saveNow(); pendingImport++; starterToken++;
        replaceProject(createProject(spec)); selectedAssetId = settings.assetId = null;
        resetView(); status('New ' + spec.kind + ' canvas ready.'); break;
      }
      case 'open-project': ui.els.projectFile.click(); break;
      case 'open-project-file': if (payload) await openNative(payload); break;
      case 'save-project': {
        const result = await downloadProject(store); status('Downloaded ' + (result?.filename || 'your editable project') + '.');
        await autosave.saveNow(); void refreshSavedProjects(); break;
      }
      case 'export-png': {
        status('Rendering PNG artwork…'); const result = await exportPNG({ store, viewport, sceneId: scene.id });
        status('Exported ' + (result?.filename || 'PNG artwork') + '.'); break;
      }
      case 'export-bundle': {
        status('Packaging artwork, assets, layers and collision…'); const result = await exportBundle({ store, viewport });
        status('Exported ' + (result?.filename || 'your complete integration bundle') + '. Send this file for game integration.'); break;
      }
      case 'undo': if (!store.getState().inTransaction) store.undo(); break;
      case 'redo': if (!store.getState().inTransaction) store.redo(); break;
      case 'tool': settings.tool = String(payload);
        if (settings.tool === 'collision') viewport.setOptions({ collision: true });
        status('Tool: ' + settings.tool); break;
      case 'setting': if (payload?.key) settings[payload.key] = payload.value; break;
      case 'color': settings.color = String(payload); break;
      case 'add-layer': {
        const type = payload?.type || 'raster';
        const id = store.addLayer(scene.id, { name: payload?.name || (type === 'objects' ? 'Objects' : 'Paint layer'),
          type, role: payload?.role || (type === 'objects' ? 'world' : 'background') });
        store.setActiveLayer(id); break;
      }
      case 'select-layer': store.setActiveLayer(payload); break;
      case 'layer-change': store.updateLayer(scene.id, layer.id, payload); break;
      case 'move-layer': store.moveLayer(scene.id, payload.id || layer.id, Number(payload.index)); break;
      case 'delete-layer': store.removeLayer(scene.id, payload || layer.id); break;
      case 'fill-layer': {
        const target = ensureLayer('raster'); store.fillLayer(scene.id, target.id, packColor(settings.color)); break;
      }
      case 'clear-layer': store.clearLayer(scene.id, layer.id); break;
      case 'add-scene': {
        const spec = payload?.kind ? payload : await ui.promptProject(); if (!spec) return;
        const id = store.addScene(spec); store.setActiveScene(id); resetView(); break;
      }
      case 'select-scene': store.setActiveScene(payload); resetView(); break;
      case 'rename-scene': store.updateScene(payload.id || scene.id, { name: payload.name }); break;
      case 'delete-scene': store.removeScene(payload || scene.id); resetView(); break;
      case 'scene-change': store.updateScene(scene.id, payload); viewport.fit(); break;
      case 'import-asset': ui.els.imageFile.click(); break;
      case 'import-asset-files': await addImageFiles(payload); break;
      case 'select-asset': selectedAssetId = settings.assetId = payload; break;
      case 'place-asset': {
        const id = typeof payload === 'string' ? payload : selectedAssetId;
        if (!store.getProject().assets.some(value => value.id === id)) throw Error('Choose an asset first.');
        selectedAssetId = settings.assetId = id; ensureLayer('objects'); settings.tool = 'stamp';
        status('Click the canvas to place your asset. Hold Shift for grid alignment.'); break;
      }
      case 'edit-asset': await editAsset(typeof payload === 'string' ? payload : selectedAssetId); break;
      case 'delete-asset': store.removeAsset(payload || selectedAssetId); selectedAssetId = settings.assetId = null; break;
      case 'make-asset': await makeAsset(); break;
      case 'photo': await convertPhoto(payload instanceof File ? payload : undefined); break;
      case 'effect': await applyImageChange(payload.name || payload, payload.options || {}); break;
      case 'transform': await applyImageChange('transform', payload, true); break;
      case 'copy': await tools.copy(); break;
      case 'cut': await tools.cut(); break;
      case 'paste': await tools.paste(); break;
      case 'select-all': tools.selectAll(); break;
      case 'clear-selection': tools.clearSelection(); break;
      case 'delete-selection': tools.deleteSelection(); break;
      case 'object-change': {
        const selected = selectedObject(); if (!selected) throw Error('Select a placed asset first.');
        store.updateObject(scene.id, selected.layer.id, selected.object.id, payload); break;
      }
      case 'duplicate-object': {
        const selected = selectedObject(); if (!selected) throw Error('Select a placed asset first.');
        const id = store.addObject(scene.id, selected.layer.id, { ...selected.object, id: undefined,
          x: selected.object.x + 16, y: selected.object.y + 16 }); viewport.setSelectedObject(id); break;
      }
      case 'delete-object': {
        const selected = selectedObject(); if (!selected) break;
        store.removeObject(scene.id, selected.layer.id, selected.object.id); viewport.setSelectedObject(null); break;
      }
      case 'collision-from-object': {
        const selected = selectedObject(); if (!selected) throw Error('Select an asset on the map first.');
        blockFootprint(selected.object, selected.layer); break;
      }
      case 'grid': viewport.setOptions({ grid: payload }); break;
      case 'collision-overlay': viewport.setOptions({ collision: payload }); break;
      case 'onion-skin': viewport.setOptions({ onionSkin: payload }); break;
      case 'walk-test': viewport.setWalkTest(payload); status(payload ? 'Walk test: use WASD or arrows. Escape returns to editing.' : 'Editing mode.'); break;
      case 'zoom-in': viewport.zoomAt(1.25); break;
      case 'zoom-out': viewport.zoomAt(.8); break;
      case 'zoom-fit': viewport.fit(); break;
      case 'zoom-actual': {
        const zoom = viewport.getState().zoom; viewport.zoomAt(1 / zoom); break;
      }
      case 'restore-project': {
        const native = await autosave.load(payload); if (!native) throw Error('That saved project is no longer available.');
        await autosave.saveNow(); replaceProject(native); pendingImport++; starterToken++;
        selectedAssetId = settings.assetId = null; resetView(); status('Restored ' + store.getProject().name + '.'); break;
      }
      case 'help': ui.showHelp(); break;
      default: throw Error('This action is not available.');
    }
    viewport.invalidate(); schedulePanels();
  } catch (error) {
    console.error('Studio action:', name, error);
    status(error?.message || 'That action could not be completed. Your project is still open.');
  }
}

ui = createUI({ onAction: (name, payload) => { void action(name, payload); } });
viewport = createViewport({ canvas: ui.els.canvas, store, onStatus: status });
tools = createTools({ canvas: ui.els.canvas, store, viewport, getSettings: () => settings,
  onSelection: schedulePanels, onColor: color => { settings.color = typeof color === 'number' ? unpackColor(color) : color; schedulePanels(); },
  onStatus: status });
autosave = createAutosave({ store, onStatus: status });
store.subscribe(() => { viewport.invalidate(); schedulePanels(); });
for (const event of ['pointerdown', 'pointerup', 'wheel']) ui.els.canvas.addEventListener(event, schedulePanels);
ui.els.canvas.addEventListener('pointermove', event => {
  const point = viewport.worldPoint(event);
  if (ui.els.coords) ui.els.coords.textContent = 'x ' + Math.floor(point.x) + '  y ' + Math.floor(point.y);
});
ui.els.canvas.addEventListener('pointerleave', () => {
  if (ui.els.coords) ui.els.coords.textContent = 'Move over the canvas';
});

const shortcuts = { b: 'pencil', e: 'eraser', g: 'fill', l: 'line', r: 'rectangle',
  u: 'ellipse', o: 'ellipse', m: 'select', q: 'lasso', v: 'move', s: 'stamp', i: 'eyedropper', c: 'collision', h: 'hand' };
window.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.target.closest?.('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open]')) return;
  const key = event.key.toLowerCase(), command = event.ctrlKey || event.metaKey;
  if (command && key === 's') { event.preventDefault(); void action('save-project'); return; }
  if (command && key === 'z') { event.preventDefault(); void action(event.shiftKey ? 'redo' : 'undo'); return; }
  if (command && key === 'y') { event.preventDefault(); void action('redo'); return; }
  if (command || event.altKey) return;
  if (key === 'escape' && viewport.getState().walk?.enabled) { event.preventDefault(); void action('walk-test', false); return; }
  if (viewport.getState().walk?.enabled) return;
  if (shortcuts[key]) { event.preventDefault(); void action('tool', shortcuts[key]); }
  else if (key === '0') { event.preventDefault(); void action('zoom-fit'); }
  else if (key === '+' || key === '=') { event.preventDefault(); void action('zoom-in'); }
  else if (key === '-') { event.preventDefault(); void action('zoom-out'); }
});
window.addEventListener('pagehide', () => { void autosave.saveNow(); });
window.studio = Object.freeze({ store, viewport, tools, settings, autosave });

async function starterRoom() {
  const projectId = store.getProject().id, token = ++starterToken;
  const samples = [
    ['Walnut table', 'table-lounge-walnut', 385, 330],
    ['Coda sofa', 'sofa-compact-south', 210, 160],
    ['Succulent', 'succulent', 635, 195],
    ['Teal chair', 'chair-teal-east', 595, 350]
  ];
  const images = await Promise.all(samples.map(async ([name, id, x, y]) => {
    const response = await fetch(new URL('./assets/' + id + '.png', import.meta.url));
    if (!response.ok) throw Error('Starter artwork could not load.');
    const blob = await response.blob(), image = await readImage(new File([blob], id + '.png', { type: 'image/png' }));
    return { ...image, name, x, y };
  }));
  if (token !== starterToken || store.getProject().id !== projectId || store.getState().revision !== 0) return;
  transaction('Starter room', () => {
    const { scene } = current(), floor = ensureLayer('raster');
    store.fillLayer(scene.id, floor.id, packColor('#b8a08aff'));
    store.fillRect(scene.id, floor.id, { x: 0, y: 0, w: scene.width, h: 112 }, packColor('#495b61ff'));
    const seams = [];
    for (let y = 144; y < scene.height; y += 32) for (let x = 0; x < scene.width; x++) seams.push([x, y, packColor('#967f6cff')]);
    for (let x = 0; x < scene.width; x++) seams.push([x, 111, packColor('#e8c47dff')]);
    store.writePixels(scene.id, floor.id, seams);
    const objects = ensureLayer('objects');
    for (const image of images) {
      const assetId = store.addAsset({ name: image.name, width: image.width, height: image.height,
        dataURL: image.dataURL, anchor: { x: image.width / 2, y: image.height },
        collision: [{ x: image.width * .12, y: image.height * .76, w: image.width * .76, h: Math.max(5, image.height * .2) }], tags: ['coda', 'starter'] });
      const objectId = store.addObject(scene.id, objects.id, { assetId, x: image.x, y: image.y,
        w: image.width, h: image.height, anchor: { x: .5, y: 1 } });
      const placed = current().scene.layers.find(value => value.id === objects.id).objects.find(value => value.id === objectId);
      blockFootprint(placed, objects);
    }
    viewport.setOptions({ collision: false }); store.setActiveLayer(floor.id);
  });
  viewport.fit(); status('Your workshop is ready. Paint a layer, place an asset, or start a new map.');
  await autosave.saveNow(); void refreshSavedProjects();
}

async function start() {
  viewport.fit(); renderPanels();
  try {
    await autosave.ready; savedProjects = await autosave.list();
    if (store.getState().revision === 0 && savedProjects.length) {
      const latest = [...savedProjects].sort((a, b) => b.updatedAt - a.updatedAt)[0];
      const saved = await autosave.load(latest.id);
      if (saved && store.getState().revision === 0) {
        replaceProject(saved); viewport.fit(); status('Restored ' + store.getProject().name + ' from this browser.');
      }
    } else if (store.getState().revision === 0) await starterRoom();
    else status('Ready. Your current edits have been kept.');
  } catch (error) { status(error?.message || 'Ready. You can save a project file at any time.'); }
  schedulePanels(); viewport.invalidate();
}
void start();
