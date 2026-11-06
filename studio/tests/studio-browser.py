"""Real-browser, offline Coda Pixel Studio workflows and portable export validation.

Run: python studio/tests/studio-browser.py
Local fixture images are generated programmatically and contain no user artwork.
"""
from __future__ import annotations

import base64
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import threading
import unittest
from urllib.parse import urlsplit
import zipfile

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT.parent / '.onboarding' / 'pixel-studio'
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []


def fixtures():
    photo = Image.new('RGBA', (128, 96), (0, 0, 0, 0))
    pixels = photo.load()
    for y in range(6, 90):
        for x in range(6, 122):
            pixels[x, y] = (int(x * 255 / 127), int(y * 255 / 95),
                            int((x + y) * 255 / 222), 255 if x < 100 else 128)
    draw = ImageDraw.Draw(photo)
    draw.rectangle((18, 18, 48, 48), fill=(238, 72, 91, 255))
    draw.ellipse((64, 26, 103, 65), fill=(56, 171, 141, 255))
    draw.polygon([(38, 81), (57, 52), (76, 81)], fill=(255, 202, 99, 255))
    photo.save(OUT / 'gradient-alpha.png')
    asset = Image.new('RGBA', (16, 20), (0, 0, 0, 0))
    draw = ImageDraw.Draw(asset)
    draw.rectangle((3, 8, 12, 17), fill=(180, 88, 62, 255))
    draw.polygon([(1, 8), (8, 1), (14, 8)], fill=(224, 170, 78, 255))
    draw.rectangle((7, 12, 9, 19), fill=(73, 60, 72, 255))
    draw.rectangle((4, 10, 5, 12), fill=(152, 220, 236, 255))
    asset.save(OUT / 'test-cottage.png')
    (OUT / 'invalid-project.json').write_text(json.dumps({
        'format': 'CodaPixelStudio', 'version': 1,
        'scenes': [{'width': 99999, 'height': 10}]}))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def inspect_bundle(path, expected):
    """Independently inspect the handoff with Python's ZIP/PNG decoders."""
    with zipfile.ZipFile(path) as bundle:
        names = bundle.namelist()
        assert len(names) == len(set(names)), 'ZIP entries must be unique'
        assert bundle.testzip() is None, 'Every ZIP member must pass its CRC'
        assert all(not name.startswith(('/', '\\')) and '..' not in name.split('/')
                   and '\\' not in name for name in names), 'ZIP paths must be safe'
        assert {'project.coda-studio.json', 'manifest.json', 'README.txt'} <= set(names)
        native = json.loads(bundle.read('project.coda-studio.json'))
        assert native == expected, 'Bundle must preserve the complete editable project'
        manifest = json.loads(bundle.read('manifest.json'))
        assert manifest.get('format') == 'CodaPixelStudioBundle'
        assert manifest.get('version') == 1 and manifest.get('chunkSize') == 512
        assert bundle.read('README.txt').strip(), 'Bundle needs integration instructions'
        pngs = {}
        for name in names:
            if name.endswith('.png'):
                content = bundle.read(name)
                assert content[:8] == b'\x89PNG\r\n\x1a\n', f'Valid PNG signature: {name}'
                image = Image.open(io.BytesIO(content))
                image.load()
                pngs[name] = {'width': image.width, 'height': image.height}
        for scene in native['scenes']:
            prefix = f"scenes/{scene['id']}/"
            assert prefix + 'scene.json' in names
            metadata = json.loads(bundle.read(prefix + 'scene.json'))
            assert {key: value for key, value in metadata.items() if key != 'layers'} == {
                key: value for key, value in scene.items() if key != 'layers'}
            assert [layer['id'] for layer in metadata['layers']] == [
                layer['id'] for layer in scene['layers']], 'Export preserves layer order'
            assert prefix + 'preview.png' in pngs
            preview = pngs[prefix + 'preview.png']
            assert 0 < preview['width'] <= scene['width']
            assert 0 < preview['height'] <= scene['height']
            assert abs(preview['width'] / preview['height'] -
                       scene['width'] / scene['height']) < 0.02
            assert scene['collision']['cellSize'] == 10
            assert all(value in (0, 1) for value in scene['collision']['cells'].values())
            for layer, portable in zip(scene['layers'], metadata['layers']):
                assert layer['role'] in ('background', 'world', 'foreground')
                for key, value in layer.items():
                    if key != 'tiles':
                        assert portable[key] == value, f'Layer property is portable: {key}'
                assert 'tiles' not in portable, 'PNG metadata does not duplicate native tiles'
                chunks = portable.get('chunks', [])
                for chunk in chunks:
                    assert chunk['path'] in pngs
                    assert pngs[chunk['path']] == {'width': chunk['width'], 'height': chunk['height']}
                    assert chunk['x'] % 512 == chunk['y'] % 512 == 0
                    assert 0 <= chunk['x'] < scene['width'] and 0 <= chunk['y'] < scene['height']
                    assert 0 < chunk['width'] <= min(512, scene['width'] - chunk['x'])
                    assert 0 < chunk['height'] <= min(512, scene['height'] - chunk['y'])
                if layer['type'] == 'raster' and (layer.get('tiles') or layer.get('baseColor')):
                    assert chunks, f"Raster layer has portable chunks: {layer['name']}"
                    by_origin = {(chunk['x'], chunk['y']): chunk for chunk in chunks}
                    witnesses = []
                    for key, runs in layer.get('tiles', {}).items():
                        tx, ty = map(int, key.split(','))
                        for offset, length, color in runs:
                            for index in {offset, offset + length - 1}:
                                x, y = tx * 64 + index % 64, ty * 64 + index // 64
                                if x < scene['width'] and y < scene['height']:
                                    witnesses.append((x, y, color))
                    decoded = {}
                    for x, y, color in witnesses:
                        chunk = by_origin.get((x // 512 * 512, y // 512 * 512))
                        rgba = tuple((color >> shift) & 255 for shift in (24, 16, 8, 0))
                        if not chunk:
                            assert rgba[3] == 0, 'Only fully transparent chunks may be omitted'
                            continue
                        if chunk['path'] not in decoded:
                            decoded[chunk['path']] = Image.open(io.BytesIO(
                                bundle.read(chunk['path']))).convert('RGBA')
                        pixel = decoded[chunk['path']].getpixel((x - chunk['x'], y - chunk['y']))
                        assert pixel[3] == rgba[3], 'PNG chunks preserve raw raster alpha'
                        if rgba[3] == 255:
                            assert pixel == rgba, 'PNG chunks preserve exact opaque raster colors'
        for asset in native['assets']:
            name = f"assets/{asset['id']}.png"
            assert pngs[name] == {'width': asset['width'], 'height': asset['height']}
    return {'entries': names, 'pngs': pngs, 'manifest': manifest,
            'scenes': len(native['scenes']), 'assets': len(native['assets'])}


class StudioBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT / 'studio')))
        cls.server_thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.server_thread.start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        (OUT / 'browser-results.json').write_text(json.dumps(RESULTS, indent=2))

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1500, 'height': 1000},
                                               accept_downloads=True)
        self.errors = []
        self.external_requests = []
        self.local_failures = []
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda err: self.errors.append(str(err)))
        self.page.on('response', lambda response: self.local_failures.append(
            f'{response.status}: {response.url}') if response.status >= 400 else None)
        self.page.set_default_timeout(10000)
        self.page.goto(self.url)
        self.page.wait_for_function('window.studio?.store && window.studio?.viewport')
        self.page.wait_for_function('studio.store.getState().revision>0')

    def tearDown(self):
        errors = self.errors + self.local_failures + self.external_requests
        failed = any(test is self for test, _ in
                     self._outcome.result.failures + self._outcome.result.errors)
        RESULTS.append({'test': self._testMethodName, 'browser_errors': self.errors,
                        'failed_local_requests': self.local_failures,
                        'external_requests': self.external_requests, 'passed': not failed and not errors})
        if failed or errors:
            self.page.screenshot(path=str(OUT / f'{self._testMethodName}-error.png'))
        self.context.close()
        self.assertEqual(errors, [], 'Browser must run without exceptions or external requests')

    def route(self, route):
        url = route.request.url
        parts = urlsplit(url)
        if parts.scheme in ('data', 'blob') or parts.hostname in ('127.0.0.1', 'localhost'):
            route.continue_()
        else:
            self.external_requests.append(url)
            route.abort()

    def action(self, name):
        return self.page.locator(f'[data-action="{name}"]').first

    def tool(self, name):
        self.page.locator(f'#tool-{name}').click()
        self.page.wait_for_function('(tool)=>studio.settings.tool===tool', arg=name)

    def color(self, value, alpha=100):
        self.page.locator('#primaryColor').fill(value)
        self.page.locator('#primaryColor').dispatch_event('change')
        self.field('#colorAlpha', str(alpha))

    def field(self, selector, value):
        control = self.page.locator(selector)
        control.fill(str(value))
        control.press('Tab')

    def panel(self, name):
        self.page.locator(f'#tab-{name}').click()

    def new_project(self, preset='asset', name='Browser QA', kind=None, four_facings=False,
                    width=None, height=None, add_scene=False, room_template=None):
        old_id = self.state()['activeSceneId'] if add_scene else self.project()['id']
        self.page.locator('#addScene' if add_scene else '#newProject').click()
        self.page.locator('#projectDialog').wait_for(state='visible')
        self.page.locator('#projectName').fill(name)
        self.page.locator(f'#kind-{kind or ("map" if preset == "village" else preset)}').click()
        self.page.locator('#projectPreset').select_option(preset)
        if width is not None:
            self.field('#projectWidth', width)
        if height is not None:
            self.field('#projectHeight', height)
        if four_facings:
            self.page.locator('#projectFourFacings').check()
        if room_template is not None:
            self.page.locator('#interiorTemplate').set_checked(room_template)
        self.page.locator('#createProjectButton').click()
        expression = 'studio.store.getState().activeSceneId' if add_scene else 'studio.store.getProject().id'
        self.page.wait_for_function(f'(old)=>{expression}!==old', arg=old_id)
        self.panel('layers')
        return self.scene()

    def selection(self, x0, y0, x1, y1):
        self.tool('select')
        self.pointer(x0, y0, x1, y1)

    def clipboard(self, action):
        self.panel('layers')
        details = self.page.locator('#panel-layers details').first
        if details.get_attribute('open') is None:
            details.locator('summary').click()
        self.action(action).click()

    def state(self):
        return self.page.evaluate('studio.store.getState()')

    def project(self):
        return self.page.evaluate('studio.store.serialize()')

    def scene(self):
        state = self.state()
        return next(s for s in state['project']['scenes'] if s['id'] == state['activeSceneId'])

    def layer(self):
        state = self.state()
        return next(l for l in self.scene()['layers'] if l['id'] == state['activeLayerId'])

    def pixel(self, x, y, layer_id=None):
        return self.page.evaluate('''([x,y,layerId]) => {
          const s=studio.store.getState();
          return studio.store.readPixel(s.activeSceneId,layerId||s.activeLayerId,x,y);
        }''', [x, y, layer_id])

    def composite(self, x, y):
        return self.page.evaluate('''async ([x,y]) => {
          const state=studio.store.getState();
          const c=await studio.viewport.renderRegion({sceneId:state.activeSceneId,
            rect:{x,y,w:1,h:1},scale:1,objects:true});
          return Array.from(c.getContext('2d').getImageData(0,0,1,1).data);
        }''', [x, y])

    def colored_pixels(self, layer_id=None):
        return self.page.evaluate('''layerId => {
          const state=studio.store.getState(), s=state.project.scenes.find(
            s=>s.id===state.activeSceneId), found=[];
          if(s.width*s.height>65536) throw new Error('QA scan is bounded to small scenes');
          for(let y=0;y<s.height;y++) for(let x=0;x<s.width;x++) {
            const rgba=studio.store.readPixel(s.id,layerId||state.activeLayerId,x,y);
            if(rgba&255) found.push([x,y,rgba]);
          }
          return found;
        }''', layer_id)

    def point(self, x, y):
        return self.page.evaluate('''([x,y]) => {
          const c=studio.viewport.canvas || document.querySelector('canvas'),
            rect=c.getBoundingClientRect(), v=studio.viewport.getState();
          return {x:rect.left+v.panX+(x+.35)*v.zoom,
                  y:rect.top+v.panY+(y+.35)*v.zoom};
        }''', [x, y])

    def pointer(self, x0, y0, x1=None, y1=None, steps=5):
        start = self.point(x0, y0)
        self.page.mouse.move(**start)
        self.page.mouse.down()
        if x1 is not None:
            self.page.mouse.move(**self.point(x1, y1), steps=steps)
        self.page.mouse.up()
        self.page.mouse.move(1, 1)

    def screenshot(self, name):
        self.page.screenshot(path=str(OUT / f'{name}.png'), full_page=True)

    def download(self, action, filename):
        with self.page.expect_download(timeout=90000) as info:
            self.action(action).click()
            if action == 'save-project':
                self.page.locator('#saveWorkDialog').wait_for(state='visible')
                self.page.locator('#saveWorkName').fill(self.project()['name'])
                self.page.locator('#saveWorkFormat').select_option('project')
                self.page.locator('#confirmSaveWork').click()
        target = OUT / filename
        info.value.save_as(str(target))
        return target

    def set_range(self, locator, value):
        spec = locator.evaluate('(e)=>({min:Number(e.min||0),step:Number(e.step||1)})')
        locator.focus()
        locator.press('Home')
        for _ in range(round((value - spec['min']) / spec['step'])):
            locator.press('ArrowRight')

    def assert_photo_previews_fit(self, dialog):
        dimensions = dialog.locator('.photo-preview-frame canvas').evaluate_all('''canvases=>
          canvases.map(canvas=>({width:canvas.getBoundingClientRect().width,
            height:canvas.getBoundingClientRect().height,
            frameWidth:canvas.parentElement.clientWidth,
            frameHeight:canvas.parentElement.clientHeight}))''')
        self.assertEqual(len(dimensions), 2)
        for item in dimensions:
            self.assertLessEqual(item['width'], item['frameWidth'] + 1,
                                 'Fit preview shows the complete image width')
            self.assertLessEqual(item['height'], item['frameHeight'] + 1,
                                 'Fit preview shows the complete image height')

    def test_01_local_workstation_starter_and_help(self):
        project = self.project()
        self.assertEqual(project['format'], 'CodaPixelStudio')
        self.assertEqual((self.scene()['width'], self.scene()['height']), (960, 720))
        self.assertEqual(len(project['assets']), 0)
        self.assertEqual(sum(len(l['objects']) for l in self.scene()['layers']), 0)
        self.assertEqual([layer['name'] for layer in self.scene()['layers']], ['Floor', 'Walls'])
        self.assertLess(self.state()['rasterBytes'], 4 * 1024 * 1024)
        self.assertLessEqual(self.state()['historyBytes'], 64 * 1024 * 1024)
        self.screenshot('studio-desktop')
        self.page.locator('#collisionToggle').click()
        self.screenshot('studio-layers-collision')
        self.page.locator('#collisionToggle').click()
        self.action('help').click()
        self.assertTrue(self.page.locator('#helpDialog').is_visible())
        self.page.locator('#helpDialog [data-ui="close-help"]').last.click()
        self.assertFalse(self.page.locator('#helpDialog').is_visible())
        for panel in ('assets', 'properties', 'layers'):
            self.panel(panel)
            self.assertTrue(self.page.locator(f'#panel-{panel}').is_visible())
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 1500)

    def test_02_pencil_eraser_fill_shapes_and_transaction_history(self):
        self.new_project()
        self.color('#01fa8d')
        self.tool('pencil')
        self.pointer(5, 5, 15, 5)
        for x in range(5, 16):
            self.assertEqual(self.pixel(x, 5), 0x01FA8DFF)
        self.action('undo').click()
        self.assertTrue(all(self.pixel(x, 5) == 0 for x in range(5, 16)))
        self.assertFalse(self.state()['canUndo'], 'One drag is one history operation')
        self.action('redo').click()
        self.assertEqual(self.pixel(10, 5), 0x01FA8DFF)
        self.tool('eraser')
        self.pointer(10, 5)
        self.assertEqual(self.pixel(10, 5), 0)
        self.action('undo').click()
        self.assertEqual(self.pixel(10, 5), 0x01FA8DFF)
        self.tool('line')
        self.pointer(5, 12, 15, 17)
        self.assertEqual(self.pixel(5, 12), 0x01FA8DFF)
        self.assertEqual(self.pixel(15, 17), 0x01FA8DFF)
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(20, 20, 30, 30)
        self.assertEqual(self.pixel(25, 25), 0x01FA8DFF)
        self.assertEqual(self.pixel(19, 25), 0)
        self.tool('ellipse')
        self.pointer(40, 20, 50, 30)
        self.assertEqual(self.pixel(45, 25), 0x01FA8DFF)
        self.assertEqual(self.pixel(40, 20), 0)
        self.tool('rectangle')
        self.page.locator('#shapeFilled').uncheck()
        self.pointer(20, 40, 30, 50)
        self.assertEqual(self.pixel(20, 45), 0x01FA8DFF)
        self.assertEqual(self.pixel(25, 45), 0)
        self.color('#e34c67')
        self.tool('fill')
        self.pointer(25, 45)
        self.assertEqual(self.pixel(25, 45), 0xE34C67FF)
        self.assertEqual(self.pixel(19, 45), 0)
        self.tool('eyedropper')
        self.pointer(25, 45)
        self.assertEqual(self.page.evaluate('studio.settings.color'), '#e34c67ff')
        before = self.project()
        self.tool('pencil')
        self.page.mouse.move(**self.point(60, 10))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(70, 10), steps=5)
        self.page.keyboard.press('Escape')
        self.page.mouse.up()
        self.assertEqual(self.project(), before, 'Escape cancels the complete live stroke')
        self.assertFalse(self.state()['inTransaction'])
        self.assertLessEqual(self.state()['historyBytes'], 64 * 1024 * 1024)
        self.page.locator('#gridToggle').click()
        self.assertTrue(self.page.evaluate('studio.viewport.getState().grid'))
        zoom = self.page.evaluate('studio.viewport.getState().zoom')
        self.action('zoom-in').click()
        self.assertGreater(self.page.evaluate('studio.viewport.getState().zoom'), zoom)
        self.assertEqual(self.page.locator('#studioCanvas').evaluate(
            'e=>getComputedStyle(e).imageRendering'), 'pixelated')
        self.screenshot('drawing-tools-desktop')

    def test_02b_erase_virtual_solid_base_exports_transparency(self):
        self.new_project(name='Transparent erasure')
        self.color('#ffffff')
        self.tool('fill')
        self.pointer(40, 40)
        self.assertEqual(self.layer()['baseColor'], 0xFFFFFFFF)
        self.assertEqual(self.layer()['tiles'], {})
        self.tool('eraser')
        self.pointer(10, 10)
        self.assertEqual(self.pixel(10, 10), 0)
        self.assertEqual(self.pixel(11, 10), 0xFFFFFFFF)
        image = Image.open(self.download('export-png', 'transparent-erasure.png')).convert('RGBA')
        self.assertEqual(image.getpixel((10, 10)), (0, 0, 0, 0))
        self.assertEqual(image.getpixel((11, 10)), (255, 255, 255, 255))
        self.action('undo').click()
        self.assertEqual(self.pixel(10, 10), 0xFFFFFFFF)

    def test_03_selections_clipboard_lasso_move_and_keyboard_focus(self):
        self.new_project(name='Selections')
        self.color('#ee745c')
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(8, 8, 12, 12)
        self.selection(8, 8, 12, 12)
        self.assertEqual(self.page.evaluate('studio.viewport.getSelection()'),
                         {'x': 8, 'y': 8, 'w': 5, 'h': 5})
        self.clipboard('copy')
        self.clipboard('cut')
        self.assertEqual(self.pixel(10, 10), 0)
        self.clipboard('paste')
        selection = self.page.evaluate('studio.viewport.getSelection()')
        self.assertEqual(self.pixel(selection['x'] + 2, selection['y'] + 2), 0xEE745CFF)
        self.tool('move')
        self.pointer(selection['x'] + 2, selection['y'] + 2,
                     selection['x'] + 12, selection['y'] + 7)
        moved = self.page.evaluate('studio.viewport.getSelection()')
        self.assertEqual((moved['x'], moved['y']), (selection['x'] + 10, selection['y'] + 5))
        self.assertEqual(self.pixel(moved['x'] + 2, moved['y'] + 2), 0xEE745CFF)
        self.clipboard('clear-selection')
        self.selection(40, 40, 44, 44)
        self.tool('pencil')
        self.color('#509bd4')
        self.pointer(35, 42, 49, 42)
        self.assertEqual(self.pixel(39, 42), 0)
        self.assertEqual(self.pixel(40, 42), 0x509BD4FF)
        self.assertEqual(self.pixel(44, 42), 0x509BD4FF)
        self.assertEqual(self.pixel(45, 42), 0)
        self.clipboard('clear-selection')
        self.tool('lasso')
        for index, (x, y) in enumerate([(60, 60), (70, 60), (60, 70), (60, 60)]):
            self.page.mouse.move(**self.point(x, y))
            if index == 0:
                self.page.mouse.down()
        self.page.mouse.up()
        polygon = self.page.evaluate('studio.viewport.getSelection()')
        self.assertGreaterEqual(len(polygon.get('points', [])), 3)
        self.tool('rectangle')
        self.pointer(60, 60, 70, 70)
        self.assertEqual(self.pixel(62, 62), 0x509BD4FF)
        self.assertEqual(self.pixel(69, 69), 0, 'Lasso triangle excludes its lower right corner')
        self.field('#layerName', 'Typing b/e must not draw')
        self.assertEqual(self.layer()['name'], 'Typing b/e must not draw')
        self.assertEqual(self.page.evaluate('studio.settings.tool'), 'rectangle')
        self.page.locator('#studioCanvas').focus()
        self.page.keyboard.press('o')
        self.assertEqual(self.page.evaluate('studio.settings.tool'), 'ellipse')

    def test_04_layers_composition_order_opacity_visibility_lock_and_blend(self):
        self.new_project(name='Layer composition')
        self.color('#ff0000')
        self.tool('pencil')
        self.pointer(20, 20)
        bottom = self.layer()['id']
        self.page.locator('#newLayerType').select_option('raster')
        self.page.locator('#addLayer').click()
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.length===2')
        top = self.layer()['id']
        self.field('#layerName', 'Blue foreground')
        self.page.locator('#layerRole').select_option('world')
        self.color('#0000ff')
        self.pointer(20, 20)
        self.assertEqual(self.composite(20, 20), [0, 0, 255, 255])
        self.set_range(self.page.locator('#layerOpacity'), 50)
        self.assertEqual(self.layer()['opacity'], .5)
        mixed = self.composite(20, 20)
        self.assertTrue(126 <= mixed[0] <= 128 and mixed[1] == 0 and 127 <= mixed[2] <= 129)
        self.assertEqual(mixed[3], 255)
        self.set_range(self.page.locator('#layerOpacity'), 100)
        self.page.locator('#layerBlend').select_option('multiply')
        self.assertEqual(self.composite(20, 20), [0, 0, 0, 255])
        self.page.locator('#layerBlend').select_option('source-over')
        row = self.page.locator(f'#layerList > [data-id="{top}"]')
        row.locator('[data-action="layer-visible"]').click()
        self.assertEqual(self.composite(20, 20), [255, 0, 0, 255])
        row.locator('[data-action="layer-visible"]').click()
        row.locator('[data-action="layer-locked"]').click()
        before = self.project()
        self.pointer(21, 20)
        self.assertEqual(self.project(), before, 'Locked paint layer rejects the edit')
        self.assertIn('Unlock', self.page.locator('#studioStatus').inner_text())
        row.locator('[data-action="layer-locked"]').click()
        self.page.locator('#layerDown').click()
        self.assertEqual(self.scene()['layers'][0]['id'], top)
        self.assertEqual(self.composite(20, 20), [255, 0, 0, 255])
        self.page.locator('#layerUp').click()
        self.assertEqual(self.scene()['layers'][-1]['id'], top)
        self.assertEqual(self.composite(20, 20), [0, 0, 255, 255])
        self.page.locator('#layerRole').select_option('foreground')
        self.assertEqual(self.layer()['role'], 'foreground')
        self.screenshot('layers-desktop')
        self.page.locator('#deleteLayer').click()
        self.assertEqual([layer['id'] for layer in self.scene()['layers']], [bottom])
        self.assertEqual(self.composite(20, 20), [255, 0, 0, 255])

    def test_05_scene_presets_sparse_large_map_and_character_facings(self):
        scene = self.new_project(preset='village', name='Village workspace')
        self.assertEqual((scene['kind'], scene['width'], scene['height']), ('map', 6800, 5100))
        self.assertEqual(self.state()['rasterBytes'], 0)
        self.action('zoom-actual').click()
        self.tool('pencil')
        self.pointer(3400, 2550)
        self.assertGreater(self.pixel(3400, 2550), 0)
        self.assertLessEqual(self.state()['rasterBytes'], 16 * 1024)
        self.assertLess(self.state()['historyBytes'], 128 * 1024)
        for preset, expected in [('map', (1672, 941)), ('interior', (960, 720)),
                                 ('asset', (128, 128)), ('customization', (80, 96))]:
            scene = self.new_project(preset=preset, name='Scene ' + preset, add_scene=True)
            self.assertEqual((scene['width'], scene['height']), expected)
            self.assertEqual(scene['kind'], preset)
            if preset == 'customization':
                self.assertEqual(scene['anchor'], {'x': 40, 'y': 80})
        self.assertEqual(len(self.project()['scenes']), 5)
        self.panel('properties')
        self.page.locator('#onionToggle').check()
        self.assertTrue(self.page.evaluate('studio.viewport.getState().onionSkin'))
        self.page.locator('#onionToggle').uncheck()
        first = self.project()['scenes'][0]
        self.page.locator(f'#sceneTabs [data-id="{first["id"]}"]').click()
        self.assertEqual(self.scene()['id'], first['id'])
        self.page.locator('#renameScene').click()
        self.page.locator('#renameSceneName').fill('Northern village')
        self.page.locator('#renameSceneDialog button[type="submit"]').click()
        self.assertEqual(self.scene()['name'], 'Northern village')
        self.new_project(preset='customization', name='Four directions', four_facings=True)
        scenes = self.project()['scenes']
        self.assertEqual([scene['facing'] for scene in scenes], ['down', 'left', 'up', 'right'])
        self.assertTrue(all(scene['anchor'] == {'x': 40, 'y': 80} for scene in scenes))
        self.page.locator('#deleteScene').click()
        self.assertEqual(len(self.project()['scenes']), 3)

    def test_06_collision_paint_open_cells_undo_and_walking(self):
        self.new_project(preset='asset', name='Collision study', width=240, height=180)
        self.tool('collision')
        self.page.locator('#collisionValue').select_option('0')
        self.pointer(145, 45, 145, 135)
        cells = self.scene()['collision']['cells']
        self.assertEqual(cells['14,9'], 0, 'Native Coda value0 blocks movement')
        if not self.page.evaluate('studio.viewport.getState().collision'):
            self.page.locator('#collisionToggle').click()
        self.assertTrue(self.page.evaluate('studio.viewport.getState().collision'))
        self.page.locator('#walkToggle').click()
        initial = self.page.evaluate('studio.viewport.getState().walk')
        self.assertTrue(initial['enabled'])
        self.assertAlmostEqual(initial['x'], 120, delta=1)
        self.page.keyboard.down('ArrowRight')
        self.page.wait_for_timeout(550)
        self.page.keyboard.up('ArrowRight')
        stopped = self.page.evaluate('studio.viewport.getState().walk')
        self.assertGreater(stopped['x'], initial['x'])
        self.assertLessEqual(stopped['x'], 130.01, 'Feet stop before the blocked wall')
        self.assertTrue(stopped['blocked'])
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('studio.viewport.getState().walk.enabled'))
        self.page.locator('#collisionValue').select_option('1')
        self.pointer(145, 45, 145, 135)
        self.assertEqual(self.scene()['collision']['cells']['14,9'], 1)
        self.action('undo').click()
        self.assertEqual(self.scene()['collision']['cells']['14,9'], 0)
        self.action('redo').click()
        self.assertEqual(self.scene()['collision']['cells']['14,9'], 1)
        self.page.locator('#walkToggle').click()
        self.page.keyboard.down('ArrowRight')
        self.page.wait_for_timeout(550)
        self.page.keyboard.up('ArrowRight')
        self.assertGreater(self.page.evaluate('studio.viewport.getState().walk.x'), 155,
                           'Value1 allows the walker through')
        self.screenshot('collision-walk-desktop')
        self.page.locator('#walkToggle').click()
        self.assertFalse(self.page.evaluate('studio.viewport.getState().walk.enabled'))

    def test_07_custom_asset_upload_place_transform_duplicate_and_edit(self):
        self.new_project(name='Uploaded cottage')
        self.panel('assets')
        self.page.locator('#imageFile').set_input_files(str(OUT / 'test-cottage.png'))
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        self.assertEqual((asset['width'], asset['height']), (16, 20))
        self.assertTrue(self.page.locator(f'#assetGrid [data-id="{asset["id"]}"] img').is_visible())
        self.page.locator('#placeAsset').click()
        self.pointer(40, 40)
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.some(l=>l.objects.length===1)')
        placed = next(layer['objects'][0] for layer in self.scene()['layers'] if layer['objects'])
        self.assertEqual((placed['x'], placed['y'], placed['w'], placed['h']), (40, 40, 16, 20))
        self.assertEqual(placed['assetId'], asset['id'])
        self.assertEqual(self.composite(44, 50), [152, 220, 236, 255])
        self.tool('move')
        self.pointer(47, 52, 57, 57)
        self.panel('properties')
        self.assertTrue(self.page.locator('#objectProperties').is_visible())
        self.assertEqual(self.page.locator('#objectX').input_value(), '50')
        self.field('#objectX', 60)
        self.field('#objectY', 50)
        self.field('#objectWidth', 32)
        self.field('#objectHeight', 40)
        self.field('#objectRotation', 90)
        self.field('#objectDepth', 12)
        self.page.locator('#objectFlipX').check()
        self.page.locator('#objectFlipY').check()
        self.set_range(self.page.locator('#objectOpacity'), 75)
        placed = next(layer['objects'][0] for layer in self.scene()['layers'] if layer['objects'])
        self.assertEqual({key: placed[key] for key in
            ('x', 'y', 'w', 'h', 'rotation', 'depthOffset', 'flipX', 'flipY', 'opacity')},
            {'x': 60, 'y': 50, 'w': 32, 'h': 40, 'rotation': 90, 'depthOffset': 12,
             'flipX': True, 'flipY': True, 'opacity': .75})
        self.action('collision-from-object').click()
        self.assertTrue(self.scene()['collision']['cells'])
        self.assertTrue(all(value == 0 for value in self.scene()['collision']['cells'].values()))
        self.screenshot('custom-asset-properties')
        self.action('duplicate-object').click()
        self.assertEqual(sum(len(layer['objects']) for layer in self.scene()['layers']), 2)
        self.action('delete-object').click()
        self.assertEqual(sum(len(layer['objects']) for layer in self.scene()['layers']), 1)
        self.panel('assets')
        self.page.locator('#editAsset').click()
        self.page.wait_for_function('studio.store.getProject().scenes.length===2')
        self.assertEqual((self.scene()['width'], self.scene()['height']), (16, 20))
        self.assertEqual(self.pixel(4, 10), 0x98DCECFF)
        self.color('#79d2ad')
        self.tool('pencil')
        self.pointer(0, 0)
        self.assertEqual(self.pixel(0, 0), 0x79D2ADFF)
        self.action('undo').click()
        self.assertEqual(self.pixel(0, 0), 0)

    def test_07b_make_asset_from_selection_composites_pixels_and_reuses_artwork(self):
        self.new_project(name='Selection artwork')
        self.color('#ff0000')
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(9, 9, 11, 11)
        self.tool('pencil')
        self.pointer(20, 20)
        self.page.locator('#newLayerType').select_option('raster')
        self.page.locator('#addLayer').click()
        self.page.locator('#layerRole').select_option('world')
        self.color('#0000ff')
        self.pointer(10, 10)
        self.set_range(self.page.locator('#layerOpacity'), 50)
        self.page.locator('#addLayer').click()
        hidden_id = self.layer()['id']
        self.color('#00ff00')
        self.pointer(8, 8)
        self.page.locator(f'#layerList [data-action="layer-visible"][data-id="{hidden_id}"]').click()
        self.selection(8, 8, 12, 12)
        original_scene = self.scene()

        self.panel('assets')
        self.page.locator('#makeAsset').click()
        dialog = self.page.locator('#assetDialog')
        dialog.wait_for(state='visible')
        self.page.wait_for_function('document.querySelector("#createAssetButton")?.disabled===false')
        self.assertEqual(len(self.project()['assets']), 0, 'Preview does not create an asset before confirmation')
        self.assertTrue(dialog.locator('#assetPreviewImage').is_visible())
        self.assertIn('5', dialog.locator('#assetDimensions').inner_text())
        dialog.locator('#assetName').fill('Painted badge')
        self.make_asset_screenshot('asset-preview-named')
        dialog.locator('#createAssetButton').click()
        dialog.wait_for(state='hidden')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        self.assertEqual((asset['name'], asset['width'], asset['height']),
                         ('Painted badge', 5, 5))
        self.assertEqual(self.scene(), original_scene, 'Making an asset preserves source layers')
        image = Image.open(io.BytesIO(base64.b64decode(asset['dataURL'].split(',')[1]))).convert('RGBA')
        self.assertEqual(image.size, (5, 5))
        self.assertEqual(image.getpixel((0, 0)), (0, 0, 0, 0), 'Hidden layers stay hidden')
        self.assertEqual(image.getpixel((4, 4)), (0, 0, 0, 0), 'Transparent crop margins survive')
        self.assertEqual(image.getpixel((1, 1)), (255, 0, 0, 255))
        mixed = image.getpixel((2, 2))
        self.assertTrue(126 <= mixed[0] <= 128 and mixed[1] == 0 and
                        127 <= mixed[2] <= 129 and mixed[3] == 255,
                        f'Asset contains the visible composition, including layer opacity: {mixed}')
        card = self.page.locator(f'#assetGrid [data-id="{asset["id"]}"]')
        card.wait_for(state='visible')
        self.assertEqual(self.page.locator('#assetCount').inner_text(), '1 asset')
        self.assertIn('Painted badge', card.inner_text())
        self.assertIn('5 × 5', card.inner_text())
        self.assertEqual(card.get_attribute('aria-pressed'), 'true')

        self.action('undo').click()
        self.page.wait_for_function('studio.store.getProject().assets.length===0')
        self.assertEqual(self.scene(), original_scene)
        self.action('redo').click()
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        self.assertEqual(self.project()['assets'][0], asset)
        self.page.locator('#placeAsset').click()
        self.pointer(40, 40)
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.some(l=>l.objects.length===1)')
        placed = next(layer['objects'][0] for layer in self.scene()['layers'] if layer['objects'])
        self.assertEqual((placed['assetId'], placed['x'], placed['y'], placed['w'], placed['h']),
                         (asset['id'], 40, 40, 5, 5))
        self.assertEqual(self.composite(41, 41), [255, 0, 0, 255])
        self.assertEqual(self.composite(40, 40), [0, 0, 0, 0])
        self.action('undo').click()
        self.assertEqual(sum(len(layer['objects']) for layer in self.scene()['layers']), 0)
        self.assertEqual(len(self.project()['assets']), 1, 'Placement undo retains the reusable asset')

    def test_07c_make_asset_from_layers_clipboard_preserves_whole_scene_and_alpha(self):
        self.new_project(name='Whole artwork', width=32, height=24)
        self.color('#50a0d0', alpha=50)
        self.tool('pencil')
        self.pointer(2, 3)
        painted = self.pixel(2, 3)
        original = self.project()
        self.assertIsNone(self.page.evaluate('studio.viewport.getSelection()'))
        self.clipboard('make-asset')
        dialog = self.page.locator('#assetDialog')
        dialog.wait_for(state='visible')
        self.page.wait_for_function('document.querySelector("#createAssetButton")?.disabled===false')
        self.assertEqual(dialog.locator('#assetName').input_value(), 'Whole artwork asset')
        self.page.wait_for_function('document.querySelector("#assetPreviewImage")?.naturalWidth===32')
        self.assertEqual(dialog.locator('#assetPreviewImage').evaluate('e=>[e.naturalWidth,e.naturalHeight]'),
                         [32, 24])
        self.assertEqual(len(self.project()['assets']), 0)
        self.make_asset_screenshot('whole-scene-preview')
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        dialog.wait_for(state='hidden')
        self.assertEqual(self.project(), original, 'Cancel leaves the artwork and library unchanged')
        self.clipboard('make-asset')
        dialog.wait_for(state='visible')
        self.page.wait_for_function('document.querySelector("#createAssetButton")?.disabled===false')
        dialog.locator('#createAssetButton').click()
        dialog.wait_for(state='hidden')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        self.assertTrue(self.page.locator('#panel-assets').is_visible(), 'Creation opens the asset library')
        asset = self.project()['assets'][0]
        self.assertEqual((asset['name'], asset['width'], asset['height']),
                         ('Whole artwork asset', 32, 24))
        image = Image.open(io.BytesIO(base64.b64decode(asset['dataURL'].split(',')[1]))).convert('RGBA')
        self.assertEqual(image.getbbox(), (2, 3, 3, 4))
        pixel = image.getpixel((2, 3))
        self.assertEqual(pixel[3], painted & 255)
        self.assertTrue(all(abs(actual - expected) <= 1 for actual, expected in
                            zip(pixel[:3], (80, 160, 208))), 'PNG preserves semitransparent paint')
        self.assertEqual(image.getpixel((31, 23)), (0, 0, 0, 0))
        self.action('undo').click()
        self.page.wait_for_function('studio.store.getProject().assets.length===0')
        self.assertNotEqual(self.pixel(2, 3), 0, 'Undo removes the asset without erasing the artwork')

    def test_07d_make_asset_large_scene_reports_error_and_selection_recovers(self):
        self.new_project(preset='village', name='Large artwork')
        original = self.project()
        self.panel('assets')
        self.page.locator('#makeAsset').click()
        dialog = self.page.locator('#assetDialog')
        dialog.wait_for(state='visible')
        error = dialog.locator('#assetError')
        error.wait_for(state='visible')
        self.assertIn('16', error.inner_text())
        self.assertTrue(dialog.locator('#createAssetButton').is_disabled())
        self.make_asset_screenshot('large-scene-error')
        self.assertEqual(self.project(), original, 'Oversized artwork does not partially create an asset')
        self.page.keyboard.press('Escape')
        dialog.wait_for(state='hidden')
        self.assertEqual(self.project(), original)
        # A bounded selection on the same map must still produce a reusable asset.
        self.color('#49a2cf')
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(140, 120, 159, 139)
        self.selection(100, 100, 299, 199)
        selected = self.page.evaluate('studio.viewport.getSelection()')
        self.assertEqual((selected['w'], selected['h']), (200, 100))
        self.panel('assets')
        self.page.locator('#makeAsset').click()
        dialog.wait_for(state='visible')
        self.page.wait_for_function('document.querySelector("#createAssetButton")?.disabled===false')
        self.assertTrue(error.is_hidden(), 'A smaller selection clears the previous render error')
        dialog.locator('#createAssetButton').click()
        dialog.wait_for(state='hidden')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        self.assertEqual((asset['width'], asset['height']), (200, 100))
        image = Image.open(io.BytesIO(base64.b64decode(asset['dataURL'].split(',')[1]))).convert('RGBA')
        self.assertIsNotNone(image.getbbox(), 'The large-map crop contains the selected artwork')

    def test_07e_make_asset_lasso_excludes_pixels_outside_polygon(self):
        self.new_project(name='Lasso artwork', width=32, height=32)
        self.color('#ef745c')
        self.tool('fill')
        self.pointer(16, 16)
        self.tool('lasso')
        for index, (x, y) in enumerate([(4, 4), (20, 4), (4, 20), (4, 4)]):
            self.page.mouse.move(**self.point(x, y))
            if index == 0:
                self.page.mouse.down()
        self.page.mouse.up()
        selected = self.page.evaluate('studio.viewport.getSelection()')
        self.assertGreaterEqual(len(selected.get('points', [])), 3)
        self.panel('assets')
        self.page.locator('#makeAsset').click()
        dialog = self.page.locator('#assetDialog')
        dialog.wait_for(state='visible')
        self.page.wait_for_function('document.querySelector("#createAssetButton")?.disabled===false')
        self.make_asset_screenshot('lasso-preview')
        dialog.locator('#createAssetButton').click()
        dialog.wait_for(state='hidden')
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        asset = self.project()['assets'][0]
        image = Image.open(io.BytesIO(base64.b64decode(asset['dataURL'].split(',')[1]))).convert('RGBA')
        self.assertEqual(image.size, (selected['w'], selected['h']))
        self.assertEqual(image.getpixel((1, 1)), (239, 116, 92, 255))
        self.assertEqual(image.getpixel((14, 14)), (0, 0, 0, 0),
                         'Make asset respects the lasso polygon, including transparent pixels')
        self.assertEqual(self.pixel(18, 18), 0xEF745CFF, 'Making an asset never cuts the source artwork')

    def test_07f_make_asset_empty_artwork_reports_visible_error(self):
        self.new_project(name='Empty artwork', width=16, height=16)
        original = self.project()
        self.panel('assets')
        self.page.locator('#makeAsset').click()
        dialog = self.page.locator('#assetDialog')
        dialog.wait_for(state='visible')
        error = dialog.locator('#assetError')
        error.wait_for(state='visible')
        self.assertTrue(error.inner_text().strip(), 'Invisible artwork must explain why creation cannot proceed')
        self.assertTrue(dialog.locator('#createAssetButton').is_disabled())
        self.make_asset_screenshot('empty-artwork-error')
        self.assertEqual(self.project(), original)
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        dialog.wait_for(state='hidden')
        self.assertEqual(self.project(), original, 'Cancel leaves the empty canvas available for painting')

    def make_asset_screenshot(self, name):
        directory = ROOT.parent / '.onboarding' / 'pixel-studio' / 'make-asset'
        directory.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(directory / f'{name}.png'), full_page=True)

    def test_09_effects_transforms_selection_and_alpha(self):
        self.new_project(name='Editable effects')
        self.color('#204060', alpha=50)
        self.tool('rectangle')
        self.page.locator('#shapeFilled').check()
        self.pointer(10, 10, 12, 14)
        original = self.pixel(10, 10)
        alpha = original & 255
        self.selection(8, 8, 17, 17)
        self.panel('layers')
        self.set_range(self.page.locator('#layerOpacity'), 50)
        self.panel('properties')
        self.page.locator('#effectName').select_option('invert')
        self.page.locator('#applyEffect').click()
        self.page.wait_for_function('studio.store.getState().revision>0')
        inverted = self.pixel(10, 10)
        self.assertEqual(inverted & 255, alpha, 'Effects use raw layer alpha once')
        expected = [223, 191, 159]
        channels = [(inverted >> shift) & 255 for shift in (24, 16, 8)]
        self.assertTrue(all(abs(a - b) <= 2 for a, b in zip(channels, expected)))
        self.assertEqual(self.pixel(9, 9), 0)
        self.action('undo').click()
        self.assertEqual(self.pixel(10, 10), original)
        transform_details = self.page.locator('#panel-properties details').filter(
            has=self.page.locator('[data-transform="flipX"]'))
        if transform_details.get_attribute('open') is None:
            transform_details.locator('summary').click()
        self.page.locator('[data-transform="flipX"]').click()
        self.assertEqual(self.pixel(10, 10), 0)
        self.assertEqual(self.pixel(15, 10) & 255, alpha)
        self.action('undo').click()
        self.assertEqual(self.pixel(10, 10), original)
        self.page.locator('[data-transform="rotate-right"]').click()
        self.assertEqual(self.pixel(10, 10), 0)
        self.assertEqual(self.pixel(15, 10) & 255, alpha)
        self.action('undo').click()
        self.page.locator('#effectName').select_option('grayscale')
        self.page.locator('#applyEffect').click()
        gray = self.pixel(10, 10)
        self.assertEqual((gray >> 24) & 255, (gray >> 16) & 255)
        self.assertEqual((gray >> 16) & 255, (gray >> 8) & 255)
        self.assertEqual(gray & 255, alpha)
        self.action('undo').click()
        self.page.locator('#effectName').select_option('outline')
        self.page.locator('#applyEffect').click()
        self.assertGreater(self.pixel(9, 10) & 255, 0)
        self.assertEqual(self.pixel(7, 10), 0, 'Effect output remains selection-bounded')

    def test_09b_non_square_asset_rotation_resizes_and_undo_restores(self):
        self.new_project(name='Rotating asset', width=16, height=20)
        self.color('#cd8b52')
        self.tool('pencil')
        self.pointer(1, 2)
        before = self.project()
        self.panel('properties')
        details = self.page.locator('#panel-properties details').filter(
            has=self.page.locator('[data-transform="rotate-right"]'))
        details.locator('summary').click()
        self.page.locator('[data-transform="rotate-right"]').click()
        self.assertEqual((self.scene()['width'], self.scene()['height']), (20, 16))
        self.assertEqual(self.pixel(17, 1), 0xCD8B52FF)
        self.assertEqual(len(self.colored_pixels()), 1)
        self.action('undo').click()
        self.assertEqual(self.project(), before)

    def test_10_native_bundle_png_autosave_and_atomic_import_roundtrip(self):
        self.new_project(name='Portable studio handoff')
        self.color('#335544')
        self.tool('fill')
        self.pointer(50, 50)
        self.tool('eraser')
        self.pointer(10, 10)
        self.page.locator('#addLayer').click()
        self.field('#layerName', 'Foreground witness')
        self.page.locator('#layerRole').select_option('foreground')
        self.color('#e34c67')
        self.tool('pencil')
        self.pointer(20, 20)
        self.set_range(self.page.locator('#layerOpacity'), 50)
        self.panel('assets')
        self.page.locator('#imageFile').set_input_files(str(OUT / 'test-cottage.png'))
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        self.page.locator('#placeAsset').click()
        self.pointer(40, 40)
        self.tool('collision')
        self.page.locator('#collisionValue').select_option('0')
        self.pointer(75, 75)
        self.page.locator('#collisionValue').select_option('1')
        self.pointer(85, 75)
        expected = self.project()
        composite_witness = self.composite(20, 20)
        native_path = self.download('save-project', 'portable.coda-studio.json')
        self.assertEqual(json.loads(native_path.read_text()), expected)
        bundle_path = self.download('export-bundle', 'portable-integration.zip')
        report = inspect_bundle(bundle_path, expected)
        self.assertEqual(report['scenes'], 1)
        self.assertEqual(report['assets'], 1)
        self.assertEqual(expected['scenes'][0]['collision']['cells'], {'7,7': 0, '8,7': 1})
        (OUT / 'bundle-inspection.json').write_text(json.dumps(report, indent=2))
        png_path = self.download('export-png', 'portable-scene.png')
        png = Image.open(png_path).convert('RGBA')
        self.assertEqual(png.size, (128, 128))
        self.assertEqual(png.getpixel((10, 10)), (0, 0, 0, 0))
        self.assertEqual(list(png.getpixel((20, 20))), composite_witness)
        self.assertEqual(png.getpixel((75, 75)), (51, 85, 68, 255),
                         'Collision overlays never leak into PNG artwork')
        self.page.wait_for_function('''async expected => {
          try{return JSON.stringify(await studio.autosave.load(expected.id))===JSON.stringify(expected)}
          catch{return false}
        }''', arg=expected)
        self.page.reload()
        self.page.wait_for_function('(id)=>window.studio?.store.getProject().id===id', arg=expected['id'])
        self.assertEqual(self.project(), expected, 'Reload restores local editable document')
        for name, data in [('invalid-bounds.json', {'format': 'CodaPixelStudio', 'version': 1,
                            'scenes': [{'width': 99999, 'height': 1}]}),
                           ('invalid-image.json', {**expected, 'assets': [{**expected['assets'][0],
                                'dataURL': 'data:image/png;base64,bm90cG5n'}]})]:
            self.page.locator('#projectFile').set_input_files({
                'name': name, 'mimeType': 'application/json', 'buffer': json.dumps(data).encode()})
            self.page.wait_for_function('!document.querySelector("#studioStatus").textContent.includes("Checking project")')
            self.assertEqual(self.project(), expected, 'Invalid native import preserves the current project')
        self.panel('layers')
        raster_id = expected['scenes'][0]['layers'][0]['id']
        self.page.locator(f'#layerList [data-action="select-layer"][data-id="{raster_id}"]').click()
        self.tool('pencil')
        self.color('#f9ca77')
        self.pointer(1, 1)
        self.assertNotEqual(self.project(), expected)
        self.page.locator('#projectFile').set_input_files(str(native_path))
        self.page.wait_for_function('document.querySelector("#studioStatus").textContent.startsWith("Opened ")')
        self.assertEqual(self.project(), expected)
        self.assertFalse(self.state()['canUndo'], 'Native replace resets history')
        self.new_project(name='Another project')
        self.page.locator('#projectFile').set_input_files(str(bundle_path))
        self.page.wait_for_function('(id)=>studio.store.getProject().id===id', arg=expected['id'])
        self.assertEqual(self.project(), expected, 'Native ZIP roundtrip retains all editable data')
        self.new_project(name='Recent project switch')
        self.page.locator('#savedProjects').select_option(expected['id'])
        self.page.wait_for_function('(id)=>studio.store.getProject().id===id', arg=expected['id'])
        self.assertEqual(self.project(), expected, 'Recent-project control restores the saved document')

    def test_11_phone_panels_tools_and_dialog_access(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.wait_for_timeout(100)
        self.action('zoom-fit').click()
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.screenshot('studio-phone-canvas')
        self.page.locator('[data-ui="toggle-panels"]').click()
        for name in ('layers', 'assets', 'properties'):
            self.panel(name)
            self.assertTrue(self.page.locator(f'#panel-{name}').is_visible())
            box = self.page.locator(f'#tab-{name}').bounding_box()
            self.assertGreaterEqual(box['x'], 0)
            self.assertLessEqual(box['x'] + box['width'], 390)
            if name == 'layers':
                self.screenshot('studio-phone-layers')
        self.panel('assets')
        self.screenshot('studio-phone-assets')
        self.action('photo').click()
        photo = self.page.locator('.photo-dialog')
        photo.locator('[data-photo="file"]').set_input_files(str(OUT / 'gradient-alpha.png'))
        self.page.wait_for_function('!document.querySelector("[data-photo=apply]").disabled')
        self.assert_photo_previews_fit(photo)
        photo.locator('[data-photo="apply"]').scroll_into_view_if_needed()
        self.assertTrue(photo.locator('[data-photo="apply"]').is_visible())
        self.assertLessEqual(photo.evaluate('e=>e.getBoundingClientRect().right'), 390)
        self.screenshot('photo-converter-phone')
        photo.locator('.photo-previews').scroll_into_view_if_needed()
        self.screenshot('photo-previews-phone')
        photo.get_by_role('button', name='Cancel', exact=True).click()
        self.page.locator('[data-ui="close-panels"]').click()
        self.tool('collision')
        self.page.locator('#collisionValue').select_option('0')
        box = self.page.locator('#collisionValue').bounding_box()
        self.assertGreaterEqual(box['x'], 0)
        self.assertLessEqual(box['x'] + box['width'], 390)
        self.page.locator('#newProject').click()
        project_dialog = self.page.locator('#projectDialog')
        self.assertTrue(project_dialog.is_visible())
        self.page.locator('#kind-customization').click()
        self.page.locator('#projectFourFacings').check()
        self.page.locator('#createProjectButton').scroll_into_view_if_needed()
        self.assertTrue(self.page.locator('#createProjectButton').is_visible())
        project_dialog.locator('[data-ui="cancel-project"]').first.click()
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 390)
        self.page.set_viewport_size({'width': 320, 'height': 740})
        self.page.wait_for_timeout(100)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 320)
        self.assertTrue(self.page.locator('#renameScene').is_visible())

    def test_12_original_coda_map_image_and_collision_overlay(self):
        self.new_project(preset='map', name='Coda map study')
        self.panel('assets')
        self.page.locator('#imageFile').set_input_files(
            str(ROOT / 'assets/world/arcade-flat-floor-world.png'))
        self.page.wait_for_function('studio.store.getProject().assets.length===1')
        self.page.locator('#placeAsset').click()
        self.pointer(0, 0)
        self.page.wait_for_function('studio.store.getProject().scenes[0].layers.some(l=>l.objects.length===1)')
        object_layer = next(layer for layer in self.scene()['layers'] if layer['objects'])
        self.assertEqual((object_layer['objects'][0]['x'], object_layer['objects'][0]['y']), (0, 0))
        self.panel('layers')
        self.field('#layerName', 'Original Coda artwork')
        self.tool('collision')
        self.page.locator('#collisionValue').select_option('0')
        self.pointer(900, 825, 1550, 825, steps=20)
        self.assertEqual(self.scene()['collision']['cells']['100,82'], 0)
        self.assertLess(self.state()['rasterBytes'], 65536,
                        'Full-resolution image is a reusable asset, not full canvases per layer')
        self.screenshot('studio-map-desktop')

    def test_08_photo_conversion_preview_and_editable_pixels(self):
        self.panel('assets')
        self.action('photo').click()
        dialog = self.page.locator('.photo-dialog')
        dialog.wait_for(state='visible')
        dialog.locator('[data-photo="file"]').set_input_files(str(OUT / 'gradient-alpha.png'))
        dialog.locator('[data-photo="preset"]').select_option('character')
        self.assertEqual(dialog.locator('[data-photo="width"]').input_value(), '80')
        self.assertEqual(dialog.locator('[data-photo="height"]').input_value(), '96')
        dialog.locator('[data-photo="preset"]').select_option('map')
        self.assertEqual(dialog.locator('[data-photo="width"]').input_value(), '1672')
        self.assertEqual(dialog.locator('[data-photo="height"]').input_value(), '941')
        dialog.locator('[data-photo="width"]').fill('64')
        dialog.locator('[data-photo="height"]').fill('48')
        dialog.locator('[data-photo="colors"]').fill('12')
        dialog.locator('[data-photo="dither"]').select_option('ordered')
        self.set_range(dialog.locator('[data-photo="block"]'), 2)
        dialog.locator('[data-photo="asAsset"]').uncheck()
        apply = dialog.locator('[data-photo="apply"]')
        self.page.wait_for_function('!document.querySelector("[data-photo=apply]").disabled')
        self.assertEqual(dialog.locator('canvas').count(), 2)
        self.assert_photo_previews_fit(dialog)
        self.page.set_viewport_size({'width': 1100, 'height': 900})
        self.page.wait_for_timeout(100)
        self.assert_photo_previews_fit(dialog)
        dialog.locator('.photo-preview-zoom select').select_option('8')
        self.assertGreater(dialog.locator('canvas').first.evaluate('e=>e.getBoundingClientRect().width'),
                           dialog.locator('.photo-preview-frame').first.evaluate('e=>e.clientWidth'))
        dialog.locator('.photo-preview-zoom select').select_option('fit')
        self.page.set_viewport_size({'width': 1500, 'height': 1000})
        self.page.wait_for_timeout(100)
        self.assert_photo_previews_fit(dialog)
        dialog.evaluate('e=>e.scrollTo(0,0)')
        self.screenshot('photo-converter-desktop')
        apply.click()
        self.page.wait_for_function('studio.store.getProject().scenes.some(s=>s.width===64&&s.height===48)')
        scene = self.scene()
        self.assertEqual((scene['kind'], scene['width'], scene['height']), ('asset', 64, 48))
        pixels = self.colored_pixels()
        self.assertGreater(len(pixels), 100)
        self.assertLessEqual(len({word >> 8 for _, _, word in pixels}), 12)
        self.assertEqual(self.pixel(0, 0), 0, 'Converted photo keeps transparent margins')
        self.assertTrue(any((word & 255) == 128 for _, _, word in pixels))
        before = self.pixel(4, 4)
        self.tool('pencil')
        self.color('#01fa8d')
        self.pointer(4, 4)
        self.assertEqual(self.pixel(4, 4), 0x01FA8DFF)
        self.action('undo').click()
        self.assertEqual(self.pixel(4, 4), before)
        self.screenshot('photo-editable-output')

    def test_08b_photo_cancel_and_invalid_upload_keep_current_document(self):
        before = self.project()
        self.panel('assets')
        self.action('photo').click()
        dialog = self.page.locator('.photo-dialog')
        dialog.locator('[data-photo="file"]').set_input_files({
            'name': 'broken.png', 'mimeType': 'image/png', 'buffer': b'not a PNG'})
        self.page.wait_for_function('document.querySelector(".photo-status")?.dataset.error==="true"')
        self.assertTrue(dialog.locator('[data-photo="apply"]').is_disabled())
        dialog.get_by_role('button', name='Cancel', exact=True).click()
        self.assertEqual(self.project(), before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
