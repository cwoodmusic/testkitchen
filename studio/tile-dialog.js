import { createPattern, imageToTile, repeatTile } from './pattern-ops.js?v=materials-1';
import { readImage, safeName } from './io.js';

function el(tag, properties = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(properties)) {
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children); return node;
}
function select(options, value) {
  const control = el('select');
  for (const [key, label] of options) control.append(el('option', { value: key, text: label }));
  control.value = value; return control;
}
const DEFAULTS = {
  floor: { name: 'Warm wood floor', pattern: 'wood', width: 32, height: 32, colors: ['#b9895a', '#cda775', '#76503c'] },
  wallpaper: { name: 'Cozy striped wallpaper', pattern: 'stripes', width: 32, height: 64, colors: ['#e5d4b4', '#6b9990', '#a9b8a3'] },
};

/** Material authoring is local. Only confirming a ready tile returns artwork to the app. */
export function openTileDialog({ getArtwork, getAsset, onStatus = () => {}, kind = 'floor', validate = () => {} } = {}) {
  return new Promise(resolve => {
    let closed = false, revision = 0, loadRevision = 0, timer, ready = null, uploaded = null;
    const cachedSources = new Map(), fields = {};
    const dialog = el('dialog', { class: 'tile-dialog', 'aria-labelledby': 'tileDialogTitle', 'aria-describedby': 'tileDialogIntro' });
    const close = el('button', { type: 'button', class: 'tile-close', text: '×', 'aria-label': 'Close tile maker' });
    const title = el('h2', { id: 'tileDialogTitle', text: 'Floors & wallpapers' });
    const intro = el('p', { id: 'tileDialogIntro', class: 'tile-intro', text: 'Make one small tile, then repeat it across a room. Start with a pattern, upload an image, or use your own artwork. The repeat preview shows how the edges meet.' });
    const controls = el('div', { class: 'tile-controls' });
    function field(key, label, control, note) {
      fields[key] = control; control.dataset.tile = key;
      const wrap = el('label', { class: 'tile-field', text: label }, [control]);
      if (note) wrap.append(el('small', { text: note }));
      controls.append(wrap); return wrap;
    }
    field('kind', 'What are you making?', select([['floor', 'Floor tile'], ['wallpaper', 'Wallpaper']], kind === 'wallpaper' ? kind : 'floor'));
    field('name', 'Tile name', el('input', { type: 'text', maxLength: 80, required: true, autocomplete: 'off' }));
    field('source', 'Start from', select([['pattern', 'A ready-to-customize pattern'], ['upload', 'Upload an image'], ['artwork', 'Current artwork / selection'], ['asset', 'Selected library asset']], 'pattern'));
    const uploadWrap = field('file', 'Choose image', el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp' }), 'PNG, JPEG, or WebP. Your image stays in this browser.');
    const fileInfo = el('p', { class: 'tile-file-info' }); uploadWrap.append(fileInfo);
    const patternWrap = field('pattern', 'Pattern', select([['wood', 'Warm wood planks'], ['checker', 'Checker tiles'], ['stone', 'Stone / brickwork'], ['stripes', 'Classic stripes'], ['dots', 'Polka dots'], ['diamonds', 'Little diamonds']], 'wood'));
    field('size', 'Tile size', select([['16', '16 × 16 pixels'], ['32', '32 × 32 pixels'], ['wallpaper', '32 × 64 · wallpaper'], ['64', '64 × 64 pixels'], ['128', '128 × 128 pixels'], ['custom', 'Custom size']], '32'));
    const dimensionRow = el('div', { class: 'tile-dimensions' }); controls.append(dimensionRow);
    for (const key of ['width', 'height']) {
      const wrap = field(key, key === 'width' ? 'Width · pixels' : 'Height · pixels', el('input', { type: 'number', min: 8, max: 256, step: 1 }));
      dimensionRow.append(wrap);
    }
    const palette = el('fieldset', { class: 'tile-palette' }, [el('legend', { text: 'Make it your own' })]); controls.append(palette);
    for (const [index, label] of ['Base', 'Pattern', 'Shade / grout'].entries()) {
      const wrap = field('color' + (index + 1), label, el('input', { type: 'color' })); palette.append(wrap);
    }
    const seamlessWrap = field('seamless', 'When this tile repeats', select([['mirror', 'Mirror edges · seamless'], ['repeat', 'Repeat original · keep composition']], 'mirror'), 'Mirror changes the arrangement so opposite edges match. Original keeps your composition; visible seams may remain.');
    const single = el('canvas', { id: 'tilePreview', width: 32, height: 32, 'aria-label': 'Single tile preview' });
    const repeated = el('canvas', { id: 'tileRepeatPreview', width: 128, height: 128, 'aria-label': 'Four by four repeated tile preview' });
    const guideOverlay = el('div', { class: 'tile-guides', 'aria-hidden': 'true' });
    const singleStage = el('div', { class: 'tile-single-stage' }, [single]);
    const repeatStage = el('div', { class: 'tile-repeat-stage' }, [repeated, guideOverlay]);
    const details = el('p', { class: 'tile-preview-details', text: '32 × 32 source pixels · repeats in both directions' });
    const guideToggle = el('input', { type: 'checkbox', checked: true, dataset: { tile: 'guides' } });
    const guideLabel = el('label', { class: 'tile-guide-toggle', text: 'Show tile edges' }, [guideToggle]);
    const previews = el('div', { class: 'tile-preview-column' }, [
      el('div', { class: 'tile-preview-heading' }, [el('h3', { text: 'Your tile' }), details]), singleStage,
      el('div', { class: 'tile-preview-heading' }, [el('h3', { text: 'In the room · 4 × 4 repeat' }), guideLabel]), repeatStage,
      el('p', { class: 'tile-preview-note', text: 'Preview guides are never added to your tile. After saving, use Fill with tile on a room selection, or Edit asset to paint more detail.' }),
    ]);
    const status = el('p', { class: 'tile-status', role: 'status', 'aria-live': 'polite', text: 'Preparing your tile…' });
    const error = el('p', { class: 'tile-error', role: 'alert', hidden: true });
    const download = el('button', { type: 'button', text: 'Download tile PNG', disabled: true, dataset: { tile: 'download' } });
    const cancel = el('button', { type: 'button', text: 'Cancel' });
    const apply = el('button', { type: 'button', class: 'tile-apply', text: 'Save tile to library', disabled: true, dataset: { tile: 'apply' } });
    dialog.append(el('header', { class: 'tile-heading' }, [title, close]), intro,
      el('div', { class: 'tile-workspace' }, [controls, previews]), status, error,
      el('footer', { class: 'tile-actions' }, [download, cancel, apply]));
    document.body.append(dialog);

    function announce(message, failed = false) {
      status.textContent = failed ? 'Tile could not be prepared.' : message;
      error.textContent = failed ? message : ''; error.hidden = !failed;
      onStatus(message);
    }
    function confirmState() {
      const validName = fields.name.value.trim().length > 0 && fields.name.value.trim().length <= 80;
      apply.disabled = download.disabled = !ready || !validName;
    }
    function finish(result = null) {
      if (closed) return;
      closed = true; revision++; loadRevision++; clearTimeout(timer);
      dialog.close(); dialog.remove(); resolve(result);
    }
    function visibility() {
      const source = fields.source.value;
      uploadWrap.hidden = source !== 'upload'; patternWrap.hidden = palette.hidden = source !== 'pattern';
      seamlessWrap.hidden = source === 'pattern';
    }
    function draw(canvas, image) {
      canvas.width = image.width; canvas.height = image.height;
      canvas.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    }
    function png(image) {
      const canvas = document.createElement('canvas'); draw(canvas, image);
      try { return canvas.toDataURL('image/png'); }
      finally { canvas.width = canvas.height = 0; }
    }
    async function sourceImage(source) {
      if (source === 'upload') {
        if (!uploaded) throw new Error('Choose an image to make your tile.');
        return uploaded;
      }
      if (!cachedSources.has(source)) {
        const getter = source === 'artwork' ? getArtwork : getAsset;
        if (typeof getter !== 'function') throw new Error(source === 'asset' ? 'Choose a library asset before opening the tile maker.' : 'Paint some artwork before making a tile.');
        cachedSources.set(source, Promise.resolve().then(getter));
      }
      return cachedSources.get(source);
    }
    async function prepare(ownRevision) {
      try {
        const width = Number(fields.width.value), height = Number(fields.height.value), source = fields.source.value;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > 256 || height > 256) throw new Error('Use whole tile dimensions from 8 to 256 pixels.');
        const result = source === 'pattern' ? createPattern({ width, height, pattern: fields.pattern.value,
          colors: [fields.color1.value, fields.color2.value, fields.color3.value] })
          : imageToTile(await sourceImage(source), { width, height, seamless: fields.seamless.value });
        if (closed || ownRevision !== revision) return;
        let visible = false;
        for (let i = 3; i < result.data.length; i += 4) if (result.data[i]) { visible = true; break; }
        if (!visible) throw new Error('There is no visible artwork here. Choose a different image, asset, or painted selection.');
        const dataURL = png(result);
        ready = { ...result, dataURL };
        draw(single, result); draw(repeated, repeatTile(result));
        dialog.style.setProperty('--tile-ratio', String(width / height));
        singleStage.style.aspectRatio = repeatStage.style.aspectRatio = `${width} / ${height}`;
        details.textContent = `${width} × ${height} source pixels · repeats in both directions`;
        announce(`${width} × ${height} ${fields.kind.value === 'floor' ? 'floor tile' : 'wallpaper'} ready. Save it to your library or download the single tile PNG.`);
      } catch (problem) {
        if (closed || ownRevision !== revision) return;
        ready = null; announce(problem.message || 'This artwork could not become a tile.', true);
      } finally { if (!closed && ownRevision === revision) confirmState(); }
    }
    function schedule() {
      const ownRevision = ++revision; clearTimeout(timer); ready = null; confirmState(); visibility();
      announce('Updating the tile and repeat preview…');
      timer = setTimeout(() => prepare(ownRevision), 80);
    }
    function setKind(initial = false) {
      const defaults = DEFAULTS[fields.kind.value];
      const names = Object.values(DEFAULTS).map(value => value.name);
      if (initial || names.includes(fields.name.value)) fields.name.value = defaults.name;
      fields.pattern.value = defaults.pattern;
      fields.width.value = defaults.width; fields.height.value = defaults.height;
      fields.size.value = fields.kind.value === 'wallpaper' ? 'wallpaper' : '32';
      defaults.colors.forEach((value, index) => { fields['color' + (index + 1)].value = value; });
      schedule();
    }
    fields.kind.addEventListener('change', () => setKind());
    fields.size.addEventListener('change', () => {
      if (fields.size.value === 'wallpaper') { fields.width.value = 32; fields.height.value = 64; }
      else if (fields.size.value !== 'custom') fields.width.value = fields.height.value = Number(fields.size.value);
      schedule();
    });
    for (const key of ['width', 'height']) fields[key].addEventListener('input', () => { fields.size.value = 'custom'; schedule(); });
    for (const key of ['source', 'pattern', 'seamless']) fields[key].addEventListener('change', schedule);
    for (const key of ['color1', 'color2', 'color3']) fields[key].addEventListener('input', schedule);
    fields.name.addEventListener('input', confirmState);
    fields.file.addEventListener('change', async () => {
      const file = fields.file.files?.[0]; fields.file.value = ''; if (!file) return;
      const ownLoad = ++loadRevision; uploaded = null; revision++; ready = null; clearTimeout(timer); confirmState();
      announce('Reading image locally…');
      try {
        const image = await readImage(file);
        if (closed || ownLoad !== loadRevision) return;
        uploaded = image; fileInfo.textContent = `${file.name} · ${image.width} × ${image.height}`; schedule();
      } catch (problem) {
        if (closed || ownLoad !== loadRevision) return;
        fileInfo.textContent = ''; announce(problem.message || 'The image could not be read.', true);
      }
    });
    guideToggle.addEventListener('change', () => { guideOverlay.hidden = !guideToggle.checked; });
    for (const button of [close, cancel]) button.addEventListener('click', () => finish());
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    dialog.addEventListener('close', () => finish());
    apply.addEventListener('click', () => {
      if (!ready || apply.disabled) return;
      try {
        const result = { ...ready, name: fields.name.value.trim(), tags: ['tile', fields.kind.value, 'repeat'] };
        validate(result); finish(result);
      } catch (problem) { announce(problem.message || 'The tile could not be saved. Download its PNG to keep a copy.', true); }
    });
    download.addEventListener('click', () => {
      if (!ready || download.disabled) return;
      const bytes = Uint8Array.from(atob(ready.dataURL.split(',')[1]), char => char.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' })), anchor = document.createElement('a');
      anchor.href = url; anchor.download = `${safeName(fields.name.value, 'material')}-${ready.width}x${ready.height}-tile.png`;
      anchor.hidden = true; document.body.append(anchor); anchor.click(); anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      announce('Downloaded the single tile PNG. The repeat preview is for checking the pattern.');
    });
    dialog.showModal(); setKind(true);
  });
}
