/** DOM-free, bounded selection masks. Coordinates and dimensions use source pixels. */
const MAX_PIXELS = 16 * 1024 * 1024;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function selectionContains(selection, x, y) {
  if (!selection) return true;
  if (x < selection.x || y < selection.y || x >= selection.x + selection.w || y >= selection.y + selection.h) return false;
  if (selection.mask) return !!selection.mask[Math.floor(y - selection.y) * selection.w + Math.floor(x - selection.x)];
  if (!selection.points?.length) return true;
  const px = x + .5, py = y + .5;
  let inside = false;
  for (let i = 0, j = selection.points.length - 1; i < selection.points.length; j = i++) {
    const [ax, ay] = selection.points[i], [bx, by] = selection.points[j];
    if ((ay > py) !== (by > py) && px < (bx - ax) * (py - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}

function checkedBounds(width, height, bounds) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192)
    throw new Error('Smart Select needs a valid scene up to 8192 pixels per side.');
  const raw = bounds || { x: 0, y: 0, w: width, h: height };
  if (![raw.x, raw.y, raw.w, raw.h].every(Number.isFinite)) throw new Error('Smart Select needs a valid selection area.');
  const x = clamp(Math.floor(raw.x), 0, width), y = clamp(Math.floor(raw.y), 0, height);
  const w = Math.max(0, Math.min(width, Math.ceil(raw.x + raw.w)) - x);
  const h = Math.max(0, Math.min(height, Math.ceil(raw.y + raw.h)) - y);
  if (!w || !h || w * h > MAX_PIXELS)
    throw new Error('Smart Select supports up to 16 million pixels. Use Select to mark a smaller area first.');
  return { x, y, w, h };
}

function compactMask(data, area, count, left, top, right, bottom) {
  if (!count) return null;
  const w = right - left + 1, h = bottom - top + 1, mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    mask[y * w + x] = data[(top + y - area.y) * area.w + left + x - area.x] === 1 ? 1 : 0;
  return { x: left, y: top, w, h, mask, count };
}

/** Select the four-connected region matching the clicked color without touching source pixels. */
export function smartSelection({ width, height, readPixel, x, y, tolerance = 0, bounds, contains } = {}) {
  const area = checkedBounds(width, height, bounds);
  if (typeof readPixel !== 'function') throw new Error('Smart Select needs readable paint pixels.');
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h || contains && !contains(x, y))
    throw new Error('Click inside the selected area to use Smart Select.');
  tolerance = clamp(Number(tolerance) || 0, 0, 255);
  const seed = readPixel(x, y) >>> 0, alpha = seed & 255;
  const state = new Uint8Array(area.w * area.h), stack = [(y - area.y) * area.w + x - area.x];
  let count = 0, left = x, right = x, top = y, bottom = y;
  const matches = (px, py) => {
    if (px < area.x || py < area.y || px >= area.x + area.w || py >= area.y + area.h) return false;
    const index = (py - area.y) * area.w + px - area.x;
    if (state[index]) return false;
    if (contains && !contains(px, py)) { state[index] = 2; return false; }
    const value = readPixel(px, py) >>> 0, candidateAlpha = value & 255;
    const match = !alpha ? !candidateAlpha : !!candidateAlpha && [0, 8, 16, 24].every(shift =>
      Math.abs((value >>> shift & 255) - (seed >>> shift & 255)) <= tolerance);
    if (!match) state[index] = 2;
    return match;
  };
  while (stack.length) {
    const index = stack.pop(), py = area.y + Math.floor(index / area.w), px = area.x + index % area.w;
    if (!matches(px, py)) continue;
    let start = px;
    while (matches(start - 1, py)) start--;
    let above = false, below = false;
    for (let sx = start; matches(sx, py); sx++) {
      state[(py - area.y) * area.w + sx - area.x] = 1; count++;
      left = Math.min(left, sx); right = Math.max(right, sx); top = Math.min(top, py); bottom = Math.max(bottom, py);
      const up = matches(sx, py - 1), down = matches(sx, py + 1);
      if (up && !above) stack.push((py - area.y - 1) * area.w + sx - area.x);
      if (down && !below) stack.push((py - area.y + 1) * area.w + sx - area.x);
      above = up; below = down;
    }
  }
  return compactMask(state, area, count, left, top, right, bottom);
}

/** Combine rectangle, lasso, or mask selections without changing either input. */
export function combineSelections(previous, next, operation = 'replace') {
  if (!['replace', 'add', 'subtract'].includes(operation)) throw new Error('Choose replace, add, or subtract for Smart Select.');
  if (operation === 'replace') return next;
  if (!previous) return operation === 'add' ? next : null;
  if (!next) return previous;
  const x = operation === 'add' ? Math.min(previous.x, next.x) : previous.x;
  const y = operation === 'add' ? Math.min(previous.y, next.y) : previous.y;
  const right = operation === 'add' ? Math.max(previous.x + previous.w, next.x + next.w) : previous.x + previous.w;
  const bottom = operation === 'add' ? Math.max(previous.y + previous.h, next.y + next.h) : previous.y + previous.h;
  const area = { x, y, w: right - x, h: bottom - y };
  if (area.w * area.h > MAX_PIXELS)
    throw new Error('The combined selection exceeds 16 million pixels. Choose a smaller area.');
  const data = new Uint8Array(area.w * area.h);
  let count = 0, left = right, top = bottom, lastX = x, lastY = y;
  for (let py = y; py < bottom; py++) for (let px = x; px < right; px++) {
    const a = selectionContains(previous, px, py), b = selectionContains(next, px, py);
    if (operation === 'add' ? a || b : a && !b) {
      data[(py - y) * area.w + px - x] = 1; count++;
      left = Math.min(left, px); top = Math.min(top, py); lastX = Math.max(lastX, px); lastY = Math.max(lastY, py);
    }
  }
  return compactMask(data, area, count, left, top, lastX, lastY);
}
