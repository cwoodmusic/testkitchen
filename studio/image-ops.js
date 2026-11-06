/** Local, DOM-free RGBA operations. Every operation returns its own pixel buffer. */
const MAX_PIXELS = 16_777_216;
const clamp = (n, lo = 0, hi = 255) => Math.max(lo, Math.min(hi, n));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > MAX_PIXELS) {
    throw new Error('Image dimensions must be 1–8192 pixels, with at most 16 million pixels.');
  }
}

function validate(image) {
  if (!image) throw new Error('An RGBA image is required.');
  dimensions(image.width, image.height);
  if (!(image.data instanceof Uint8ClampedArray) || image.data.length !== image.width * image.height * 4) throw new Error('Image must contain a complete Uint8ClampedArray RGBA buffer.');
  return image;
}

function copy(image) {
  validate(image);
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) };
}

function color(value) {
  if (Array.isArray(value) || ArrayBuffer.isView(value)) return [clamp(finite(value[0])), clamp(finite(value[1])), clamp(finite(value[2])), clamp(finite(value[3], 255))];
  if (typeof value === 'number') return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
  if (value && typeof value === 'object') return color([value.r, value.g, value.b, value.a ?? 255]);
  let hex = String(value ?? '#000000ff').replace(/^#/, '');
  if (/^[0-9a-f]{3,4}$/i.test(hex)) hex = [...hex].map(c => c + c).join('');
  if (!/^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(hex)) throw new Error('Palette and effect colors must be hex colors or RGBA arrays.');
  return [0, 2, 4, 6].map((i) => i < hex.length ? parseInt(hex.slice(i, i + 2), 16) : 255);
}

/** Median-cut palette, alpha-weighted and bounded to a 32K color histogram. */
export function extractPalette(image, count = 32) {
  validate(image);
  count = Math.round(clamp(finite(count, 32), 1, 256));
  const bins = new Map();
  const exact = new Map();
  let hasManyColors = false;
  for (let i = 0; i < image.data.length; i += 4) {
    const d = image.data, weight = d[i + 3] / 255;
    if (!weight) continue;
    const key = (d[i] >> 3) * 1024 + (d[i + 1] >> 3) * 32 + (d[i + 2] >> 3);
    let bin = bins.get(key);
    if (!bin) { bin = [0, 0, 0, 0]; bins.set(key, bin); }
    for (let channel = 0; channel < 3; channel++) bin[channel] += d[i + channel] * weight;
    bin[3] += weight;
    if (!hasManyColors) {
      exact.set(d[i] * 65536 + d[i + 1] * 256 + d[i + 2], [d[i], d[i + 1], d[i + 2], 255]);
      if (exact.size > count) { hasManyColors = true; exact.clear(); }
    }
  }
  if (!hasManyColors) return [...exact.values()];
  const entries = [...bins.values()].map(v => [v[0] / v[3], v[1] / v[3], v[2] / v[3], v[3]]);
  function box(values) {
    const ranges = [0, 1, 2].map(c => Math.max(...values.map(v => v[c])) - Math.min(...values.map(v => v[c])));
    const axis = ranges.indexOf(Math.max(...ranges));
    return { values, axis, score: ranges[axis] * values.reduce((s, v) => s + v[3], 0) };
  }
  const boxes = [box(entries)];
  while (boxes.length < count) {
    let index = -1, best = -1;
    boxes.forEach((b, i) => { if (b.values.length > 1 && b.score > best) { best = b.score; index = i; } });
    if (index < 0) break;
    const current = boxes.splice(index, 1)[0];
    current.values.sort((a, b) => a[current.axis] - b[current.axis]);
    const midpoint = current.values.reduce((s, v) => s + v[3], 0) / 2;
    let total = 0, split = 1;
    for (let i = 0; i < current.values.length - 1; i++) {
      total += current.values[i][3]; split = i + 1;
      if (total >= midpoint) break;
    }
    boxes.push(box(current.values.slice(0, split)), box(current.values.slice(split)));
  }
  return boxes.map(b => {
    const total = b.values.reduce((s, v) => s + v[3], 0);
    return [0, 1, 2].map(c => Math.round(b.values.reduce((s, v) => s + v[c] * v[3], 0) / total)).concat(255);
  });
}

function resize(image, width, height, fit = 'stretch') {
  dimensions(width, height);
  const data = new Uint8ClampedArray(width * height * 4);
  const ratio = fit === 'contain' ? Math.min(width / image.width, height / image.height) : fit === 'cover' ? Math.max(width / image.width, height / image.height) : null;
  const dw = ratio ? image.width * ratio : width, dh = ratio ? image.height * ratio : height;
  const ox = (width - dw) / 2, oy = (height - dh) / 2;
  for (let y = 0; y < height; y++) {
    const sy = Math.floor((y + .5 - oy) / dh * image.height);
    if (sy < 0 || sy >= image.height) continue;
    for (let x = 0; x < width; x++) {
      const sx = Math.floor((x + .5 - ox) / dw * image.width);
      if (sx < 0 || sx >= image.width) continue;
      const source = (sy * image.width + sx) * 4, dest = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) data[dest + c] = image.data[source + c];
    }
  }
  return { width, height, data };
}

