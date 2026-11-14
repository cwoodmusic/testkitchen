"""Actual Builder/Play clocks and native lighting across a 21-minute cycle."""
from datetime import datetime, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import hashlib
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/day-night/browser'
OUT.mkdir(parents=True, exist_ok=True)
MAP = ROOT / 'town/maps/coda-town-plaza-boardwalk.json'
MAP_HASH = hashlib.sha256(MAP.read_bytes()).hexdigest()
KEY = 'codaTownDayNightCycleV1'


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


INSTALL_PIXELS = r'''async () => {
  const entry = new URL(document.querySelector('script[type="module"]').src),
    source = await (await fetch(entry)).text(),
    runtimeURL = new URL(source.match(/from\s+['"]([^'"]*runtime\.mjs[^'"]*)['"]/)[1], entry),
    runtime = await import(runtimeURL);
  const doc = {version:1,name:'Cycle lamp probe',cells:{},edges:{},objects:[
    {id:'lamp',asset:'decor-14-01',x:8192,y:6208,scale:1,rotation:0,layer:'objects',collision:true}
  ],spawn:{x:8192,y:6144}};
  for(let y=84;y<109;y++)for(let x=113;x<144;x++)doc.cells[`${x},${y}`]={surface:'asphalt',level:0};
  await runtime.preparePlacedArt(doc);
  const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=720;
  const c=canvas.getContext('2d',{willReadFrequently:true}),cam={x:8192,y:6144,zoom:.6},before=JSON.stringify(doc);
  window.__cyclePixels = state => {
    runtime.render(c,doc,cam,1000,720,{dayNight:state,time:7.25,heightView:'art'});
    const pixels=c.getImageData(0,0,1000,720).data,samples=[];
    for(const [wx,wy] of [[7592,6208],[8792,6208],[7592,5984],[8792,5984]]){
      const x=Math.round(500+(wx-cam.x)*cam.zoom),y=Math.round(360+(wy-cam.y)*cam.zoom),rgb=[0,0,0];let n=0;
      for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){
        const i=((y+dy)*1000+x+dx)*4;for(let k=0;k<3;k++)rgb[k]+=pixels[i+k];n++;
      }
      samples.push(rgb.map(v=>v/n));
    }
    const rgb=[0,1,2].map(k=>samples.reduce((sum,v)=>sum+v[k],0)/samples.length),
      luma=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    if(JSON.stringify(doc)!==before)throw Error('Lighting changed its source project');
    return {phase:state.phase,darkness:state.darkness,warmth:state.warmth,rgb,luma};
  };
}'''

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
reports = []
errors = []
pixel_states = {}
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1600,'height':1050}, reduced_motion='reduce')
        # The obsolete static-night preference must not disable the new cycle.
        context.add_init_script("localStorage.setItem('codaTownBuilderNightV1','night');")
        page = context.new_page()
        page.set_default_timeout(90000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin+'/town/builder/')
        page.wait_for_function('!!window.townBuilder?.dayNight')
        assert page.locator('#lightingToggle').evaluate('(e)=>e.tagName') == 'SELECT'
        assert page.locator('#lightingToggle').get_attribute('aria-label') == 'Time of day'
        assert page.locator('#lightingToggle').input_value() == 'auto'
        assert page.evaluate('townBuilder.dayNight.phase') == 'day'
        page.locator('#file').set_input_files(str(MAP))
        page.wait_for_function('townBuilder.project.objects.length===137')
        page.clock.install()
        page.clock.pause_at(page.evaluate('Date.now()/1000')+1)
        page.locator('#walk').click()
        page.clock.run_for(34)
        anchor = page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).startedAt', KEY)
        before = page.evaluate('JSON.stringify(townBuilder.project)')
        bank = page.evaluate('JSON.stringify(townBuilder.urban.activities.state.yellowNotes.counts)')
        page.evaluate(INSTALL_PIXELS)

        def at_offset(ms, game='townBuilder'):
            # Change wall time without replaying thousands of animation frames.
            page.clock.set_system_time(datetime.fromtimestamp((anchor+ms)/1000, timezone.utc))
            page.clock.run_for(34)
            state = page.evaluate('(game)=>window[game].dayNight', game)
            reports.append({'offset':ms,'game':game,**state})
            return state

        checkpoints = [
            (0,'day'),(599900,'day'),(600000,'dusk'),(690000,'dusk'),
            (779900,'dusk'),(780000,'night'),(1079900,'night'),(1080000,'dawn'),
            (1170000,'dawn'),(1259900,'dawn'),(1260000,'day'),(1860000,'dusk')
        ]
        for offset, phase in checkpoints:
            state = at_offset(offset)
            assert state['mode'] == 'auto' and state['phase'] == phase, (offset,state)
            assert 0 <= state['darkness'] <= 1 and 0 <= state['warmth'] <= 1
            if offset in [0,690000,780000,1170000]:
                pixel_states[phase] = page.evaluate('(state)=>__cyclePixels(state)', state)
                page.screenshot(path=str(OUT/f'builder-{phase}.png'))
        assert pixel_states['day']['darkness'] == 0
        assert pixel_states['night']['darkness'] == 1
        for phase in ['dusk','dawn']:
            assert .49 < pixel_states[phase]['darkness'] < .51
            assert pixel_states['night']['luma'] < pixel_states[phase]['luma'] < pixel_states['day']['luma'], pixel_states
        assert pixel_states['night']['luma'] < pixel_states['day']['luma']*.85, pixel_states
        assert pixel_states['dusk']['rgb'] != pixel_states['dawn']['rgb'], 'Dusk and dawn should have distinct warm colours'

        # Fixed previews are explicit choices; Auto resumes the original clock.
        at_offset(1170000)
        for mode in ['day','dusk','night','dawn']:
            page.locator('#lightingToggle').select_option(mode)
            page.clock.run_for(34)
            state = page.evaluate('townBuilder.dayNight')
            assert state['mode'] == mode and state['phase'] == mode
            assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).startedAt', KEY) == anchor
        page.locator('#lightingToggle').select_option('auto')
        page.clock.run_for(34)
        assert page.evaluate('townBuilder.dayNight.phase') == 'dawn'
        assert page.evaluate('JSON.stringify(townBuilder.project)') == before
        assert page.evaluate('JSON.stringify(townBuilder.urban.activities.state.yellowNotes.counts)') == bank

        at_offset(870000)
        page.locator('#walk').click()
        page.locator('#play').click()
        page.wait_for_function('!!window.townGame?.dayNight')
        page.clock.run_for(34)
        assert page.evaluate('townGame.dayNight.phase') == 'night'
        assert page.locator('#lightingToggle').input_value() == 'auto'
        assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).startedAt', KEY) == anchor
        play_before = page.evaluate('JSON.stringify(townGame.project)')
        assert play_before == before
        assert page.evaluate('JSON.stringify(townGame.urban.activities.state.yellowNotes.counts)') == bank
        page.reload()
        page.wait_for_function('!!window.townGame?.dayNight')
        page.clock.run_for(34)
        assert page.evaluate('townGame.dayNight.phase') == 'night'
        assert page.evaluate('(key)=>JSON.parse(localStorage.getItem(key)).startedAt', KEY) == anchor
        assert at_offset(1080000,'townGame')['phase'] == 'dawn'

        # Indoors uses its own lighting while the outdoor clock keeps advancing.
        assert page.evaluate("townGame.urban.enterBuilding(townGame.project.objects.find(o=>o.asset==='sydney-opera-house'))")
        page.clock.run_for(34)
        assert page.evaluate('townGame.urban.scene.kind') == 'concert'
        assert at_offset(1260000,'townGame')['phase'] == 'day'
        assert page.evaluate('townGame.urban.scene.kind') == 'concert'
        page.get_by_role('button',name='Go outside',exact=True).click()
        page.clock.run_for(34)
        assert page.evaluate('townGame.urban.scene') is None
        assert page.evaluate('townGame.dayNight.phase') == 'day'
        assert page.evaluate('JSON.stringify(townGame.project)') == play_before
        assert page.evaluate('JSON.stringify(townGame.urban.activities.state.yellowNotes.counts)') == bank
        assert hashlib.sha256(MAP.read_bytes()).hexdigest() == MAP_HASH
        assert not errors, errors
        (OUT/'results.json').write_text(json.dumps({'passed':True,'reports':reports,'pixels':pixel_states,
            'errors':errors,'mapUnchanged':True,'inventoryUnchanged':True},indent=2))
        print('PASS: 21-minute exact phase boundaries/repeat, native day/dusk/night/dawn pixels, manual previews/auto resume, Builder→Play/reload persistence, indoor clock, unchanged map/inventory and zero browser errors.',flush=True)
        context.close()
        browser.close()
finally:
    server.shutdown()
