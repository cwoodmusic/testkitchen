import { pixelate, applyEffect, extractPalette } from './image-ops.js';

// Sampled from the bundled walnut table, teal chair, coral sofa and succulent,
// with the blue/purple accents from arcade-flat-floor-world.png. Keep these
// source colors fixed so separate uploads can share a coherent game palette.
export const CODA_PALETTES = Object.freeze({
  coda: Object.freeze([
    '#01020b', '#030817', '#181123', '#322357', '#00262a', '#005e5f', '#126664', '#058b80',
    '#59d4ca', '#4f7596', '#0832a1', '#001eae', '#111a8d', '#2408a1', '#52057e', '#6b3967',
    '#881b6d', '#d63c7c', '#eb798e', '#7f231a', '#532a27', '#783d21', '#914a27', '#b56115',
    '#bb6514', '#f9b119', '#fcce46', '#dfc383', '#fcb863', '#fc5149', '#fd655b', '#feedd0',
  ]),
  cozy: Object.freeze([
    '#080302', '#181123', '#322357', '#000a10', '#0a1f22', '#013034', '#005e5f', '#126664',
    '#058b80', '#32725c', '#494a39', '#adb087', '#c3cea1', '#32080a', '#532a27', '#783d21',
    '#864425', '#914a27', '#b56115', '#bb6514', '#d73537', '#f25f49', '#fd655b', '#f48e5b',
    '#fcb863', '#f9b119', '#fcce46', '#dfc383', '#fde5b6', '#feedd0', '#fdeed5', '#fef1d9',
  ]),
});

export const PIXELIFY_STYLES = Object.freeze({
  coda: Object.freeze({ label: 'Coda arcade', palette: 'coda', colors: 32, simplify: 1,
    block: 1, brightness: 0, contrast: 8, saturation: 5, hue: 0, outline: 0, sharpen: 0 }),
  cozy: Object.freeze({ label: 'Cozy interiors', palette: 'cozy', colors: 24, simplify: 2,
    block: 1, brightness: 3, contrast: 4, saturation: -8, hue: 0, outline: 0, sharpen: 0 }),
  original: Object.freeze({ label: 'Original image colors', palette: 'image', colors: 32, simplify: 0,
    block: 1, brightness: 0, contrast: 0, saturation: 0, hue: 0, outline: 0, sharpen: 0 }),
});

// Edge-aware color smoothing groups photographic speckles without blurring
// alpha, extending silhouettes, or averaging across a strong color boundary.
function simplifyColors(image, passes) {
  let result = image;
  const { width, height } = image;
  const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (let pass = 0; pass < passes; pass++) {
    const src = result.data, data = new Uint8ClampedArray(src);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (!src[i + 3]) continue;
      let total = 4, r = src[i] * 4, g = src[i + 1] * 4, b = src[i + 2] * 4;
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const j = (ny * width + nx) * 4;
        if (!src[j + 3] || (src[i] - src[j]) ** 2 + (src[i + 1] - src[j + 1]) ** 2 + (src[i + 2] - src[j + 2]) ** 2 > 96 ** 2) continue;
        const weight = src[j + 3] / 255;
        total += weight; r += src[j] * weight; g += src[j + 1] * weight; b += src[j + 2] * weight;
      }
      data[i] = r / total; data[i + 1] = g / total; data[i + 2] = b / total;
    }
    result = { width, height, data };
  }
  return result;
}

function limitedPalette(image, colors, hexPalette) {
  if (colors >= hexPalette.length) return hexPalette;
  const fixed = hexPalette.map(hex => [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)));
  // Use the image's representative colors to select a useful subset, rather
  // than taking the first (often darkest) entries of a fixed game palette.
  const chosen = new Set();
  for (const sample of extractPalette(image, colors)) {
    let best = 0, distance = Infinity;
    fixed.forEach((entry, index) => {
      const delta = (entry[0] - sample[0]) ** 2 + (entry[1] - sample[1]) ** 2 + (entry[2] - sample[2]) ** 2;
      if (delta < distance) { distance = delta; best = index; }
    });
    chosen.add(hexPalette[best]);
  }
  return chosen.size ? [...chosen] : [hexPalette[0]];
}

/** Pure local conversion shared by the browser and its module worker. */
export function pixelifyImage(image, options = {}) {
  const style = PIXELIFY_STYLES[options.style ?? 'coda'];
  if (!style) throw new Error('Choose Coda arcade, Cozy interiors, or Original image colors.');
  const settings = { ...style, fit: 'contain', dither: 'none', ...options };
  const width = settings.width ?? image?.width, height = settings.height ?? image?.height;
  if (!Number.isInteger(settings.block) || settings.block < 1 || settings.block > 16)
    throw new Error('Pixel block size must be a whole number from 1 to 16.');
  if (!Number.isInteger(settings.simplify) || settings.simplify < 0 || settings.simplify > 3)
    throw new Error('Detail simplification must be a whole number from 0 to 3.');
  if (!Number.isInteger(settings.colors) || settings.colors < 2 || settings.colors > 256)
    throw new Error('Choose a palette of 2–256 colors.');
  if (!['coda', 'cozy', 'image'].includes(settings.palette)) throw new Error('Choose a Coda, Cozy, or image palette.');
  // Validate the final canvas before computing its smaller working grid.
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
    width > 8192 || height > 8192 || width * height > 16_777_216)
    throw new Error('Use dimensions up to 8192 on either side and at most 16 million pixels.');
  let result = pixelate(image, { width: Math.max(1, Math.ceil(width / settings.block)),
    height: Math.max(1, Math.ceil(height / settings.block)), fit: settings.fit, colors: 0 });
  result = simplifyColors(result, settings.simplify);
  result = pixelate(result, { colors: 0, brightness: settings.brightness, contrast: settings.contrast,
    saturation: settings.saturation, hue: settings.hue });
  if (settings.grayscale) result = applyEffect(result, 'grayscale');
  if (settings.invert) result = applyEffect(result, 'invert');
  if (settings.outline) result = applyEffect(result, 'outline', { size: settings.outline, color: settings.outlineColor });
  if (settings.sharpen) result = applyEffect(result, 'sharpen', { amount: settings.sharpen });
  result = pixelate(result, { colors: settings.colors, dither: settings.dither,
    ...(settings.palette !== 'image' ? { palette: limitedPalette(result, settings.colors, CODA_PALETTES[settings.palette]) } : {}) });
  if (result.width !== width || result.height !== height)
    result = pixelate(result, { width, height, colors: 0 });
  return result;
}