function adjust(image, options) {
  const brightness = clamp(finite(options.brightness), -100, 100) * 2.55;
  const contrast = clamp(finite(options.contrast), -100, 100) * 2.55;
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const saturation = 1 + clamp(finite(options.saturation), -100, 100) / 100;
  const angle = finite(options.hue) * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
  const hue = finite(options.hue) % 360;
  const d = image.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    let r = cf * (d[i] - 128) + 128 + brightness, g = cf * (d[i + 1] - 128) + 128 + brightness, b = cf * (d[i + 2] - 128) + 128 + brightness;
    const l = .2126 * r + .7152 * g + .0722 * b;
    r = l + (r - l) * saturation; g = l + (g - l) * saturation; b = l + (b - l) * saturation;
    if (hue) {
      const nr = (.213 + cos * .787 - sin * .213) * r + (.715 - cos * .715 - sin * .715) * g + (.072 - cos * .072 + sin * .928) * b;
      const ng = (.213 - cos * .213 + sin * .143) * r + (.715 + cos * .285 + sin * .140) * g + (.072 - cos * .072 - sin * .283) * b;
      const nb = (.213 - cos * .213 - sin * .787) * r + (.715 - cos * .715 + sin * .715) * g + (.072 + cos * .928 + sin * .072) * b;
      r = nr; g = ng; b = nb;
    }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return image;
}

function quantize(image, palette, dither) {
  if (!palette.length) return image;
  const d = image.data, w = image.width, h = image.height;
  // Exact cache is capped; a bounded coarse cache covers error-diffusion colors.
  const cache = new Map(), coarse = new Int16Array(32768).fill(-1);
  const paletteKeys = new Map(palette.map((p, i) => [p[0] * 65536 + p[1] * 256 + p[2], i]));
  function nearest(r, g, b) {
    r = Math.round(clamp(r)); g = Math.round(clamp(g)); b = Math.round(clamp(b));
    const key = r * 65536 + g * 256 + b;
    if (paletteKeys.has(key)) return paletteKeys.get(key);
    if (cache.has(key)) return cache.get(key);
    const ckey = (r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3);
    if (cache.size >= 65536 && coarse[ckey] !== -1) return coarse[ckey];
    let best = 0, distance = Infinity;
    for (let j = 0; j < palette.length; j++) {
      const p = palette[j], delta = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
      if (delta < distance) { distance = delta; best = j; }
    }
    if (cache.size < 65536) cache.set(key, best);
    coarse[ckey] = best;
    return best;
  }
  const mode = dither === true ? 'floyd-steinberg' : String(dither || 'none').toLowerCase();
  const floyd = ['floyd', 'floyd-steinberg', 'floydsteinberg', 'diffusion'].includes(mode);
  const ordered = ['ordered', 'bayer'].includes(mode);
  if (!floyd && !ordered && !['none', 'false', 'off'].includes(mode)) throw new Error('Dither must be none, ordered, or floyd-steinberg.');
  let current = floyd ? new Float32Array((w + 2) * 3) : null;
  let next = floyd ? new Float32Array((w + 2) * 3) : null;
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const strength = 255 / Math.max(2, Math.cbrt(palette.length));
  for (let y = 0; y < h; y++) {
    const direction = floyd && y % 2 ? -1 : 1;
    for (let n = 0; n < w; n++) {
      const x = direction === 1 ? n : w - 1 - n, i = (y * w + x) * 4, ei = (x + 1) * 3;
      if (!d[i + 3]) { if (current) current.fill(0, ei, ei + 3); continue; }
      const offset = ordered ? ((bayer[(y % 4) * 4 + x % 4] + .5) / 16 - .5) * strength : 0;
      const rgb = [0, 1, 2].map(c => clamp(d[i + c] + offset + (current ? current[ei + c] : 0)));
      const p = palette[nearest(...rgb)];
      for (let c = 0; c < 3; c++) {
        d[i + c] = p[c];
        if (!floyd) continue;
        const error = (rgb[c] - p[c]) * d[i + 3] / 255;
        current[ei + direction * 3 + c] += error * 7 / 16;
        next[ei - direction * 3 + c] += error * 3 / 16;
        next[ei + c] += error * 5 / 16;
        next[ei + direction * 3 + c] += error / 16;
      }
    }
    if (floyd) { [current, next] = [next, current]; next.fill(0); }
  }
  return image;
}

