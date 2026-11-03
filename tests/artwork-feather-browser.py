"""Feather an asset's coloured edge into transparency with reversible brush edits."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location(
    'feather_art_fixture', Path(__file__).with_name('artwork-smoothing-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class ArtworkFeatherTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ArtworkSmoothingTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ArtworkSmoothingTests.tearDownClass.__func__)
    for name in ['setUp', 'tearDown', 'editor', 'state', 'host', 'control', 'ready',
                 'frames', 'load_fixture', 'point', 'center', 'select_rectangle',
                 'click', 'drag']:
        locals()[name] = getattr(fixture.ArtworkSmoothingTests, name)

    def asset_source(self):
        self.load_fixture()
        self.page.evaluate('''()=>{
          fixtureEditor.dispose();
          sourceContext.clearRect(0,0,64,48);
          sourceContext.fillStyle='#dc6428';sourceContext.fillRect(20,12,24,24);
          window.featherBaseline=Array.from(sourceContext.getImageData(0,0,64,48).data);
          artworkData={};artworkChanges=[];artworkUndo=[];artworkRedo=[];fixtureCanEdit=true;
          fixtureEditor=CodaArtworkEditor.mount({...fixtureEditorOptions,
            initialId:'asset.cutout',getTargets:()=>[{id:'asset.cutout',name:'Cut-out asset'}],
            getSource:()=>source});
        }''')
        self.ready('asset.cutout')
        self.control('zoom').select_option('4'); self.frames(); self.center(32,24)

    def feather(self, radius=6, strength=100):
        self.control('tool').select_option('feather')
        self.control('smooth-radius').fill(str(radius))
        self.control('smooth-strength').fill(str(strength))
        self.control('smooth-strength').press('Tab'); self.frames()
        self.assertTrue(self.control('smooth-radius').is_visible())
        self.assertTrue(self.control('smooth-strength').is_visible())

    def pixel(self, x, y):
        return self.page.evaluate("([x,y])=>fixturePixel('asset.cutout',x,y)", [x,y])

    def pixels(self):
        return self.page.evaluate('''()=>{
          const texture=artworkData['asset.cutout'];
          const image=texture?CodaArtworkEditor.compose(source,texture):source;
          return Array.from(image.getContext('2d').getImageData(0,0,64,48).data);
        }''')

    def test_brush_blends_alpha_without_dark_fringes_and_exports_one_reversible_edit(self):
        self.asset_source(); before = self.pixels(); self.feather()
        self.drag((20,16),(20,31))
        inner, outer = self.pixel(20,24), self.pixel(18,24)
        self.assertGreater(inner[3], 0); self.assertLess(inner[3], 255)
        self.assertGreater(outer[3], 0); self.assertLess(outer[3], inner[3])
        for pixel in [inner, outer]:
            self.assertLessEqual(max(abs(a-b) for a,b in zip(pixel[:3],[220,100,40])), 4,
                                 'Fading an edge must keep its colour rather than mix in transparent black')
        self.assertEqual(self.pixel(32,24), [220,100,40,255])
        self.assertEqual(self.pixel(10,24), [0,0,0,0])
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)
        after = self.pixels()
        self.control('undo').click(); self.ready(); self.assertEqual(self.pixels(), before)
        self.control('redo').click(); self.ready(); self.assertEqual(self.pixels(), after)
        with self.page.expect_download() as pending:
            self.control('export').click()
        from PIL import Image
        with Image.open(pending.value.path()) as image:
            self.assertEqual(image.size, (64,48))
            self.assertEqual(list(image.getpixel((18,24))), outer)
            self.assertEqual(list(image.getpixel((20,24))), inner)
        self.assertEqual(self.page.evaluate('Array.from(sourceContext.getImageData(0,0,64,48).data)'),
                         self.page.evaluate('featherBaseline'), 'Original asset pixels remain available for Restore')

    def test_selection_limits_every_changed_pixel_to_the_selected_area(self):
        self.asset_source(); before = self.pixels()
        self.select_rectangle((18,18),(23,28)); self.feather(radius=10)
        self.drag((20,14),(20,33)); after = self.pixels()
        self.assertNotEqual(self.pixel(20,24), [220,100,40,255])
        for y in range(48):
            for x in range(64):
                if 18 <= x <= 23 and 18 <= y <= 28:
                    continue
                index=(y*64+x)*4
                self.assertEqual(after[index:index+4], before[index:index+4],
                                 f'Feathering escaped the selection at {x},{y}')

    def test_painted_protection_keeps_edge_details_unchanged(self):
        self.asset_source(); before = self.pixels()
        self.select_rectangle((18,21),(22,26))
        self.page.get_by_role('button', name='Protect selection', exact=True).click()
        self.page.get_by_role('button', name='Clear selection', exact=True).click()
        self.feather(); self.drag((20,15),(20,32))
        after = self.pixels()
        for y in range(21,27):
            for x in range(18,23):
                index=(y*64+x)*4
                self.assertEqual(after[index:index+4], before[index:index+4])
        self.assertLess(self.pixel(20,17)[3], 255)
        self.assertGreater(self.pixel(18,17)[3], 0)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)

    def test_cancelled_or_readonly_strokes_never_save_the_preview(self):
        self.asset_source(); before = self.pixels(); self.feather()
        self.page.mouse.move(**self.point(20,17)); self.page.mouse.down()
        self.page.mouse.move(**self.point(20,30), steps=5)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.page.keyboard.press('Escape'); self.page.mouse.up(); self.frames()
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.page.mouse.move(**self.point(20,17)); self.page.mouse.down()
        self.page.mouse.move(**self.point(20,30), steps=3)
        self.page.evaluate('fixtureCanEdit=false;fixtureEditor.refresh()'); self.ready()
        self.page.mouse.up(); self.frames()
        self.assertEqual(self.pixels(), before)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.assertTrue(self.control('smooth-radius').is_disabled())

    def test_strength_controls_the_amount_of_edge_blending(self):
        self.asset_source(); self.feather(strength=25); self.click(20,24)
        gentle_inner, gentle_outer = self.pixel(20,24), self.pixel(18,24)
        self.asset_source(); self.feather(strength=100); self.click(20,24)
        strong_inner, strong_outer = self.pixel(20,24), self.pixel(18,24)
        self.assertLess(strong_inner[3], gentle_inner[3])
        self.assertGreater(strong_outer[3], gentle_outer[3])


if __name__ == '__main__':
    unittest.main(verbosity=2)
