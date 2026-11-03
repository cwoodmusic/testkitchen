"""Fill and move selected artwork pixels, preserving shape, RGBA and undo."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    'selection_edit_fixture', Path(__file__).with_name('artwork-smoothing-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class SelectionEditTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ArtworkSmoothingTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ArtworkSmoothingTests.tearDownClass.__func__)
    for name in ['setUp', 'tearDown', 'editor', 'state', 'host', 'control', 'ready',
                 'frames', 'load_fixture', 'point', 'center', 'select',
                 'select_rectangle', 'step_source', 'pixel', 'click', 'drag']:
        locals()[name] = getattr(fixture.ArtworkSmoothingTests, name)

    def colour(self, value):
        self.control('hex').fill(value)
        self.control('hex').press('Tab')

    def pixels(self):
        return self.page.evaluate('''()=>{
          const texture=artworkData['background.fixture'];
          const image=texture?CodaArtworkEditor.compose(source,texture):source;
          const data=image.getContext('2d').getImageData(0,0,64,48).data;
          return Array.from({length:64*48},(_,i)=>Array.from(data.slice(i*4,i*4+4)));
        }''')

    def polygon(self):
        self.control('select').click()
        self.page.get_by_label('Selection shape', exact=True).select_option('manual')
        for point in [(20,10),(40,10),(40,14),(27,14),(27,30),(20,30)]:
            self.click(*point)
        self.page.get_by_role('button', name='Finish selection', exact=True).click()
        self.frames()

    @staticmethod
    def polygon_pixels():
        return {(x,y) for y in range(10,31) for x in range(20,41)
                if y <= 14 or x <= 27}

    def assert_moved(self, before, selected, dx, dy):
        expected = [pixel[:] for pixel in before]
        for x,y in selected:
            expected[y*64+x] = [0,0,0,0]
        for x,y in selected:
            expected[(y+dy)*64+x+dx] = before[y*64+x]
        self.assertEqual(self.pixels(), expected)

    def test_fill_replaces_all_selected_colours_and_transparency_in_one_undo(self):
        self.step_source()
        self.assertTrue(self.control('fill-selection').is_disabled())
        before = self.pixels()
        self.select_rectangle((28,18),(35,23))
        self.colour('#00ff00ff')
        self.control('fill-selection').click()
        expected = [pixel[:] for pixel in before]
        for y in range(18,24):
            for x in range(28,36):
                expected[y*64+x] = [0,255,0,255]
        self.assertEqual(self.pixels(), expected,
                         'Fill selection must cross colour boundaries and include transparent pixels')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)
        self.control('undo').click(); self.ready()
        self.assertEqual(self.pixels(), before)
        self.control('redo').click(); self.ready()
        self.assertEqual(self.pixels(), expected)

    def test_fill_uses_the_exact_concave_selection_instead_of_its_bounds(self):
        self.step_source(); before = self.pixels(); self.polygon()
        selection = self.state()['selection']
        self.colour('#ff0000ff'); self.control('fill-selection').click()
        expected = [pixel[:] for pixel in before]
        for x,y in self.polygon_pixels():
            expected[y*64+x] = [255,0,0,255]
        self.assertEqual(self.pixels(), expected)
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)

    def test_drag_moves_rgba_pixels_cuts_the_source_and_is_one_undo(self):
        self.load_fixture(); self.control('zoom').select_option('4'); self.frames()
        before = self.pixels(); self.select_rectangle((29,19),(32,21))
        self.page.evaluate('CodaPixelSelection.clipboard.set({width:1,height:1,pixels:new Uint8ClampedArray([1,2,3,4])})')
        self.drag((30,20),(40,30))
        selected = {(x,y) for y in range(19,22) for x in range(29,33)}
        self.assert_moved(before, selected, 10, 10)
        self.assertEqual(self.state()['selection'], {'x':39,'y':29,'width':4,'height':3})
        self.assertEqual(self.page.evaluate('Array.from(CodaPixelSelection.clipboard.get().pixels)'), [1,2,3,4])
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)
        moved = self.pixels()
        self.control('undo').click(); self.ready()
        self.assertEqual(self.pixels(), before)
        self.control('redo').click(); self.ready()
        self.assertEqual(self.pixels(), moved)

    def test_overlapping_drag_uses_the_frozen_original_pixels(self):
        self.load_fixture(); self.control('zoom').select_option('4'); self.frames()
        before = self.pixels(); self.select_rectangle((20,15),(25,18))
        self.drag((22,16),(25,16))
        selected = {(x,y) for y in range(15,19) for x in range(20,26)}
        self.assert_moved(before, selected, 3, 0)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)

    def test_polygon_drag_cuts_only_its_shape_and_moves_the_selection_with_it(self):
        self.step_source(); before = self.pixels(); self.polygon()
        self.drag((23,20),(43,27))
        self.assert_moved(before, self.polygon_pixels(), 20, 7)
        selection = self.state()['selection']
        self.assertEqual(selection['points'],
                         [[40,17],[60,17],[60,21],[47,21],[47,37],[40,37]])
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)

    def test_cancelled_drag_and_revoked_editing_never_cut_or_save_pixels(self):
        self.step_source(); before = self.pixels(); self.select_rectangle((20,15),(25,20))
        selection = self.state()['selection']
        self.control('canvas').scroll_into_view_if_needed()
        self.page.mouse.move(**self.point(22,17)); self.page.mouse.down()
        self.page.mouse.move(**self.point(34,29), steps=5); self.frames()
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0,
                         'A drag preview must not commit before release')
        self.page.keyboard.press('Escape'); self.page.mouse.up(); self.frames()
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.page.mouse.move(**self.point(22,17)); self.page.mouse.down()
        self.page.mouse.move(**self.point(28,23), steps=3)
        self.page.evaluate('fixtureCanEdit=false;fixtureEditor.refresh()'); self.ready()
        self.page.mouse.up(); self.frames()
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.assertTrue(self.control('fill-selection').is_disabled())

    def test_move_clamps_the_complete_selection_and_ignores_zero_distance(self):
        self.step_source(); before = self.pixels(); self.select_rectangle((20,15),(25,18))
        selection = self.state()['selection']
        self.click(22,16)
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.page.mouse.move(**self.point(22,16)); self.page.mouse.down()
        self.page.mouse.move(**self.point(34,28), steps=4)
        self.page.mouse.move(**self.point(22,16), steps=4); self.page.mouse.up(); self.frames()
        self.assertEqual(self.state()['selection'], selection)
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0,
                         'Dragging away and back must not create a redundant undo step')
        self.drag((22,16),(63,47))
        self.assertEqual(self.state()['selection'], {'x':58,'y':44,'width':6,'height':4})
        selected = {(x,y) for y in range(15,19) for x in range(20,26)}
        self.assert_moved(before, selected, 38, 29)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)

    def test_move_button_keyboard_safety_fill_after_move_and_shift_reselection(self):
        self.step_source(); before = self.pixels(); self.select_rectangle((28,18),(35,23))
        self.control('move-selection').click()
        self.assertEqual(self.state()['tool'], 'move')
        self.control('canvas').focus()
        self.page.keyboard.press('Enter'); self.page.keyboard.press('Space'); self.frames()
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0,
                         'Keyboard paint commands must not paint while Move is selected')
        self.drag((10,10),(18,14))
        selected = {(x,y) for y in range(18,24) for x in range(28,36)}
        self.assert_moved(before, selected, 8, 4)
        self.assertEqual(self.state()['selection'], {'x':36,'y':22,'width':8,'height':6})
        moved = self.pixels()
        self.colour('#00ff00ff'); self.control('fill-selection').click()
        expected = [pixel[:] for pixel in moved]
        for y in range(22,28):
            for x in range(36,44):
                expected[y*64+x] = [0,255,0,255]
        self.assertEqual(self.pixels(), expected,
                         'Fill after move must use the translated selection')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 2)
        self.control('select').click()
        self.page.keyboard.down('Shift')
        try:
            self.drag((37,23),(40,25))
        finally:
            self.page.keyboard.up('Shift')
        self.assertEqual(self.state()['selection'], {'x':37,'y':23,'width':4,'height':3})
        self.assertEqual(self.pixels(), expected)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 2)

    def test_finish_gesture_blur_and_target_change_cancel_an_unsaved_move(self):
        self.step_source(); before = self.pixels(); self.select_rectangle((20,15),(25,20))
        selection = self.state()['selection']
        for action in ['fixtureEditor.finishGesture()',
                       "window.dispatchEvent(new Event('blur'))",
                       "fixtureEditor.selectTarget('asset.large')"]:
            with self.subTest(action=action):
                self.control('canvas').scroll_into_view_if_needed()
                self.page.mouse.move(**self.point(22,17)); self.page.mouse.down()
                self.page.mouse.move(**self.point(34,29), steps=4); self.frames()
                self.assertTrue(self.state()['stroke'])
                self.page.evaluate(action)
                self.page.mouse.up(); self.ready()
                self.assertFalse(self.state()['stroke'])
                self.assertEqual(self.pixels(), before)
                self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
                if self.state()['target'] == 'background.fixture':
                    self.assertEqual(self.state()['selection'], selection)
                else:
                    self.assertIsNone(self.state()['selection'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
