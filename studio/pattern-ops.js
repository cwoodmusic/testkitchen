/** Small, deterministic RGBA material tiles. No DOM or project mutations. */
import { pixelate } from './image-ops.js';

const MAX_TILE_SIDE = 256;
const PATTERNS = ['wood', 'checker', 'stone', 'stripes', 'dots', 'diamonds'];

function dimensions(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 8 || height < 8 || width > MAX_TILE_SIDE || height > MAX_TILE_SIDE)
    throw new Error('Tile width and height must be whole numbers from 8 to 256 pixels.');
}
function validate(image) {
  if (!image || !Number.isInteger(image.width) || !Number.isInteger(image.height) || image.width < 1 || image.height < 1 || image.width > 8192 || image.height > 8192 || image.width * image.height > 16_777_216 || !(image.data instanceof Uint8ClampedArray) || image.data.length !== image.width * image.height * 4)
    throw new Error('Choose a complete RGBA image with at most 16 million pixels.');
}
function rgba(value) {
  if (typeof value !== 'string' || !/^#[a-f\d]{6}(?:[a-f\d]{2})?$/i.test(value)) throw new Error('Use six-digit hexadecimal tile colors.');
  return [0, 2, 4].map(offset => parseInt(value.slice(1 + offset, 3 + offset), 16)).concat(value.length === 9 ? parseInt(value.slice(7, 9), 16) : 255);
}
const mod = (value, period) => (value % period + period) % period;
function mix(a, b, weight) { return a.map((value, index) => Math.round(value * (1 - weight) + b[index] * weight)); }

/** Each pattern's geometry wraps on its tile period, including at custom sizes. */
export function createPattern({ width = 32, height = 32, pattern = 'wood', colors = ['#b9895a', '#cda775', '#76503c'] } = {}) {
  dimensions(width, height);
  if (!PATTERNS.includes(pattern)) throw new Error('Choose wood, checker, stone, stripes, dots, or diamonds.');
  if (!Array.isArray(colors) || colors.length !== 3) throw new Error('Choose three tile colors.');
  const [base, accent, dark] = colors.map(rgba), light = mix(base, accent, .5), grain = mix(base, dark, .18);
  const data = new Uint8ClampedArray(width * height * 4);
  const cellW = Math.max(1, Math.floor(width / 4)), cellH = Math.max(1, Math.floor(height / 4));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let color = base;
    // Normalized repeating coordinates make opposite custom-size periods meet.
    const gx = x / width * 4, gy = y / height * 4;
    if (pattern === 'wood') {
      const row = Math.floor(gy), localY = mod(y, Math.max(2, height / 4));
      const joint = mod(x + (row % 2 ? width / 2 : 0), width);
      if (localY < 1 || joint < 1) color = dark;
      else if (localY < 2) color = accent;
      else if ((y + row * 3) % 5 === 0 && mod(x + row * 7, Math.max(4, width / 2)) > 3) color = grain;
      else if (mod(x + row * 3, width) > width * .43 && mod(x + row * 3, width) < width * .59 && localY > 3 && localY < 5) color = light;
      else color = row % 2 ? light : base;
    } else if (pattern === 'checker') {
      const row = Math.floor(gy), col = Math.floor(gx), lx = mod(x, cellW), ly = mod(y, cellH);
      color = (row + col) % 2 ? accent : base;
      if (lx < 1 || ly < 1) color = dark;
      else if (lx === 1 || ly === 1) color = mix(color, accent, .25);
    } else if (pattern === 'stone') {
      const row = Math.floor(gy), localY = mod(y, Math.max(2, height / 4)), localX = mod(x + (row % 2 ? width / 4 : 0), Math.max(2, width / 2));
      color = localY < 1 || localX < 1 ? dark : localY < 2 ? accent : (Math.floor(gx / 2) + row) % 2 ? base : light;
      if (localY > 2 && localX > 2 && ((x * 11 + y * 17) % 37 === 0)) color = grain;
    } else if (pattern === 'stripes') {
      const phase = mod(x, width / 4);
      color = phase < width / 8 ? base : accent;
      if (phase < 1 || Math.abs(phase - width / 8) < .5) color = dark;
    } else if (pattern === 'dots') {
      const px = (gx % 2) - 1, py = (gy % 2) - 1, distance = px * px + py * py;
      color = distance < .14 ? accent : distance < .26 ? dark : base;
    } else if (pattern === 'diamonds') {
      const px = Math.abs((gx % 2) - 1), py = Math.abs((gy % 2) - 1), distance = px + py;
      color = distance < .42 ? accent : distance < .65 ? dark : base;
      if (distance < .13) color = light;
    }
    data.set(color, (y * width + x) * 4);
  }
  return { width, height, data };
}

/** Mirror folding retains sharp pixels and makes both pairs of opposing edges identical. */
export function imageToTile(image, { width = 32, height = 32, seamless = 'mirror' } = {}) {
  validate(image); dimensions(width, height);
  if (!['mirror', 'repeat'].includes(seamless)) throw new Error('Choose mirror edges or repeat original artwork.');
  if (seamless === 'repeat') return pixelate(image, { width, height, fit: 'cover', colors: 0 });
  const halfWidth = Math.ceil(width / 2), halfHeight = Math.ceil(height / 2);
  const half = pixelate(image, { width: halfWidth, height: halfHeight, fit: 'cover', colors: 0 });
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = x < halfWidth ? x : width - 1 - x, sy = y < halfHeight ? y : height - 1 - y;
    const source = (sy * halfWidth + sx) * 4;
    data.set(half.data.subarray(source, source + 4), (y * width + x) * 4);
  }
  return { width, height, data };
}

/** The repeated preview contains exact source pixels; editing guides are a UI overlay. */
export function repeatTile(image, { columns = 4, rows = 4 } = {}) {
  validate(image); dimensions(image.width, image.height);
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || columns > 8 || rows > 8) throw new Error('Repeat preview must use 1–8 rows and columns.');
  const width = image.width * columns, height = image.height * rows, data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let col = 0; col < columns; col++) {
    const source = (y % image.height) * image.width * 4;
    data.set(image.data.subarray(source, source + image.width * 4), (y * width + col * image.width) * 4);
  }
  return { width, height, data };
}
