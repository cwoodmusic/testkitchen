import { createProject, createStore, packColor, unpackColor } from './model.js';
import { createViewport, pointInSelection } from './viewport.js?v=materials-1';
import { createTools } from './tools.js?v=materials-1';
import { createUI } from './ui.js?v=materials-1';
import { applyEffect, transform } from './image-ops.js';
import { openPhotoDialog } from './photo-dialog.js?v=materials-1';
import { openTileDialog } from './tile-dialog.js?v=materials-1';
import { createInteriorProject, applySceneResize } from './workspace-ops.js?v=materials-1';
import { readProject, readImage, downloadProject, exportPNG, exportBundle,
  createAutosave, downloadBlob, safeName } from './io.js';

const settings = { tool: 'pencil', color: '#efbb78ff', secondary: '#172831ff',
  size: 1, tolerance: 0, filled: false, snap: 1, assetId: null,
  collisionValue: 0, collisionSize: 1, stampMode: 'objects' };
const store = createStore(createProject({ name: 'My Coda workshop',
  kind: 'interior', width: 960, height: 720 }));
let ui, viewport, tools, autosave, panelFrame = 0, statusText = 'Opening your workshop…';
let selectedAssetId = null, savedProjects = [], pendingImport = 0, starterToken = 0;
let assetCreationPending = false;
let materialDialogPending = false;

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
  return pointInSelection(selection, x, y);
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
  return { x, y, w: Math.max(0, Math.min(scene.width, Math.ceil(raw.x + raw.w)) - x),
    h: Math.max(0, Math.min(scene.height, Math.ceil(raw.y + raw.h)) - y) };
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
    ui.showAssets();
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
  if (assetCreationPending) return;
  const { state, scene, project } = current();
  if (state.inTransaction) throw Error('Finish your current stroke before making an asset.');
  const selection = structuredClone(viewport.getSelection());
  const raw = selection || { x: 0, y: 0, w: scene.width, h: scene.height };
  const x = Math.max(0, Math.floor(raw.x)), y = Math.max(0, Math.floor(raw.y));
  const rect = { x, y, w: Math.min(scene.width, Math.ceil(raw.x + raw.w)) - x,
    h: Math.min(scene.height, Math.ceil(raw.y + raw.h)) - y };
  const checkContext = () => {
    if (store.getProject() !== project || current().scene.id !== scene.id || store.getState().inTransaction)
      throw Error('The artwork changed while preparing this asset. Close this window and try again.');
  };
  assetCreationPending = true;
  try {
    const result = await ui.promptAsset({ suggestedName: (scene.name + ' asset').slice(0, 80),
      prepare: async () => {
        checkContext();
        if (rect.w < 1 || rect.h < 1) throw Error('Select artwork inside the canvas, then try again.');
        if (rect.w * rect.h > 16 * 1024 * 1024)
          throw Error('One asset can contain up to 16 million pixels. Use Select to mark a smaller area, then choose Make asset from artwork again.');
        if (project.assets.length >= 512) throw Error('This library already has 512 assets. Remove an unused asset before making another.');
        let canvas;
        try {
          canvas = await viewport.renderRegion({ sceneId: scene.id, rect, scale: 1, objects: true });
          checkContext();
          if (!prepareAssetPixels(canvas, rect, selection))
            throw Error('There is no visible artwork in this area. Paint something or choose a different selection, then try again.');
          const dataURL = canvas.toDataURL('image/png');
          if (dataURL.length > 32 * 1024 * 1024 * 4 / 3 + 128)
            throw Error('This asset image is too large. Select a smaller area, then try again.');
          if (project.assets.reduce((sum, asset) => sum + asset.dataURL.length * .75, dataURL.length * .75) > 64 * 1024 * 1024)
            throw Error('This project’s asset library is full. Remove an unused asset or make a smaller selection.');
          return { dataURL, width: rect.w, height: rect.h,
            description: selection ? 'Selected artwork · visible layers' : 'Whole canvas · visible layers' };
        } finally { if (canvas) canvas.width = canvas.height = 0; }
      } });
    if (!result) return;
    checkContext();
    const { prepared, name } = result;
    selectedAssetId = store.addAsset({ name, width: prepared.width, height: prepared.height,
      dataURL: prepared.dataURL, anchor: { x: prepared.width / 2, y: prepared.height }, collision: [], tags: ['created'] });
    settings.assetId = selectedAssetId; ui.showAssets(); schedulePanels();
    status('“' + name + '” added to your asset library. Choose Place asset to use it.');
  } finally { assetCreationPending = false; }
}
function prepareAssetPixels(canvas, rect, selection) {
  const context = canvas.getContext('2d'), points = selection?.points, masked = !!selection?.mask;
  let visible = false;
  // Work in small strips so large artwork does not need a second full-size pixel buffer.
  for (let top = 0; top < canvas.height; top += 64) {
    const image = context.getImageData(0, top, canvas.width, Math.min(64, canvas.height - top));
    if (masked) {
      for (let row = 0; row < image.height; row++) for (let col = 0; col < canvas.width; col++) {
        if (!insideSelection(selection, rect.x + col, rect.y + top + row)) {
          const offset = (row * canvas.width + col) * 4;
          image.data.fill(0, offset, offset + 4);
        }
      }
    } else if (points?.length) {
      for (let row = 0; row < image.height; row++) {
        const centerY = rect.y + top + row + .5, crossings = [];
        for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
          const [ax, ay] = points[i], [bx, by] = points[j];
          if ((ay > centerY) !== (by > centerY)) crossings.push(ax + (centerY - ay) * (bx - ax) / (by - ay));
        }
        crossings.sort((a, b) => a - b);
        const offset = row * canvas.width * 4;
        let last = 0;
        for (let i = 0; i + 1 < crossings.length; i += 2) {
          const left = Math.max(0, Math.min(canvas.width, Math.ceil(crossings[i] - rect.x - .5)));
          const right = Math.max(left, Math.min(canvas.width, Math.ceil(crossings[i + 1] - rect.x - .5)));
          image.data.fill(0, offset + last * 4, offset + left * 4); last = right;
        }
        image.data.fill(0, offset + last * 4, offset + canvas.width * 4);
      }
    }
    if (masked || points?.length) context.putImageData(image, 0, top);
    if (!visible) for (let i = 3; i < image.data.length; i += 4) {
      if (image.data[i]) { visible = true; break; }
    }
    if (visible && !points?.length && !masked) break;
  }
  return visible;
}
async function artworkPixels(scene, selection) {
  const raw = selection || { x: 0, y: 0, w: scene.width, h: scene.height };
  const x = Math.max(0, Math.floor(raw.x)), y = Math.max(0, Math.floor(raw.y));
  const rect = { x, y, w: Math.min(scene.width, Math.ceil(raw.x + raw.w)) - x,
    h: Math.min(scene.height, Math.ceil(raw.y + raw.h)) - y };
  if (rect.w < 1 || rect.h < 1 || rect.w * rect.h > 16 * 1024 * 1024)
    throw Error('Use Select to mark a smaller area of artwork, up to 16 million pixels.');
  const canvas = await viewport.renderRegion({ sceneId: scene.id, rect, scale: 1, objects: true });
  try {
    if (!prepareAssetPixels(canvas, rect, selection)) throw Error('Paint some artwork or upload an image to make a tile.');
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
  } finally { canvas.width = canvas.height = 0; }
}
async function makeTile() {
  if (materialDialogPending) return;
  const { project, scene, state } = current(), assetId = selectedAssetId || settings.assetId;
  if (state.inTransaction) throw Error('Finish your current stroke before making a tile.');
  const selection = structuredClone(viewport.getSelection());
  const checkContext = () => {
    if (store.getProject() !== project || current().scene.id !== scene.id || store.getState().inTransaction)
      throw Error('The project changed. Close this window and try again.');
  };
  materialDialogPending = true;
  try {
    const result = await openTileDialog({ onStatus: status, validate: result => { checkContext(); checkAssetCapacity(result.dataURL); },
      getArtwork: async () => { checkContext(); const image = await artworkPixels(scene, selection); checkContext(); return image; },
      getAsset: async () => {
        checkContext();
        if (!assetId) throw Error('Select an asset in your library before opening the tile maker.');
        const image = await viewport.getAssetPixels(assetId); checkContext();
        if (!image) throw Error('That asset is unavailable. Select another asset and try again.');
        return image;
      } });
    if (!result) return;
    checkContext();
    selectedAssetId = store.addAsset({ name: result.name, width: result.width, height: result.height,
      dataURL: result.dataURL, tags: result.tags, collision: [], anchor: { x: result.width / 2, y: result.height } });
    settings.assetId = selectedAssetId; ui.showAssets(); schedulePanels();
    status('“' + result.name + '” is ready. Select an area, then choose Fill area with tile.');
  } finally { materialDialogPending = false; }
}
async function fillTile(id = selectedAssetId || settings.assetId) {
  if (materialDialogPending) return;
  const { project, scene, state } = current(), asset = project.assets.find(value => value.id === id);
  if (!asset) throw Error('Choose an asset or make a floor / wallpaper tile first.');
  if (state.inTransaction) throw Error('Finish your current stroke before filling an area.');
  const selection = structuredClone(viewport.getSelection()), rect = selectionRect(scene);
  const checkContext = () => {
    if (store.getProject() !== project || current().scene.id !== scene.id || store.getState().inTransaction)
      throw Error('The project changed before filling. Choose your area and try again.');
  };
  materialDialogPending = true;
  try {
    let error = '', image;
    const tileColumns = Math.ceil((rect.x + rect.w) / 64) - Math.floor(rect.x / 64);
    const tileRows = Math.ceil((rect.y + rect.h) / 64) - Math.floor(rect.y / 64);
    if (rect.w < 1 || rect.h < 1) error = 'Select an area inside the canvas to fill.';
    else if (rect.w * rect.h > 8 * 1024 * 1024) error = 'Select a smaller area to fill, up to 8 million pixels, so Undo stays available.';
    else if (scene.layers.length >= 128) error = 'This scene already has 128 layers. Remove an unused layer before filling.';
    else if (state.rasterBytes + tileColumns * tileRows * 64 * 64 * 4 > 256 * 1024 * 1024)
      error = 'This project has room for a smaller fill. Select a smaller area or remove an unused paint layer.';
    else try { image = await viewport.getAssetPixels(id); if (!image) throw Error('The tile image could not be loaded. Choose another asset.'); }
    catch (failure) { error = failure.message; }
    checkContext();
    const confirmed = await ui.promptTileFill({ assetName: asset.name, width: rect.w, height: rect.h, selection: !!selection, error });
    if (!confirmed || error) return;
    checkContext();
    transaction('Fill area with tile', () => {
      const layerId = store.addLayer(scene.id, { name: (asset.name + ' · ' + (asset.tags.includes('wallpaper') ? 'wallpaper' : 'tile fill')).slice(0, 160),
        type: 'raster', role: 'world' });
      store.writePixels(scene.id, layerId, (function* () {
        for (let row = 0; row < rect.h; row++) for (let col = 0; col < rect.w; col++) {
          const x = rect.x + col, y = rect.y + row;
          if (selection && !insideSelection(selection, x, y)) continue;
          const offset = ((row % image.height) * image.width + col % image.width) * 4, d = image.data;
          if (!d[offset + 3]) continue;
          yield [x, y, ((d[offset] << 24) | (d[offset + 1] << 16) | (d[offset + 2] << 8) | d[offset + 3]) >>> 0];
        }
      })());
      store.setActiveLayer(layerId);
    });
    viewport.invalidate(); schedulePanels();
    status('Filled ' + (selection ? 'the selection' : 'the canvas') + ' with “' + asset.name + '” on a new paint layer. Undo is available.');
  } finally { materialDialogPending = false; }
}
async function downloadAsset(id = selectedAssetId || settings.assetId) {
  const asset = store.getProject().assets.find(value => value.id === id);
  if (!asset) throw Error('Select an asset to download.');
  const image = await viewport.getAssetPixels(id);
  if (!image) throw Error('The asset image could not be loaded.');
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  try {
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('The PNG could not be prepared.');
    downloadBlob(blob, safeName(asset.name) + '-' + image.width + 'x' + image.height + '.png');
    status('Downloaded “' + asset.name + '” as a native-size PNG.');
  } finally { canvas.width = canvas.height = 0; }
}
function checkAssetCapacity(dataURL, existingId = null) {
  const assets = store.getProject().assets;
  if (!existingId && assets.length >= 512) throw Error('Your library has 512 assets. Remove an unused asset, or download an editable project instead.');
  if (dataURL.length > 32 * 1024 * 1024 * 4 / 3 + 128) throw Error('Select a smaller area for this image, under 32 MB.');
  if (assets.reduce((sum, asset) => sum + (asset.id === existingId ? 0 : asset.dataURL.length * .75), dataURL.length * .75) > 64 * 1024 * 1024)
    throw Error('The asset library is full. Remove an unused asset, or download an editable project instead.');
}
async function saveWork(kind) {
  if (materialDialogPending) return;
  const { project, scene, state } = current();
  if (state.inTransaction) throw Error('Finish the current stroke before saving.');
  const assetId = selectedAssetId || settings.assetId, selectedAsset = project.assets.find(value => value.id === assetId);
  const selection = structuredClone(viewport.getSelection()), rect = selectionRect(scene);
  const assetSource = !!kind && kind !== 'interior' && scene.kind !== 'asset' && selectedAsset &&
    (kind === 'asset' || selectedAsset.tags.includes(kind));
  let options = { kind: kind || (scene.kind === 'interior' || scene.kind === 'map' ? 'interior' : 'asset'),
    name: assetSource ? selectedAsset.name : project.name, source: assetSource ? 'asset' : 'canvas',
    hasAsset: !!selectedAsset, assetName: selectedAsset?.name,
    sceneWidth: scene.width, sceneHeight: scene.height, selectionWidth: selection ? rect.w : null, selectionHeight: selection ? rect.h : null };
  const checkContext = () => {
    if (store.getProject() !== project || current().scene.id !== scene.id || store.getState().inTransaction)
      throw Error('The project changed. Close this window and save again.');
  };
  materialDialogPending = true;
  try {
    while (true) {
      const choice = await ui.promptSaveWork(options); if (!choice) return;
      try {
        checkContext();
        const snapshot = store.serialize(); snapshot.name = choice.name;
        const fileStore = { serialize: () => snapshot, getProject: () => snapshot,
          getState: () => store.getState(), markSaved: () => store.markSaved() };
        if (choice.format === 'project') {
          const result = await downloadProject(fileStore);
          await autosave.saveNow(); void refreshSavedProjects();
          status('Saved ' + result.filename + '. This editable file includes every layer, asset and collision edit.');
        } else if (choice.format === 'bundle') {
          const result = await exportBundle({ store: fileStore, viewport });
          status('Saved ' + result.filename + ' with editable artwork and game integration files.');
        } else if (choice.kind === 'interior') {
          snapshot.scenes.find(value => value.id === scene.id).name = choice.name;
          const result = await exportPNG({ store: fileStore, viewport, sceneId: scene.id });
          status('Saved ' + result.filename + '. Choose Editable project to keep layers and collision too.');
        } else {
          const revision = store.getState().revision;
          const image = choice.source === 'asset' ? await viewport.getAssetPixels(assetId) : await artworkPixels(scene, selection);
          checkContext();
          if (store.getState().revision !== revision) throw Error('The artwork changed while preparing the PNG. Save again after finishing your edit.');
          if (!image) throw Error('Choose an asset or some visible artwork to save.');
          const dataURL = choice.source === 'asset' ? selectedAsset.dataURL : imageDataURL(image);
          const existing = choice.source === 'asset' ? selectedAsset : project.assets.find(value => value.name === choice.name && value.dataURL === dataURL);
          const tags = [...new Set([...(existing?.tags || ['created', 'pixel-art']).filter(value => !['floor', 'wallpaper', 'tile', 'repeat'].includes(value)),
            ...(choice.kind === 'floor' || choice.kind === 'wallpaper' ? ['tile', choice.kind, 'repeat'] : [])])];
          checkAssetCapacity(dataURL, existing?.id);
          if (existing) { store.updateAsset(existing.id, { name: choice.name, tags }); selectedAssetId = existing.id; }
          else selectedAssetId = store.addAsset({ name: choice.name, width: image.width, height: image.height, dataURL,
            anchor: { x: image.width / 2, y: image.height }, collision: [], tags });
          settings.assetId = selectedAssetId; ui.showAssets(); schedulePanels();
          await downloadAsset(selectedAssetId); await autosave.saveNow(); void refreshSavedProjects();
          status('Saved “' + choice.name + '” as a PNG and in your asset library.');
        }
        return;
      } catch (error) { options = { ...options, ...choice, error: error.message || 'The file could not be saved. Try another format.' }; }
    }
  } finally { materialDialogPending = false; }
}
async function resizeImage() {
  if (materialDialogPending) return;
  const { project, scene } = current();
  let options = { width: scene.width, height: scene.height, mode: 'canvas' };
  materialDialogPending = true;
  try {
    while (true) {
      const choice = await ui.promptResize(options); if (!choice) return;
      try {
        if (store.getProject() !== project || current().scene.id !== scene.id) throw Error('The project changed. Close this window and try again.');
        applySceneResize(store, scene.id, choice); tools.clearSelection(); viewport.setSelectedObject(null); viewport.fit();
        status('Resized to ' + choice.width + ' × ' + choice.height + ' pixels. Undo restores the previous size and artwork.'); return;
      } catch (error) { options = { ...choice, error: error.message || 'Choose a smaller image size.' }; }
    }
  } finally { materialDialogPending = false; }
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
  if (isTransform && (mask?.points?.length || mask?.mask)) {
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
  if (isTransform && mask) {
    const next = { x: rect.x, y: rect.y, w: output.width, h: output.height };
    if (transformedMask) {
      next.mask = new Uint8Array(output.width * output.height);
      for (let i = 0; i < next.mask.length; i++) next.mask[i] = transformedMask.data[i * 4 + 3] ? 1 : 0;
    }
    viewport.setSelection(next);
  }
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
        replaceProject(spec.kind === 'interior' && spec.roomTemplate !== false ? createInteriorProject(spec) : createProject(spec)); selectedAssetId = settings.assetId = null;
        resetView(); status('New ' + spec.kind + ' canvas ready.'); break;
      }
      case 'open-project': ui.els.projectFile.click(); break;
      case 'open-project-file': if (payload) await openNative(payload); break;
      case 'save-project': await saveWork(); break;
      case 'save-work': await saveWork(payload?.kind); break;
      case 'resize-image': await resizeImage(); break;
      case 'blank-selection': {
        if (!viewport.getSelection()) throw Error('Use Select or Smart Select to choose the area to clear.');
        if (layer.type !== 'raster' || layer.locked) throw Error('Choose an unlocked paint layer, or use Edit pixels on your image first.');
        viewport.setSelectedObject(null); tools.deleteSelection();
        status('Cleared the selected area to transparent. Undo restores it.'); break;
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
        const sceneSpec = spec.kind === 'interior' && spec.roomTemplate !== false ? createInteriorProject(spec).scenes[0] : spec;
        const id = store.addScene(sceneSpec); store.setActiveScene(id); resetView(); break;
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
      case 'make-tile': await makeTile(); break;
      case 'fill-tile': await fillTile(typeof payload === 'string' ? payload : undefined); break;
      case 'export-asset': await downloadAsset(typeof payload === 'string' ? payload : undefined); break;
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
  u: 'ellipse', o: 'ellipse', m: 'select', q: 'lasso', w: 'smart-select', v: 'move', s: 'stamp', i: 'eyedropper', c: 'collision', h: 'hand' };
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
  if (store.getState().revision !== 0) return;
  replaceProject(createInteriorProject({ name: 'My interior' }));
  resetView(); status('Your empty room is ready. Floor and Walls are separate layers. Start painting, pixelify an image, or make flooring.');
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
