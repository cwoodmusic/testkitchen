/* Canvas light projection for the connected world. The beams are a stylized
 * room-lighting effect; no WebGL, external service, or character asset is used. */
(function (root, build) {
  'use strict';
  const library = build();
  if (typeof module === 'object' && module.exports) module.exports = library;
  if (root) root.createCodaWorldLighting = library.createCodaWorldLighting;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const TAU = Math.PI * 2;
  const COLORS = ['#69dcff', '#ff72ec', '#fff4b8', '#8fb2ff', '#79ffd7', '#e5a0ff'];
  // Glass interiors measured against coda_arcade_world_clean.png. These are
  // hanging lanterns, not the separate candles or the painted club floodlights.
  const LANTERNS = Object.freeze([
    ['lounge-west', 83, 119, 8, 15], ['lounge-roof-west', 188, 103, 8, 15],
    ['lounge-roof-east', 210, 76, 8, 15], ['lounge-east', 464, 130, 8, 15],
    ['arcade-west', 605, 57, 8, 16], ['arcade-east', 1144, 56, 8, 16],
    ['piano-west', 1216, 78, 8, 14], ['piano-east', 1397, 91, 8, 15],
    ['hall-east', 1568, 179, 8, 15], ['boutique-west', 364, 404, 7, 12],
    ['dance-entry', 207, 499, 7, 12], ['dance-west', 83, 551, 8, 15],
    ['dance-sofa-west', 200, 613, 7, 14], ['dance-corner-west', 137, 652, 7, 13],
    ['dance-stage-east', 619, 547, 8, 15], ['dance-upper-passage', 821, 514, 7, 13],
    ['dance-passage-lantern', 843, 650, 8, 15]
  ].map(([id, x, y, w, h]) => Object.freeze({id, x, y, w, h})));
  const CLUB = [[55,475],[650,475],[737,495],[802,559],[814,805],[725,846],[91,846],[49,791],[49,527]];
  const ARCADE = [[644,20],[1585,20],[1585,821],[843,821],[843,466],[644,466]];
  const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const identity = [1, 0, 0, 1, 0, 0];
  function transformPoint(matrix, x, y) {
    return {x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5]};
  }
  function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i], b = polygon[j];
      if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function traceFloorRay(start, target, allowed, step = 3) {
    const dx = target.x - start.x, dy = target.y - start.y, length = Math.hypot(dx, dy);
    if (![start.x, start.y, target.x, target.y].every(Number.isFinite) || !allowed(start.x, start.y)) return null;
    if (!length) return {x: start.x, y: start.y, hitWall: false, length: 0};
    const count = Math.ceil(length / clamp(finite(step, 3), 1, 4));
    let last = {x: start.x, y: start.y};
    for (let i = 1; i <= count; i++) {
      const x = start.x + dx * i / count, y = start.y + dy * i / count;
      if (!allowed(x, y)) return {...last, hitWall: true, length: Math.hypot(last.x - start.x, last.y - start.y)};
      last = {x, y};
    }
    return {...last, hitWall: false, length};
  }
  function createCodaWorldLighting(api = {}) {
    const width = finite(api.width, 1672), height = finite(api.height, 941), textures = new Map();
    const time = () => Math.max(0, finite(api.getTime?.()));
    const quality = () => ['full', 'lite', 'off'].includes(api.getQuality?.()) ? api.getQuality() : 'full';
    const quiet = () => typeof api.reducedMotion === 'function' ? !!api.reducedMotion() : api.reducedMotion === true;
    // Light is decorative and passes across furniture and painted collision
    // cells. Only the artwork's room outline and canvas bounds contain it.
    const inWorld = (x, y) => x >= 0 && y >= 0 && x < width && y < height;
    let geometryKey = '', current = {balls: [], beams: [], spots: []};
    function glow(color) {
      if (textures.has(color)) return textures.get(color);
      const canvas = api.makeCanvas ? api.makeCanvas(64, 64) : typeof document !== 'undefined' ? document.createElement('canvas') : null;
      if (!canvas) return null;
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d'), gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, color); gradient.addColorStop(.15, color + 'd8');
      gradient.addColorStop(.45, color + '52'); gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64); textures.set(color, canvas); return canvas;
    }
    function lanternState() {
      const t = quiet() ? 0 : time(), beat = api.getBeat?.() || {}, bass = beat.on ? Math.exp(-clamp(finite(beat.phase), 0, 1) * 5) : 0;
      return LANTERNS.map((lamp, i) => ({...lamp, intensity: quiet() ? .65 : clamp(.48 + .43 * Math.sin(t * 1.65 + i * .79) + bass * .09, .10, 1)}));
    }
    function getGeometry() {
      const q = quality(), now = time(), reduced = quiet(), source = api.getBallStates?.() || [];
      const key = JSON.stringify([q, reduced, Math.floor(now * (q === 'full' ? 30 : 16)), source]);
      if (key === geometryKey) return current;
      geometryKey = key;
      const balls = [], beams = [], spots = [], beat = api.getBeat?.() || {};
      for (let index = 0; index < Math.min(8, source.length); index++) {
        const raw = source[index];
        if (!raw || !Number.isFinite(raw.x) || !Number.isFinite(raw.y)) continue;
        const matrix = Array.isArray(raw.matrix) && raw.matrix.length === 6 && raw.matrix.every(Number.isFinite) ? raw.matrix : identity;
        const anchor = transformPoint(matrix, raw.x, raw.y), r = clamp(finite(raw.radius, finite(raw.r, 28)), 4, 180);
        const visible = raw.visible !== false, rays = raw.rays !== false, opacity = clamp(finite(raw.opacity, 1), 0, 1);
        const spin = clamp(finite(raw.spin, 1), -8, 8), animate = raw.animate !== false;
        const inClub = raw.club === true && pointInPolygon(anchor.x, anchor.y, CLUB);
        const region = inClub ? CLUB : pointInPolygon(anchor.x, anchor.y, ARCADE) ? ARCADE : null;
        const allowed = (x, y) => inWorld(x, y) && (!region || pointInPolygon(x, y, region));
        const desired = transformPoint(matrix, raw.x, raw.y + (raw.club ? r * 5.8 : r * 7.8));
        let ground = null;
        // Keep moved or rotated balls within their room outline. This search
        // never consults walking collision, including furniture underneath.
        for (let ring = 0; ring <= 80 && !ground; ring += 10) {
          const offsets = ring ? [[0,ring],[-ring,0],[ring,0],[0,-ring],[-ring,ring],[ring,ring]] : [[0,0]];
          for (const [dx, dy] of offsets) if (allowed(desired.x + dx, desired.y + dy)) { ground = {x: desired.x + dx, y: desired.y + dy}; break; }
        }
        const id = typeof raw.id === 'string' ? raw.id : 'disco-' + index;
        balls.push({id, x: anchor.x, y: anchor.y, groundX: ground?.x ?? null, groundY: ground?.y ?? null, visible, rays, spin, animate, opacity});
        if (q === 'off' || !visible || !rays || !opacity || !ground) continue;
        const count = q === 'full' ? 32 : 12, t = reduced || !animate ? 0 : now;
        const seed = finite(raw.seed, index * 3), rotation = t * spin * (beat.on ? .57 : .37) + seed;
        for (let ray = 0; ray < count; ray++) {
          const angle = rotation + ray * 2.3999632297;
          const range = 65 + ((ray * 73 + seed * 29) % (raw.club ? 250 : 370));
          const ideal = transformPoint(matrix, raw.x + Math.cos(angle) * range, raw.y + (raw.club ? r * 5.8 : r * 7.8) + Math.sin(angle) * range * (raw.club ? .46 : .72));
          // Preserve only the room-boundary adjustment after transforming the
          // projection, so moving/resizing/rotation remain coherent.
          ideal.x += ground.x - desired.x; ideal.y += ground.y - desired.y;
          const hit = traceFloorRay(ground, ideal, allowed);
          if (!hit || hit.length < 12) continue;
          const color = COLORS[(ray + index * 2) % COLORS.length];
          const shimmer = reduced || !animate ? .75 : .64 + .28 * Math.sin(t * 1.8 + ray * 1.37);
          const start = transformPoint(matrix, raw.x + Math.cos(angle) * r * .24, raw.y + Math.sin(angle) * r * .18);
          beams.push({ballId: id, start, end: {x: hit.x, y: hit.y}, color, opacity: opacity * (q === 'full' ? .135 : .075) * shimmer,
            hitWall: hit.hitWall, length: Math.hypot(hit.x - start.x, hit.y - start.y), region});
          // A tiny tangential streak makes the circling reflection readable
          // against the bright painted dance tiles. It follows the same orbit
          // and room boundary as the pin, without storing per-frame trails.
          let trace = null;
          if (!reduced && animate && spin !== 0) {
            const tx = -Math.sin(angle), ty = Math.cos(angle) * (raw.club ? .46 : .72);
            const length = (q === 'full' ? 9 : 6) * Math.sign(spin) / Math.hypot(tx, ty);
            const dx = -tx * length, dy = -ty * length;
            const end = traceFloorRay(hit, {x: hit.x + matrix[0] * dx + matrix[2] * dy, y: hit.y + matrix[1] * dx + matrix[3] * dy}, allowed);
            if (end && end.length > 1) trace = {x: end.x, y: end.y};
          }
          spots.push({ballId: id, x: hit.x, y: hit.y, rx: 4.2 + ray % 3, ry: 1.8 + (ray % 2) * .6, color, intensity: opacity * (.48 + .35 * shimmer), trace});
        }
      }
      current = {balls, beams, spots}; return current;
    }
    function clip(ctx, polygon) {
      if (!polygon) return;
      ctx.beginPath(); ctx.moveTo(...polygon[0]);
      for (let i = 1; i < polygon.length; i++) ctx.lineTo(...polygon[i]);
      ctx.closePath(); ctx.clip();
    }
    let beamSurface=null,beamContext=null,beamRasterKey='';
    function drawBeamLayer(ctx,frame){
      ctx.save();ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';
      // One room clip per group avoids rebuilding a full-canvas clipping mask
      // for every small ray on software Canvas implementations.
      for (const region of new Set(frame.beams.map(beam=>beam.region))) {
       ctx.save(); clip(ctx, region);
       for (const beam of frame.beams) {
        if(beam.region!==region)continue;
        const dx = beam.end.x - beam.start.x, dy = beam.end.y - beam.start.y, distance = Math.max(1, Math.hypot(dx, dy));
        const nx = -dy / distance, ny = dx / distance, width = quality() === 'full' ? 3.2 : 2;
        ctx.globalAlpha = beam.opacity; ctx.fillStyle = beam.color;
        ctx.beginPath(); ctx.moveTo(beam.start.x, beam.start.y);
        ctx.lineTo(beam.end.x + nx * width, beam.end.y + ny * width);
        ctx.lineTo(beam.end.x - nx * width, beam.end.y - ny * width); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = beam.opacity * 1.05; ctx.strokeStyle = beam.color; ctx.lineWidth = .75;
        ctx.beginPath(); ctx.moveTo(beam.start.x, beam.start.y); ctx.lineTo(beam.end.x, beam.end.y); ctx.stroke();
       }
       ctx.restore();
      }
      ctx.restore();
    }
    function drawDisco(ctx) {
      const frame=getGeometry();if(quality()==='off')return;
      if(!beamSurface){
        beamSurface=api.makeCanvas?api.makeCanvas(Math.ceil(width/2),Math.ceil(height/2)):typeof document!=='undefined'?document.createElement('canvas'):null;
        if(beamSurface){beamSurface.width=Math.ceil(width/2);beamSurface.height=Math.ceil(height/2);beamContext=beamSurface.getContext('2d');}
      }
      ctx.save();ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';
      if(beamContext){
        if(beamRasterKey!==geometryKey){
          beamContext.setTransform(1,0,0,1,0,0);beamContext.clearRect(0,0,beamSurface.width,beamSurface.height);
          beamContext.setTransform(beamSurface.width/width,0,0,beamSurface.height/height,0,0);
          drawBeamLayer(beamContext,frame);beamRasterKey=geometryKey;
        }
        ctx.imageSmoothingEnabled=true;ctx.drawImage(beamSurface,0,0,width,height);
      }else drawBeamLayer(ctx,frame);
      ctx.restore();drawFloorPins(ctx);
    }
    function drawBeams(ctx){if(quality()!=='off')drawBeamLayer(ctx,getGeometry());}
    function drawFloorPins(ctx){
      const frame=getGeometry();if(quality()==='off')return;
      ctx.save();ctx.shadowBlur=0;ctx.globalCompositeOperation='screen';
      for (const spot of frame.spots) {
        if (spot.trace) {
          ctx.globalAlpha = spot.intensity * .6; ctx.strokeStyle = spot.color; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(spot.trace.x, spot.trace.y); ctx.lineTo(spot.x, spot.y); ctx.stroke();
        }
        const image = glow(spot.color); ctx.globalAlpha = spot.intensity * .75;
        if (image) ctx.drawImage(image, spot.x - spot.rx * 2, spot.y - spot.ry * 2, spot.rx * 4, spot.ry * 4);
        ctx.globalAlpha = spot.intensity; ctx.fillStyle = spot.color;
        ctx.fillRect(Math.round(spot.x) - 2, Math.round(spot.y) - 1, 4, 2);
        ctx.fillStyle = '#fff7df'; ctx.globalAlpha = spot.intensity * .88;
        ctx.fillRect(Math.round(spot.x), Math.round(spot.y) - 1, 1, 1);
      }
      ctx.restore();
    }
    function drawLanterns(ctx) {
      if (quality() === 'off') return;
      ctx.save(); ctx.shadowBlur = 0;
      const lamps=lanternState();
      // Batch blend modes: alternating multiply/screen for each lamp forces
      // repeated destination reads on software Canvas.
      ctx.globalCompositeOperation='multiply';ctx.fillStyle='#84602d';
      for (const lamp of lamps) {
        // The source lamp is nearly white already. A gentle glass-only
        // multiply pass makes the pulse visible in the actual lamp interior.
        ctx.globalAlpha = (1 - lamp.intensity) * .53;
        ctx.fillRect(Math.round(lamp.x - lamp.w / 2), Math.round(lamp.y - lamp.h / 2), lamp.w, lamp.h);
      }
      ctx.globalCompositeOperation='screen';ctx.fillStyle='#fff2b0';
      for (const lamp of lamps) {
        ctx.globalAlpha = .10 + lamp.intensity * .20;
        ctx.fillRect(Math.round(lamp.x - lamp.w / 2 + 1), Math.round(lamp.y - lamp.h / 2 + 1), lamp.w - 2, lamp.h - 2);
        const image = glow('#ffb650'); ctx.globalAlpha = .13 + lamp.intensity * .24;
        if (image) ctx.drawImage(image, lamp.x - 33, lamp.y - 38, 66, 76);
      }
      ctx.restore();
    }
    function snapshot() {
      const frame = getGeometry();
      return {quality: quality(), time: time(), reducedMotion: quiet(), lanterns: lanternState(),
        balls: frame.balls.map(ball => ({...ball})), beams: frame.beams.map(({region, ...beam}) => ({...beam, start: {...beam.start}, end: {...beam.end}})),
        spots: frame.spots.map(spot => ({...spot, trace: spot.trace ? {...spot.trace} : null})), rayCount: frame.beams.length, spotCount: frame.spots.length, glowTextures: textures.size, beamRaster: api.getBeamRaster?.()||{width:beamSurface?.width||0,height:beamSurface?.height||0,refreshHz:30}};
    }
    return {drawLanterns, drawDisco, drawBeams, drawFloorPins, snapshot};
  }
  return {createCodaWorldLighting, traceFloorRay, transformPoint, pointInPolygon, LANTERNS};
});
