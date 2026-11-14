"""Native gold compass rendering through actual Builder and saved-town Play."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/gold-tracker/browser'
OUT.mkdir(parents=True, exist_ok=True)
MAP = ROOT / 'town/maps/coda-town-plaza-boardwalk.json'
original_hash = hashlib.sha256(MAP.read_bytes()).hexdigest()


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


INSTALL = r'''async gameName => {
  window.__goldGame = window[gameName];
  let app = new URL(document.querySelector('script[type="module"]').src), text = await (await fetch(app)).text();
  if (!/from\s+['"][^'"]*runtime\.mjs/.test(text)) {
    app = new URL(text.match(/import\(['"]([^'"]*play\.mjs[^'"]*)['"]/)[1], app);
    text = await (await fetch(app)).text();
  }
  const dep = (text, base, name) => new URL(text.match(new RegExp("from\\s+['\"]([^'\"]*" + name + "\\.mjs[^'\"]*)['\"]"))[1], base);
  const runtime = dep(text, app, 'runtime'), runtimeText = await (await fetch(runtime)).text();
  const physics = dep(runtimeText, runtime, 'physics'), physicsText = await (await fetch(physics)).text();
  window.__goldModel = await import(dep(physicsText, physics, 'model'));
  window.__goldInk = [];
  if (!window.__goldInstalled) {
    const fill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function(...args) {
      if (['world', 'map'].includes(this.canvas.id) && this.fillStyle === '#f4cc55' && this.strokeStyle === '#795521') {
        const t = this.getTransform();
        __goldInk.push({x:t.e, y:t.f, a:t.a, b:t.b, c:t.c, d:t.d});
      }
      return fill.apply(this, args);
    };
    window.__goldInstalled = true;
  }
}'''

# Independently derive the nearest eligible glyph and projected arrow from the
# actual live activity state; do not call the compass helper under test.
PROBE = r'''() => {
  const g = __goldGame, s = g.urban.activities.state, p = s.player, cam = g.cam,
    cv = document.getElementById(window.townGame ? 'world' : 'map'), c = cv.getContext('2d'),
    w = cv.clientWidth, h = cv.clientHeight, z = __goldModel.actorHeight(g.project, p),
    anchor = {x:p.x,y:p.y-z-55};
  let nearest = null;
  for (const t of s.yellowNotes.tokens) {
    const point = {x:t.x,y:t.y-__goldModel.height(g.project,t.x,t.y)-80},
      dx = (point.x-anchor.x)*cam.zoom, dy = (point.y-anchor.y)*cam.zoom,
      screens = Math.hypot(dx/w,dy/h), distance = dx*dx+dy*dy;
    if (screens <= 1.5 && distance > 1e-8 && (!nearest || distance < nearest.distance)) nearest = {id:t.id,dx,dy,distance,screens};
  }
  __goldInk = [];
  c.save();c.setTransform(cv.width/w,0,0,cv.height/h,0,0);
  g.urban.activities.draw(c,cam,w,h,0);c.restore();
  const arrow = __goldInk;
  if (!nearest) {
    if (arrow.length) throw Error('Gold compass drew without a nearby live gold fairy');
    return {nearby:false,arrows:0};
  }
  if (arrow.length !== 1) throw Error('Expected exactly one gold arrow: '+JSON.stringify({nearest,arrow}));
  const angle = Math.atan2(nearest.dy,nearest.dx), radius = Math.max(50,55*cam.zoom+8),
    expected = {x:(w/2+(anchor.x-cam.x)*cam.zoom+Math.cos(angle)*radius)*cv.width/w,
      y:(h/2+(anchor.y-cam.y)*cam.zoom+Math.sin(angle)*radius)*cv.height/h}, actual = arrow[0];
  if (Math.hypot(actual.x-expected.x,actual.y-expected.y) > .001) throw Error('Gold compass misses visible glyph: '+JSON.stringify({expected,actual}));
  if (Math.abs(Math.atan2(actual.b,actual.a)-angle)>1e-6) throw Error('Gold compass heading differs from the visible target');
  if (Math.abs(Math.hypot(actual.a,actual.b)-cv.width/w)>1e-6) throw Error('Gold compass CSS size changes with world zoom');
  return {nearby:true,targetId:nearest.id,arrows:1,angle,radius,z,zoom:cam.zoom};
}'''

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
reports = []
errors = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
        context.add_init_script("let goldSeed=421;Math.random=()=>((goldSeed=(Math.imul(goldSeed,1664525)+1013904223)>>>0)/4294967296);")
        page = context.new_page()
        page.set_default_timeout(60000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin+'/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        page.locator('#file').set_input_files(str(MAP))
        page.wait_for_function('townBuilder.project.objects.length===137')
        page.clock.install()
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        page.locator('#walk').click()
        page.clock.run_for(34)
        page.evaluate(INSTALL, 'townBuilder')
        assert page.evaluate('townBuilder.urban.activities.state.yellowNotes.tokens.length') == 5
        # Builder exposes a copied player state, so point its camera at the live
        # avatar and use a sufficiently wide view to sense an actual map fairy.
        page.evaluate('townBuilder.cam.zoom=.15')
        reports.append({'builder':page.evaluate(PROBE)})
        assert reports[-1]['builder']['nearby']
        page.locator('#walk').click()
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame?.player')
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        page.clock.run_for(34)
        page.evaluate(INSTALL, 'townGame')
        before = page.evaluate('JSON.stringify(townGame.project)')
        bank = page.evaluate('JSON.stringify(townGame.urban.activities.state.yellowNotes.counts)')
        # Move only the test avatar. The map and live fairy positions are intact.
        for zoom in [.35, .8, 1.7]:
            for dx, dy in [(240,0),(-240,0),(0,240),(0,-240)]:
                page.evaluate('''([zoom,dx,dy])=>{const g=townGame,t=g.urban.activities.state.yellowNotes.tokens[0];delete g.player.underPier;Object.assign(g.player,{x:t.x+dx,y:t.y+dy});Object.assign(g.cam,{x:g.player.x,y:g.player.y-100,zoom});}''', [zoom,dx,dy])
                report = page.evaluate(PROBE)
                assert report['nearby']
                reports.append(report)
        # Let the real frame clear the canvas after the direction probes.
        page.clock.run_for(34)
        assert page.evaluate(PROBE)['nearby']
        page.screenshot(path=str(OUT/'gold-compass-play.png'))
        page.locator('#world').focus()
        page.keyboard.press('Tab')
        assert page.evaluate('townGame.urban.activities.state.netEquipped')
        assert page.evaluate(PROBE)['nearby']
        page.keyboard.press('Tab')
        assert not page.evaluate('townGame.urban.activities.state.netEquipped')
        assert page.evaluate(PROBE)['nearby']
        page.evaluate('Object.assign(townGame.player,{x:-100000,y:-100000})')
        assert not page.evaluate(PROBE)['nearby']
        # The normal indoor transition suppresses all gold world arrows.
        page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='sydney-opera-house'))")
        page.clock.run_for(67)
        page.evaluate('__goldInk=[]')
        page.clock.run_for(67)
        assert page.locator('.yellow-note-inventory').is_hidden()
        assert page.evaluate('__goldInk.length') == 0
        assert page.evaluate('JSON.stringify(townGame.project)') == before
        assert page.evaluate('JSON.stringify(townGame.urban.activities.state.yellowNotes.counts)') == bank
        assert hashlib.sha256(MAP.read_bytes()).hexdigest() == original_hash
        assert not errors, errors
        (OUT/'results.json').write_text(json.dumps({'passed':True,'reports':reports,'errors':errors,'mapUnchanged':True,'inventoryUnchanged':True},indent=2))
        print('PASS: actual Builder and saved-town Play gold arrows, live nearest heading, terrain/body height, 12 direction/zoom cases, fixed CSS size, stowed/equipped, distance cutoff, indoor suppression, unchanged map and inventory.', flush=True)
        browser.close()
finally:
    server.shutdown()
