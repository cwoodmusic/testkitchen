"""Stationary live NPC sprites and prop ordering use portable editor data."""
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


class WorldCharacterPlacementTests(unittest.TestCase):
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
          if(location.protocol!=='http:'||sessionStorage.getItem('characterFixtureSeeded'))return;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify({
            format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
            assets:[],collision:[],strokes:[],savedAt:Date.now()
          }));sessionStorage.setItem('characterFixtureSeeded','yes');
        })()''')
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.ready()
        self.page.evaluate("CodaDeveloperConsole.open('objects')")

    def tearDown(self):
        errors = self.errors[:]
        self.context.close()
        self.assertEqual(errors, [], 'Browser script errors')

    def ready(self):
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def person(self, character):
        return self.page.evaluate('''id=>id==='scholar'?CodaArcadeQA.scholar():CodaArcadeQA.shopkeepers().find(person=>person.id===id)''', character)

    def choose(self, character):
        self.page.locator('#devCharacterSelect').select_option(character)

    def field(self, name, value):
        target = self.page.locator('#' + name)
        target.fill(str(value))
        target.press('Tab')

    def point(self, x, y):
        return self.page.evaluate('''([x,y])=>{const b=document.querySelector('#view').getBoundingClientRect(),cam=CodaArcadeQA.camera();return {x:b.left+(x+.5-cam.x)*cam.zoom*b.width/1672,y:b.top+(y+.5-cam.y)*cam.zoom*b.height/941}}''', [x,y])

    def uncover(self, x, y):
        point, panel = self.point(x,y), self.page.locator('#assetStudio').bounding_box()
        if panel['x'] <= point['x'] <= panel['x'] + panel['width'] and panel['y'] <= point['y'] <= panel['y'] + panel['height']:
            self.page.get_by_label('Move console to the other side', exact=True).click()

    def drag_character(self, character, dx, dy):
        before = self.person(character)
        self.uncover(before['x'], before['y']-35)
        self.page.mouse.move(**self.point(before['x'],before['y']-35))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(before['x']+dx,before['y']-35+dy), steps=6)

    def new_asset(self, x, y, layer='world'):
        self.page.locator('#assetPreset').click()
        self.page.locator('#assetAnim').select_option('none')
        self.field('assetX',x)
        self.field('assetY',y)
        self.page.locator('#assetLayer').select_option(layer)
        return self.project()['assets'][-1]['id']

    def asset(self, asset_id):
        return next(asset for asset in self.project()['assets'] if asset['id'] == asset_id)

    @staticmethod
    def depth(asset):
        return asset['y'] + asset['h']/2 + asset.get('depthOffset',0)

    def test_dropdown_and_direct_sprite_selection_do_not_mutate_project(self):
        original = self.project()
        for character in ['scholar','riff','pip']:
            self.choose(character)
            self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getState().characters.selected'),character)
            self.assertEqual(self.project(),original)
        scholar = self.person('scholar')
        self.uncover(scholar['x'],scholar['y']-35)
        self.page.mouse.click(**self.point(scholar['x'],scholar['y']-35))
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getState().characters.selected'),'scholar')
        self.assertEqual(self.project(),original)
        self.assertTrue(self.page.locator('#devUndo').is_disabled())
        self.choose('pip')
        self.page.locator('[data-world-character="pixels"]').click()
        self.page.wait_for_function("CodaDeveloperConsole.getState().artwork?.target==='character.pip.down'")
        self.assertEqual(self.project(),original,'Opening a specific NPC sprite must not author a pixel edit')

    def test_dragging_each_sprite_moves_interactions_and_commits_one_undo_step(self):
        original = self.project()
        for character in ['scholar','riff','pip']:
            with self.subTest(character=character):
                self.choose(character)
                before = self.person(character)
                self.drag_character(character,80,60)
                preview = self.person(character)
                self.assertEqual((preview['x'],preview['y']),(before['x']+80,before['y']+60))
                self.assertEqual(self.project(),original,'Live dragging must remain a preview until release')
                self.page.mouse.up()
                moved = self.person(character)
                self.assertEqual(self.project()['characters'][character],{'x':before['x']+80,'y':before['y']+60})
                self.assertEqual(moved['approaches'],[{'x':point['x']+80,'y':point['y']+60} for point in before['approaches']])
                self.page.locator('#devUndo').click()
                self.assertEqual(self.project(),original,'One undo must restore the complete drag')
                self.assertEqual(self.person(character)['approaches'],before['approaches'])

    def test_moving_and_hiding_original_furniture_leaves_all_three_npcs_independent(self):
        before = {character:self.person(character) for character in ['scholar','riff','pip']}
        for name in ['lounge_sofa','main_counter','boutique_counter']:
            self.page.locator('#devCatalog').select_option(name)
            self.page.locator('#devLift').click()
            self.field('assetX',1000)
            self.field('assetY',700)
            self.page.locator('#assetVisible').uncheck()
        for character in before:
            person = self.person(character)
            self.assertEqual((person['x'],person['y'],person['visible'],person['approaches']),
                             (before[character]['x'],before[character]['y'],True,before[character]['approaches']))

    def test_character_controls_export_reload_and_invalid_import_are_portable(self):
        self.choose('scholar')
        self.field('devCharacterX',900)
        self.field('devCharacterY',400)
        self.field('devCharacterDepthOffset',75)
        self.page.locator('#devCharacterLayer').select_option('front')
        self.page.locator('#devCharacterFacing').select_option('left')
        self.page.locator('#devCharacterVisible').uncheck()
        self.assertEqual(self.person('scholar')['facing'],'left')
        self.assertFalse(self.person('scholar')['visible'])
        self.assertGreater(self.person('scholar')['sortY'],941)
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as downloaded:
            self.page.locator('#devExport').click()
        exported = json.loads(Path(downloaded.value.path()).read_text())
        expected = self.project()
        self.assertEqual(exported,expected)
        for patch in [{'x':-1},{'layer':'invalid'},{'visible':'true'},{'unknown':1}]:
            invalid = json.loads(json.dumps(exported))
            invalid['characters']['scholar'].update(patch)
            self.page.locator('#devImportFile').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
            self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
            self.assertEqual(self.project(),expected)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project()['characters'],expected['characters'])
        self.assertEqual((self.person('scholar')['x'],self.person('scholar')['y']),(900,400))
        self.assertFalse(self.person('scholar')['visible'])
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.choose('scholar')
        self.page.locator('[data-world-character="reset"]').click()
        self.assertEqual((self.person('scholar')['x'],self.person('scholar')['y']),(298,213))
        self.assertEqual(self.person('scholar')['facing'],'left','Reset position keeps appearance and layer edits')

    def test_relative_order_places_props_either_side_of_other_props_and_npcs(self):
        first = self.new_asset(900,500)
        second = self.new_asset(1000,700)
        self.page.locator('#assetList').select_option(first)
        self.page.locator('#devOrderTarget').select_option(second)
        self.page.locator('#devOrderInFront').click()
        self.assertGreater(self.depth(self.asset(first)),self.depth(self.asset(second)))
        self.page.locator('#devOrderBehind').click()
        self.assertLess(self.depth(self.asset(first)),self.depth(self.asset(second)))
        self.page.locator('#devOrderTarget').select_option('character.scholar')
        self.page.locator('#devOrderInFront').click()
        self.assertGreater(self.depth(self.asset(first)),self.person('scholar')['sortY'])
        self.page.locator('#devOrderBehind').click()
        self.assertLess(self.depth(self.asset(first)),self.person('scholar')['sortY'])
        original = self.depth(self.asset(first))
        self.field('devAssetDepth',100)
        self.assertEqual(self.asset(first)['depthOffset'],100)
        self.page.locator('#devUndo').click()
        self.assertEqual(self.depth(self.asset(first)),original)

    def test_bring_forward_send_back_step_through_actual_world_depth(self):
        first = self.new_asset(950,500)
        self.new_asset(1000,700)
        self.page.locator('#assetList').select_option(first)
        original = self.depth(self.asset(first))
        self.page.locator('#assetFront').click()
        self.assertGreater(self.depth(self.asset(first)),original,'Bring forward must change effective sorting depth')
        forward = self.depth(self.asset(first))
        self.page.locator('#assetBack').click()
        self.assertLess(self.depth(self.asset(first)),forward,'Send back must change effective sorting depth')


if __name__ == '__main__':
    unittest.main(verbosity=2)
