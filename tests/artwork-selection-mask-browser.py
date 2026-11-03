"""Selections protect outside pixels without changing exported artwork."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('selection_mask_fixture', Path(__file__).with_name('artwork-smoothing-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class SelectionMaskTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ArtworkSmoothingTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ArtworkSmoothingTests.tearDownClass.__func__)
    for name in ['setUp', 'tearDown', 'editor', 'state', 'host', 'control', 'ready', 'frames',
                 'load_fixture', 'point', 'center', 'select', 'select_rectangle', 'step_source',
                 'pixel', 'click', 'drag']:
        locals()[name] = getattr(fixture.ArtworkSmoothingTests, name)

    def colour(self, value):
        self.control('hex').fill(value)
        self.control('hex').press('Tab')

    def displayed_pixel(self, x, y):
        return self.control('canvas').evaluate('''(canvas,[x,y])=>{
          const state=fixtureEditor.getState();
          return Array.from(canvas.getContext('2d').getImageData(
            Math.floor(state.pan.x+(x+.5)*state.zoom),
            Math.floor(state.pan.y+(y+.5)*state.zoom),1,1).data);
        }''', [x,y])

    def test_selection_shows_outside_mask_without_editing_art_or_export(self):
        self.step_source();self.control('grid').uncheck();self.frames()
        outside = self.displayed_pixel(22,18)
        inside = self.displayed_pixel(30,18)
        self.select_rectangle((28,12),(35,26));self.frames()
        self.assertNotEqual(self.displayed_pixel(22,18), outside)
        self.assertEqual(self.displayed_pixel(30,18), inside)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.assertEqual(self.state()['protection']['count'], 0)
        self.page.get_by_label('Show protection mask',exact=True).uncheck();self.frames()
        self.assertNotEqual(self.displayed_pixel(22,18), outside,
                            'Hiding painted protection must not hide the active selection mask')
        with self.page.expect_download() as pending:self.control('export').click()
        from PIL import Image
        with Image.open(pending.value.path()) as image:
            self.assertEqual(list(image.getpixel((22,18))), self.pixel(22,18))
        self.page.get_by_role('button',name='Clear selection',exact=True).click();self.frames()
        self.assertEqual(self.displayed_pixel(22,18), outside)

    def test_rectangle_blocks_pencil_line_erase_and_restore_outside_until_cleared(self):
        self.step_source();self.colour('#ff0000ff')
        self.drag((20,18),(44,18));self.drag((20,22),(44,22))
        self.select_rectangle((28,12),(35,26));self.colour('#00ff00ff')
        self.control('tool').select_option('pencil');self.drag((20,18),(44,18))
        self.assertEqual(self.pixel(30,18), [0,255,0,255])
        self.assertEqual(self.pixel(24,18), [255,0,0,255])
        self.control('tool').select_option('line');self.drag((20,22),(44,22))
        self.assertEqual(self.pixel(30,22), [0,255,0,255])
        self.assertEqual(self.pixel(40,22), [255,0,0,255])
        self.control('tool').select_option('erase');self.drag((20,22),(44,22))
        self.assertEqual(self.pixel(30,22)[3], 0)
        self.assertEqual(self.pixel(40,22), [255,0,0,255])
        self.control('tool').select_option('restore');self.drag((20,18),(44,18))
        self.assertEqual(self.pixel(30,18), [32,70,100,255])
        self.assertEqual(self.pixel(24,18), [255,0,0,255])
        self.control('canvas').focus();self.page.keyboard.press('Escape')
        self.assertIsNone(self.state()['selection'])
        self.control('tool').select_option('pencil');self.click(24,18)
        self.assertEqual(self.pixel(24,18), [0,255,0,255])

    def test_manual_concave_selection_limits_fill_to_its_exact_shape(self):
        self.step_source();self.control('tool').select_option('select')
        self.page.get_by_label('Selection shape',exact=True).select_option('manual')
        for point in [(20,10),(40,10),(40,14),(27,14),(27,30),(20,30)]:self.click(*point)
        self.page.get_by_role('button',name='Finish selection',exact=True).click()
        self.colour('#00ff00ff');self.control('tool').select_option('fill');self.click(23,20)
        self.assertEqual(self.pixel(23,20), [0,255,0,255])
        self.assertEqual(self.pixel(29,20), [32,70,100,255])
        self.assertEqual(self.pixel(18,20), [32,70,100,255])
        changes = self.page.evaluate('artworkChanges.length');self.click(29,20)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), changes)
        self.click(35,12)
        self.assertEqual(self.pixel(35,12), [0,255,0,255])
        self.assertEqual(self.pixel(45,12), [224,180,210,255])

    def test_paste_and_stamp_preserve_the_destination_selection_and_outside_pixels(self):
        self.step_source();self.control('grid').uncheck()
        self.select_rectangle((28,18),(33,23));self.frames()
        selected = self.state()['selection'];outside = self.pixel(34,22)
        display_outside = self.displayed_pixel(34,22)
        self.control('copy').click()
        self.page.evaluate('''CodaPixelSelection.clipboard.set({width:6,height:6,
          pixels:new Uint8ClampedArray(Array.from({length:36},()=>[255,0,0,255]).flat())})''')
        self.control('paste').click();self.page.mouse.move(**self.point(30,20));self.frames()
        self.assertEqual(self.displayed_pixel(34,22), display_outside,
                         'Paste preview must respect the same outside mask as its commit')
        self.click(30,20)
        self.assertEqual(self.pixel(31,21), [255,0,0,255])
        self.assertEqual(self.pixel(34,22), outside)
        self.assertEqual(self.state()['selection'], selected)
        self.colour('#00ff00ff');self.control('tool').select_option('pencil');self.click(28,18)
        self.control('stamp').click();self.control('capture-stamp').click();self.click(30,20)
        self.assertEqual(self.pixel(30,20), [0,255,0,255])
        self.assertEqual(self.pixel(34,22), outside)
        self.assertEqual(self.state()['selection'], selected)
        self.page.get_by_role('button',name='Clear selection',exact=True).click()
        self.assertTrue(self.state()['stampReady'])
        self.click(40,30)
        self.assertEqual(self.pixel(40,30), [0,255,0,255])


if __name__ == '__main__':
    unittest.main(verbosity=2)
