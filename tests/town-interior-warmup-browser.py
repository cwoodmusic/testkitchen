"""A failed furniture request must not freeze a home's pending material tiles.

Exercise the actual cold builder, network routes and interior renderer in an
isolated guest context. Material responses stay pending until native furniture
requests fail and the fallback background has been rendered again. Releasing
the real material files must replace that cached background without re-entry.

Optional --baseline-ref serves only urban-interiors.mjs from an immutable Git
revision, allowing a red run against the former Promise.all race without
changing the checkout. This is a functional regression, not a performance run.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import argparse
import base64
import hashlib
import json
import subprocess
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'town/maps/coda-town-uploaded-3.json'
parser = argparse.ArgumentParser()
parser.add_argument('--screenshots', type=Path, default=Path('/tmp/town-interior-warmup'))
parser.add_argument('--baseline-ref', help='Serve the historical renderer only, without changing the checkout')
args = parser.parse_args()
args.screenshots.mkdir(parents=True, exist_ok=True)
source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
renderer_override = subprocess.check_output(
    ['git', 'show', f'{args.baseline_ref}:town/world/urban-interiors.mjs'], cwd=ROOT
) if args.baseline_ref else None
fingerprint = ['node', 'tests/town-surface-contract-fingerprint.mjs']
subprocess.run(fingerprint + ['--output', str(args.screenshots / 'physical-before.json')], cwd=ROOT, check=True, capture_output=True)


class Files(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        if renderer_override is not None and urlsplit(self.path).path == '/town/world/urban-interiors.mjs':
            self.send_response(200)
            self.send_header('Content-Type', 'text/javascript')
            self.send_header('Content-Length', str(len(renderer_override)))
            self.end_headers()
            self.wfile.write(renderer_override)
            return
        super().do_GET()


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Files, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
report = {}
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1500, 'height': 1000})
        context.add_init_script('''(() => {
            localStorage.setItem('codaNotesWalletV1', JSON.stringify({version:1,balance:150,owned:['furniture-geranium'],rewards:[],earned:170,spent:20}));
            localStorage.setItem('codaUrbanRoomV1', JSON.stringify({version:1,owner:'guest',items:[{id:'room-legacy-geranium',item:'furniture-geranium',asset:'decor-08-01',x:1800,y:900,scale:1}]}));
            window.__warmupUnhandled = [];
            addEventListener('unhandledrejection', e => __warmupUnhandled.push(String(e.reason)));
        })()''')
        page = context.new_page()
        page.set_default_timeout(180000)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        page.evaluate(r'''async () => {
            const app = new URL(document.querySelector('script[type=module]').src);
            const url = name => new URL('../world/' + name + '.mjs' + app.search, app);
            const interior = await import(url('urban-interiors'));
            const materials = await import(url('home-materials'));
            const collections = await import(url('apartment-collections'));
            await Promise.all([import(url('ground-textures')), import(url('interior-portal-art')).then(m => m.warmInteriorPortalArt()), document.fonts.ready]);
            interior.clearInteriorRenderCache();
            const initial = materials.getHomeMaterialCacheStats();
            if(initial.textures !== 0 || initial.ready !== 0) throw Error('Home materials must be cold before the regression');
            const scene = {kind:'apartment',resident:'player',floor:15};
            const model = interior.getInterior(scene);
            const physical = () => JSON.stringify({width:model.width,height:model.height,spawn:model.spawn,solids:model.solids,
                walls:model.walls.map(({x,y,w,h}) => ({x,y,w,h})),
                doors:model.doors,privacyDoors:model.privacyDoors,
                items:model.items.map(({asset,x,y,w,h,rotation,collisionBoxes}) => ({asset,x,y,w,h,rotation,collisionBoxes}))});
            const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2,'0')).join('');
            const capture = async () => {
                const cv = document.createElement('canvas');cv.width=model.width;cv.height=model.height;
                const c=cv.getContext('2d',{willReadFrequently:true}), draw=c.drawImage;let background;
                c.drawImage=function(image,...rest){if(image.width===model.width && image.height===model.height)background=image;return draw.call(this,image,...rest);};
                interior.renderInterior(c, townBuilder.urban.scene, {catalog:townBuilder.catalog,actors:[],time:.4,decor:townBuilder.urban.decor});
                if(!background || background===cv)throw Error('The real interior background was not observed');
                const pixels=background.getContext('2d',{willReadFrequently:true}).getImageData(0,0,background.width,background.height).data;
                const row={backgroundHash:await digest(pixels),backgroundWidth:background.width,backgroundHeight:background.height,
                    materialStats:materials.getHomeMaterialCacheStats(),cache:interior.getInteriorRenderCacheStats(),png:cv.toDataURL()};
                if(!__warmup.fallback){__warmup.fallback={background,pixels:new Uint8ClampedArray(pixels),scene:townBuilder.urban.scene};}
                else {row.sameScene=townBuilder.urban.scene===__warmup.fallback.scene;row.replacedBackground=background!==__warmup.fallback.background;
                    row.oldBackingReleased=__warmup.fallback.background.width===0 && __warmup.fallback.background.height===0;
                    let changed=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==__warmup.fallback.pixels[i] || pixels[i+1]!==__warmup.fallback.pixels[i+1] || pixels[i+2]!==__warmup.fallback.pixels[i+2] || pixels[i+3]!==__warmup.fallback.pixels[i+3])changed++;
                    row.changedBackgroundPixels=changed;}
                cv.width=cv.height=0;return row;
            };
            window.__warmup={capture,physical,physicalBefore:physical(),materialStats:materials.getHomeMaterialCacheStats,
                artStats:collections.getApartmentCollectionRuntimeStats,projectBefore:JSON.stringify(townBuilder.project),
                roomBefore:localStorage.getItem('codaUrbanRoomV1'),walletBefore:localStorage.getItem('codaNotesWalletV1')};
        }''')

        held_materials = []
        failed_native = []

        def hold_material(route):
            if Path(urlsplit(route.request.url).path).name.startswith('player-'):
                held_materials.append(route)
            else:
                route.continue_()

        def fail_native(route):
            name = Path(urlsplit(route.request.url).path).name
            if '-thumb.' in name or 'overview' in name:
                route.continue_()
            else:
                failed_native.append(route.request.url)
                route.abort('failed')

        context.route('**/assets/home-materials/*.webp*', hold_material)
        context.route('**/assets/apartment-collections/*.webp*', fail_native)
        page.locator('#walk').click()
        page.evaluate("townBuilder.urban.openRoom('player')")
        page.wait_for_function('townBuilder.urban.scene?.kind === "apartment" && townBuilder.urban.scene.resident === "player"')
        deadline = time.monotonic() + 30
        while (len(held_materials) != 4 or not failed_native) and time.monotonic() < deadline:
            page.wait_for_timeout(25)
        assert len(held_materials) == 4, f'Expected four held real material requests, got {len(held_materials)}'
        assert failed_native, 'No real native furniture requests were rejected'
        page.wait_for_function('''() => {const s=__warmup.artStats();return s.activeLoads===0 && s.queuedLoads===0 && s.pendingLoads===0;}''')
        # Two real frames force the fallback to be rendered again after every
        # native rejection; an early Promise.all invalidation is now spent.
        page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
        fallback = page.evaluate('() => __warmup.capture()')
        (args.screenshots / 'fallback.png').write_bytes(base64.b64decode(fallback.pop('png').split(',')[1]))
        assert fallback['materialStats']['textures'] == 4 and fallback['materialStats']['ready'] == 0, fallback
        for route in held_materials:
            route.continue_()
        page.wait_for_function('__warmup.materialStats().ready === 4')
        page.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
        loaded = page.evaluate('() => __warmup.capture()')
        (args.screenshots / 'materials-arrived.png').write_bytes(base64.b64decode(loaded.pop('png').split(',')[1]))
        unchanged = page.evaluate('''() => ({physical:__warmup.physical()===__warmup.physicalBefore,
            project:JSON.stringify(townBuilder.project)===__warmup.projectBefore,
            roomSave:localStorage.getItem('codaUrbanRoomV1')===__warmup.roomBefore,
            wallet:localStorage.getItem('codaNotesWalletV1')===__warmup.walletBefore,
            unhandled:__warmupUnhandled})''')
        report = {'baselineRef':args.baseline_ref,'heldRealMaterialRequests':len(held_materials),
            'rejectedNativeRequests':len(failed_native),'fallback':fallback,'loaded':loaded,
            'unchanged':unchanged,'pageErrors':errors,'sourceMapUnchanged':hashlib.sha256(SOURCE.read_bytes()).hexdigest()==source_hash}
        (args.screenshots / 'results.json').write_text(json.dumps(report, indent=2))
        assert loaded['sameScene'], 'The room was re-entered instead of updating in place'
        assert loaded['replacedBackground'] and loaded['oldBackingReleased'], 'Completed materials did not invalidate the cached fallback after furniture failure'
        assert loaded['backgroundHash'] != fallback['backgroundHash'] and loaded['changedBackgroundPixels'] > 1000, 'Actual material textures did not appear in the room'
        assert all(unchanged[k] for k in ['physical','project','roomSave','wallet']), unchanged
        assert not unchanged['unhandled'] and not errors, report
        assert report['sourceMapUnchanged']
        browser.close()
    subprocess.run(fingerprint + ['--baseline', str(args.screenshots / 'physical-before.json')], cwd=ROOT, check=True, capture_output=True)
    print(json.dumps({'materials':4,'nativeFailures':report['rejectedNativeRequests'],
        'sameScene':report['loaded']['sameScene'],'backgroundReplaced':report['loaded']['replacedBackground'],
        'changedPixels':report['loaded']['changedBackgroundPixels'],'physicalAndSavesUnchanged':True,'pageErrors':report['pageErrors']}), flush=True)
finally:
    server.shutdown()
