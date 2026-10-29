"""Piano Lab developer entry and the real collision/layer workflow.

Uses disposable browsers and local source routed at the public origin. The
permission case changes only the supplied capability callback; no Firebase,
real account, or existing save is read.
"""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location(
    'piano_room_editor_fixture', Path(__file__).with_name('room-developer-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class PianoDeveloperEntryTests(unittest.TestCase):
    setUpClass = classmethod(fixture.RoomDeveloperTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.RoomDeveloperTests.tearDownClass.__func__)
    setUp = fixture.RoomDeveloperTests.setUp
    tearDown = fixture.RoomDeveloperTests.tearDown
    load = fixture._world.WorldBrowserCase.load
    state = fixture.RoomDeveloperTests.state
    project = fixture.RoomDeveloperTests.project
    room_state = fixture.RoomDeveloperTests.room_state
    panel = fixture.RoomDeveloperTests.panel
    action = fixture.RoomDeveloperTests.action
    tab = fixture.RoomDeveloperTests.tab
    canvas = fixture.RoomDeveloperTests.canvas
    enter = fixture.RoomDeveloperTests.enter
    point = fixture.RoomDeveloperTests.point
    drag = fixture.RoomDeveloperTests.drag
    pixel = fixture.RoomDeveloperTests.pixel

    def route_checkout(self, route):
        if urlparse(route.request.url).path == '/coda-arcade/piano-lab.js':
            capture = ''';(()=>{
              const create=window.createCodaPianoLab;
              window.__pianoDevelopAllowed=true;
              window.createCodaPianoLab=options=>{
                const allowed=options.canDevelop;
                options.canDevelop=()=>__pianoDevelopAllowed&&(!allowed||allowed());
                window.__entryPiano=create(options);return __entryPiano;
              };
            })();'''
            return route.fulfill(status=200, content_type='text/javascript',
                                 body=(ROOT / 'piano-lab.js').read_text() + capture)
        return fixture._world.WorldBrowserCase.route_checkout(self, route)

    def developer(self):
        return self.page.locator('[data-room-dev-open="piano"]')

    def frames(self, milliseconds=64):
        self.page.clock.run_for(milliseconds)

    def assert_editor(self, tab='objects'):
        state = self.state('piano')
        self.assertTrue(state['open'])
        self.assertTrue(state['editing'])
        self.assertEqual(state['tab'], tab)
        self.assertTrue(self.room_state('piano')['open'])
        self.assertFalse(self.room_state('piano')['menuOpen'])
        self.assertFalse(self.room_state('piano')['dialogueOpen'])
        self.assertFalse(self.page.locator('#assetStudio').is_visible(),
                         'Piano editing must not open the arcade underneath')

    def close_developer(self):
        self.action('piano', 'close').click()
        self.frames(32)
        self.assertFalse(self.state('piano')['open'])

    def test_header_opens_the_complete_room_console_without_a_menu(self):
        self.enter('piano')
        self.assertEqual(self.developer().count(), 1)
        self.assertTrue(self.developer().is_visible())
        self.assertTrue(self.developer().evaluate(
            'node=>!!node.closest(".piano-room-heading-actions")'))
        self.assertFalse(self.room_state('piano')['menuOpen'])
        self.developer().click()
        self.frames()
        self.assert_editor()
        tabs = self.panel('piano').locator('[data-room-tab]').all_text_contents()
        self.assertEqual(tabs, ['Objects', 'Collision', 'Layers', 'Sprites', 'Artwork', 'Project'])
        self.assertEqual(self.developer().get_attribute('aria-expanded'), 'true')
        controlled = self.developer().get_attribute('aria-controls')
        self.assertTrue(self.page.locator('#' + controlled).is_visible())
        self.developer().click()
        self.assertFalse(self.state('piano')['open'])
        self.assertEqual(self.developer().get_attribute('aria-expanded'), 'false')
        self.assertTrue(self.room_state('piano')['open'])

    def test_f2_dismisses_the_menu_and_chopin_dialogue_before_editing(self):
        self.enter('piano')
        original = self.project('piano')
        self.page.locator('#pianoMenuButton').click()
        self.assertTrue(self.room_state('piano')['menuOpen'])
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'pianoLesson')
        self.page.keyboard.press('F2')
        self.frames()
        self.assert_editor()
        self.close_developer()
        self.page.locator('#pianoMenuButton').click()
        self.page.locator('#pianoTalkChopin').click()
        self.assertTrue(self.room_state('piano')['dialogueOpen'])
        self.page.keyboard.press('F2')
        self.frames()
        self.assert_editor()
        self.assertEqual(self.room_state('piano')['voiceCount'], 0)
        self.assertFalse(self.room_state('piano')['recording'])
        self.assertFalse(self.room_state('piano')['playing'])
        self.assertEqual(self.project('piano'), original)

    def test_direct_tools_and_global_proxy_keep_the_piano_camera(self):
        self.enter('piano')
        self.canvas('piano').focus()
        self.page.keyboard.press('c')
        self.frames()
        self.assert_editor('collision')
        self.action('piano', 'zoom-in').click()
        self.action('piano', 'zoom-in').click()
        camera = self.state('piano')['camera']
        self.assertGreater(camera['zoom'], 1)
        self.close_developer()
        self.canvas('piano').focus()
        self.page.keyboard.press('Shift+L')
        self.frames()
        self.assert_editor('layers')
        self.assertEqual(self.state('piano')['camera'], camera)
        self.close_developer()
        self.page.locator('#pianoMenuButton').click()
        self.page.evaluate('CodaDeveloperConsole.open("collision")')
        self.frames()
        self.assert_editor('collision')
        self.assertEqual(self.state('piano')['camera'], camera)
        self.canvas('piano').focus()
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state('piano')['open'])
        self.assertTrue(self.room_state('piano')['open'])

    def test_visible_console_paints_real_collision_and_foreground_and_exports_both(self):
        self.enter('piano')
        self.developer().click()
        self.tab('piano', 'collision')
        original_collision=dict(self.project('piano')['collision'])
        wall={row*100+55 for row in range(25,59)}
        self.drag(self.point('piano', 555, 255), self.point('piano', 555, 585))
        blocked_cells=dict(self.project('piano')['collision'])
        self.assertTrue(all(blocked_cells.get(index)==0 for index in wall))
        self.assertEqual({index:value for index,value in blocked_cells.items() if index not in wall},
                         {index:value for index,value in original_collision.items() if index not in wall})
        self.action('piano', 'playtest').click()
        self.canvas('piano').focus()
        self.page.keyboard.down('d')
        self.frames(1000)
        self.page.keyboard.up('d')
        blocked = self.room_state('piano')['player']
        self.assertGreater(blocked['x'], 535)
        self.assertLess(blocked['x'], 550, 'Painted red cells must stop actual walking')
        self.action('piano', 'playtest').click()
        self.panel('piano').locator('[data-room-field="collision-tool"]').select_option('open')
        self.drag(self.point('piano', 555, 255), self.point('piano', 555, 585))
        opened_cells=dict(self.project('piano')['collision'])
        self.assertTrue(all(opened_cells.get(index)==1 for index in wall))
        self.assertEqual({index:value for index,value in opened_cells.items() if index not in wall},
                         {index:value for index,value in original_collision.items() if index not in wall})
        self.action('piano', 'playtest').click()
        self.canvas('piano').focus()
        self.page.keyboard.down('d')
        self.frames(500)
        self.page.keyboard.up('d')
        self.assertGreater(self.room_state('piano')['player']['x'], 600)
        self.action('piano', 'playtest').click()
        for overlay in ('collision', 'layers'):
            if self.state('piano')['overlays'][overlay]:
                self.action('piano', 'show-' + overlay).click()
        player = self.room_state('piano')['player']
        x, y = round(player['x']), round(player['y'] - 30)
        before = self.pixel('piano', x, y)
        original_strokes=self.project('piano')['strokes']
        self.tab('piano', 'layers')
        self.panel('piano').locator('[data-room-field="layer-size"]').select_option('32')
        self.page.mouse.click(**self.point('piano', x, y))
        self.frames()
        self.action('piano', 'show-layers').click()
        self.frames()
        self.assertNotEqual(self.pixel('piano', x, y), before,
                            'A foreground brush must cover the real character')
        saved = self.project('piano')
        self.assertEqual(saved['strokes'][-1]['tool'], 'paint')
        self.action('piano', 'undo').click()
        self.assertEqual(self.project('piano')['strokes'], original_strokes)
        self.action('piano', 'redo').click()
        self.assertEqual(self.project('piano'), saved)
        self.tab('piano', 'project')
        self.action('piano', 'save').click()
        with self.page.expect_download() as download:
            self.action('piano', 'export').click()
        exported = json.loads(Path(download.value.path()).read_text())
        self.assertEqual(exported['room'], 'piano')
        self.assertEqual(exported['collision'], saved['collision'])
        self.assertEqual(exported['strokes'], saved['strokes'])
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().rooms.piano'), saved)

    def test_header_console_and_fullscreen_fit_small_touch_screens_phone(self):
        self.enter('piano')
        for size in ({'width':320, 'height':780}, {'width':390, 'height':844},
                     {'width':844, 'height':390}):
            with self.subTest(size=size):
                self.page.set_viewport_size(size)
                self.frames(96)
                heading = self.page.locator('.piano-room-heading')
                self.assertLessEqual(heading.evaluate('node=>node.scrollWidth'),
                                     heading.evaluate('node=>node.clientWidth') + 1)
                for button in heading.locator('button:visible').all():
                    box = button.bounding_box()
                    self.assertGreaterEqual(box['height'], 44)
                    self.assertGreaterEqual(box['x'], 0)
                    self.assertLessEqual(box['x'] + box['width'], size['width'] + 1)
                self.developer().tap()
                self.frames()
                self.assert_editor()
                for tool in ('show-collision', 'show-layers', 'zoom-in'):
                    target = self.action('piano', tool)
                    target.scroll_into_view_if_needed()
                    self.assertTrue(target.is_visible())
                    self.assertGreaterEqual(target.bounding_box()['height'], 44)
                self.close_developer()
        self.page.locator('#pianoFullscreen').tap()
        self.frames()
        self.page.wait_for_function('document.fullscreenElement===document.querySelector("#pianoroom")')
        self.developer().tap()
        self.frames()
        self.assert_editor()
        self.assertTrue(self.panel('piano').evaluate(
            'node=>document.fullscreenElement.contains(node)'))
        self.panel('piano').screenshot(path='/tmp/piano-developer-entry-mobile.png')

    def test_permission_callback_blocks_buttons_shortcuts_and_global_proxy(self):
        self.page.evaluate('__pianoDevelopAllowed=false')
        self.enter('piano')
        original = self.project('piano')
        self.developer().dispatch_event('click')
        self.frames()
        self.assertFalse(self.state('piano')['open'])
        self.canvas('piano').focus()
        for shortcut in ('F2', 'c', 'Shift+L'):
            self.page.keyboard.press(shortcut)
            self.frames()
            self.assertFalse(self.state('piano')['open'], shortcut)
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.open("layers")'))
        self.assertFalse(self.page.evaluate('__entryPiano.openDeveloperConsole("collision")'))
        self.page.evaluate('CodaArcadeQA.roomEditor("piano").open("layers")')
        self.assertFalse(self.state('piano')['open'])
        self.assertEqual(self.project('piano'), original)


if __name__ == '__main__':
    unittest.main(verbosity=2)
