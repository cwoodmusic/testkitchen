/* Shared collision overrides for movement, pathfinding, and the developer console. */
(function () {
  'use strict';
  window.createCodaCollisionEditor = function (api) {
    const { W, H, cell, gridWidth, gridHeight, navGrid } = api;
    const baseGrid = (api.baseGrid || navGrid).slice();
    const overrides = new Map();
    let active = false, tool = 'block', size = 1, stroke = null;
    let beforeChange = () => {}, afterChange = () => {}, status = null;

    function refresh() {
      if (status) status.textContent = `${overrides.size} edited cell${overrides.size === 1 ? '' : 's'} · drag on the map to paint`;
    }
    function validate(entries) {
      if (!Array.isArray(entries) || entries.length > navGrid.length) return false;
      const seen = new Set();
      for (const entry of entries) {
        if (!Array.isArray(entry) || entry.length !== 2) return false;
        const [id, value] = entry;
        if (!Number.isSafeInteger(id) || id < 0 || id >= navGrid.length || seen.has(id) || (value !== 0 && value !== 1)) return false;
        seen.add(id);
      }
      return true;
    }
    function releaseStroke() {
      const previous = stroke;
      stroke = null;
      if (previous?.target?.hasPointerCapture?.(previous.pointerId)) {
        try { previous.target.releasePointerCapture(previous.pointerId); } catch (_) { /* Already released by the browser. */ }
      }
      return previous;
    }
    function apply(entries) {
      if (!validate(entries)) throw new Error('Invalid collision overrides.');
      releaseStroke();
      overrides.clear();
      navGrid.set(baseGrid);
      for (const [id, value] of entries) { overrides.set(id, value); navGrid[id] = value; }
      api.invalidateRoutes();
      refresh();
    }
    function overrideAt(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= W || y >= H) return undefined;
      const id = Math.floor(y / cell) * gridWidth + Math.floor(x / cell);
      return overrides.has(id) ? !!overrides.get(id) : undefined;
    }
    function gridPoint(e) {
      const p = api.toWorld(e.clientX, e.clientY);
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      // Keep captured drags bounded, including when the pointer leaves the map.
      return {
        x: Math.max(0, Math.min(gridWidth - 1, Math.floor(p.x / cell))),
        y: Math.max(0, Math.min(gridHeight - 1, Math.floor(p.y / cell)))
      };
    }
    function stamp(x, y) {
      let changed = false;
      const half = (size - 1) / 2;
      for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
        const gx = x + dx, gy = y + dy;
        if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) continue;
        const id = gy * gridWidth + gx;
        if (tool === 'restore') {
          if (overrides.has(id)) { overrides.delete(id); navGrid[id] = baseGrid[id]; changed = true; }
        } else {
          const value = tool === 'open' ? 1 : 0;
          if (overrides.get(id) !== value) { overrides.set(id, value); navGrid[id] = value; changed = true; }
        }
      }
      return changed;
    }
    function paint(from, to) {
      let x = from.x, y = from.y;
      const dx = Math.abs(to.x - x), dy = Math.abs(to.y - y);
      const sx = x < to.x ? 1 : -1, sy = y < to.y ? 1 : -1;
      let error = dx - dy, changed = false;
      for (;;) {
        changed = stamp(x, y) || changed;
        if (x === to.x && y === to.y) break;
        const twice = error * 2;
        if (twice > -dy) { error -= dy; x += sx; }
        if (twice < dx) { error += dx; y += sy; }
      }
      if (changed) { api.invalidateRoutes(); refresh(); }
    }
    function pointerDown(e) {
      if (!active) return false;
      if (e.button !== 0 || stroke) return true;
      const p = gridPoint(e);
      if (!p) return true;
      e.preventDefault();
      beforeChange();
      stroke = { pointerId: e.pointerId, target: e.currentTarget || e.target, previous: p };
      try { stroke.target?.setPointerCapture?.(e.pointerId); } catch (_) { /* Pointer capture is optional. */ }
      paint(p, p);
      return true;
    }
    function pointerMove(e) {
      if (!active || !stroke || e.pointerId !== stroke.pointerId) return false;
      const p = gridPoint(e);
      if (!p) return true;
      e.preventDefault();
      paint(stroke.previous, p);
      stroke.previous = p;
      return true;
    }
    function pointerEnd(e) {
      if (!stroke || (e && e.pointerId !== stroke.pointerId)) return false;
      releaseStroke();
      afterChange();
      return true;
    }
    function setActive(value) {
      if (!value && stroke) pointerEnd();
      active = !!value;
    }
    function mount(container, hooks = {}) {
      beforeChange = hooks.beforeChange || (() => {});
      afterChange = hooks.afterChange || (() => {});
      const fields = document.createElement('div');
      fields.className = 'collision-editor-fields';
      const makeSelect = (title, options, onChange) => {
        const label = document.createElement('label');
        label.textContent = title;
        const select = document.createElement('select');
        select.setAttribute('aria-label', title);
        for (const [value, text] of options) {
          const option = document.createElement('option');
          option.value = value; option.textContent = text; select.append(option);
        }
        select.addEventListener('change', () => onChange(select.value));
        label.append(select); fields.append(label);
        return select;
      };
      const mode = makeSelect('Collision tool', [['block', 'Block walking'], ['open', 'Allow walking'], ['restore', 'Restore original']], value => { pointerEnd(); tool = value; });
      mode.value = tool;
      const brush = makeSelect('Collision brush', [['1', '1 × 1 cell'], ['3', '3 × 3 cells'], ['5', '5 × 5 cells']], value => { pointerEnd(); size = Number(value); });
      brush.value = String(size);
      status = document.createElement('p');
      status.className = 'studioTip'; status.setAttribute('role', 'status');
      const hint = document.createElement('p');
      hint.className = 'studioTip';
      hint.textContent = `Green allows walking; red blocks it. Each cell is ${cell} px. Overrides also affect pathfinding. Restore returns cells to the original map.`;
      fields.append(hint, status); container.append(fields); refresh();
      return fields;
    }
    function draw(g, cam) {
      if (!active) return;
      const zoom = cam?.zoom || 1;
      g.save();
      for (let y = 0; y < gridHeight; y++) for (let x = 0; x < gridWidth; x++) {
        const id = y * gridWidth + x;
        g.fillStyle = navGrid[id] ? 'rgba(50,235,160,.22)' : 'rgba(250,65,100,.22)';
        g.fillRect(x * cell, y * cell, Math.min(cell, W - x * cell), Math.min(cell, H - y * cell));
      }
      g.lineWidth = 1.5 / zoom;
      for (const [id, value] of overrides) {
        const x = (id % gridWidth) * cell, y = Math.floor(id / gridWidth) * cell;
        g.strokeStyle = value ? '#75ffd0' : '#ff8094';
        g.strokeRect(x + .5 / zoom, y + .5 / zoom, Math.min(cell, W - x) - 1 / zoom, Math.min(cell, H - y) - 1 / zoom);
      }
      g.restore();
    }
    return {
      overrideAt, get: () => [...overrides].sort((a, b) => a[0] - b[0]), validate, apply,
      mount, pointerDown, pointerMove, pointerEnd, setActive, draw,
      get active() { return active; }
    };
  };
})();
