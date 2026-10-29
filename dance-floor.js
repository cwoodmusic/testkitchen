/* Footstep lights for the measured quadrilateral tiles in the painted club.
 * Vertices follow the original grout, whose columns fan out toward the viewer.
 * No world collision cells or rectangular sprite grid are used here. */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  if (root) root.createCodaDanceFloor = exported.createCodaDanceFloor;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const VERTEX_ROWS = [
    [[171,667],[204,667],[237,666],[271,666],[305,666],[339,666],[374,666],[408,666],[442,666],[477,666],[511,666],[545,666],[579,667],[612,667]],
    [[163,693],[197,693],[232,693],[267,693],[302,693],[337,693],[373,693],[409,693],[445,693],[481,693],[517,693],[553,693],[589,693],[624,693]],
    [[154,723],[190,723],[226,723],[262,723],[299,723],[335,723],[372,723],[409,723],[447,723],[484,723],[522,723],[560,723],[598,723],[637,723]],
    [[145,753],[183,753],[220,753],[258,753],[296,753],[334,753],[372,753],[410,753],[449,753],[488,753],[527,753],[567,753],[607,753],[649,753]],
    [[136,784],[175,784],[214,784],[254,784],[293,784],[332,784],[371,784],[411,784],[451,784],[492,784],[533,784],[574,784],[616,784],[660,784]],
    [[127,814],[168,814],[208,814],[249,814],[289,814],[331,814],[371,814],[412,814],[454,814],[496,814],[538,814],[580,814],[623,814],[672,814]],
    [[119,843],[161,843],[203,843],[245,843],[287,843],[329,843],[370,843],[413,843],[457,843],[500,843],[543,843],[586,843],[630,843],[683,843]]
  ];
  VERTEX_ROWS.forEach(row => { row.forEach(Object.freeze); Object.freeze(row); }); Object.freeze(VERTEX_ROWS);
  const COLORS = ['#70eaff','#ffe997','#ff83ed','#fff6b2','#a2ffff','#8aaaff','#ffb5e9'];
  const DECAY = .72, INSET = 1.5;
  const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
  const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
  function pointInPolygon(x, y, polygon) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    let sign = 0;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i], b = polygon[(i + 1) % polygon.length];
      const side = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
      if (Math.abs(side) < 1e-8) continue;
      const next = Math.sign(side); if (sign && next !== sign) return false; sign = next;
    }
    return true;
  }
  function insetPolygon(polygon, distance = INSET) {
    const lines = polygon.map((a, i) => {
      const b = polygon[(i + 1) % polygon.length], dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      return {p: [a[0] - dy / length * distance, a[1] + dx / length * distance], d: [dx,dy]};
    });
    return lines.map((line, i) => {
      const previous = lines[(i + lines.length - 1) % lines.length], between = [line.p[0] - previous.p[0], line.p[1] - previous.p[1]];
      const determinant = cross(previous.d, line.d);
      if (Math.abs(determinant) < 1e-8) return line.p;
      const t = cross(between, line.d) / determinant;
      return [previous.p[0] + previous.d[0] * t, previous.p[1] + previous.d[1] * t];
    });
  }
  const TILES = [];
  for (let row = 0; row < VERTEX_ROWS.length - 1; row++) {
    for (let column = 0; column < VERTEX_ROWS[row].length - 1; column++) {
      const polygon = [VERTEX_ROWS[row][column], VERTEX_ROWS[row][column+1], VERTEX_ROWS[row+1][column+1], VERTEX_ROWS[row+1][column]];
      const center = polygon.reduce((sum, point) => [sum[0] + point[0]/4, sum[1] + point[1]/4], [0,0]);
      TILES.push(Object.freeze({id: 'dance-' + row + '-' + column, row, column,
        polygon: Object.freeze(polygon), inset: Object.freeze(insetPolygon(polygon).map(Object.freeze)), center: Object.freeze(center),
        color: COLORS[(column + row * 3) % COLORS.length]}));
    }
  }
  Object.freeze(TILES);
  function tileAt(x, y) { return TILES.find(tile => pointInPolygon(x, y, tile.polygon)) || null; }
  function createCodaDanceFloor(api = {}) {
    const lit = new Map(); let current = null, lastTime = 0;
    function update() {
      const time = Math.max(0, finite(api.getTime?.(), lastTime));
      if (time < lastTime) lit.clear(); lastTime = time;
      const player = api.getPlayer?.();
      const grounded = player && finite(player.jumpHeight) <= .1;
      const tile = grounded ? tileAt(player.x, player.y) : null;
      if (tile) {
        const old = lit.get(tile.id);
        lit.set(tile.id, {tile, entered: old?.entered ?? time, contact: time});
      }
      current = tile?.id || null;
      for (const [id, light] of lit) if (time - light.contact >= DECAY) lit.delete(id);
      return time;
    }
    function trace(ctx, polygon) {
      ctx.beginPath(); ctx.moveTo(polygon[0][0], polygon[0][1]);
      for (let i=1; i<polygon.length; i++) ctx.lineTo(polygon[i][0], polygon[i][1]);
      ctx.closePath();
    }
    function intensity(light, time) {
      const remaining = Math.max(0, 1 - (time - light.contact) / DECAY);
      return remaining * remaining;
    }
    function draw(ctx) {
      const time = update(); if (!ctx || !lit.size) return;
      const quality = api.getQuality?.() || 'full', quiet = !!api.reducedMotion?.();
      ctx.save(); ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'screen';
      for (const light of lit.values()) {
        const tile = light.tile, brightness = intensity(light, time);
        ctx.fillStyle = tile.color; ctx.globalAlpha = .28 * brightness;
        trace(ctx, tile.inset); ctx.fill();
        // The rim follows each measured skewed edge, safely inside its grout.
        ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 1; ctx.globalAlpha = .46 * brightness;
        trace(ctx, insetPolygon(tile.polygon, INSET + .5)); ctx.stroke();
        // A small crisp glint, with no blur textures or full-canvas offscreen pass.
        if (quality !== 'off') {
          const glint = quiet ? .55 : Math.max(.2, 1 - (time - light.entered) / .3);
          ctx.globalAlpha = brightness * glint * .6; ctx.fillStyle = '#ffffff';
          const x = Math.round(tile.center[0]), y = Math.round(tile.center[1]);
          ctx.fillRect(x - 3, y, 7, 1); ctx.fillRect(x, y - 2, 1, 5);
        }
      }
      ctx.restore();
    }
    function snapshot() {
      const time = update();
      return {columns: 13, rows: 6, tileCount: TILES.length, current, decaySeconds: DECAY,
        tiles: TILES.map(tile => ({id:tile.id,row:tile.row,column:tile.column,polygon:tile.polygon.map(p=>p.slice()),inset:tile.inset.map(p=>p.slice()),center:tile.center.slice()})),
        active: Array.from(lit.values(), light=>({id:light.tile.id,row:light.tile.row,column:light.tile.column,intensity:intensity(light,time),entered:light.entered}))};
    }
    return {draw, snapshot, tileAt: (x,y) => {const tile=tileAt(x,y);return tile?{id:tile.id,row:tile.row,column:tile.column,polygon:tile.polygon.map(p=>p.slice())}:null;}};
  }
  return {createCodaDanceFloor, tileAt, pointInPolygon, insetPolygon, VERTEX_ROWS, TILES};
});
