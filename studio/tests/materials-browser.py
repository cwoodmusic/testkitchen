"""Offline, real-UI image pixelification and reusable interior material checks.

Run: python studio/tests/materials-browser.py
Uses disposable projects and generated PNGs, never a classroom or database.
"""
from __future__ import annotations

import base64
import importlib.util
import io
import json
from pathlib import Path
import unittest
import zipfile

from PIL import Image

BASE_PATH = Path(__file__).with_name('studio-browser.py')
SPEC = importlib.util.spec_from_file_location('studio_browser_helpers', BASE_PATH)
base = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(base)
OUT = base.ROOT.parent / '.onboarding' / 'pixel-studio' / 'materials'
OUT.mkdir(parents=True, exist_ok=True)
base.OUT = OUT
base.RESULTS = []
# Reuse the existing server, real-pointer commands, and read-only observations,
# without rerunning the twenty unrelated workflows from the base suite.
Helpers = type('StudioBrowserHelpers', (unittest.TestCase,), {
    key: value for key, value in base.StudioBrowserTests.__dict__.items()
    if not key.startswith('test_') and key not in ('__dict__', '__weakref__')})


def png(asset):
    return Image.open(io.BytesIO(base64.b64decode(asset['dataURL'].split(',')[1]))).convert('RGBA')


