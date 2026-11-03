"""The canvas stays large while controls remain reachable in every orientation."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('layout_art_fixture', Path(__file__).with_name('artwork-editor-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class ArtworkLayoutTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ArtworkEditorBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ArtworkEditorBrowserTests.tearDownClass.__func__)
    for name in ['setUp', 'tearDown', 'editor', 'state', 'host', 'control', 'ready', 'frames',
                 'load_fixture', 'load_world', 'point', 'center', 'select', 'select_rectangle',
                 'zoom', 'colour', 'paint', 'project']:
        locals()[name] = getattr(fixture.ArtworkEditorBrowserTests, name)

    def canvas_share(self, min_width, min_height):
        box = self.control('canvas').bounding_box()
        viewport = self.page.viewport_size
        self.assertGreater(box['width'], viewport['width'] * min_width)
        self.assertGreater(box['height'], viewport['height'] * min_height)
        self.assertGreaterEqual(box['x'], 0)
        self.assertGreaterEqual(box['y'], 0)
        self.assertLessEqual(box['x'] + box['width'], viewport['width'] + 1)
        self.assertLessEqual(box['y'] + box['height'], viewport['height'] + 1)
        return box

    def image_center(self):
        state = self.state()
        return [(state['viewport'][axis] / 2 - state['pan'][coordinate]) / state['zoom']
                for axis, coordinate in [('width', 'x'), ('height', 'y')]]

    def test_desktop_sidebar_is_compact_and_hiding_preserves_the_editing_view(self):
        self.page.set_viewport_size({'width':1440, 'height':900})
        self.load_fixture();self.control('expand').click();self.frames(5)
        self.assertTrue(self.state()['controlsVisible'])
        before = self.canvas_share(.75, .80)
        self.select('asset.large');self.zoom(2);self.center(1000,500)
        self.select_rectangle((998,498),(1002,502))
        selected = self.state()['selection'];zoom = self.state()['zoom'];center = self.image_center()
        self.control('controls-toggle').click();self.frames()
        self.assertFalse(self.state()['controlsVisible'])
        self.assertEqual(self.control('controls-toggle').get_attribute('aria-expanded'), 'false')
        after = self.canvas_share(.95, .80)
        self.assertGreater(after['width'], before['width'] + 190)
        self.assertEqual(self.state()['selection'], selected)
        self.assertEqual(self.state()['zoom'], zoom)
        for actual, expected in zip(self.image_center(), center):self.assertAlmostEqual(actual, expected, delta=.5)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.control('controls-toggle').click();self.frames()
        self.assertTrue(self.state()['controlsVisible'])
        self.assertEqual(self.state()['selection'], selected)
        self.page.screenshot(path='/tmp/coda-pixel-compact-desktop.png')

    def test_phone_drawer_starts_closed_and_edits_work_with_controls_hidden(self):
        self.page.set_viewport_size({'width':390, 'height':844})
        self.load_world();self.page.evaluate("CodaDeveloperConsole.open('artwork')");self.ready()
        self.assertFalse(self.state()['controlsVisible'])
        before = self.canvas_share(.95, .78)
        self.control('controls-toggle').click();self.frames()
        self.assertTrue(self.state()['controlsVisible'])
        sidebar = self.host().locator('.artwork-sidebar').bounding_box()
        self.assertLessEqual(sidebar['width'], 300)
        self.assertEqual(self.control('canvas').bounding_box(), before,
                         'Opening the phone drawer must not shrink the editing canvas')
        untouched = self.project()
        self.control('controls-scrim').click(position={'x':before['width']-10, 'y':20})
        self.assertFalse(self.state()['controlsVisible'])
        self.assertTrue(self.control('controls-toggle').evaluate('el=>el===document.activeElement'))
        self.assertEqual(self.project(), untouched, 'Dismissing controls must not paint behind the drawer')
        self.control('controls-toggle').click()
        self.zoom(64);self.colour('#aabbccff');original = self.project()
        self.control('controls-toggle').click();self.frames()
        self.paint(1252,650)
        self.assertNotEqual(self.project(), original)
        self.control('controls-toggle').click();self.control('undo').click();self.ready()
        self.assertEqual(self.project(), original)
        self.control('fit').click()
        self.control('controls-toggle').click();self.frames()
        self.canvas_share(.95, .78)
        self.page.screenshot(path='/tmp/coda-pixel-compact-phone.png')
        self.control('exit').click()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().open'))

    def test_landscape_controls_scroll_without_taking_half_the_canvas(self):
        self.page.set_viewport_size({'width':844, 'height':390})
        self.load_fixture();self.control('expand').click();self.frames(5)
        self.assertTrue(self.state()['controlsVisible'])
        self.canvas_share(.70, .70)
        self.control('tool').select_option('smooth')
        for control in [self.control('hex'), self.page.get_by_label('Smoothing brush radius',exact=True),
                        self.page.get_by_label('Smoothing strength',exact=True), self.control('export')]:
            control.scroll_into_view_if_needed()
            bounds = control.bounding_box()
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertGreaterEqual(bounds['y'], 0)
            self.assertLessEqual(bounds['x'] + bounds['width'], 845)
            self.assertLessEqual(bounds['y'] + bounds['height'], 391)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth > innerWidth'))
        self.control('controls-toggle').click();self.frames()
        self.canvas_share(.95, .70)
        self.page.screenshot(path='/tmp/coda-pixel-compact-landscape.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
