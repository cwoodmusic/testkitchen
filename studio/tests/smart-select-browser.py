"""Offline Smart Select workflows using real pointer input and disposable artwork.

Run: python studio/tests/smart-select-browser.py
All project authoring goes through the UI; window.studio is observed read-only.
"""
from __future__ import annotations

import base64
import importlib.util
import io
import json
from pathlib import Path
import unittest

from PIL import Image

SPEC = importlib.util.spec_from_file_location('studio_smart_select_helpers',
                                            Path(__file__).with_name('studio-browser.py'))
base = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(base)
OUT = base.ROOT.parent / '.onboarding' / 'pixel-studio' / 'smart-select'
OUT.mkdir(parents=True, exist_ok=True)
base.OUT = OUT
base.RESULTS = []
Helpers = type('StudioSmartSelectHelpers', (unittest.TestCase,), {
    key: value for key, value in base.StudioBrowserTests.__dict__.items()
    if not key.startswith('test_') and key not in ('__dict__', '__weakref__')})

RED = 0xCC5544FF
GREEN = 0x11EE66FF
RING = {(x, y) for y in range(4, 15) for x in range(4, 15)
        if not (7 <= x <= 9 and 7 <= y <= 9)
        and not (12 <= x <= 14 and 4 <= y <= 6)}
ISLAND = {(x, y) for y in range(4, 7) for x in range(20, 23)}
NEAR = {(x, y) for y in range(10, 13) for x in range(15, 18)}


def png(asset):
    return Image.open(io.BytesIO(base64.b64decode(asset['dataURL'].split(',')[1]))).convert('RGBA')