class MaterialsBrowserTests(Helpers):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        image = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
        for y in range(8, 56):
            for x in range(8, 56):
                image.putpixel((x, y), (x * 4, y * 4, (x + y) * 2, 128 if x >= 40 else 255))
        image.save(OUT / 'pixelify-input.png')
        tile = Image.new('RGBA', (8, 8), (0, 0, 0, 0))
        for y in range(8):
            for x in range(8):
                if not (x < 2 and y < 2):
                    tile.putpixel((x, y), (x * 30, y * 30, (x + y) * 15, 128 if x == 3 else 255))
        tile.save(OUT / 'asymmetric-tile.png')

    def tearDown(self):
        self.page.screenshot(path=str(OUT / (self._testMethodName + '.png')), full_page=True)
        project = self.project()
        for index, asset in enumerate(project['assets']):
            png(asset).save(OUT / f'{self._testMethodName}-asset-{index}.png')
            asset.pop('dataURL')
        (OUT / (self._testMethodName + '.json')).write_text(json.dumps(project, indent=2))
        super().tearDown()

    def photo(self):
        self.panel('assets')
        self.action('photo').click()
        dialog = self.page.locator('.photo-dialog')
        dialog.wait_for(state='visible')
        return dialog

    def photo_ready(self):
        self.page.wait_for_function('!document.querySelector("[data-photo=apply]").disabled')

    def tile(self):
        self.panel('assets')
        self.page.locator('#makeTile').click()
        dialog = self.page.locator('.tile-dialog')
        dialog.wait_for(state='visible')
        return dialog

    def tile_ready(self):
        self.page.wait_for_function('!document.querySelector("[data-tile=apply]").disabled')

    def tile_custom(self, dialog, width, height):
        dialog.locator('[data-tile=size]').select_option('custom')
        dialog.locator('[data-tile=width]').fill(str(width))
        dialog.locator('[data-tile=height]').fill(str(height))
        dialog.locator('[data-tile=height]').press('Tab')

    def save_tile(self, dialog, name):
        self.tile_ready()
        dialog.locator('[data-tile=name]').fill(name)
        old_count = len(self.project()['assets'])
        dialog.locator('[data-tile=apply]').click()
        dialog.wait_for(state='detached')
        self.page.wait_for_function('(n)=>studio.store.getProject().assets.length===n+1', arg=old_count)
        asset = self.project()['assets'][-1]
        self.assertEqual(asset['name'], name)
        self.assertTrue(self.page.locator('#panel-assets').is_visible())
        self.assertEqual(self.page.locator(f'#assetGrid [data-id="{asset["id"]}"]').get_attribute('aria-pressed'), 'true')
        return asset

    def canvas_image(self, selector):
        data_url = self.page.locator(selector).evaluate('e=>e.toDataURL("image/png")')
        return Image.open(io.BytesIO(base64.b64decode(data_url.split(',')[1]))).convert('RGBA')

    def assert_repeat(self, tile, repeated):
        self.assertEqual(repeated.size, (tile.width * 4, tile.height * 4))
        for row in range(4):
            for col in range(4):
                self.assertEqual(repeated.crop((col * tile.width, row * tile.height,
                    (col + 1) * tile.width, (row + 1) * tile.height)).tobytes(), tile.tobytes())

    def test_01_pixelify_coda_palette_blocks_alpha_and_cancel(self):
        self.new_project(name='Pixelify Coda style', width=64, height=64)
        original = self.project()
        dialog = self.photo()
        self.assertEqual(dialog.locator('[data-photo=style]').input_value(), 'coda')
        self.assertEqual(dialog.locator('[data-photo=palette]').input_value(), 'coda')
        dialog.locator('[data-photo=preset]').select_option('floor')
        self.assertEqual(dialog.locator('[data-photo=width]').input_value(), '32')
        self.assertEqual(dialog.locator('[data-photo=height]').input_value(), '32')
        self.set_range(dialog.locator('[data-photo=block]'), 4)
        dialog.locator('[data-photo=file]').set_input_files(str(OUT / 'pixelify-input.png'))
        self.photo_ready()
        self.assert_photo_previews_fit(dialog)
        self.screenshot('pixelify-coda-preview')
        preview = self.canvas_image('.photo-previews figure:last-child canvas')
        self.assertEqual(preview.size, (32, 32))
        self.assertEqual(self.project(), original, 'Preview never mutates the project')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        dialog.wait_for(state='detached')
        self.assertEqual(self.project(), original)

        dialog = self.photo()
        dialog.locator('[data-photo=preset]').select_option('floor')
        self.set_range(dialog.locator('[data-photo=block]'), 4)
        dialog.locator('[data-photo=file]').set_input_files(str(OUT / 'pixelify-input.png'))
        self.photo_ready()
        dialog.locator('[data-photo=apply]').click()
        dialog.wait_for(state='detached')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        image = png(asset)
        self.assertEqual(image.size, (32, 32))
        colors = set(image.getdata())
        self.assertTrue(any(color[3] == 0 for color in colors))
        self.assertTrue(any(color[3] == 128 for color in colors), 'Semitransparent photo pixels survive')
        palette = self.page.evaluate('''async()=>{
          const {CODA_PALETTES}=await import('./coda-style.js?v=materials-1');
          return CODA_PALETTES.coda;
        }''')
        allowed = {tuple(bytes.fromhex(color.lstrip('#'))[:3]) for color in palette}
        opaque = {color[:3] for color in colors if color[3] == 255}
        self.assertGreater(len(opaque), 1)
        self.assertTrue(opaque <= allowed, 'Opaque output uses the actual Coda palette')
        for top in range(0, 32, 4):
            for left in range(0, 32, 4):
                self.assertEqual(len(set(image.crop((left, top, left + 4, top + 4)).getdata())), 1,
                                 'Pixel detail is baked into source pixels, not only CSS')
        self.assertEqual(self.scene()['layers'][:len(original['scenes'][0]['layers'])],
                         original['scenes'][0]['layers'], 'Original paint layers remain unchanged')

    def test_02_pixelify_original_manual_tuning_and_editable_scene(self):
        self.new_project(name='Photo source')
        dialog = self.photo()
        dialog.locator('[data-photo=style]').select_option('original')
        self.assertEqual(dialog.locator('[data-photo=palette]').input_value(), 'image')
        dialog.locator('[data-photo=preset]').select_option('wallpaper')
        self.assertEqual((dialog.locator('[data-photo=width]').input_value(),
                          dialog.locator('[data-photo=height]').input_value()), ('32', '64'))
        dialog.locator('[data-photo=file]').set_input_files(str(OUT / 'pixelify-input.png'))
        self.photo_ready()
        before = self.canvas_image('.photo-previews figure:last-child canvas').tobytes()
        unchanged = self.project()
        dialog.locator('[data-photo=file]').set_input_files({
            'name': 'damaged.png', 'mimeType': 'image/png', 'buffer': b'not a PNG'})
        self.page.wait_for_function('document.querySelector(".photo-status").dataset.error==="true"')
        self.assertTrue(dialog.locator('[data-photo=apply]').is_disabled(),
                        'A failed replacement cannot accidentally reuse the previous upload')
        self.assertEqual(self.project(), unchanged)
        dialog.locator('[data-photo=file]').set_input_files(str(OUT / 'pixelify-input.png'))
        self.photo_ready()
        self.set_range(dialog.locator('[data-photo=contrast]'), 20)
        self.photo_ready()
        after = self.canvas_image('.photo-previews figure:last-child canvas').tobytes()
        self.assertNotEqual(after, before, 'Manual controls still change the conversion')
        dialog.locator('[data-photo=asAsset]').uncheck()
        dialog.locator('[data-photo=apply]').click()
        dialog.wait_for(state='detached')
        self.page.wait_for_function('studio.store.getProject().scenes.length===2')
        self.assertEqual((self.scene()['width'], self.scene()['height']), (32, 64))
        self.assertEqual(len(self.project()['assets']), 0)
        self.assertGreater(len(self.colored_pixels()), 0)
        self.assertEqual(self.pixel(0, 0), 0)
        self.color('#efbb78')
        self.tool('pencil')
        self.pointer(0, 0)
        self.assertEqual(self.pixel(0, 0), 0xEFBB78FF)

    def test_03_floor_and_wallpaper_patterns_preview_name_colors_and_download(self):
        self.new_project(name='Interior materials', width=64, height=64)
        original = self.project()
        dialog = self.tile()
        self.tile_ready()
        self.assertEqual(dialog.locator('[data-tile=kind]').input_value(), 'floor')
        self.assertEqual(self.canvas_image('#tilePreview').size, (32, 32))
        self.assert_repeat(self.canvas_image('#tilePreview'), self.canvas_image('#tileRepeatPreview'))
        dialog.locator('[data-tile=pattern]').select_option('checker')
        for key, value in [('color1', '#72543d'), ('color2', '#d9b98c'), ('color3', '#352f37')]:
            dialog.locator(f'[data-tile={key}]').fill(value)
            dialog.locator(f'[data-tile={key}]').dispatch_event('input')
        dialog.locator('[data-tile=size]').select_option('16')
        self.tile_ready()
        preview = self.canvas_image('#tilePreview')
        self.assertEqual(preview.size, (16, 16))
        self.assert_repeat(preview, self.canvas_image('#tileRepeatPreview'))
        self.assertEqual(self.project(), original)
        self.screenshot('floor-repeat-preview')
        with self.page.expect_download() as info:
            dialog.locator('[data-tile=download]').click()
        path = OUT / 'floor-tile.png'
        info.value.save_as(str(path))
        self.assertEqual(Image.open(path).convert('RGBA').tobytes(), preview.tobytes())
        floor = self.save_tile(dialog, 'Honey checker floor')
        self.assertEqual((floor['width'], floor['height']), (16, 16))
        self.assertTrue({'tile', 'floor', 'repeat'} <= set(floor['tags']))
        self.assertEqual(png(floor).tobytes(), preview.tobytes())

        dialog = self.tile()
        dialog.locator('[data-tile=kind]').select_option('wallpaper')
        dialog.locator('[data-tile=pattern]').select_option('diamonds')
        self.tile_ready()
        self.assertEqual(self.canvas_image('#tilePreview').size, (32, 64))
        self.assert_repeat(self.canvas_image('#tilePreview'), self.canvas_image('#tileRepeatPreview'))
        self.screenshot('wallpaper-repeat-preview')
        wallpaper = self.save_tile(dialog, 'Cozy diamond wallpaper')
        self.assertEqual((wallpaper['width'], wallpaper['height']), (32, 64))
        self.assertTrue({'tile', 'wallpaper', 'repeat'} <= set(wallpaper['tags']))
        self.assertEqual(self.scene(), original['scenes'][0])

    def test_04_uploaded_tile_seams_fill_repeat_undo_and_portable_exports(self):
        self.new_project(name='Repeatable tile handoff', width=48, height=48)
        self.color('#f98b66')
        self.tool('pencil')
        self.pointer(0, 0)
        self.panel('assets')
        self.page.locator('#imageFile').set_input_files(str(OUT / 'test-cottage.png'))
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        self.page.locator('#placeAsset').click()
        self.pointer(7, 9)
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.some(l=>l.objects.length===1)')
        source_layers = self.scene()['layers']
        dialog = self.tile()
        self.tile_custom(dialog, 8, 8)
        dialog.locator('[data-tile=source]').select_option('upload')
        dialog.locator('[data-tile=file]').set_input_files(str(OUT / 'asymmetric-tile.png'))
        self.tile_ready()
        tile = self.canvas_image('#tilePreview')
        for y in range(tile.height):
            self.assertEqual(tile.getpixel((0, y)), tile.getpixel((tile.width - 1, y)))
        for x in range(tile.width):
            self.assertEqual(tile.getpixel((x, 0)), tile.getpixel((x, tile.height - 1)))
        self.assert_repeat(tile, self.canvas_image('#tileRepeatPreview'))
        asset = self.save_tile(dialog, 'Mirrored uploaded floor')
        tile = png(asset)
        self.selection(7, 9, 26, 28)
        before = self.project()
        self.panel('assets')
        self.page.locator('#fillTile').click()
        fill = self.page.locator('#tileFillDialog')
        fill.wait_for(state='visible')
        self.assertEqual(self.project(), before)
        self.page.locator('#confirmTileFill').click()
        fill.wait_for(state='hidden')
        self.page.wait_for_function('(n)=>studio.store.getProject().scenes[0].layers.length===n+1', arg=len(source_layers))
        tiled_layer = self.layer()
        self.assertEqual(self.scene()['layers'][:len(source_layers)], source_layers,
                         'Filling a tile creates a new layer and preserves original artwork')
        self.assertEqual(tiled_layer['role'], 'world')
        for x, y in [(7, 9), (8, 9), (14, 16), (15, 17), (26, 28)]:
            rgba = tile.getpixel(((x - 7) % 8, (y - 9) % 8))
            expected = int.from_bytes(bytes(rgba), 'big') if rgba[3] else 0
            self.assertEqual(self.pixel(x, y), expected, 'Tile repeats at native scale from selection origin')
        self.assertEqual(self.pixel(6, 9), 0)
        self.assertEqual(self.pixel(27, 28), 0)
        self.assertEqual(self.composite(11, 19), [152, 220, 236, 255],
                         'Placed furniture stays visible above repeated floor pixels')
        self.assertEqual(self.composite(0, 0), [249, 139, 102, 255])
        after = self.project()
        self.action('undo').click()
        self.assertEqual(self.project(), before)
        self.action('redo').click()
        self.assertEqual(self.project(), after)
        self.panel('assets')
        with self.page.expect_download() as info:
            self.page.locator('#exportAsset').click()
        asset_path = OUT / 'exported-tile.png'
        info.value.save_as(str(asset_path))
        self.assertEqual(Image.open(asset_path).convert('RGBA').tobytes(), tile.tobytes())
        native = self.download('save-project', 'materials.coda-studio.json')
        self.assertEqual(json.loads(native.read_text()), after)
        bundle = self.download('export-bundle', 'materials-bundle.zip')
        base.inspect_bundle(bundle, after)
        with zipfile.ZipFile(bundle) as archive:
            exported = Image.open(io.BytesIO(archive.read(f'assets/{asset["id"]}.png'))).convert('RGBA')
            self.assertEqual(exported.tobytes(), tile.tobytes())
        self.new_project(name='Import destination')
        self.page.locator('#projectFile').set_input_files(str(bundle))
        self.page.wait_for_function('(id)=>studio.store.getProject().id===id', arg=after['id'])
        self.assertEqual(self.project(), after, 'Tile dimensions, tags and pixels survive bundle reimport')

    def test_05_artwork_and_selected_asset_sources_preserve_pixels(self):
        self.new_project(name='My painted tile', width=16, height=16)
        self.color('#79d2ad')
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(3, 3, 6, 6)
        self.selection(2, 2, 9, 9)
        original_scene = self.scene()
        dialog = self.tile()
        self.tile_custom(dialog, 8, 8)
        dialog.locator('[data-tile=source]').select_option('artwork')
        dialog.locator('[data-tile=seamless]').select_option('repeat')
        self.tile_ready()
        first = self.save_tile(dialog, 'My painted material')
        image = png(first)
        self.assertEqual(image.size, (8, 8))
        self.assertEqual(image.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertEqual(image.getpixel((1, 1)), (121, 210, 173, 255))
        self.assertEqual(image.getbbox(), (1, 1, 5, 5))
        self.assertEqual(self.scene(), original_scene)
        dialog = self.tile()
        self.tile_custom(dialog, 8, 8)
        dialog.locator('[data-tile=source]').select_option('asset')
        dialog.locator('[data-tile=seamless]').select_option('repeat')
        self.tile_ready()
        second = self.save_tile(dialog, 'Reuse painted asset')
        self.assertEqual(png(second).tobytes(), image.tobytes())
        self.assertEqual(self.scene(), original_scene)

    def test_06_phone_error_cancel_and_oversized_fill_are_safe(self):
        self.new_project(name='Phone material workspace', width=32, height=32)
        before = self.project()
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('[data-ui="toggle-panels"]').click()
        dialog = self.tile()
        self.tile_ready()
        self.assertLessEqual(dialog.evaluate('e=>e.getBoundingClientRect().right'), 390)
        self.assertGreaterEqual(dialog.evaluate('e=>e.getBoundingClientRect().left'), 0)
        dialog.locator('[data-tile=apply]').scroll_into_view_if_needed()
        self.assertTrue(dialog.locator('[data-tile=apply]').is_visible())
        self.screenshot('tile-maker-phone')
        self.tile_custom(dialog, 0, 32)
        dialog.locator('.tile-error').wait_for(state='visible')
        self.assertTrue(dialog.locator('[data-tile=apply]').is_disabled())
        self.assertEqual(self.project(), before)
        self.page.keyboard.press('Escape')
        dialog.wait_for(state='detached')
        self.assertEqual(self.project(), before)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.page.set_viewport_size({'width': 1500, 'height': 1000})
        self.new_project(preset='village', name='Oversized material area')
        dialog = self.tile()
        asset = self.save_tile(dialog, 'Large map material')
        self.assertEqual(asset['width'], 32)
        large = self.project()
        self.page.locator('#fillTile').click()
        fill = self.page.locator('#tileFillDialog')
        fill.wait_for(state='visible')
        self.assertTrue(self.page.locator('#errorTileFill').is_visible())
        self.assertTrue(self.page.locator('#confirmTileFill').is_disabled())
        self.page.keyboard.press('Escape')
        fill.wait_for(state='hidden')
        self.assertEqual(self.project(), large)


if __name__ == '__main__':
    unittest.main(verbosity=2)
