"""Asset-level background mask overrides preserve artwork, depth, and saves."""
import copy
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class AssetBackgroundMaskTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/world-preview.html'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1600, 'height':1000})
        self.context.add_init_script('''(()=>{
          if(location.protocol!=='http:'||sessionStorage.getItem('assetBackgroundMaskFixture'))return;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify({
            format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
            assets:[],collision:[],strokes:[],savedAt:Date.now()
          }));localStorage.setItem('codaArcadeFXV1','off');
          sessionStorage.setItem('assetBackgroundMaskFixture','yes');
        })()''')
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.ready()
        self.page.evaluate("CodaDeveloperConsole.open('objects')")

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Browser script errors')

    def ready(self):
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready')

    def frames(self):
        self.page.evaluate('''()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))''')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def import_project(self, project):
        self.page.locator('#devTab-project').click()
        self.page.once('dialog', lambda dialog:dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'mask-fixture.json', 'mimeType':'application/json', 'buffer':json.dumps(project).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Imported complete project")')
        self.page.locator('#devTab-objects').click()
        self.frames()

    def fixture(self, opacity=100):
        self.page.locator('#assetPreset').click()
        project = self.project()
        red = self.page.evaluate('''()=>{const c=document.createElement('canvas');c.width=c.height=1;const g=c.getContext('2d');g.fillStyle='#ff0000';g.fillRect(0,0,1,1);return c.toDataURL('image/png');}''')
        asset = project['assets'][-1]
        self.asset_id = asset['id']
        asset.update({'name':'Mask override prop', 'kind':'image', 'data':red,
                      'x':1000, 'y':603, 'w':100, 'h':150, 'rotation':0,
                      'opacity':opacity, 'layer':'front', 'anim':'none'})
        project['characters'] = {'scholar':{'x':1000, 'y':650, 'layer':'world'}}
        project['strokes'] = [{'tool':'erase', 'size':1, 'points':[[950,528]], 'depth':800,
                               'selection':{'x':950, 'y':528, 'width':100, 'height':150}}]
        self.import_project(project)
        self.page.locator('#assetList').select_option(self.asset_id)
        if self.page.locator('#assetGuides').is_checked():
            self.page.locator('#assetGuides').uncheck()
        self.frames()

    def non_red_body_pixels(self):
        return self.page.evaluate('''()=>{
          const g=document.querySelector('#view').getContext('2d'),cam=CodaArcadeQA.camera(),
            pixels=g.getImageData(Math.round((982-cam.x)*cam.zoom),Math.round((580-cam.y)*cam.zoom),Math.round(36*cam.zoom),Math.round(62*cam.zoom)).data;
          let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<245||pixels[i+1]>10||pixels[i+2]>10)n++;return n;
        }''')

    def pixel(self, x, y):
        return self.page.evaluate('''([x,y])=>{const cam=CodaArcadeQA.camera();return Array.from(document.querySelector('#view').getContext('2d').getImageData(Math.round((x-cam.x)*cam.zoom),Math.round((y-cam.y)*cam.zoom),1,1).data);}''', [x,y])

    def test_override_draws_the_actual_asset_above_an_erased_region_and_undo_restores_it(self):
        self.fixture()
        before = self.project()
        self.assertGreater(self.non_red_body_pixels(), 100, 'The erased asset fragment starts behind the live Scholar')
        self.page.locator('#devIgnoreBackgroundMasks').check()
        self.frames()
        self.assertLess(self.non_red_body_pixels(), 40, 'The foreground red image must cover the Scholar when it ignores the background mask')
        after = self.project()
        changed = copy.deepcopy(before)
        changed['assets'][-1]['ignoreBackgroundMasks'] = True
        self.assertEqual(after, changed, 'The toggle changes no position, transform, layer, mask, or NPC data')
        self.page.locator('#devUndo').click()
        self.frames()
        self.assertEqual(self.project(), before)
        self.assertGreater(self.non_red_body_pixels(), 100)
        self.page.locator('#devRedo').click()
        self.frames()
        self.assertEqual(self.project(), changed)
        self.assertLess(self.non_red_body_pixels(), 40)
        self.page.locator('#devIgnoreBackgroundMasks').uncheck()
        self.frames()
        self.assertGreater(self.non_red_body_pixels(), 100, 'Turning the override off restores the authored background mask')

    def test_translucent_override_is_drawn_once_instead_of_in_both_layer_passes(self):
        self.fixture(opacity=50)
        behind = self.pixel(960, 540)
        self.page.locator('#devIgnoreBackgroundMasks').check()
        self.frames()
        self.assertEqual(self.pixel(960, 540), behind, 'Away from actors, the same 50% red image must not become darker or more opaque')
        self.page.locator('#devIgnoreBackgroundMasks').uncheck()
        self.frames()
        self.assertEqual(self.pixel(960, 540), behind)

    def test_lifted_builtin_source_partitions_switch_and_restore_without_stale_masks(self):
        legacy = json.loads((ROOT/'assets/environment/legacy-world-project.json').read_text())
        mirror = next(asset for asset in legacy['assets'] if asset.get('origin', {}).get('name') == 'boutique_mirror')
        self.import_project(legacy)
        self.page.locator('#assetList').select_option(mirror['id'])
        def source(part):
            return self.page.evaluate("part=>CodaArcadeQA.liftedObjectPixel('boutique_mirror',619,406,part)", part)
        raw = source('raw')
        self.assertGreater(raw[3], 200)
        self.assertEqual(source('above')[3], 0)
        self.assertEqual(source('behind'), raw)
        self.page.locator('#devIgnoreBackgroundMasks').check()
        self.frames()
        self.assertEqual(source('above'), raw, 'A lifted original uses its full source when ignoring the mask')
        self.assertEqual(source('behind')[3], 0)
        self.page.locator('#devIgnoreBackgroundMasks').uncheck()
        self.frames()
        self.assertEqual(source('above')[3], 0, 'Restoring the mask must not retain an override cache')
        self.assertEqual(source('behind'), raw)

    def test_override_round_trips_and_invalid_values_leave_the_project_intact(self):
        self.fixture()
        self.page.locator('#devIgnoreBackgroundMasks').check()
        expected = self.project()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as download:
            self.page.locator('#devExport').click()
        self.assertEqual(json.loads(Path(download.value.path()).read_text()), expected)
        invalid = copy.deepcopy(expected)
        invalid['assets'][-1]['ignoreBackgroundMasks'] = 'yes'
        self.page.locator('#devImportFile').set_input_files({'name':'invalid-mask.json', 'mimeType':'application/json', 'buffer':json.dumps(invalid).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
        self.assertEqual(self.project(), expected)
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.page.locator('#assetList').select_option(self.asset_id)
        self.assertTrue(self.page.locator('#devIgnoreBackgroundMasks').is_checked())
        self.frames()
        self.assertLess(self.non_red_body_pixels(), 40)


if __name__ == '__main__':
    unittest.main(verbosity=2)
