"""Selections fill foreground/background coverage through the shipped world UI."""
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


class WorldLayerSelectionTests(unittest.TestCase):
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
          if(location.protocol!=='http:'||sessionStorage.getItem('layerSelectionFixtureSeeded'))return;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify({
            format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
            assets:[],collision:[],strokes:[],savedAt:Date.now()
          }));sessionStorage.setItem('layerSelectionFixtureSeeded','yes');
        })()''')
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.ready()
        self.page.evaluate("CodaDeveloperConsole.open('layers')")

    def tearDown(self):
        errors = self.errors[:]
        self.context.close()
        self.assertEqual(errors, [], 'Browser script errors')

    def ready(self):
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def state(self):
        return self.page.evaluate('CodaDeveloperConsole.getState().layerSelection')

    def point(self, x, y):
        # Aim at the centre of a world pixel, independent of canvas CSS scaling.
        return self.page.evaluate('''([x,y])=>{const b=document.querySelector('#view').getBoundingClientRect(),cam=CodaArcadeQA.camera();return {x:b.left+(x+.5-cam.x)*cam.zoom*b.width/1672,y:b.top+(y+.5-cam.y)*cam.zoom*b.height/941}}''', [x,y])

    def click_pixel(self, x, y):
        self.page.mouse.click(**self.point(x,y))

    def drag(self, start, end, button='left'):
        self.page.mouse.move(**self.point(*start))
        self.page.mouse.down(button=button)
        self.page.mouse.move(**self.point(*end), steps=5)
        self.page.mouse.up(button=button)

    def select_rectangle(self, start=(1000,480), end=(1020,500)):
        if not self.state()['selecting']:
            self.page.locator('#devLayerSelect').click()
        self.page.locator('#devLayerSelectionShape').select_option('rectangle')
        self.drag(start,end)
        return self.state()['selection']

    def owner(self, x, y):
        return self.page.evaluate('([x,y])=>CodaArcadeQA.layerPixelOwner(x,y)', [x,y])

    def test_double_click_finishes_manual_shape_once_without_filling_it(self):
        original = self.project()
        self.page.locator('#devLayerSelectionShape').select_option('manual')
        self.click_pixel(1000, 480)
        self.page.mouse.dblclick(**self.point(1020, 480))
        self.assertIsNone(self.state()['selection'], 'Two corners cannot close an area')
        self.assertEqual(self.state()['draft'], [[1000, 480], [1020, 480]])
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_disabled())
        self.click_pixel(1020, 500)
        self.page.mouse.dblclick(**self.point(1000, 500))
        expected = {'x':1000, 'y':480, 'width':21, 'height':21,
                    'points':[[1000,480], [1020,480], [1020,500], [1000,500]]}
        self.assertEqual(self.state()['selection'], expected)
        self.assertIsNone(self.state()['draft'], 'The second click must not start another draft')
        self.assertEqual(self.project(), original, 'Finishing a selection does not paint or add history')
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_enabled())
        self.page.locator('#devLayerFillSelection').click()
        self.assertEqual(len(self.project()['strokes']), 1)
        self.assertEqual(self.project()['strokes'][0]['selection'], expected)

    def test_rectangle_selection_is_preview_only_then_fills_exact_inclusive_pixels(self):
        original = self.project()
        outside = self.owner(1021,490)
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_disabled())
        selection = self.select_rectangle()
        self.assertEqual(selection, {'x':1000, 'y':480, 'width':21, 'height':21})
        self.assertEqual(self.project(), original, 'Selecting must not edit artwork or history')
        self.assertFalse(self.page.locator('#devLayerFillSelection').is_disabled())
        self.page.locator('#devLayerFillSelection').click()
        stroke = self.project()['strokes'][-1]
        self.assertEqual(stroke['selection'], selection)
        self.assertEqual(stroke['tool'], 'paint')
        self.assertTrue(stroke['foreground'])
        self.assertGreaterEqual(self.owner(1000,480), 0)
        self.assertGreaterEqual(self.owner(1010,490), 0)
        self.assertGreaterEqual(self.owner(1020,500), 0)
        self.assertEqual(self.owner(1021,490), outside)
        self.assertEqual(len(self.project()['strokes']), 1, 'One selection fill is one portable stroke')

    def test_background_fill_and_history_restore_the_full_selected_mask(self):
        self.select_rectangle()
        self.page.locator('#devLayerFillSelection').click()
        painted_owner = self.owner(1005,490)
        self.page.locator('#devLayerTool').select_option('erase')
        self.page.locator('#devLayerFillSelection').click()
        self.assertEqual(self.project()['strokes'][-1]['tool'], 'erase')
        self.assertEqual(self.owner(1000,480), -2)
        self.assertEqual(self.owner(1020,500), -2)
        self.page.locator('#devUndo').click()
        self.assertEqual(len(self.project()['strokes']), 1)
        self.assertEqual(self.owner(1005,490), painted_owner)
        self.page.locator('#devRedo').click()
        self.assertEqual(len(self.project()['strokes']), 2)
        self.assertEqual(self.owner(1005,490), -2)

    def test_manual_concave_selection_excludes_its_notch_and_keeps_depth_placement(self):
        self.page.locator('#devLayerSelect').click()
        self.page.locator('#devLayerSelectionShape').select_option('manual')
        vertices = [[1000,480],[1020,480],[1020,486],[1006,486],[1006,500],[1000,500]]
        outside = self.owner(1015,495)
        for point in vertices:
            self.click_pixel(*point)
        self.assertEqual(self.project()['strokes'], [])
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_disabled())
        self.page.locator('#devLayerFinishSelection').click()
        self.assertEqual(self.state()['selection']['points'], vertices)
        self.page.locator('#devLayerPlacement').select_option('depth')
        self.page.locator('#devLayerDepth').fill('30')
        self.page.locator('#devLayerDepth').press('Tab')
        self.page.locator('#devLayerFillSelection').click()
        stroke = self.project()['strokes'][-1]
        self.assertNotEqual(stroke.get('foreground'), True)
        self.assertIsInstance(stroke['depth'], (int,float))
        self.assertGreaterEqual(self.owner(1015,483), 0)
        self.assertGreaterEqual(self.owner(1006,499), 0, 'The polygon edge owns its pixel centres')
        self.assertGreaterEqual(self.owner(1002,495), 0)
        self.assertEqual(self.owner(1015,495), outside, 'A concave fill must not fill its bounding box')
        self.assertEqual(len(self.project()['strokes']), 1)

    def test_selection_fill_round_trips_and_invalid_selection_import_is_atomic(self):
        self.select_rectangle()
        self.page.locator('#devLayerFillSelection').click()
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as downloaded:
            self.page.locator('#devExport').click()
        exported = json.loads(Path(downloaded.value.path()).read_text())
        expected = self.project()
        self.assertEqual(exported, expected)
        invalid = json.loads(json.dumps(exported))
        invalid['strokes'][0]['selection']['width'] = 0
        self.page.locator('#devImportFile').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
        self.assertEqual(self.project(), expected)
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'selection.json','mimeType':'application/json','buffer':json.dumps(exported).encode()})
        self.page.wait_for_function('!document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
        self.assertEqual(self.project()['strokes'], expected['strokes'])
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.ready()
        self.assertEqual(self.project()['strokes'], expected['strokes'])
        self.assertGreaterEqual(self.owner(1010,490), 0)

    def test_pan_preserves_selection_and_escape_cancels_only_the_pending_shape(self):
        selection = self.select_rectangle()
        original = self.project()
        self.drag((1100,550),(1120,570),button='right')
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.project(), original)
        self.page.locator('#devLayerSelectionShape').select_option('manual')
        self.click_pixel(1040,480)
        self.click_pixel(1050,480)
        self.assertTrue(self.state()['draft'])
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_disabled())
        self.page.keyboard.press('Escape')
        self.assertIsNone(self.state()['draft'])
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.project(), original)
        self.assertTrue(self.page.locator('#assetStudio').is_visible())
        self.page.locator('#devLayerClearSelection').click()
        self.assertIsNone(self.state()['selection'])
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_disabled())
        self.assertEqual(self.project(), original)

    def test_pending_rectangle_cannot_fill_and_escape_keeps_the_committed_selection(self):
        selection = self.select_rectangle()
        original = self.project()
        self.page.mouse.move(**self.point(1040,480))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(1060,500), steps=3)
        self.assertTrue(self.state()['dragging'])
        self.assertTrue(self.state()['draft'])
        self.assertEqual(self.state()['selection'], selection)
        self.assertTrue(self.page.locator('#devLayerFillSelection').is_disabled())
        self.assertEqual(self.project(), original)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertIsNone(self.state()['draft'])
        self.assertFalse(self.state()['dragging'])
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.project(), original)
        self.assertFalse(self.page.locator('#devLayerFillSelection').is_disabled())

    def test_right_drag_pan_keeps_manual_corners_and_new_points_use_the_moved_camera(self):
        original = self.project()
        for _ in range(4):
            self.page.locator('#devZoomIn').click()
        self.page.locator('#devLayerSelectionShape').select_option('manual')
        self.click_pixel(1000, 480)
        self.click_pixel(1020, 480)
        self.assertEqual(self.state()['draft'], [[1000, 480], [1020, 480]])
        camera = self.page.evaluate('CodaArcadeQA.camera()')
        self.drag((1100, 550), (1080, 530), button='right')
        moved = self.page.evaluate('CodaArcadeQA.camera()')
        self.assertGreater(abs(moved['x'] - camera['x']) + abs(moved['y'] - camera['y']), 5,
                           'The gesture must actually pan the zoomed camera')
        self.assertEqual(self.state()['draft'], [[1000, 480], [1020, 480]],
                         'Panning must retain the unfinished manual selection')
        self.assertEqual(self.project(), original)
        self.click_pixel(1020, 500)
        self.click_pixel(1000, 500)
        self.page.locator('#devLayerFinishSelection').click()
        selection = self.state()['selection']
        self.assertEqual(selection['points'], [[1000, 480], [1020, 480], [1020, 500], [1000, 500]])
        self.assertEqual((selection['x'], selection['y'], selection['width'], selection['height']), (1000, 480, 21, 21))
        self.page.locator('#devLayerFillSelection').click()
        self.assertEqual(self.project()['strokes'][-1]['selection'], selection)
        self.assertGreaterEqual(self.owner(1010, 490), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
