"""Rug copies stay editable; mirroring and rotation affect rendered asset pixels."""
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
RED, GREEN, BLUE, YELLOW = ([255,0,0,255], [0,255,0,255], [0,0,255,255], [255,255,0,255])


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class RugsAssetTransformsTests(unittest.TestCase):
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
        self.errors, self.failures = [], []
        self.load(seed=True)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Browser script errors')
        self.assertEqual(self.failures, [], 'Failed local resources')

    def load(self, seed):
        if self.context:
            self.context.close()
        self.context = self.browser.new_context(viewport={'width':1600, 'height':1000})
        if seed:
            self.context.add_init_script('''(()=>{
              if(location.protocol!=='http:'||sessionStorage.getItem('rugTransformFixture'))return;
              localStorage.setItem('codaWorldProjectV1',JSON.stringify({
                format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
                assets:[],collision:[],strokes:[],savedAt:Date.now()
              }));sessionStorage.setItem('rugTransformFixture','yes');
            })()''')
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failures.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.ready()
        settings_page(self.page, 'screen')
        for _ in range(3):
            if self.page.locator('#fxBtn').inner_text().endswith('Off'):
                break
            self.page.locator('#fxBtn').click()
        close_settings(self.page)
        self.page.evaluate("CodaDeveloperConsole.open('objects')")

    def ready(self):
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready')

    def frames(self):
        self.page.evaluate('''()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))''')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def asset(self):
        return next(asset for asset in self.project()['assets'] if asset['id'] == self.asset_id)

    def import_project(self, project):
        self.page.locator('#devTab-project').click()
        self.page.once('dialog', lambda dialog:dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'rug-transform-fixture.json', 'mimeType':'application/json', 'buffer':json.dumps(project).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Imported complete project")')
        self.page.locator('#devTab-objects').click()
        self.frames()

    def fixture(self, mask=False):
        self.page.locator('#assetPreset').click()
        project = self.project()
        image = self.page.evaluate('''()=>{
          const c=document.createElement('canvas');c.width=c.height=4;const g=c.getContext('2d');
          for(const [x,y,color]of [[0,0,'#ff0000'],[2,0,'#00ff00'],[0,2,'#0000ff'],[2,2,'#ffff00']]){
            g.fillStyle=color;g.fillRect(x,y,2,2);
          }return c.toDataURL('image/png');
        }''')
        asset = project['assets'][-1]
        self.asset_id = asset['id']
        asset.update({'name':'Asymmetric transform prop', 'kind':'image', 'data':image,
                      'x':1000, 'y':600, 'w':100, 'h':80, 'rotation':0,
                      'opacity':100, 'layer':'front', 'anim':'none',
                      'ignoreBackgroundMasks':not mask})
        if mask:
            asset['origin'] = {'name':'region-transform-fixture', 'bounds':[1000,500,4,4], 'sample':[1020,520]}
            project['strokes'] = [{'tool':'erase', 'size':1, 'points':[[950,560]], 'depth':800,
                                   'selection':{'x':950,'y':560,'width':50,'height':80}}]
        self.import_project(project)
        self.page.locator('#assetList').select_option(self.asset_id)
        if self.page.locator('#assetGuides').is_checked():
            self.page.locator('#assetGuides').uncheck()
        self.frames()

    def pixels(self):
        self.frames()
        return self.page.evaluate('''()=>{
          const cam=CodaArcadeQA.camera(),g=document.querySelector('#view').getContext('2d');
          return [[980,580],[1020,580],[980,620],[1020,620]].map(([x,y])=>
            Array.from(g.getImageData(Math.floor((x-cam.x)*cam.zoom),Math.floor((y-cam.y)*cam.zoom),1,1).data));
        }''')

    def test_flip_and_quarter_turn_controls_change_actual_pixels_without_repainting_source(self):
        self.fixture()
        original = self.asset()
        self.assertEqual(self.pixels(), [RED,GREEN,BLUE,YELLOW])
        for button, expected in [
            ('devAssetFlipX',[GREEN,RED,YELLOW,BLUE]),
            ('devAssetFlipY',[YELLOW,BLUE,GREEN,RED]),
            ('devAssetFlipX',[BLUE,YELLOW,RED,GREEN]),
            ('devAssetFlipY',[RED,GREEN,BLUE,YELLOW]),
            ('devAssetRotateRight',[BLUE,RED,YELLOW,GREEN]),
            ('devAssetFlipX',[YELLOW,GREEN,BLUE,RED]),
            ('devAssetRotateLeft',[GREEN,RED,YELLOW,BLUE]),
        ]:
            with self.subTest(button=button):
                self.page.locator('#'+button).click()
                self.assertEqual(self.pixels(), expected)
                asset = self.asset()
                self.assertEqual((asset['x'],asset['y'],asset['w'],asset['h']), (1000,600,100,80))
                self.assertEqual(asset['data'], original['data'], 'Transforms preserve the editable native PNG')

    def test_transform_history_and_portable_saves_preserve_optional_flags(self):
        self.fixture()
        original = self.project()
        self.page.locator('#devAssetFlipX').click()
        flipped = self.project()
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project(), original)
        self.page.locator('#devRedo').click()
        self.assertEqual(self.project(), flipped)
        self.page.locator('#devAssetRotateRight').click()
        expected = self.project()
        self.assertTrue(self.asset()['flipX'])
        self.assertEqual(self.asset()['rotation'], 90)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as pending:
            self.page.locator('#devExport').click()
        self.assertEqual(json.loads(Path(pending.value.path()).read_text()), expected)
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)
        self.page.evaluate("CodaDeveloperConsole.open('project')")
        invalid = copy.deepcopy(expected)
        invalid['assets'][-1]['flipY'] = 'yes'
        self.page.locator('#devImportFile').set_input_files({'name':'invalid-flip.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
        self.assertEqual(self.project(), expected, 'An invalid transform cannot replace a saved scene')

    def test_world_space_background_mask_partition_follows_flip_rotation_and_undo(self):
        self.fixture(mask=True)
        def alphas():
            self.frames()
            return self.page.evaluate('''()=>[[1000,500],[1003,500],[1000,503],[1003,503]].map(([x,y])=>
              CodaArcadeQA.liftedObjectPixel('region-transform-fixture',x,y,'above')[3])''')
        self.assertEqual(alphas(), [0,255,0,255])
        self.page.locator('#devAssetFlipX').click()
        self.assertEqual(alphas(), [255,0,255,0])
        self.page.locator('#devAssetRotateRight').click()
        self.assertEqual(alphas(), [255,255,0,0])
        self.page.locator('#devUndo').click()
        self.assertEqual(alphas(), [255,0,255,0])
        self.page.locator('#devUndo').click()
        self.assertEqual(alphas(), [0,255,0,255], 'Undo invalidates mirrored source-mask partitions')

    def test_off_center_collision_footprint_follows_asset_flips_and_rotation(self):
        self.fixture()
        probes = [[970,635], [1030,635], [1030,665], [985,680]]
        def walkable():
            return self.page.evaluate('points=>points.map(([x,y])=>CodaArcadeQA.walkable(x,y))', probes)
        self.assertEqual(walkable(), [True,True,True,True], 'The fixture starts on open walking cells')
        project = self.project()
        project['assets'][-1].update({'x':1000, 'y':650, 'w':80, 'h':40,
                                      'collider':{'x':-50, 'y':-50, 'w':25, 'h':25}})
        self.import_project(project)
        self.page.locator('#assetList').select_option(self.asset_id)
        self.assertEqual(walkable(), [False,True,True,True])
        self.page.locator('#devAssetFlipX').click()
        self.assertEqual(walkable(), [True,False,True,True])
        self.page.locator('#devAssetFlipY').click()
        self.assertEqual(walkable(), [True,True,False,True])
        self.page.locator('#devAssetRotateRight').click()
        self.assertEqual(walkable(), [True,True,True,False])
        self.assertEqual((self.asset()['x'],self.asset()['y'],self.asset()['w'],self.asset()['h']), (1000,650,80,40))

    def test_place_notes_rug_keeps_existing_layout_and_follows_the_edited_counter(self):
        self.page.locator('#devCatalog').select_option('main_counter')
        self.page.locator('#devLift').click()
        for name, value in [('assetX',1000),('assetY',500),('assetW',722),('assetH',284),('assetRotate',90)]:
            field = self.page.locator('#'+name)
            field.fill(str(value))
            field.press('Tab')
        self.page.locator('#devAssetFlipX').click()
        before = self.project()
        self.assertEqual(len(before['assets']), 1)
        library = self.page.locator('[data-decor-library]')
        if not library.evaluate('(node)=>node.open'):
            library.locator('summary').click()
        self.page.locator('#devAddNotesRug').click()
        self.page.wait_for_function('CodaDeveloperConsole.getProject().assets.length===2')
        after = self.project()
        self.assertEqual({**after, 'assets':after['assets'][:-1]}, before,
                         'Placing the Notes mat preserves every existing layout edit')
        rug = after['assets'][-1]
        self.assertEqual(rug['name'], 'Notes shop arcade rug')
        self.assertEqual(rug['layer'], 'back')
        self.assertTrue(rug.get('flipX'))
        self.assertAlmostEqual(rug['x'],744,delta=.01)
        self.assertAlmostEqual(rug['y'],501,delta=.01)
        self.assertAlmostEqual(rug['w'],720,delta=.01)
        self.assertAlmostEqual(rug['h'],224,delta=.01)
        self.assertEqual(rug['rotation'],90)
        self.assertFalse(bool(rug.get('collider')))

    def test_rug_library_has_eleven_transparent_shapes_and_adds_background_copies(self):
        original = self.project()
        library = self.page.locator('[data-decor-library]')
        library.locator('summary').click()
        self.page.locator('[data-decor-category]').select_option('rug')
        self.assertEqual(self.page.locator('[data-decor-item]:visible').count(), 11)
        self.assertEqual(self.page.evaluate('CodaDecorLibrary.items.length'), 71)
        rugs = self.page.evaluate('''async()=>Promise.all(CodaDecorLibrary.items.filter(item=>item.category==='rug').map(async item=>{
          const image=new Image();image.src='assets/decor/v1/'+item.id+'.png';await image.decode();
          const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
          const g=c.getContext('2d');g.drawImage(image,0,0);const data=g.getImageData(0,0,c.width,c.height).data;
          let clear=false,opaque=false;for(let n=3;n<data.length;n+=4){if(data[n]===0)clear=true;if(data[n]>200)opaque=true;if(clear&&opaque)break;}
          return {id:item.id,width:c.width,height:c.height,clear,opaque};
        }))''')
        self.assertEqual(len(rugs), 11)
        self.assertTrue(all(rug['clear'] and rug['opaque'] and rug['width']>4 and rug['height']>4 for rug in rugs), rugs)
        self.page.locator('[data-decor-item="rug-pixel-round"]').click()
        self.assertEqual(self.project(), original, 'Looking at a rug does not place it')
        self.page.locator('[data-decor-add]').click()
        self.page.wait_for_function('CodaDeveloperConsole.getProject().assets.length===1')
        rug = self.project()['assets'][0]
        self.assertEqual(rug['layer'], 'back')
        self.assertFalse(bool(rug.get('collider')))
        self.assertTrue(rug['data'].startswith('data:image/png;base64,'))
        self.assertLessEqual(rug['w'],120)
        self.assertLessEqual(rug['h'],100)

    def test_fresh_layout_places_only_the_big_rug_in_front_of_the_notes_store(self):
        self.load(seed=False)
        project = self.project()
        self.assertEqual(len(project['assets']), 58)
        names = set(self.page.evaluate("CodaDecorLibrary.items.filter(item=>item.category==='rug').map(item=>item.name)"))
        placed = [asset for asset in project['assets'] if asset['name'] in names]
        self.assertEqual(len(placed), 1)
        rug = placed[0]
        self.assertEqual(rug['name'], 'Notes shop arcade rug')
        self.assertEqual(rug['layer'], 'back')
        self.assertFalse(bool(rug.get('collider')))
        self.assertGreaterEqual(rug['w'],300)
        self.assertGreaterEqual(rug['h'],100)
        counter = next(asset for asset in project['assets'] if asset.get('origin',{}).get('name')=='main_counter')
        self.assertAlmostEqual(rug['x'], counter['x'], delta=20)
        self.assertGreater(rug['y'], counter['y']+counter['h']/2)
        self.assertLess(rug['y']-rug['h']/2, counter['y']+counter['h']/2+50)
        self.assertEqual(len([asset for asset in project['assets'] if asset.get('floodLights')]),1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