/** Nearest-neighbor resampling, tone adjustment, palette reduction and dithering. */
export function pixelate(image, options = {}) {
  validate(image);
  const width = options.width ?? image.width, height = options.height ?? image.height;
  const output = adjust(resize(image, width, height, options.fit), options);
  const palette = options.palette ? [...options.palette].map(color) : options.colors === 0 || options.colors === null ? null : extractPalette(output, options.colors ?? 32);
  if (palette && (palette.length > 256 || !palette.length && options.palette)) throw new Error('A palette must contain 1–256 colors.');
  return palette ? quantize(output, palette, options.dither) : output;
}

/** Premultiplied box blur avoids dark RGB halos around transparent edges. */
function blur(image, radius) {
  radius = Math.round(clamp(finite(radius, 1), 0, 20));
  if (!radius) return copy(image);
  const { width: w, height: h, data: src } = image;
  const horizontal = new Float32Array(src.length), data = new Uint8ClampedArray(src.length);
  const span = radius * 2 + 1;
  for (let y = 0; y < h; y++) {
    const sums = [0, 0, 0, 0];
    const add = (x, sign) => {
      if (x < 0 || x >= w) return;
      const i = (y * w + x) * 4, alpha = src[i + 3] / 255;
      for (let c = 0; c < 3; c++) sums[c] += src[i + c] * alpha * sign;
      sums[3] += src[i + 3] * sign;
    };
    for (let x = 0; x <= radius; x++) add(x, 1);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) horizontal[i + c] = sums[c] / span;
      add(x - radius, -1); add(x + radius + 1, 1);
    }
  }
  for (let x = 0; x < w; x++) {
    const sums = [0, 0, 0, 0];
    const add = (y, sign) => {
      if (y < 0 || y >= h) return;
      const i = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) sums[c] += horizontal[i + c] * sign;
    };
    for (let y = 0; y <= radius; y++) add(y, 1);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4, alpha = sums[3] / span;
      data[i + 3] = alpha;
      for (let c = 0; c < 3; c++) data[i + c] = alpha > 0 ? sums[c] / span * 255 / alpha : 0;
      add(y - radius, -1); add(y + radius + 1, 1);
    }
  }
  return { width: w, height: h, data };
}

function behind(image, underlay) {
  const result = copy(image), d = result.data;
  for (let i = 0; i < d.length; i += 4) {
    const sourceAlpha = image.data[i + 3] / 255, backAlpha = underlay.data[i + 3] / 255 * (1 - sourceAlpha), alpha = sourceAlpha + backAlpha;
    for (let c = 0; c < 3; c++) d[i + c] = alpha ? (image.data[i + c] * sourceAlpha + underlay.data[i + c] * backAlpha) / alpha : image.data[i + c];
    d[i + 3] = alpha * 255;
  }
  return result;
}

// Squared Euclidean distance transform. Outlines cost O(pixels), even on maps.
// Carry the nearest visible alpha so anti-aliased edges remain translucent.
function outlineAlpha(image, radius) {
  const { width: w, height: h, data } = image, limit = radius * radius + 1;
  const horizontal = new Uint16Array(w * h), nearestX = new Uint16Array(w * h);
  for (let y = 0; y < h; y++) {
    let previous = -w - radius;
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]) previous = x;
      const distance = (x - previous) ** 2, i = y * w + x;
      horizontal[i] = Math.min(limit, distance); nearestX[i] = Math.max(0, previous);
    }
    previous = w * 2 + radius;
    for (let x = w - 1; x >= 0; x--) {
      if (data[(y * w + x) * 4 + 3]) previous = x;
      const distance = (x - previous) ** 2, i = y * w + x;
      if (distance < horizontal[i]) { horizontal[i] = distance; nearestX[i] = previous; }
    }
  }
  const vertices = new Int32Array(h), boundaries = new Float64Array(h + 1), alpha = new Uint8ClampedArray(w * h);
  for (let x = 0; x < w; x++) {
    let k = 0; vertices[0] = 0; boundaries[0] = -Infinity; boundaries[1] = Infinity;
    for (let q = 1; q < h; q++) {
      let separation;
      do {
        const v = vertices[k];
        separation = (horizontal[q * w + x] + q * q - horizontal[v * w + x] - v * v) / (2 * (q - v));
        if (separation <= boundaries[k]) k--; else break;
      } while (k >= 0);
      k++; vertices[k] = q; boundaries[k] = separation; boundaries[k + 1] = Infinity;
    }
    k = 0;
    for (let y = 0; y < h; y++) {
      while (boundaries[k + 1] < y) k++;
      const sourceY = vertices[k], i = sourceY * w + x;
      if ((y - sourceY) ** 2 + horizontal[i] <= radius * radius) alpha[y * w + x] = data[(sourceY * w + nearestX[i]) * 4 + 3];
    }
  }
  return alpha;
}