class SmartSelectBrowserTests(Helpers):
    def tearDown(self):
        self.page.screenshot(path=str(OUT / (self._testMethodName + '.png')), full_page=True)
        project = self.project()
        for index, asset in enumerate(project['assets']):
            png(asset).save(OUT / f'{self._testMethodName}-asset-{index}.png')
            asset.pop('dataURL')
        (OUT / (self._testMethodName + '.json')).write_text(json.dumps({
            'project': project, 'selection': self.smart_selection(),
            'status': self.page.locator('#studioStatus').inner_text()}, indent=2))
        super().tearDown()

    def rectangle(self, x0, y0, x1, y1, color):
        self.tool('rectangle')
        self.color(color)
        self.page.locator('#shapeFilled').check()
        self.pointer(x0, y0, x1, y1)

    def artwork(self, paste_backdrop=False):
        self.new_project(name='Smart Select artwork', width=64, height=48)
        self.rectangle(4, 4, 14, 14, '#cc5544')
        self.rectangle(7, 7, 9, 9, '#225588')
        self.rectangle(12, 4, 14, 6, '#225588')
        self.rectangle(20, 4, 22, 6, '#cc5544')
        self.rectangle(15, 10, 17, 12, '#d15948')
        if paste_backdrop:
            self.rectangle(30, 24, 40, 34, '#119944')
        self.assertEqual({(x, y) for x, y, color in self.colored_pixels() if color == RED},
                         RING | ISLAND, 'UI fixture has a hole, concavity and disconnected matching island')

    def smart_selection(self):
        return self.page.evaluate('''() => {
          const s=studio.viewport.getSelection();
          return s ? {...s, ...(s.mask ? {mask:Array.from(s.mask),
            maskType:Object.prototype.toString.call(s.mask)} : {})} : null;
        }''')

    def expect_selection(self, points):
        expected = [list(point) for point in sorted(points, key=lambda point: (point[1], point[0]))]
        self.page.wait_for_function('''expected => {
          const s=studio.viewport.getSelection();
          if (!expected.length) return s===null;
          if (!(s?.mask instanceof Uint8Array)) return false;
          const actual=[];
          for(let y=0;y<s.h;y++) for(let x=0;x<s.w;x++)
            if(s.mask[y*s.w+x]) actual.push([s.x+x,s.y+y]);
          return JSON.stringify(actual)===JSON.stringify(expected);
        }''', arg=expected)
        selected = self.smart_selection()
        if not points:
            self.assertIsNone(selected)
            return
        self.assertEqual(selected['maskType'], '[object Uint8Array]')
        self.assertEqual(len(selected['mask']), selected['w'] * selected['h'])
        self.assertTrue(set(selected['mask']) <= {0, 1})
        self.assertEqual((selected['x'], selected['y'], selected['w'], selected['h']),
                         (min(x for x, _ in points), min(y for _, y in points),
                          max(x for x, _ in points) - min(x for x, _ in points) + 1,
                          max(y for _, y in points) - min(y for _, y in points) + 1))

    def smart(self, x=4, y=4, modifier=None):
        self.tool('smart-select')
        if modifier:
            self.page.keyboard.down(modifier)
        try:
            self.pointer(x, y)
        finally:
            if modifier:
                self.page.keyboard.up(modifier)

    def wait_pixel(self, x, y, color):
        self.page.wait_for_function('''([x,y,color])=>{
          const s=studio.store.getState();
          return studio.store.readPixel(s.activeSceneId,s.activeLayerId,x,y)===color;
        }''', arg=[x, y, color])

    def pixels(self, layer_id=None):
        return {(x, y): color for x, y, color in self.colored_pixels(layer_id)}

    def test_01_connected_shape_holes_tolerance_keyboard_and_no_history(self):
        self.artwork()
        original = self.project()
        history_bytes = self.state()['historyBytes']
        self.page.locator('#studioCanvas').focus()
        self.page.keyboard.press('w')
        self.page.wait_for_function('studio.settings.tool==="smart-select"')
        self.page.locator('#toolTolerance').wait_for(state='visible')
        self.field('#toolTolerance', 0)
        self.pointer(4, 4)
        self.expect_selection(RING)
        self.assertEqual(self.project(), original, 'Selecting matching pixels does not edit the artwork')
        self.assertEqual(self.state()['historyBytes'], history_bytes, 'A selection consumes no Undo history')
        self.field('#toolTolerance', 5)
        self.pointer(4, 4)
        self.expect_selection(RING | NEAR)
        self.assertEqual(self.project(), original)
        self.assertEqual(self.state()['historyBytes'], history_bytes)
        self.page.screenshot(path=str(OUT / 'tolerance-selection.png'), full_page=True)
        self.page.locator('#studioCanvas').focus()
        self.page.keyboard.press('Escape')
        self.expect_selection(set())
        self.assertEqual(self.project(), original)
        self.field('#toolTolerance', 0)
        self.smart()
        self.expect_selection(RING)
        self.clipboard('clear-selection')
        self.expect_selection(set())

    def test_02_add_subtract_copy_cut_delete_paint_and_undo(self):
        self.artwork(paste_backdrop=True)
        original = self.project()
        original_pixels = self.pixels()
        history_bytes = self.state()['historyBytes']
        self.smart()
        self.expect_selection(RING)
        self.smart(20, 4, modifier='Shift')
        self.expect_selection(RING | ISLAND)
        self.smart(4, 4, modifier='Alt')
        self.expect_selection(ISLAND)
        self.smart(20, 4, modifier='Alt')
        self.expect_selection(set())
        self.assertEqual(self.project(), original)
        self.assertEqual(self.state()['historyBytes'], history_bytes)

        self.smart()
        self.expect_selection(RING)
        self.clipboard('copy')
        self.assertEqual(self.project(), original)
        self.selection(30, 24, 40, 34)
        self.clipboard('paste')
        translated = {(x + 26, y + 20) for x, y in RING}
        self.expect_selection(translated)
        expected = dict(original_pixels)
        expected.update({point: RED for point in translated})
        self.assertEqual(self.pixels(), expected, 'Paste preserves the hole and exterior destination pixels')
        self.action('undo').click()
        self.assertEqual(self.project(), original)

        self.smart()
        self.expect_selection(RING)
        self.clipboard('cut')
        self.assertEqual(self.pixels(), {point: color for point, color in original_pixels.items() if point not in RING})
        self.action('undo').click()
        self.assertEqual(self.project(), original)
        self.smart()
        self.expect_selection(RING)
        self.page.locator('#studioCanvas').focus()
        self.page.keyboard.press('Delete')
        self.assertEqual(self.pixels(), {point: color for point, color in original_pixels.items() if point not in RING})
        self.action('undo').click()
        self.assertEqual(self.project(), original)
        self.smart()
        self.expect_selection(RING)
        self.rectangle(0, 0, 25, 18, '#11ee66')
        expected = dict(original_pixels)
        expected.update({point: GREEN for point in RING})
        self.assertEqual(self.pixels(), expected, 'Painting follows the exact mask and preserves every exterior pixel')
        self.action('undo').click()
        self.assertEqual(self.project(), original)

    def test_03_make_asset_uses_exact_smart_mask_and_transparent_hole(self):
        self.artwork()
        original = self.project()
        original_scene = self.scene()
        self.smart()
        self.expect_selection(RING)
        self.panel('assets')
        self.page.locator('#makeAsset').click()
        dialog = self.page.locator('#assetDialog')
        dialog.wait_for(state='visible')
        self.page.wait_for_function('!document.querySelector("#createAssetButton").disabled')
        dialog.locator('#assetName').fill('Smart ring')
        self.page.screenshot(path=str(OUT / 'smart-mask-asset-preview.png'), full_page=True)
        dialog.locator('#createAssetButton').click()
        dialog.wait_for(state='hidden')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        self.assertEqual((asset['name'], asset['width'], asset['height']), ('Smart ring', 11, 11))
        image = png(asset)
        actual = {(x + 4, y + 4) for y in range(image.height) for x in range(image.width)
                  if image.getpixel((x, y))[3]}
        self.assertEqual(actual, RING, 'PNG transparency follows selected pixels rather than their bounding rectangle')
        self.assertEqual(image.getpixel((3, 3)), (0, 0, 0, 0), 'The unselected blue hole becomes transparent')
        self.assertEqual(image.getpixel((8, 0)), (0, 0, 0, 0), 'The concave notch stays transparent')
        self.assertEqual(image.getpixel((0, 0)), (204, 85, 68, 255))
        self.assertEqual(self.scene(), original_scene)
        image.save(OUT / 'smart-mask-asset.png')
        self.action('undo').click()
        self.assertEqual(self.project(), original)

    def test_04_effects_and_rotation_keep_shape_and_preserve_exterior_pixels(self):
        self.artwork()
        original = self.project()
        original_pixels = self.pixels()
        self.smart()
        self.expect_selection(RING)
        self.panel('properties')
        self.page.locator('#effectName').select_option('invert')
        self.page.locator('#applyEffect').click()
        self.wait_pixel(4, 4, 0x33AABBFF)
        expected = dict(original_pixels)
        expected.update({point: 0x33AABBFF for point in RING})
        self.assertEqual(self.pixels(), expected, 'An effect changes only matching selected pixels')
        self.action('undo').click()
        self.assertEqual(self.project(), original)
        self.smart()
        self.expect_selection(RING)
        self.panel('properties')
        details = self.page.locator('#panel-properties details').filter(
            has=self.page.locator('[data-transform="rotate-right"]'))
        if details.get_attribute('open') is None:
            details.locator('summary').click()
        self.page.locator('[data-transform="rotate-right"]').click()
        rotated = {(18 - y, x) for x, y in RING}
        self.expect_selection(rotated)
        expected = {point: color for point, color in original_pixels.items() if point not in RING}
        expected.update({point: RED for point in rotated})
        self.assertEqual(self.pixels(), expected, 'Rotation moves only masked pixels and keeps exterior artwork')
        self.assertEqual(self.pixel(20, 4), RED, 'The disconnected island is never transformed')
        self.action('undo').click()
        self.assertEqual(self.project(), original)

    def test_05_repeating_tile_fill_follows_mask_and_undo_removes_only_fill(self):
        self.artwork()
        original_scene = self.scene()
        source_id = self.layer()['id']
        original_pixels = self.pixels()
        self.smart()
        self.expect_selection(RING)
        self.panel('assets')
        self.page.locator('#makeTile').click()
        dialog = self.page.locator('.tile-dialog')
        dialog.wait_for(state='visible')
        dialog.locator('[data-tile=pattern]').select_option('checker')
        dialog.locator('[data-tile=size]').select_option('16')
        self.page.wait_for_function('!document.querySelector("[data-tile=apply]").disabled')
        dialog.locator('[data-tile=name]').fill('Smart checker')
        dialog.locator('[data-tile=apply]').click()
        dialog.wait_for(state='detached')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        tile = png(asset)
        self.expect_selection(RING)
        self.page.locator('#fillTile').click()
        fill = self.page.locator('#tileFillDialog')
        fill.wait_for(state='visible')
        self.page.screenshot(path=str(OUT / 'smart-mask-tile-fill.png'), full_page=True)
        fill.locator('#confirmTileFill').click()
        fill.wait_for(state='hidden')
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.length===2')
        expected = {}
        for x, y in RING:
            rgba = tile.getpixel(((x - 4) % tile.width, (y - 4) % tile.height))
            if rgba[3]:
                expected[(x, y)] = int.from_bytes(bytes(rgba), 'big')
        self.assertEqual(self.pixels(), expected, 'A repeating tile fills only Smart Select matching pixels')
        self.assertEqual(self.pixels(source_id), original_pixels, 'Tile filling preserves source artwork')
        self.assertEqual(self.pixel(8, 8), 0, 'The hole stays empty on the new fill layer')
        self.action('undo').click()
        self.assertEqual(self.scene(), original_scene, 'Undo removes the new fill layer in one step')
        self.assertEqual(self.project()['assets'], [asset], 'Undo retains the reusable checker tile')


if __name__ == '__main__':
    unittest.main(verbosity=2)
