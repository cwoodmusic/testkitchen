"""Placeable decor stays in the library; the editable DJ rig lights the live world."""
from settings_menu_helpers import settings_page
import copy
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest
import sys

sys.dont_write_bytecode = True

from playwright.sync_api import sync_playwright
from world_navigation_helpers import open_settings, close_settings

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class DecorLibraryBrowserTests(unittest.TestCase):
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
        self.context = None
        self.errors = []
        self.failures = []
        self.load(seed=True)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Browser script errors')
        self.assertEqual(self.failures, [], 'Failed local resources')

    def load(self, seed):
        if self.context:
            self.context.close()
        self.context = self.browser.new_context(viewport={'width':1600, 'height':1000}, reduced_motion='no-preference')
        if seed:
            self.context.add_init_script('''(()=>{
              if(location.protocol!=='http:'||sessionStorage.getItem('decorFixtureSeeded'))return;
              localStorage.setItem('codaWorldProjectV1',JSON.stringify({
                format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
                assets:[],collision:[],strokes:[],savedAt:Date.now()
              }));sessionStorage.setItem('decorFixtureSeeded','yes');
            })()''')
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failures.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.ready()
        self.page.evaluate("CodaDeveloperConsole.open('objects')")

    def ready(self):
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready && window.CodaDecorLibrary?.items.length===91')

    def frames(self):
        self.page.evaluate('''()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))''')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def field(self, name, value):
        target = self.page.locator('#' + name)
        target.fill(str(value))
        target.press('Tab')

    def library(self):
        panel = self.page.locator('[data-decor-library]')
        if not panel.evaluate('(node)=>node.open'):
            panel.locator('summary').click()
        return panel

    def add_decor(self, decor_id):
        self.library()
        self.page.locator('[data-decor-category]').select_option('all')
        self.page.locator('[data-decor-search]').fill('')
        self.page.locator('[data-decor-item="' + decor_id + '"]').click()
        before = len(self.project()['assets'])
        self.page.locator('[data-decor-add]').click()
        self.page.wait_for_function('(count)=>CodaDeveloperConsole.getProject().assets.length===count', arg=before + 1)
        self.page.wait_for_function('!document.querySelector("[data-decor-library]").matches("[aria-busy=true]")')
        return self.project()['assets'][-1]

    def add_rig(self):
        self.library()
        before = len(self.project()['assets'])
        self.page.locator('#devAddFloodRig').click()
        self.page.wait_for_function('(count)=>CodaDeveloperConsole.getProject().assets.length===count', arg=before + 1)
        rig = next(asset for asset in reversed(self.project()['assets']) if asset.get('floodLights'))
        self.page.locator('#assetList').select_option(rig['id'])
        self.frames()
        return rig

    def rig(self, rig_id):
        return self.page.evaluate('id=>CodaArcadeQA.floodLights().rigs.find(rig=>rig.id===id)', rig_id)

    def quality(self, target):
        settings_page(self.page, 'screen')
        for _ in range(3):
            if self.page.locator('#fxBtn').inner_text().endswith(target.capitalize()):
                break
            self.page.locator('#fxBtn').click()
        close_settings(self.page)
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.frames()

    def test_handdrawn_audio_assets_and_north_facing_register_use_the_new_sources(self):
        self.load(seed=True)
        for decor_id in ['boombox','boombox-tower','notes-register']:
            asset = self.add_decor(decor_id)
            self.assertTrue(self.page.locator('[data-decor-preview] img').get_attribute('src').startswith('assets/decor/handdrawn/v1/'))
            description = self.page.locator('[data-decor-preview]').inner_text()
            self.assertIn('North-facing · rear view' if decor_id == 'notes-register' else 'South-facing · front view', description)
            expected = self.page.evaluate('''async id=>{
              const image=new Image();image.src=CodaDecorLibrary.imageURL(id);await image.decode();
              const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
              c.getContext('2d').drawImage(image,0,0);return c.toDataURL();
            }''', decor_id)
            self.assertEqual(asset['data'], expected, 'Placed asset must contain the new artwork')
        expected = self.project()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)

    def test_directional_furniture_is_unplaced_and_saves_as_independent_east_west_assets(self):
        self.load(seed=False)
        original = self.project()
        directional = self.page.evaluate("CodaDecorLibrary.items.filter(item=>item.id.endsWith('-east')||item.id.endsWith('-west'))")
        self.assertEqual(len(directional), 12)
        self.assertEqual(original, json.loads((ROOT/'published-world-project.json').read_text()), 'Keep the uploaded placements exactly')
        self.library()
        self.page.locator('[data-decor-category]').select_option('furniture')
        self.page.locator('[data-decor-search]').fill('east')
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), 6)
        self.page.locator('[data-decor-search]').fill('west')
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), 6)
        self.assertEqual(self.project(), original, 'Browsing must leave the uploaded layout unchanged')
        for item in directional:
            asset = self.add_decor(item['id'])
            self.assertGreater(asset['h'], asset['w'])
            self.assertEqual(asset['rotation'], 0, 'Side-view artwork must not be a rotated south-facing sprite')
            self.assertFalse(asset.get('origin'))
            self.assertIn('East-facing' if item['id'].endswith('-east') else 'West-facing', self.page.locator('[data-decor-preview]').inner_text())
        self.assertEqual(self.project()['assets'][:-12], original['assets'])
        expected = self.project()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)

    def test_music_wall_art_is_separate_and_the_rectangular_table_preserves_the_uploaded_layout(self):
        self.load(seed=False)
        table = next(asset for asset in self.project()['assets'] if asset['id'] == 'asset-90')
        self.assertEqual((table['name'], table['kind'], table['visible']), ('Rectangular walnut lounge table', 'image', True))
        self.assertTrue(table['data'].startswith('data:image/png;base64,'))
        self.assertFalse(next(asset for asset in self.project()['assets'] if asset['id'] == 'asset-7')['visible'])
        additions = ['wall-art-treble-clef', 'wall-art-bass-clef', 'wall-art-grand-staff',
                     'wall-art-gold-record', 'wall-art-saxophone', 'wall-art-electric-guitars', 'wall-art-drum-kit']
        before = self.project()
        for decor_id in additions:
            asset = self.add_decor(decor_id)
            self.assertEqual(asset['kind'], 'image')
            self.assertTrue(asset['data'].startswith('data:image/png;base64,'))
            self.assertFalse(asset.get('origin'), 'Wall decorations must be independent copies')
        self.assertEqual(len(self.project()['assets']), len(before['assets']) + 7)
        self.assertEqual(self.project()['assets'][:-7], before['assets'])
        selected = self.project()['assets'][-1]['id']
        self.field('assetX', 1000)
        self.field('assetY', 350)
        self.field('assetRotate', 25)
        expected = self.project()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)
        self.assertEqual(next(asset for asset in self.project()['assets'] if asset['id'] == selected)['rotation'], 25)

    def test_fresh_layout_preserves_the_published_rig_decor_and_unplaced_expansion(self):
        self.load(seed=False)
        published = json.loads((ROOT/'published-world-project.json').read_text())
        self.assertEqual(self.project(), published)
        self.assertEqual(len(published['assets']), 97)
        rigs = [asset for asset in published['assets'] if asset.get('floodLights')]
        self.assertEqual(len(rigs), 1)
        rig = rigs[0]
        dj = self.page.evaluate('CodaArcadeQA.dj()')
        self.assertAlmostEqual(rig['x'], dj['x'], delta=1)
        self.assertLess(rig['y'] + rig['h']/2, dj['y'] - 40, 'The fixture is mounted above the DJ')
        self.assertEqual(len(self.page.evaluate('CodaDecorLibrary.items')), 91)
        self.assertTrue(all(asset.get('data', '').startswith('data:image/png;base64,')
                            for asset in published['assets'] if asset['kind'] == 'image'),
                        'Placed images are embedded rather than tied to a library URL')
        self.assertEqual(len([asset for asset in published['assets'] if asset.get('floodLights')]), 1)

    def test_all_library_cutouts_load_and_filtering_or_preview_does_not_place_them(self):
        original = self.project()
        self.library()
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), 91)
        images = self.page.evaluate('''async()=>Promise.all(CodaDecorLibrary.items.map(async item=>{
          const image=new Image();image.src=CodaDecorLibrary.imageURL(item.id);await image.decode();
          const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
          const g=canvas.getContext('2d');g.drawImage(image,0,0);const pixels=g.getImageData(0,0,canvas.width,canvas.height).data;
          let clear=false,visible=false;for(let i=3;i<pixels.length;i+=4){if(pixels[i]===0)clear=true;if(pixels[i]>0)visible=true;if(clear&&visible)break;}
          return {id:item.id,width:canvas.width,height:canvas.height,clear,visible};
        }))''')
        self.assertEqual(len(images), 91)
        self.assertTrue(all(image['width'] > 1 and image['height'] > 1 and image['clear'] and image['visible'] for image in images), images)
        for category, count in [('floor',16), ('tabletop',22), ('wall',19), ('rug',11), ('furniture',23)]:
            self.page.locator('[data-decor-category]').select_option(category)
            self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), count)
        self.page.locator('[data-decor-category]').select_option('all')
        self.page.locator('[data-decor-search]').fill('rocket')
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), 2)
        self.page.locator('[data-decor-item="mini-rocket"]').click()
        self.assertTrue(self.page.locator('[data-decor-preview]').is_visible())
        self.assertTrue(self.page.locator('[data-decor-add]').is_enabled())
        self.assertEqual(self.project(), original, 'Filtering and selecting art are not layout edits')

    def test_added_floor_and_tabletop_copies_use_the_normal_editing_and_history_controls(self):
        floor = self.add_decor('neon-jukebox')
        table = self.add_decor('mini-cabinet')
        self.assertTrue(floor['data'].startswith('data:image/png;base64,'))
        self.assertTrue(table['data'].startswith('data:image/png;base64,'))
        self.assertGreater(floor['h'], table['h'] * 2)
        self.assertLessEqual(table['w'], 26)
        self.assertLessEqual(table['h'], 30)
        self.assertTrue(floor.get('ignoreBackgroundMasks'))
        self.assertTrue(table.get('ignoreBackgroundMasks'))
        self.page.locator('#assetList').select_option(table['id'])
        self.field('assetName', 'My tabletop cabinet')
        self.field('assetX', 1020)
        self.field('assetY', 620)
        self.field('assetW', 42)
        edited = next(asset for asset in self.project()['assets'] if asset['id'] == table['id'])
        self.assertEqual((edited['x'], edited['y'], edited['w'], edited['name']), (1020,620,42,'My tabletop cabinet'))
        self.page.locator('#assetDuplicate').click()
        self.assertEqual(len(self.project()['assets']), 3)
        self.assertEqual(self.project()['assets'][-1]['data'], edited['data'])
        before = self.project()
        self.page.locator('#assetRemove').click()
        self.assertEqual(len(self.project()['assets']), 2)
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project(), before)
        self.page.locator('#devEditPixels').click()
        self.page.wait_for_function("CodaDeveloperConsole.getState().artwork?.target.startsWith('asset.')")

    def test_light_rig_and_decor_edits_round_trip_as_portable_project_data(self):
        self.add_decor('succulent')
        rig = self.add_rig()
        self.field('devFloodSpeed', 1.7)
        self.field('devFloodIntensity', 45)
        self.field('devFloodLength', 225)
        self.page.locator('#devFloodEnabled').uncheck()
        expected = self.project()
        settings = next(asset['floodLights'] for asset in expected['assets'] if asset['id'] == rig['id'])
        self.assertEqual(settings, {'version':1, 'enabled':False, 'speed':1.7, 'intensity':45, 'beamLength':225})
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as pending:
            self.page.locator('#devExport').click()
        exported = json.loads(Path(pending.value.path()).read_text())
        self.assertEqual(exported, expected)
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)
        self.page.evaluate("CodaDeveloperConsole.open('project')")
        invalid = copy.deepcopy(expected)
        next(asset for asset in invalid['assets'] if asset['id'] == rig['id'])['floodLights']['intensity'] = 'bright'
        self.page.locator('#devImportFile').set_input_files({'name':'invalid-decor.json', 'mimeType':'application/json', 'buffer':json.dumps(invalid).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
        self.assertEqual(self.project(), expected, 'Invalid light settings cannot replace a good layout')

    def test_four_lamp_faces_change_color_and_follow_the_editable_rig(self):
        rig = self.add_rig()
        self.quality('full')
        self.page.locator('#assetList').select_option(rig['id'])
        self.field('assetX', 1000)
        self.field('assetY', 500)
        if self.page.locator('#assetGuides').is_checked():
            self.page.locator('#assetGuides').uncheck()
        first = self.rig(rig['id'])
        self.assertTrue(first['enabled'])
        self.assertEqual(len(first['heads']), 4)
        sample = '''id=>{const rig=CodaArcadeQA.floodLights().rigs.find(rig=>rig.id===id),cam=CodaArcadeQA.camera(),g=document.querySelector('#view').getContext('2d');return rig.heads.map(head=>Array.from(g.getImageData(Math.floor((head.x-cam.x)*cam.zoom),Math.floor((head.y-cam.y)*cam.zoom),1,1).data));}'''
        pixels = self.page.evaluate(sample, rig['id'])
        self.page.wait_for_timeout(600)
        self.frames()
        second = self.rig(rig['id'])
        self.assertNotEqual([head['color'] for head in first['heads']], [head['color'] for head in second['heads']])
        self.assertNotEqual(pixels, self.page.evaluate(sample, rig['id']), 'The actual four lamp faces must visibly change color')
        self.page.locator('#assetPlay').uncheck()
        frozen = [head['color'] for head in self.rig(rig['id'])['heads']]
        self.page.wait_for_timeout(200)
        self.assertEqual([head['color'] for head in self.rig(rig['id'])['heads']], frozen)
        self.field('assetRotate', 30)
        transformed = self.rig(rig['id'])
        self.assertAlmostEqual(transformed['rotation'], 3.141592653589793/6)
        self.assertNotEqual((transformed['heads'][0]['x'], transformed['heads'][0]['y']),
                            (second['heads'][0]['x'], second['heads'][0]['y']))
        self.page.locator('#devFloodEnabled').uncheck()
        self.assertFalse(self.rig(rig['id'])['enabled'])
        self.page.locator('#devFloodEnabled').check()
        self.page.locator('#assetVisible').uncheck()
        self.assertFalse(self.rig(rig['id'])['enabled'])
        self.page.locator('#assetVisible').check()
        self.field('assetOpacity', 0)
        self.assertFalse(self.rig(rig['id'])['enabled'])
        self.field('assetOpacity', 100)
        self.quality('off')
        self.assertFalse(self.rig(rig['id'])['enabled'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