export function applyEffect(image, name, options = {}) {
  validate(image);
  if (typeof options === 'number') options = { amount: options };
  name = String(name).toLowerCase();
  if (['brightness', 'contrast', 'saturation', 'hue'].includes(name)) return adjust(copy(image), { [name]: options[name] ?? options.amount ?? options.value ?? 0 });
  if (['palette', 'reduce', 'palette-reduction', 'pixelate', 'quantize'].includes(name)) return pixelate(image, options);
  if (name === 'blur') return blur(image, options.radius ?? options.amount ?? 1);
  if (name === 'sharpen') {
    const output = copy(image), softened = blur(image, 1), amount = clamp(finite(options.amount, 1), 0, 4);
    for (let i = 0; i < output.data.length; i += 4) {
      if (!output.data[i + 3]) continue;
      for (let c = 0; c < 3; c++) output.data[i + c] += (image.data[i + c] - softened.data[i + c]) * amount;
    }
    return output;
  }
  if (name === 'outline' || name === 'shadow') {
    const { width: w, height: h } = image, underlay = { width: w, height: h, data: new Uint8ClampedArray(image.data.length) };
    const rgba = color(options.color ?? (name === 'outline' ? '#161a25ff' : '#000000a0'));
    const size = Math.round(clamp(finite(options.size ?? options.radius, 1), 1, 16));
    const dx = Math.round(clamp(finite(options.offsetX, 3), -8192, 8192)), dy = Math.round(clamp(finite(options.offsetY, 3), -8192, 8192));
    const opacity = clamp(finite(options.opacity, 1), 0, 1);
    const outlinedAlpha = name === 'outline' ? outlineAlpha(image, size) : null;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let alpha = 0;
      if (name === 'shadow') {
        const sx = x - dx, sy = y - dy;
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) alpha = image.data[(sy * w + sx) * 4 + 3];
      } else alpha = outlinedAlpha[y * w + x];
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) underlay.data[i + c] = rgba[c];
      underlay.data[i + 3] = alpha * rgba[3] / 255 * opacity;
    }
    return behind(image, name === 'shadow' && finite(options.blur) > 0 ? blur(underlay, options.blur) : underlay);
  }
  const result = copy(image), data = result.data;
  const levels = Math.round(clamp(finite(options.levels ?? options.amount, 4), 2, 256));
  if (!['grayscale', 'greyscale', 'invert', 'posterize'].includes(name)) throw new Error(`Unknown image effect: ${name}`);
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    if (name === 'grayscale' || name === 'greyscale') data[i] = data[i + 1] = data[i + 2] = Math.round(data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722);
    else for (let c = 0; c < 3; c++) data[i + c] = name === 'invert' ? 255 - data[i + c] : Math.round(data[i + c] / 255 * (levels - 1)) * 255 / (levels - 1);
  }
  return result;
}

/** Clockwise degrees, applied after flips; arbitrary angles use sharp nearest pixels. */
export function transform(image, { flipX = false, flipY = false, rotate = 0 } = {}) {
  validate(image);
  const angle = ((finite(rotate) % 360) + 360) % 360, radians = angle * Math.PI / 180;
  const cos = Math.abs(Math.cos(radians)) < 1e-12 ? 0 : Math.cos(radians), sin = Math.abs(Math.sin(radians)) < 1e-12 ? 0 : Math.sin(radians);
  const width = Math.ceil(Math.abs(image.width * cos) + Math.abs(image.height * sin) - 1e-10), height = Math.ceil(Math.abs(image.width * sin) + Math.abs(image.height * cos) - 1e-10);
  dimensions(width, height);
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const dx = x + .5 - width / 2, dy = y + .5 - height / 2;
    let sx = Math.floor(dx * cos + dy * sin + image.width / 2), sy = Math.floor(-dx * sin + dy * cos + image.height / 2);
    if (flipX) sx = image.width - 1 - sx;
    if (flipY) sy = image.height - 1 - sy;
    if (sx < 0 || sx >= image.width || sy < 0 || sy >= image.height) continue;
    const source = (sy * image.width + sx) * 4, destination = (y * width + x) * 4;
    for (let c = 0; c < 4; c++) data[destination + c] = image.data[source + c];
  }
  return { width, height, data };
}
