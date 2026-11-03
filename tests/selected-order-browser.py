"""The shared order controls follow the selected prop or live NPC sprite."""
from settings_menu_helpers import settings_page
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright
from world_navigation_helpers import open_settings, close_settings

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class SelectedOrderBrowserTests(unittest.TestCase):
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
        self.context = self.browser.new_context(viewport={'width': 1600, 'height': 1000})
        self.context.add_init_script('''(()=>{
          if(location.protocol!=='http:'||sessionStorage.getItem('selectedOrderFixture'))return;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify({
            format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
            assets:[],collision:[],strokes:[],savedAt:Date.now()
          }));sessionStorage.setItem('selectedOrderFixture','yes');
        })()''')
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.ready()
        settings_page(self.page, 'screen')
        self.page.locator('#fxBtn').click()
        self.page.locator('#fxBtn').click()
        close_settings(self.page)
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
        return self.page.evaluate("id=>id==='scholar'?CodaArcadeQA.scholar():CodaArcadeQA.shopkeepers().find(person=>person.id===id)", character)

    def field(self, name, value):
        target = self.page.locator('#' + name)
        target.fill(str(value))
        target.press('Tab')

    def choose(self, character):
        self.page.locator('#devCharacterSelect').select_option(character)

    def point(self, x, y):
        return self.page.evaluate('''([x,y])=>{const b=document.querySelector('#view').getBoundingClientRect(),cam=CodaArcadeQA.camera();return {x:b.left+(x+.5-cam.x)*cam.zoom*b.width/1672,y:b.top+(y+.5-cam.y)*cam.zoom*b.height/941}}''', [x, y])

    def map_click(self, x, y):
        point, panel = self.point(x, y), self.page.locator('#assetStudio').bounding_box()
        if panel['x'] <= point['x'] <= panel['x'] + panel['width'] and panel['y'] <= point['y'] <= panel['y'] + panel['height']:
            self.page.get_by_label('Move console to the other side', exact=True).click()
        self.page.mouse.click(**self.point(x, y))

    def new_asset(self, x, y, name='Selected order prop'):
        self.page.locator('#assetPreset').click()
        self.page.locator('#assetAnim').select_option('none')
        self.field('assetX', x)
        self.field('assetY', y)
        self.field('assetName', name)
        self.page.locator('#assetLayer').select_option('world')
        return self.project()['assets'][-1]['id']

    def import_project(self, project):
        self.page.locator('#devTab-project').click()
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name': 'order-fixture.json', 'mimeType': 'application/json', 'buffer': json.dumps(project).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Imported complete project")')
        self.page.locator('#devTab-objects').click()

    def test_one_toolbar_follows_asset_dropdown_and_direct_npc_selection(self):
        self.assertTrue(self.page.locator('#assetFront').is_disabled())
        self.assertTrue(self.page.locator('#assetBack').is_disabled())
        asset_id = self.new_asset(1000, 500)
        before = self.project()
        self.assertIn('Selected order prop', self.page.locator('#devOrderSelection').inner_text())
        for character, name in [('scholar', 'The Scholar'), ('riff', 'Riff'), ('pip', 'Pip')]:
            self.choose(character)
            self.assertIn(name, self.page.locator('#devOrderSelection').inner_text())
            for button in ['assetFront', 'assetBack']:
                self.assertTrue(self.page.locator('#' + button).is_enabled())
                self.assertTrue(self.page.locator('#devSelectionOrder #' + button).is_visible())
            self.assertEqual(self.project(), before, 'Changing selection must not create an edit')
        self.page.locator('#assetList').select_option(asset_id)
        self.assertIn('Selected order prop', self.page.locator('#devOrderSelection').inner_text())
        scholar = self.person('scholar')
        self.map_click(scholar['x'], scholar['y'] - 35)
        self.assertIn('The Scholar', self.page.locator('#devOrderSelection').inner_text())
        self.assertEqual(self.page.locator('#assetBack').count(), 1)
        self.assertEqual(self.page.locator('#assetFront').count(), 1)
        self.assertFalse(self.page.locator('#assetFront').evaluate('(button)=>!!button.closest("#assetSelection")'))
        self.assertEqual(self.project(), before)

    def test_each_npc_steps_past_a_prop_without_moving_and_supports_one_undo(self):
        for index, character in enumerate(['scholar', 'riff', 'pip']):
            with self.subTest(character=character):
                y = 650 + index * 10
                self.choose(character)
                self.field('devCharacterX', 1000)
                self.field('devCharacterY', y)
                self.field('devCharacterDepthOffset', 0)
                asset_id = self.new_asset(1000, y - 23, character + ' reference prop')
                prop = next(asset for asset in self.project()['assets'] if asset['id'] == asset_id)
                prop_depth = prop['y'] + prop['h'] / 2
                self.assertEqual(prop_depth, y + 1)
                self.choose(character)
                before, position = self.project(), self.person(character)
                self.page.locator('#assetFront').click()
                moved = self.person(character)
                self.assertGreater(moved['sortY'], prop_depth)
                self.assertEqual((moved['x'], moved['y'], moved['approaches']), (position['x'], position['y'], position['approaches']))
                self.page.locator('#devUndo').click()
                self.assertEqual(self.project(), before, 'One undo restores the whole ordering change')
                self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getState().characters.selected'), character)
                self.page.locator('#devRedo').click()
                self.assertGreater(self.person(character)['sortY'], prop_depth)
                self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getState().characters.selected'), character)
                self.page.locator('#assetBack').click()
                self.assertLess(self.person(character)['sortY'], prop_depth)

    def test_selected_npc_order_survives_save_reload_and_controls_follow_editing_mode(self):
        self.new_asset(1000, 627)
        self.choose('scholar')
        self.field('devCharacterX', 1000)
        self.field('devCharacterY', 650)
        self.field('devCharacterDepthOffset', 0)
        self.page.locator('#assetFront').click()
        expected, sort_y = self.project(), self.person('scholar')['sortY']
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project(), expected)
        self.assertEqual(self.person('scholar')['sortY'], sort_y)
        self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.choose('scholar')
        self.assertTrue(self.page.locator('#assetFront').is_enabled())
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.locator('#devSelectionOrder').is_hidden())
        self.assertEqual(self.project(), expected)
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.locator('#devSelectionOrder').is_visible())
        self.page.locator('#devTab-layers').click()
        self.assertTrue(self.page.locator('#devSelectionOrder').is_hidden())

    def test_boundary_steps_change_layers_without_changing_npc_position(self):
        self.choose('scholar')
        self.field('devCharacterX', 1000)
        self.field('devCharacterY', 650)
        self.field('devCharacterDepthOffset', 941)
        original = self.person('scholar')
        self.page.locator('#assetFront').click()
        self.assertEqual(self.person('scholar')['layer'], 'front')
        self.page.locator('#assetBack').click()
        self.assertEqual(self.person('scholar')['layer'], 'world')
        self.page.locator('#devCharacterLayer').select_option('back')
        self.page.locator('#assetFront').click()
        moved = self.person('scholar')
        self.assertEqual(moved['layer'], 'world')
        self.assertEqual((moved['x'], moved['y'], moved['approaches']), (original['x'], original['y'], original['approaches']))

    def red_fixture(self, layer):
        asset_id = self.new_asset(1000, 603)
        project = self.project()
        red = self.page.evaluate('''()=>{const canvas=document.createElement('canvas');canvas.width=1;canvas.height=1;const ctx=canvas.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,1,1);return canvas.toDataURL('image/png');}''')
        asset = next(asset for asset in project['assets'] if asset['id'] == asset_id)
        asset.update({'kind': 'image', 'data': red, 'w': 100, 'h': 150, 'x': 1000, 'y': 603, 'layer': layer, 'anim': 'none', 'rotation': 0})
        project['characters'] = {'scholar': {'x': 1000, 'y': 650, 'layer': layer}}
        self.import_project(project)
        self.choose('scholar')
        # Ordering changes should be visible in artwork, apart from any selection outline.
        if self.page.locator('#assetGuides').is_checked():
            self.page.locator('#assetGuides').uncheck()

    def non_red_body_pixels(self):
        return self.page.evaluate('''()=>{
          const canvas=document.querySelector('#view'),ctx=canvas.getContext('2d'),cam=CodaArcadeQA.camera(),x=Math.round((982-cam.x)*cam.zoom),y=Math.round((580-cam.y)*cam.zoom),w=Math.round(36*cam.zoom),h=Math.round(62*cam.zoom),pixels=ctx.getImageData(x,y,w,h).data;
          let count=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<245||pixels[i+1]>10||pixels[i+2]>10)count++;return count;
        }''')

    def test_npc_forward_and_backward_change_actual_pixel_occlusion_in_actor_depth(self):
        self.red_fixture('world')
        self.page.wait_for_timeout(100)
        behind = self.non_red_body_pixels()
        self.assertLess(behind, 40, 'The opaque red prop initially covers the Scholar')
        self.page.locator('#assetFront').click()
        self.page.wait_for_timeout(100)
        self.assertGreater(self.non_red_body_pixels(), behind + 100, 'Bring forward must draw the live sprite over the prop')
        self.page.locator('#assetBack').click()
        self.page.wait_for_timeout(100)
        self.assertLess(self.non_red_body_pixels(), 40, 'Send back must restore the red prop over the sprite')

    def test_npc_backward_and_forward_interleave_with_foreground_props(self):
        self.red_fixture('front')
        self.page.wait_for_timeout(100)
        in_front = self.non_red_body_pixels()
        self.assertGreater(in_front, 100, 'Default foreground NPC appears over the foreground prop')
        self.page.locator('#assetBack').click()
        self.page.wait_for_timeout(100)
        self.assertLess(self.non_red_body_pixels(), 40, 'Send back must interleave the NPC behind the foreground prop')
        self.page.locator('#assetFront').click()
        self.page.wait_for_timeout(100)
        self.assertGreater(self.non_red_body_pixels(), 100)


if __name__ == '__main__':
    unittest.main(verbosity=2)
