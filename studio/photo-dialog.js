import { pixelate, applyEffect } from './image-ops.js';

const MAX_PIXELS = 16_777_216;
const MAX_FILE_BYTES = 24 * 1024 * 1024;
const PRESETS = {
  character: { width: 80, height: 96, anchor: { x: 40, y: 80 } },
  tile: { width: 128, height: 128 },
  asset: { width: 512, height: 512 },
  map: { width: 1672, height: 941 },
};

function checkSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > MAX_PIXELS) throw new Error('Use dimensions up to 8192 on either side and at most 16 million pixels.');
}

// Inspect encoded dimensions before asking the browser to allocate a decoded image.
function encodedSize(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (start, size) => String.fromCharCode(...bytes.subarray(start, start + size));
  if (bytes.length >= 24 && bytes[0] === 137 && ascii(1, 3) === 'PNG' && ascii(12, 4) === 'IHDR') return [view.getUint32(16), view.getUint32(20)];
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const type = ascii(offset, 4), length = view.getUint32(offset + 4, true), p = offset + 8;
      if (p + length > bytes.length) break;
      if (type === 'VP8X' && length >= 10) return [1 + bytes[p + 4] + bytes[p + 5] * 256 + bytes[p + 6] * 65536, 1 + bytes[p + 7] + bytes[p + 8] * 256 + bytes[p + 9] * 65536];
      if (type === 'VP8L' && length >= 5 && bytes[p] === 0x2f) return [1 + ((bytes[p + 1] | bytes[p + 2] << 8) & 0x3fff), 1 + ((bytes[p + 2] >> 6 | bytes[p + 3] << 2 | bytes[p + 4] << 10) & 0x3fff)];
      if (type === 'VP8 ' && length >= 10 && bytes[p + 3] === 0x9d && bytes[p + 4] === 1 && bytes[p + 5] === 0x2a) return [view.getUint16(p + 6, true) & 0x3fff, view.getUint16(p + 8, true) & 0x3fff];
      offset = p + length + (length & 1);
    }
  }
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 255) continue;
      while (bytes[offset] === 255) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
      if (offset + 2 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker) && length >= 7) return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      offset += length;
    }
  }
  throw new Error('Choose a valid PNG, JPEG, or WebP image.');
}

async function decode(file) {
  if (!file || !Number.isFinite(file.size) || !file.size || file.size > MAX_FILE_BYTES) throw new Error('Choose an image smaller than 24 MB.');
  const dimensions = encodedSize(new Uint8Array(await file.arrayBuffer()));
  checkSize(...dimensions);
  let image, url;
  try {
    if (typeof createImageBitmap === 'function') image = await createImageBitmap(file);
    else {
      url = URL.createObjectURL(file);
      image = new Image(); image.src = url; await image.decode();
    }
    const width = image.width || image.naturalWidth, height = image.height || image.naturalHeight;
    checkSize(width, height);
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser cannot read image pixels.');
    context.drawImage(image, 0, 0);
    const result = { width, height, data: context.getImageData(0, 0, width, height).data };
    canvas.width = canvas.height = 1;
    return result;
  } finally {
    image?.close?.();
    if (url) URL.revokeObjectURL(url);
  }
}

// This function is also serialized into the local module worker below.
function convert(image, settings) {
  const block = settings.block;
  let result = pixelate(image, {
    width: Math.max(1, Math.ceil(settings.width / block)), height: Math.max(1, Math.ceil(settings.height / block)),
    fit: settings.fit, colors: 0,
    brightness: settings.brightness, contrast: settings.contrast, saturation: settings.saturation, hue: settings.hue,
  });
  if (settings.grayscale) result = applyEffect(result, 'grayscale');
  if (settings.invert) result = applyEffect(result, 'invert');
  if (settings.outline) result = applyEffect(result, 'outline', { size: settings.outline, color: settings.outlineColor });
  if (settings.sharpen) result = applyEffect(result, 'sharpen', { amount: settings.sharpen });
  result = pixelate(result, { colors: settings.colors, dither: settings.dither });
  if (result.width !== settings.width || result.height !== settings.height) result = pixelate(result, { width: settings.width, height: settings.height, colors: 0 });
  return result;
}

function element(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') el.textContent = value;
    else if (key === 'class') el.className = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key in el) el[key] = value;
    else el.setAttribute(key, value);
  }
  el.append(...children);
  return el;
}

