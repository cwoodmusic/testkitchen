/* Color-changing panels and footstep lights for the measured club tiles.
 * Vertices follow the original grout, whose columns fan out toward the viewer.
 * No world collision cells or rectangular sprite grid are used here. */
(function (root, factory) {
  const exported = factory();
  if (typeof module === 'object' && module.exports) module.exports = exported;
  if (root) root.createCodaDanceFloor = exported.createCodaDanceFloor;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  // Measured from the refreshed environment backdrop at native resolution.
  // The legacy floor seams were 8–15 pixels left of this painted grid.
  const VERTEX_ROWS = [
    [[181,668],[214,668],[245,668],[280,668],[313,668],[347,668],[383,668],[416,668],[450,668],[483,668],[516,668],[551,668],[582,668],[615,668]],
    [[173,695],[208,695],[241,695],[276,695],[311,695],[346,695],[383,695],[418,695],[452,695],[487,695],[520,695],[557,695],[590,695],[626,695]],
    [[165,724],[202,724],[236,724],[272,724],[309,724],[345,724],[383,724],[419,724],[454,724],[490,724],[526,724],[564,724],[598,724],[637,724]],
    [[156,754],[195,754],[231,754],[268,754],[307,754],[345,754],[383,754],[420,754],[457,754],[494,754],[531,754],[571,754],[607,754],[648,754]],
    [[147,784],[189,784],[227,784],[264,784],[305,784],[344,784],[382,784],[421,784],[459,784],[498,784],[536,784],[577,784],[616,784],[660,784]],
    [[138,814],[183,814],[222,814],[260,814],[302,814],[343,814],[382,814],[423,814],[461,814],[502,814],[542,814],[584,814],[625,814],[671,814]],
    [[129,845],[176,845],[217,845],[256,845],[300,845],[342,845],[382,845],[424,845],[464,845],[505,845],[547,845],[591,845],[634,845],[683,845]]
  ];
  VERTEX_ROWS.forEach(row => { row.forEach(Object.freeze); Object.freeze(row); }); Object.freeze(VERTEX_ROWS);
  const COLORS = ['#20d9d2','#ffbd45','#ff6b79','#6aee9b','#a68cff','#ff974f','#ed73db'];
  const DECAY = .72, INSET = 2.25, COLOR_SECONDS = 1;
  const RGB = COLORS.map(color=>[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)));
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
  // The foreground rail clips the last row's two corners; those pixels are
  // architecture, not extra dance panels. Keep color and contact off the rail.
  const FLOOR_OUTLINE = Object.freeze([[181,668],[615,668],[679,834],[561,834],
    [548,845],[171,845],[138,817]].map(Object.freeze));
  function insideFloor(x,y) {
    if (!Number.isFinite(x)||!Number.isFinite(y)) return false;
    let inside=false;
    for(let i=0,j=FLOOR_OUTLINE.length-1;i<FLOOR_OUTLINE.length;j=i++){
      const [xi,yi]=FLOOR_OUTLINE[i],[xj,yj]=FLOOR_OUTLINE[j];
      if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  function tileAt(x, y) { return insideFloor(x,y)?TILES.find(tile => pointInPolygon(x, y, tile.polygon)) || null:null; }
  function panelColor(tile, time) {
    // Adjacent panels trade palette positions in a slow diagonal wave. Only
    // their color changes; measured vertices and grout never move or flash.
    const progress = Math.max(0,time) / COLOR_SECONDS + tile.row * .13 + tile.column * .07;
    const step = Math.floor(progress), fraction = progress - step;
    const mix = fraction * fraction * (3 - 2 * fraction);
    const index = (tile.column + tile.row * 3 + step) % COLORS.length;
    const first=RGB[index], next=RGB[(index+1)%COLORS.length];
    return 'rgb('+first.map((value,i)=>Math.round(value+(next[i]-value)*mix)).join(',')+')';
  }
  function createCodaDanceFloor(api = {}) {
    const lit = new Map(); let current = null, lastTime = 0;
    function animated() { return api.getQuality?.() !== 'off' && !api.reducedMotion?.() && api.getAnimation?.() !== false; }
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
      const time = update(); if (!ctx) return;
      const quality = api.getQuality?.() || 'full', quiet = !!api.reducedMotion?.();
      const colorTime = animated() ? time : 0;
      ctx.save();trace(ctx,FLOOR_OUTLINE);ctx.clip();
      ctx.shadowBlur=0; ctx.globalCompositeOperation='source-over';
      ctx.globalAlpha=quality==='lite'?.64:.72;
      for (const tile of TILES) {
        ctx.fillStyle=panelColor(tile,colorTime);
        trace(ctx,tile.inset);ctx.fill();
      }
      ctx.restore();
      ctx.save();trace(ctx,FLOOR_OUTLINE);ctx.clip();
      ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'screen';
      for (const light of lit.values()) {
        const tile = light.tile, brightness = intensity(light, time);
        ctx.fillStyle = '#fff5de'; ctx.globalAlpha = .52 * brightness;
        trace(ctx, tile.inset); ctx.fill();
        // The rim follows each measured skewed edge, safely inside its grout.
        ctx.strokeStyle = '#fff7de'; ctx.lineWidth = 1; ctx.globalAlpha = .74 * brightness;
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
      const moving=animated();
      return {columns: 13, rows: 6, tileCount: TILES.length, current, decaySeconds: DECAY, animated:moving, colorCycleSeconds:COLOR_SECONDS,
        tiles: TILES.map(tile => ({id:tile.id,row:tile.row,column:tile.column,color:panelColor(tile,moving?time:0),polygon:tile.polygon.map(p=>p.slice()),inset:tile.inset.map(p=>p.slice()),center:tile.center.slice()})),
        active: Array.from(lit.values(), light=>({id:light.tile.id,row:light.tile.row,column:light.tile.column,intensity:intensity(light,time),entered:light.entered}))};
    }
    return {draw, snapshot, tileAt: (x,y) => {const tile=tileAt(x,y);return tile?{id:tile.id,row:tile.row,column:tile.column,polygon:tile.polygon.map(p=>p.slice())}:null;}};
  }
  return {createCodaDanceFloor, tileAt, pointInPolygon, insetPolygon, VERTEX_ROWS, TILES, FLOOR_OUTLINE};
});
