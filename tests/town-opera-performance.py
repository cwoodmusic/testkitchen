"""Profile the real edited outdoor town without touching its source map.

Use --ref <commit> to serve immutable JS/CSS/HTML from Git while work continues.
Assets remain the checked-in files. --ref working profiles the current sources.
Reports callback CPU milliseconds, draw calls, CDP task time and CPU samples;
requestAnimationFrame FPS alone hides work that nearly consumes a frame budget.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit, unquote
import argparse
import hashlib
import json
import statistics
import subprocess
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
MAP = ROOT / 'town/maps/coda-town-uploaded-3.json'
parser = argparse.ArgumentParser()
parser.add_argument('--ref', default='fd79869', help='Immutable baseline commit, or working')
parser.add_argument('--output', type=Path, default=Path('/workspace/.onboarding/opera-performance-baseline'))
parser.add_argument('--seconds', type=float, default=2.5)
parser.add_argument('--limit', type=int, default=0)
parser.add_argument('--scenario', action='append', help='Run only a named scenario; repeat to select several')
parser.add_argument('--sustained', action='store_true', help='Walk continuously along real clear town corridors; include a 500-object stress copy')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
source_bytes = MAP.read_bytes()
source_hash = hashlib.sha256(source_bytes).hexdigest()
original = json.loads(source_bytes)
assert len(original['objects']) == 120
commit = subprocess.check_output(['git', 'rev-parse', args.ref if args.ref != 'working' else 'HEAD'], cwd=ROOT, text=True).strip()
snapshot = {}


class Snapshot(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, outputfile):
        try:
            super().copyfile(source, outputfile)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):
        path = unquote(urlsplit(self.path).path).lstrip('/')
        if path.endswith('/'):
            path += 'index.html'
        if args.ref != 'working' and Path(path).suffix in ['.mjs', '.js', '.css', '.html'] and '..' not in Path(path).parts:
            if path not in snapshot:
                result = subprocess.run(['git', 'show', f'{commit}:{path}'], cwd=ROOT, capture_output=True)
                snapshot[path] = result.stdout if result.returncode == 0 else None
            data = snapshot[path]
            if data is not None:
                self.send_response(200)
                self.send_header('Content-Type', self.guess_type(path))
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
                return
        super().do_GET()


INSTRUMENT = r"""(()=>{
 const nativeRAF=window.requestAnimationFrame.bind(window),state={active:false,frames:[],draws:0,drawMs:0,reads:0,readMs:0,sourcePixels:0};
 window.__outdoorPerf={
  begin(){state.frames=[];state.draws=state.drawMs=state.reads=state.readMs=state.sourcePixels=0;state.active=true;},
  end(){state.active=false;return {frames:state.frames,draws:state.draws,drawMs:state.drawMs,reads:state.reads,readMs:state.readMs,sourcePixels:state.sourcePixels};}
 };
 window.requestAnimationFrame=callback=>nativeRAF(now=>{
  if(!state.active||callback.name!=='frame')return callback(now);
  const start=performance.now(),draws=state.draws,drawMs=state.drawMs,reads=state.reads,readMs=state.readMs,pixels=state.sourcePixels;
  try{return callback(now);}finally{const stats=window.__chunkStats?.();state.frames.push({at:now,cpu:performance.now()-start,draws:state.draws-draws,drawMs:state.drawMs-drawMs,reads:state.reads-reads,readMs:state.readMs-readMs,sourcePixels:state.sourcePixels-pixels,cam:window.townBuilder?{...townBuilder.cam}:null,chunkBuilds:stats?.builds,chunkScans:stats?.scans,chunkSyncBuilds:stats?.syncBuilds,chunkPrefetchBuilds:stats?.prefetchBuilds,chunkPrefetchSteps:stats?.prefetchSteps,chunkPending:stats?.pending,navigation:window.townBuilder?.ambient.navigationStats});}
 });
 for(const proto of [globalThis.CanvasRenderingContext2D?.prototype,globalThis.OffscreenCanvasRenderingContext2D?.prototype].filter(Boolean)){
  const draw=proto.drawImage,read=proto.getImageData;
  proto.drawImage=function(...a){
   if(!state.active)return draw.apply(this,a);
   state.draws++;state.sourcePixels+=(a.length===9?a[3]*a[4]:(a[0]?.width||0)*(a[0]?.height||0));const start=performance.now();
   try{return draw.apply(this,a);}finally{state.drawMs+=performance.now()-start;}
  };
  proto.getImageData=function(...a){if(!state.active)return read.apply(this,a);state.reads++;const start=performance.now();try{return read.apply(this,a);}finally{state.readMs+=performance.now()-start;}};
 }
})()"""


def percentile(values, fraction):
    values = sorted(values)
    return values[min(len(values) - 1, int((len(values) - 1) * fraction))] if values else 0


def profile_summary(profile):
    nodes = {node['id']: node for node in profile['nodes']}
    parents = {child: node['id'] for node in profile['nodes'] for child in node.get('children', [])}
    own, inclusive = {}, {}
    for index, sample in enumerate(profile.get('samples', [])):
        duration = profile.get('timeDeltas', [])[index] / 1000
        own[sample] = own.get(sample, 0) + duration
        node_id = sample
        while node_id in nodes:
            inclusive[node_id] = inclusive.get(node_id, 0) + duration
            node_id = parents.get(node_id)
    def rows(values):
        result = []
        for node_id, ms in sorted(values.items(), key=lambda item: -item[1]):
            frame = nodes[node_id]['callFrame']
            if frame.get('functionName') in ['(root)', '(idle)', '(program)']:
                continue
            result.append({'function': frame.get('functionName') or '(anonymous)', 'file': frame.get('url', '').split('/town/')[-1], 'line': frame.get('lineNumber', -1) + 1, 'ms': round(ms, 2)})
        return result[:18]
    return {'self': rows(own), 'inclusive': rows(inclusive)}


scenarios = [
    {'id': 'original-courtyard-night-npcs', 'opera': False, 'night': True, 'npcs': True, 'camera': [10500, 7600, .8]},
    {'id': 'opera-courtyard-night-npcs', 'opera': True, 'night': True, 'npcs': True, 'camera': [10500, 7600, .8]},
    {'id': 'opera-courtyard-night-no-npcs', 'opera': True, 'night': True, 'npcs': False, 'camera': [10500, 7600, .8]},
    {'id': 'opera-courtyard-day-no-npcs', 'opera': True, 'night': False, 'npcs': False, 'camera': [10500, 7600, .8]},
    {'id': 'opera-close-night-npcs', 'opera': True, 'night': True, 'npcs': True, 'camera': [12500, 9700, .48]},
    {'id': 'opera-close-day-no-npcs', 'opera': True, 'night': False, 'npcs': False, 'camera': [12500, 9700, .48]},
    {'id': 'original-fullmap-night-npcs', 'opera': False, 'night': True, 'npcs': True, 'camera': [8192, 6144, .065]},
    {'id': 'opera-fullmap-night-npcs', 'opera': True, 'night': True, 'npcs': True, 'camera': [8192, 6144, .065]},
    {'id': 'opera-fullmap-night-no-npcs', 'opera': True, 'night': True, 'npcs': False, 'camera': [8192, 6144, .065]},
    {'id': 'opera-fullmap-day-no-npcs', 'opera': True, 'night': False, 'npcs': False, 'camera': [8192, 6144, .065]},
    {'id': 'opera-district-night-npcs', 'opera': True, 'night': True, 'npcs': True, 'camera': [11000, 7200, .2]},
    {'id': 'opera-district-day-no-npcs', 'opera': True, 'night': False, 'npcs': False, 'camera': [11000, 7200, .2]},
    {'id': 'opera-walk-courtyard-night-npcs', 'opera': True, 'night': True, 'npcs': True, 'camera': [10080, 8192, .8], 'walk': True},
    {'id': 'opera-walk-courtyard-day-no-npcs', 'opera': True, 'night': False, 'npcs': False, 'camera': [10080, 8192, .8], 'walk': True},
]
if args.sustained:
    scenarios = [
        {'id': 'walk-courtyards-121', 'opera': True, 'night': True, 'npcs': True, 'camera': [10500, 7800, .8], 'walk': True, 'corridor': 'courtyards', 'objects': 121},
        {'id': 'walk-organic-shore-121', 'opera': True, 'night': True, 'npcs': True, 'camera': [9000, 10800, .8], 'walk': True, 'corridor': 'shore', 'objects': 121},
        {'id': 'walk-courtyards-500', 'opera': True, 'night': True, 'npcs': True, 'camera': [10500, 7800, .8], 'walk': True, 'corridor': 'courtyards', 'objects': 500},
        {'id': 'walk-courtyards-121-walls1500', 'opera': True, 'night': True, 'npcs': True, 'camera': [10500, 7800, .8], 'walk': True, 'corridor': 'courtyards', 'objects': 121, 'extraEdges': 1500},
    ]
if args.scenario:
    scenarios = [scenario for scenario in scenarios if scenario['id'] in args.scenario]
if args.limit:
    scenarios = scenarios[:args.limit]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Snapshot, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
results = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1920, 'height': 1200}, device_scale_factor=2)
        context.add_init_script(INSTRUMENT)
        page = context.new_page()
        page.set_default_timeout(180000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/?profile=outdoor')
        page.wait_for_function('!!window.townBuilder')
        session = context.new_cdp_session(page)
        session.send('Profiler.enable')
        session.send('Profiler.setSamplingInterval', {'interval': 500})
        session.send('Performance.enable')
        page.evaluate(r'''async()=>{const app=new URL(document.querySelector('script[type="module"]').src),terrainURL=new URL('../world/terrain-render.mjs'+app.search,app),source=await (await fetch(terrainURL)).text(),url=new URL(source.match(/from ['"]([^'"]*terrain-chunks\.mjs[^'"]*)['"]/)[1],terrainURL);const {terrainChunkStats}=await import(url);window.__chunkStats=()=>terrainChunkStats(document.getElementById('map').getContext('2d'));}''')
        current_opera = None
        for scenario in scenarios:
            if current_opera is not scenario['opera'] or scenario.get('walk'):
                if page.locator('#walk').inner_text() == 'Stop walk test':
                    page.locator('#walk').click()
                fixture = json.loads(source_bytes)
                if scenario['opera']:
                    fixture['objects'].append({'id': 'temporary-profile-opera', 'asset': 'sydney-opera-house', 'x': 12500, 'y': 11200, 'scale': 1, 'rotation': 0, 'layer': 'objects', 'collision': True})
                if scenario.get('objects', 121) > len(fixture['objects']):
                    small_ids = page.evaluate('(ids)=>ids.filter(id=>{const a=townBuilder.catalog.get(id);return a&&a.w<240&&a.h<300;})', list({o['asset'] for o in original['objects']}))
                    samples = [o for o in original['objects'] if o['asset'] in small_ids]
                    for index in range(scenario['objects'] - len(fixture['objects'])):
                        extra = {**samples[index % len(samples)], 'id': 'stress-detail-' + str(index), 'x': 6600 + index % 20 * 370, 'y': 5400 + index // 20 * 260}
                        fixture['objects'].append(extra)
                for index in range(scenario.get('extraEdges', 0)):
                    axis = 'h' if index % 2 == 0 else 'v'
                    n = index // 2
                    fixture['edges'][f'{axis}:{60+n%36}:{150+n//36}'] = {'style': 'music-square', 'gate': False, 'open': False}
                if scenario.get('walk'):
                    fixture['spawn'] = {'x': scenario['camera'][0], 'y': scenario['camera'][1]}
                fixture['name'] = 'Isolated outdoor performance fixture'
                page.locator('#file').set_input_files({'name': 'outdoor-profile.json', 'mimeType': 'application/json', 'buffer': json.dumps(fixture).encode()})
                page.wait_for_function('(n)=>townBuilder.project.objects.length===n', arg=len(fixture['objects']))
                current_opera = scenario['opera']
                await_art = page.evaluate('''async()=>{
                    await Promise.all(townBuilder.project.objects.map(o=>townBuilder.catalog.get(o.asset)?.ensureFull?.()));
                    return townBuilder.project.objects.length;
                }''')
            page.locator('#lightingToggle').select_option('night' if scenario['night'] else 'day')
            if page.evaluate('townBuilder.npcsVisible') != scenario['npcs']:
                page.locator('#npcToggle').click()
            if scenario.get('walk'):
                if scenario.get('corridor'):
                    route = page.evaluate('''async zone=>{
                        const app=new URL(document.querySelector('script[type="module"]').src),{blocked}=await import(new URL('../world/model.mjs'+app.search,app));
                        const doc=townBuilder.project,catalog=townBuilder.catalog,ys=zone==='shore'?[10080,10336,10592,10848,11104]:[7280,7440,7600,7760,7920,8080,8192,8352,8512,8672,8832,8992],runs=[];
                        for(const y of ys){let begin=null,previous=null;for(let x=3808;x<=15136;x+=32){const p={x,y},clear=!blocked(doc,x,y,catalog,previous);if(clear){if(begin===null)begin=x;previous=p;}else {if(begin!==null)runs.push({x0:begin+64,x1:x-96,y,length:x-begin-160});begin=null;previous=null;}}if(begin!==null)runs.push({x0:begin+64,x1:15072,y,length:15072-begin-64});}
                        runs.sort((a,b)=>b.length-a.length);const best=runs[0];if(!best||best.length<700)throw Error('No long clear '+zone+' corridor');doc.spawn={x:best.x0,y:best.y};return best;
                    }''', scenario['corridor'])
                    scenario['route'] = route
                page.locator('#walk').click()
            page.evaluate('([x,y,zoom])=>Object.assign(townBuilder.cam,{x,y,zoom})', scenario['camera'])
            page.locator('#map').focus()
            page.wait_for_timeout(1200)
            # Exclude first-bake art/cache costs from the steady-state sample.
            before_metrics = {item['name']: item['value'] for item in session.send('Performance.getMetrics')['metrics']}
            session.send('Profiler.start')
            page.evaluate('__outdoorPerf.begin()')
            if scenario.get('walk'):
                held = 'd'
                page.keyboard.down(held)
            deadline = time.monotonic() + args.seconds
            while time.monotonic() < deadline:
                page.wait_for_timeout(min(200, max(1, (deadline - time.monotonic()) * 1000)))
                if scenario.get('corridor'):
                    x = page.evaluate('townBuilder.cam.x')
                    if held == 'd' and x >= scenario['route']['x1'] - 70 or held == 'a' and x <= scenario['route']['x0'] + 70:
                        page.keyboard.up(held)
                        held = 'a' if held == 'd' else 'd'
                        page.keyboard.down(held)
            if scenario.get('walk'):
                page.keyboard.up(held)
            measured = page.evaluate('__outdoorPerf.end()')
            profile = session.send('Profiler.stop')['profile']
            after_metrics = {item['name']: item['value'] for item in session.send('Performance.getMetrics')['metrics']}
            frames = measured.pop('frames')
            frame_gaps = [frames[i]['at'] - frames[i - 1]['at'] for i in range(1, len(frames))]
            moved = [abs(frames[i]['cam']['x'] - frames[i - 1]['cam']['x']) for i in range(1, len(frames))]
            duration = (frames[-1]['at'] - frames[0]['at']) if len(frames) > 1 else args.seconds * 1000
            summary = {
                **scenario, 'frames': len(frames), 'fps': round((len(frames) - 1) * 1000 / duration, 2),
                'frameCpuMeanMs': round(statistics.mean(f['cpu'] for f in frames), 3),
                'frameCpuP95Ms': round(percentile([f['cpu'] for f in frames], .95), 3),
                'frameCpuP50Ms': round(percentile([f['cpu'] for f in frames], .5), 3),
                'frameCpuP99Ms': round(percentile([f['cpu'] for f in frames], .99), 3),
                'frameCpuMaxMs': round(max(f['cpu'] for f in frames), 3),
                'frameGapP50Ms': round(percentile(frame_gaps, .5), 3),
                'frameGapP95Ms': round(percentile(frame_gaps, .95), 3),
                'frameGapP99Ms': round(percentile(frame_gaps, .99), 3),
                'frameGapMaxMs': round(max(frame_gaps, default=0), 3),
                'stallsOver50Ms': sum(t > 50 for t in frame_gaps), 'stallsOver100Ms': sum(t > 100 for t in frame_gaps),
                'cameraTravel': round(sum(moved), 2), 'movingFrameFraction': round(sum(d > .1 for d in moved) / max(1, len(moved)), 3),
                'worstFrames': sorted(frames, key=lambda f: -f['cpu'])[:12],
                'drawsPerFrame': round(statistics.mean(f['draws'] for f in frames), 1),
                'drawNativeMeanMs': round(statistics.mean(f['drawMs'] for f in frames), 3),
                'sourceMegaPixelsPerFrame': round(statistics.mean(f['sourcePixels'] for f in frames) / 1e6, 1),
                'readbacksPerFrame': round(statistics.mean(f['reads'] for f in frames), 2),
                'taskCpuMs': round((after_metrics['TaskDuration'] - before_metrics['TaskDuration']) * 1000, 2),
                'scriptCpuMs': round((after_metrics['ScriptDuration'] - before_metrics['ScriptDuration']) * 1000, 2),
                'profile': profile_summary(profile),
                'actors': page.evaluate('townBuilder.ambient.actors.length'),
                'navigation': page.evaluate('townBuilder.ambient.navigationStats'),
                'actualCamera': page.evaluate('({...townBuilder.cam})'),
            }
            results.append(summary)
            (args.output / (scenario['id'] + '.cpuprofile')).write_text(json.dumps(profile))
            (args.output / (scenario['id'] + '.frames.json')).write_text(json.dumps(frames))
            (args.output / 'results.json').write_text(json.dumps({'ref': args.ref, 'commit': commit, 'deviceScaleFactor': 2, 'viewport': [1920, 1200], 'sourceHash': source_hash, 'scenarios': results, 'pageErrors': errors}, indent=2))
            print(json.dumps(summary), flush=True)
            page.locator('#map').screenshot(path=str(args.output / (scenario['id'] + '.png')))
        assert hashlib.sha256(MAP.read_bytes()).hexdigest() == source_hash
        assert not errors, errors
        browser.close()
finally:
    server.shutdown()