/** Local file conversion. Nothing is sent to a server or written to a project. */
export function openPhotoDialog({ file, onStatus = () => {} } = {}) {
  return new Promise(resolve => {
    let source = null, converted = null, sourceName = 'Pixel photo', closed = false, timer, worker, workerURL, revision = 0, loadRevision = 0;
    let previewFrame = 0, previewObserver;
    const previewDimensions = new WeakMap();
    const dialog = element('dialog', { class: 'photo-dialog', 'aria-label': 'Photo to pixel art' });
    const heading = element('h2', { text: 'Photo → editable pixels' });
    const close = element('button', { type: 'button', text: '×', class: 'photo-close', 'aria-label': 'Close photo conversion' });
    const intro = element('p', { class: 'photo-intro', text: 'Convert a local PNG, JPEG, or WebP into editable pixels. Coda uses source pixels: choose a real canvas size, then adjust detail and color. Palette reduction preserves photographed shapes; drawing tools refine the result.' });
    const upload = element('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', dataset: { photo: 'file' } });
    const fileLabel = element('label', { class: 'photo-upload', text: 'Choose image (up to 24 MB)' }, [upload]);
    const fileInfo = element('p', { class: 'photo-file-info', text: 'Your image stays in this browser.' });
    const form = element('div', { class: 'photo-controls' });
    const fields = {};
    function field(key, label, input, note) {
      fields[key] = input; input.dataset.photo = key;
      const wrap = element('label', { class: 'photo-field', text: label }, [input]);
      if (note) wrap.append(element('small', { text: note }));
      form.append(wrap); return input;
    }
    function select(options, value) {
      const control = element('select');
      for (const [key, label] of options) control.append(element('option', { value: key, text: label }));
      control.value = value; return control;
    }
    function number(value, min, max, step = 1) { return element('input', { type: 'number', value, min, max, step }); }
    function range(key, label, value, min, max, step = 1, note) {
      const input = element('input', { type: 'range', value, min, max, step });
      field(key, label, input, note);
      const output = element('output', { text: String(value) });
      input.parentElement.append(output); input.addEventListener('input', () => { output.value = input.value; });
      return input;
    }
    field('preset', 'Coda size', select([['tile', 'Tile / small asset · 128 × 128'], ['character', 'Character · 80 × 96 · anchor 40,80'], ['asset', 'Large asset · 512 × 512'], ['map', 'Original map · 1672 × 941'], ['custom', 'Custom dimensions']], 'tile'));
    field('width', 'Width (source pixels)', number(128, 1, 8192));
    field('height', 'Height (source pixels)', number(128, 1, 8192));
    field('fit', 'Image fitting', select([['contain', 'Fit inside · transparent edges'], ['cover', 'Fill canvas · crop edges'], ['stretch', 'Stretch to canvas']], 'contain'));
    range('block', 'Pixel block size', 1, 1, 16, 1, '1 = native Coda pixels. Larger blocks give coarser detail within this canvas.');
    field('colors', 'Palette colors', number(32, 2, 256));
    field('dither', 'Dithering', select([['none', 'None · flat color'], ['ordered', 'Ordered · regular texture'], ['floyd-steinberg', 'Floyd–Steinberg · fine texture']], 'none'));
    range('brightness', 'Brightness', 0, -100, 100);
    range('contrast', 'Contrast', 0, -100, 100);
    range('saturation', 'Saturation', 0, -100, 100);
    range('hue', 'Hue (degrees)', 0, -180, 180);
    range('outline', 'Outline (sample pixels)', 0, 0, 4);
    field('outlineColor', 'Outline color', element('input', { type: 'color', value: '#24223a' }));
    range('sharpen', 'Sharpen', 0, 0, 2, .25);
    field('grayscale', 'Grayscale', element('input', { type: 'checkbox' }));
    field('invert', 'Invert colors', element('input', { type: 'checkbox' }));
    field('asAsset', 'Add to asset library', element('input', { type: 'checkbox', checked: true }), 'Uncheck to create an editable scene.');
    const previews = element('div', { class: 'photo-previews' });
    const before = element('canvas', { width: 320, height: 240, 'aria-label': 'Original photo preview' });
    before.style.imageRendering = 'auto';
    const after = element('canvas', { width: 320, height: 240, 'aria-label': 'Converted pixel preview' });
    for (const [title, canvas] of [['Original', before], ['Pixel preview', after]]) previews.append(element('figure', {}, [element('figcaption', { text: title }), element('div', { class: 'photo-preview-frame' }, [canvas])]));
    const previewZoom = select([['fit', 'Fit preview'], ['1', '1× source pixels'], ['2', '2× source pixels'], ['4', '4× source pixels'], ['8', '8× source pixels']], 'fit');
    const previewControls = element('label', { class: 'photo-preview-zoom', text: 'Preview scale' }, [previewZoom]);
    const status = element('p', { class: 'photo-status', text: 'Choose an image to begin.', role: 'status', 'aria-live': 'polite' });
    const apply = element('button', { type: 'button', text: 'Use editable pixels', disabled: true, class: 'photo-apply', dataset: { photo: 'apply' } });
    const cancel = element('button', { type: 'button', text: 'Cancel' });
    const reset = element('button', { type: 'button', text: 'Reset adjustments' });
    const actions = element('div', { class: 'photo-actions' }, [reset, cancel, apply]);
    dialog.append(element('div', { class: 'photo-heading' }, [heading, close]), intro, fileLabel, fileInfo, element('div', { class: 'photo-workspace' }, [form, element('div', { class: 'photo-preview-column' }, [previewControls, previews, status])]), actions);
    document.body.append(dialog);

    function announce(message, error = false) { status.textContent = message; status.dataset.error = String(error); onStatus(message); }
    function stopWorker() { worker?.terminate(); worker = null; if (workerURL) URL.revokeObjectURL(workerURL); workerURL = null; }
    function finish(result = null) {
      if (closed) return;
      closed = true; revision++; loadRevision++; clearTimeout(timer); stopWorker();
      cancelAnimationFrame(previewFrame); previewObserver?.disconnect();
      window.removeEventListener('resize', queuePreviewResize);
      window.visualViewport?.removeEventListener('resize', queuePreviewResize);
      dialog.close?.(); dialog.remove(); resolve(result);
    }
    function readSettings() {
      const settings = {};
      for (const [key, input] of Object.entries(fields)) settings[key] = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.type === 'range' ? Number(input.value) : input.value;
      checkSize(settings.width, settings.height);
      if (!Number.isInteger(settings.colors) || settings.colors < 2 || settings.colors > 256) throw new Error('Choose a palette of 2–256 colors.');
      return settings;
    }
    function sizePreview(canvas, image) {
      const frame = canvas.parentElement, zoom = previewZoom.value;
      // Remove existing scrollbars before measuring the complete available frame.
      frame.style.overflow = zoom === 'fit' ? 'hidden' : 'auto';
      if (!frame.clientWidth || !frame.clientHeight) return;
      const scale = zoom === 'fit' ? Math.min(frame.clientWidth / image.width, frame.clientHeight / image.height) : Number(zoom);
      canvas.style.width = `${Math.max(1, Math.floor(image.width * scale))}px`;
      canvas.style.height = `${Math.max(1, Math.floor(image.height * scale))}px`;
      if (zoom === 'fit') frame.scrollLeft = frame.scrollTop = 0;
    }
    function resizePreviews() {
      previewFrame = 0;
      if (closed) return;
      for (const canvas of [before, after]) {
        const image = previewDimensions.get(canvas);
        if (image) sizePreview(canvas, image);
      }
    }
    function queuePreviewResize() {
      if (!closed && !previewFrame) previewFrame = requestAnimationFrame(resizePreviews);
    }
    function drawPreview(canvas, image) {
      previewDimensions.set(canvas, { width: image.width, height: image.height });
      // Preview buffers stay bounded; CSS zoom provides scrolling without huge canvases.
      const bufferScale = Math.min(1, 1024 / Math.max(image.width, image.height));
      const tiny = document.createElement('canvas'); tiny.width = image.width; tiny.height = image.height;
      tiny.getContext('2d').putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
      canvas.width = Math.max(1, Math.round(image.width * bufferScale)); canvas.height = Math.max(1, Math.round(image.height * bufferScale));
      const context = canvas.getContext('2d'); context.imageSmoothingEnabled = canvas === before;
      context.drawImage(tiny, 0, 0, canvas.width, canvas.height);
      sizePreview(canvas, image);
      tiny.width = tiny.height = 1;
    }
    function showResult(result, ownRevision, settings) {
      if (closed || ownRevision !== revision) return;
      converted = result; drawPreview(after, result); apply.disabled = false;
      announce(`${result.width} × ${result.height} editable pixels · ${settings.colors} color limit · ${settings.block}px blocks. Alpha is preserved; outlines stay within the canvas.`);
    }
    function process() {
      if (!source || closed) return;
      let settings;
      try { settings = readSettings(); } catch (error) { announce(error.message, true); return; }
      const ownRevision = revision;
      announce('Converting locally…');
      const fallback = () => {
        // Worker-free browsers retain the same bounded conversion and output validation.
        setTimeout(() => {
          if (closed || ownRevision !== revision) return;
          try { showResult(convert(source, settings), ownRevision, settings); } catch (error) { announce(error.message, true); }
        }, 0);
      };
      if (typeof Worker !== 'function') { fallback(); return; }
      try {
        const moduleURL = new URL('./image-ops.js', import.meta.url).href;
        const script = `import {pixelate,applyEffect} from ${JSON.stringify(moduleURL)};const convert=${convert.toString()};self.onmessage=({data})=>{try{const result=convert(data.image,data.settings);self.postMessage({result},[result.data.buffer])}catch(error){self.postMessage({error:error.message})}};`;
        workerURL = URL.createObjectURL(new Blob([script], { type: 'text/javascript' }));
        worker = new Worker(workerURL, { type: 'module' });
        worker.onmessage = ({ data }) => {
          if (closed || ownRevision !== revision) return;
          stopWorker();
          if (data.error) announce(data.error, true); else showResult(data.result, ownRevision, settings);
        };
        worker.onerror = event => { event.preventDefault(); if (closed || ownRevision !== revision) return; stopWorker(); fallback(); };
        // Structured cloning keeps the source intact when an in-flight worker is cancelled.
        worker.postMessage({ image: source, settings });
      } catch { stopWorker(); fallback(); }
    }
    function schedule() {
      revision++; converted = null; apply.disabled = true; clearTimeout(timer); stopWorker();
      if (source) { announce('Updating preview…'); timer = setTimeout(process, 130); }
    }
    async function load(selectedFile) {
      if (!selectedFile) return;
      const ownLoad = ++loadRevision;
      announce('Reading image locally…');
      try {
        const image = await decode(selectedFile);
        if (closed || ownLoad !== loadRevision) return;
        source = image; sourceName = String(selectedFile.name || 'Pixel photo').replace(/\.[^.]+$/, '').slice(0, 120) || 'Pixel photo';
        fileInfo.textContent = `${selectedFile.name || 'Photo'} · ${image.width} × ${image.height} source pixels · local processing`;
        drawPreview(before, source); schedule();
      } catch (error) { if (!closed && ownLoad === loadRevision) announce(`Image not loaded: ${error.message}`, true); }
    }
    upload.addEventListener('change', () => { load(upload.files?.[0]); upload.value = ''; });
    fields.preset.addEventListener('change', () => {
      const preset = PRESETS[fields.preset.value];
      if (preset) { fields.width.value = preset.width; fields.height.value = preset.height; }
      schedule();
    });
    for (const key of ['width', 'height']) fields[key].addEventListener('input', () => { fields.preset.value = 'custom'; });
    for (const [key, control] of Object.entries(fields)) if (key !== 'preset' && key !== 'asAsset') control.addEventListener('input', schedule);
    previewZoom.addEventListener('change', resizePreviews);
    reset.addEventListener('click', () => {
      for (const key of ['brightness', 'contrast', 'saturation', 'hue', 'outline', 'sharpen']) { fields[key].value = 0; fields[key].dispatchEvent(new Event('input')); }
      fields.grayscale.checked = fields.invert.checked = false; fields.colors.value = 32; fields.dither.value = 'none'; fields.block.value = 1;
      fields.block.dispatchEvent(new Event('input')); schedule();
    });
    for (const button of [close, cancel]) button.addEventListener('click', () => finish());
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
    dialog.addEventListener('close', () => finish());
    apply.addEventListener('click', () => {
      if (!converted || apply.disabled) return;
      try {
        const canvas = document.createElement('canvas'); canvas.width = converted.width; canvas.height = converted.height;
        canvas.getContext('2d').putImageData(new ImageData(converted.data, converted.width, converted.height), 0, 0);
        const dataURL = canvas.toDataURL('image/png'); canvas.width = canvas.height = 1;
        const preset = PRESETS[fields.preset.value];
        finish({ name: `${sourceName} pixels`, ...converted, dataURL, asAsset: fields.asAsset.checked, pixelScale: 1, anchor: preset?.anchor ? { ...preset.anchor } : { x: Math.floor(converted.width / 2), y: converted.height } });
      } catch (error) { announce(`Could not prepare pixels: ${error.message}`, true); }
    });
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    if (typeof ResizeObserver === 'function') {
      previewObserver = new ResizeObserver(queuePreviewResize);
      for (const canvas of [before, after]) previewObserver.observe(canvas.parentElement);
    }
    window.addEventListener('resize', queuePreviewResize);
    window.visualViewport?.addEventListener('resize', queuePreviewResize);
    queuePreviewResize();
    if (file) load(file);
  });
}
