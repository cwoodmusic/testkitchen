"""Pixel artwork tools and their real world/room rendering and persistence.

Runs the production editor in disposable Chromium profiles. All image sources
and game files are local; external services and classroom accounts are blocked.
"""
import copy
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from world_navigation_helpers import enter_room


FIXTURE = '''<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="artwork-editor.css">
<style>body{margin:12px;background:#151324;color:white;font:14px sans-serif}
#fixtureOwner{max-width:900px;margin:auto}#fixtureEditor{width:100%}</style>
<main id="fixtureOwner"><section id="fixtureEditor"></section></main>
<script src="pixel-selection.js"></script><script src="artwork-editor.js"></script><script>
const source=document.createElement('canvas');source.width=64;source.height=48;
const sourceContext=source.getContext('2d'),sourcePixels=sourceContext.createImageData(64,48);
for(let y=0;y<48;y++)for(let x=0;x<64;x++){
 const at=(y*64+x)*4;sourcePixels.data.set([20+x*3,16+y*4,80,255],at);
}
sourcePixels.data.set([36,104,172,128],(20*64+30)*4);
sourcePixels.data.set([0,0,0,0],(20*64+31)*4);
sourceContext.putImageData(sourcePixels,0,0);
const large=document.createElement('canvas');large.width=2048;large.height=1024;
large.getContext('2d').fillStyle='#112233';large.getContext('2d').fillRect(0,0,2048,1024);
window.artworkData={};window.artworkChanges=[];window.artworkUndo=[];window.artworkRedo=[];window.fixtureCanEdit=true;
window.fixtureEditorOptions={host:document.querySelector('#fixtureEditor'),
 getTargets:()=>[{id:'background.fixture',name:'Small patterned source'},
  {id:'asset.large',name:'Large background'}],
 getSource:id=>id==='asset.large'?large:source,getData:()=>artworkData,
 onChange:next=>{artworkUndo.push(JSON.parse(JSON.stringify(artworkData)));artworkRedo=[];artworkData=next;artworkChanges.push(JSON.parse(JSON.stringify(next)));return true;},
 canEdit:()=>fixtureCanEdit,
 onUndo:()=>{if(artworkUndo.length){artworkRedo.push(artworkData);artworkData=artworkUndo.pop();}},
 onRedo:()=>{if(artworkRedo.length){artworkUndo.push(artworkData);artworkData=artworkRedo.pop();}},
 getHistory:()=>({undo:artworkUndo.length>0,redo:artworkRedo.length>0})};
window.fixtureEditor=CodaArtworkEditor.mount(fixtureEditorOptions);
window.fixturePixel=(id,x,y)=>{
 const base=id==='asset.large'?large:source,texture=artworkData[id],
  image=texture?CodaArtworkEditor.compose(base,texture):base;
 return Array.from(image.getContext('2d').getImageData(x,y,1,1).data);
};
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.split('?')[0] == '/artwork-fixture':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(FIXTURE.encode())
            return
        return super().do_GET()


class ArtworkEditorBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}/'
        cls.published = json.loads((ROOT / 'published-world-project.json').read_text())
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(
            viewport={'width': 1440, 'height': 1100}, accept_downloads=True)
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.add_init_script('''(()=>{
          localStorage.setItem('codaArcadeFXV1','off');Math.random=()=>.01;
          window.artworkFrames=count=>new Promise(resolve=>{
            const next=()=>--count<=0?resolve():requestAnimationFrame(next);
            requestAnimationFrame(next);
          });
        })()''')
        self.page = self.context.new_page()
        self.page.set_default_timeout(10000)
        self.errors, self.failures = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response: self.failures.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)
        self.room = None
        self.fixture = False

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Artwork must not cause browser/frame errors')
        self.assertEqual(self.failures, [], 'Artwork sources must load successfully')

    def editor(self):
        if self.fixture:
            return 'window.fixtureEditor'
        if self.room:
            return f'CodaArcadeQA.roomEditor({json.dumps(self.room)}).getArtworkEditor()'
        return 'CodaDeveloperConsole.getArtworkEditor()'

    def state(self):
        return self.page.evaluate(self.editor() + '.getState()')

    def host(self):
        return self.page.locator('[data-artwork-editor]:visible').last

    def control(self, name):
        return self.host().locator('[data-artwork-' + name + ']')

    def ready(self, target=None):
        expression = self.editor()
        self.page.wait_for_function(
            f'()=>{{const e={expression};return e&&!e.getState().loading&&e.getState().width>0;}}')
        if target:
            self.assertEqual(self.state()['target'], target)
        self.frames()

    def frames(self, count=3):
        self.page.evaluate('artworkFrames', count)

    def load_fixture(self):
        self.fixture = True
        self.page.goto(self.base + 'artwork-fixture', wait_until='domcontentloaded')
        self.ready('background.fixture')

    def load_world(self):
        self.fixture = False
        self.page.goto(self.base + 'world-preview.html', wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA?.characters().spriteState.ready')
        self.frames()

    def open_world_artwork(self, target='background.world'):
        self.room = None
        self.page.evaluate("CodaDeveloperConsole.open('artwork')")
        self.ready()
        self.select(target)

    def select(self, target):
        self.control('target').select_option(target)
        self.page.wait_for_function(
            f'()=>{{const s={self.editor()}.getState();return s.target==={json.dumps(target)}&&!s.loading;}}')
        self.frames()

    def zoom(self, value):
        self.control('zoom').select_option(str(value))
        self.frames()
        self.assertEqual(self.state()['zoom'], value)

    def colour(self, value):
        control = self.control('hex')
        bounds = control.bounding_box()
        host_bounds = self.host().bounding_box()
        self.assertGreaterEqual(bounds['width'], 70, 'The exact colour field must remain readable')
        self.assertLessEqual(bounds['x'] + bounds['width'], host_bounds['x'] + host_bounds['width'] + 1,
                             'The colour swatch must not push the hex field outside the console')
        control.focus()
        control.press('ControlOrMeta+A')
        control.press_sequentially(value)
        control.press('Tab')
        self.assertEqual(self.state()['color'], value.lower() if len(value) == 9 else value.lower() + 'ff')

    def center(self, x, y):
        self.control('canvas').scroll_into_view_if_needed()
        state = self.state()
        box = self.control('canvas').bounding_box()
        desired_x = state['viewport']['width'] / 2 - (x + .5) * state['zoom']
        desired_y = state['viewport']['height'] / 2 - (y + .5) * state['zoom']
        dx = (desired_x - state['pan']['x']) * box['width'] / state['viewport']['width']
        dy = (desired_y - state['pan']['y']) * box['height'] / state['viewport']['height']
        start = {'x': box['x'] + box['width'] / 2, 'y': box['y'] + box['height'] / 2}
        self.page.mouse.move(**start)
        self.page.mouse.down(button='right')
        self.page.mouse.move(start['x'] + dx, start['y'] + dy)
        self.page.mouse.up(button='right')
        self.frames()

    def point(self, x, y):
        state = self.state()
        box = self.control('canvas').bounding_box()
        return {'x': box['x'] + (state['pan']['x'] + (x + .5) * state['zoom']) * box['width'] / state['viewport']['width'],
                'y': box['y'] + (state['pan']['y'] + (y + .5) * state['zoom']) * box['height'] / state['viewport']['height']}

    def paint(self, x, y):
        self.center(x, y)
        self.page.mouse.click(**self.point(x, y))
        self.frames()

    def select_rectangle(self, start, end):
        self.control('select').click()
        self.center((start[0] + end[0]) // 2, (start[1] + end[1]) // 2)
        self.page.mouse.move(**self.point(*start))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(*end))
        self.page.mouse.up()
        self.frames()

    def exit_editor(self):
        if self.host().count() and self.state()['expanded']:
            self.control('exit').click()
            self.page.wait_for_function('!document.querySelector("[data-artwork-editor].is-expanded")')
            self.frames()

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def world_pixel(self, x, y):
        return self.page.evaluate('''([x,y])=>{
          const camera=CodaArcadeQA.camera();
          return Array.from(document.querySelector('#view').getContext('2d').getImageData(
            Math.floor((x-camera.x)*camera.zoom),Math.floor((y-camera.y)*camera.zoom),1,1).data);
        }''', [x, y])

    def test_eyedropper_returns_to_each_previous_tool_and_never_continues_the_sample_as_paint(self):
        self.load_fixture()
        self.zoom(16)
        self.center(30, 20)
        expected = '#' + ''.join(f'{value:02x}' for value in self.page.evaluate(
            'fixturePixel("background.fixture",30,20)'))
        for previous in ['pencil', 'line', 'erase', 'restore', 'fill', 'select', 'pan', 'stamp']:
            with self.subTest(previous=previous):
                self.control('tool').select_option(previous)
                self.control('picker').click()
                self.control('canvas').focus()
                self.page.keyboard.press('i')
                self.page.mouse.move(**self.point(30, 20))
                self.page.mouse.down()
                self.page.mouse.move(**self.point(31, 21))
                self.page.mouse.up()
                self.assertEqual(self.state()['tool'], previous)
                self.assertEqual(self.control('tool').input_value(), previous)
                self.assertEqual(self.control('picker').get_attribute('aria-pressed'), 'false')
                self.assertEqual(self.control('hex').input_value(), expected)
                self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        self.control('tool').select_option('fill')
        self.control('canvas').focus()
        self.page.keyboard.press('i')
        self.page.keyboard.down('Enter')
        self.page.keyboard.down('Enter')
        self.assertEqual(self.state()['tool'], 'fill')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0,
                         'Holding the sample key must not paint after the picker returns')
        self.page.keyboard.up('Enter')
        self.control('tool').select_option('erase')
        self.control('canvas').focus()
        self.page.keyboard.press('i')
        self.page.keyboard.press('Space')
        self.assertEqual(self.state()['tool'], 'erase')
        self.control('tool').select_option('pan')
        self.page.keyboard.down('Alt')
        self.paint(30, 20)
        self.page.keyboard.up('Alt')
        self.assertEqual(self.state()['tool'], 'pan')
        self.assertEqual(self.control('hex').input_value(), expected)
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)

    def test_eyedropper_copies_exact_rgba_and_line_replaces_preview_with_one_commit(self):
        self.load_fixture()
        self.zoom(16)
        expected = self.page.evaluate('fixturePixel("background.fixture",30,20)')
        self.control('tool').select_option('picker')
        self.paint(30, 20)
        self.assertEqual(self.control('hex').input_value(), '#' + ''.join(f'{value:02x}' for value in expected))
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0,
                         'Picking a colour must not change the source')
        self.colour('#123456ff')
        self.control('tool').select_option('line')
        self.center(31, 21)
        self.page.mouse.move(**self.point(29, 20))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(34, 19))
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0,
                         'A line preview must not enter the undo journal before release')
        self.page.mouse.move(**self.point(33, 23))
        self.page.mouse.up()
        self.frames()
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)
        points = [[29, 20], [30, 21], [31, 22], [32, 22], [33, 23]]
        actual = self.page.evaluate('points=>points.map(([x,y])=>fixturePixel("background.fixture",x,y))', points)
        self.assertEqual(actual, [[18, 52, 86, 255]] * len(points))
        self.assertNotEqual(self.page.evaluate('fixturePixel("background.fixture",34,19)'), [18, 52, 86, 255],
                            'The previous preview endpoint must be restored')
        before = self.page.evaluate('JSON.stringify(artworkData)')
        self.page.mouse.move(**self.point(29, 21))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(32, 24))
        self.control('canvas').dispatch_event('pointercancel', {'pointerId': 1})
        self.page.mouse.up()
        self.assertEqual(self.page.evaluate('JSON.stringify(artworkData)'), before)

    def test_selection_copy_paste_preserves_rgba_and_is_one_reversible_commit(self):
        self.load_fixture()
        self.zoom(16)
        source_points = [[30, 20], [31, 20], [30, 21], [31, 21]]
        expected = self.page.evaluate('points=>points.map(([x,y])=>fixturePixel("background.fixture",x,y))', source_points)
        self.assertEqual([pixel[3] for pixel in expected], [128, 0, 255, 255])
        self.select_rectangle((31, 21), (30, 20))
        self.assertEqual(self.state()['selection'], {'x': 30, 'y': 20, 'width': 2, 'height': 2})
        self.control('copy').click()
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)
        before = self.page.evaluate('JSON.stringify(artworkData)')
        self.control('paste').click()
        self.center(42, 26)
        self.page.mouse.move(**self.point(42, 26))
        self.frames()
        self.assertTrue(self.state()['pasting'])
        self.assertEqual(self.page.evaluate('JSON.stringify(artworkData)'), before,
                         'A floating paste must not change artwork or its undo history')
        self.page.keyboard.press('Escape')
        self.assertFalse(self.state()['pasting'])
        self.assertEqual(self.page.evaluate('JSON.stringify(artworkData)'), before)
        self.control('canvas').focus()
        self.page.keyboard.press('ControlOrMeta+V')
        self.page.mouse.move(**self.point(42, 26))
        self.page.keyboard.press('Enter')
        self.frames()
        actual = self.page.evaluate('()=>[[42,26],[43,26],[42,27],[43,27]].map(([x,y])=>fixturePixel("background.fixture",x,y))')
        self.assertEqual(actual, expected, 'Transparent and partially transparent pixels replace destination pixels exactly')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)
        self.control('undo').click()
        self.assertEqual(self.page.evaluate('JSON.stringify(artworkData)'), before)
        self.control('redo').click()
        self.assertEqual(self.page.evaluate('()=>[[42,26],[43,26],[42,27],[43,27]].map(([x,y])=>fixturePixel("background.fixture",x,y))'), expected)
        self.control('picker').click()
        self.paint(42, 26)
        self.assertEqual(self.control('hex').input_value(), '#' + ''.join(f'{byte:02x}' for byte in expected[0]))
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1,
                         'The eyedropper samples edited artwork without creating another undo step')

    def test_clipboard_crosses_sources_and_negative_paste_clips_without_wrapping(self):
        self.load_fixture()
        self.zoom(16)
        self.select_rectangle((30, 20), (31, 21))
        self.control('copy').click()
        copied = self.page.evaluate('()=>[[30,20],[31,20],[30,21],[31,21]].map(([x,y])=>fixturePixel("background.fixture",x,y))')
        self.select('asset.large')
        self.assertFalse(self.state()['selection'])
        self.control('paste').click()
        self.center(0, 0)
        self.page.mouse.move(**self.point(-1, -1))
        self.control('canvas').focus()
        self.page.keyboard.press('Enter')
        self.frames()
        self.assertEqual(self.page.evaluate('fixturePixel("asset.large",0,0)'), copied[3])
        self.assertEqual(self.page.evaluate('fixturePixel("asset.large",1,0)'), [17, 34, 51, 255])
        self.assertEqual(self.page.evaluate('fixturePixel("asset.large",2047,1023)'), [17, 34, 51, 255],
                         'Clipped source rows must not wrap onto another image edge')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)
        self.control('paste').click()
        self.center(1234, 777)
        self.page.mouse.move(**self.point(1234, 777))
        self.page.mouse.click(**self.point(1234, 777))
        self.frames()
        self.assertEqual(self.page.evaluate('()=>[[1234,777],[1235,777],[1234,778],[1235,778]].map(([x,y])=>fixturePixel("asset.large",x,y))'), copied)
        self.page.evaluate('fixtureEditor.dispose();window.fixtureEditor=CodaArtworkEditor.mount(fixtureEditorOptions)')
        self.ready('background.fixture')
        self.assertTrue(self.state()['clipboard'], 'Closing and reopening an editor keeps its in-memory copied pixels')
        self.control('paste').click()
        self.assertTrue(self.state()['pasting'])
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 2)


    def test_selection_shortcuts_ignore_text_fields_and_readonly_cannot_paste(self):
        self.load_fixture()
        self.select_rectangle((30, 20), (31, 21))
        self.control('copy').click()
        before = self.page.evaluate('JSON.stringify(artworkData)')
        handled = self.control('hex').evaluate("input=>['c','v'].map(key=>{const event=new KeyboardEvent('keydown',{key,ctrlKey:true,bubbles:true,cancelable:true});input.focus();input.dispatchEvent(event);return event.defaultPrevented;})")
        self.assertEqual(handled, [False, False], 'Text fields keep their own native copy and paste shortcuts')
        self.assertFalse(self.state()['pasting'])
        self.control('canvas').focus()
        self.page.keyboard.press('ControlOrMeta+V')
        self.assertTrue(self.state()['pasting'])
        self.page.evaluate('fixtureCanEdit=false')
        self.page.keyboard.press('Enter')
        self.page.keyboard.press('Escape')
        self.page.keyboard.press('ControlOrMeta+V')
        self.page.keyboard.press('Enter')
        self.frames()
        self.assertEqual(self.page.evaluate('JSON.stringify(artworkData)'), before,
                         'Losing edit permission during a floating paste must prevent its commit')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 0)

    def test_large_sources_use_a_small_64x_viewport_and_fullscreen_returns_focus(self):
        self.load_fixture()
        self.select('asset.large')
        self.zoom(64)
        self.colour('#fedcbaff')
        self.paint(1234, 777)
        self.assertEqual(self.page.evaluate('fixturePixel("asset.large",1234,777)'), [254, 220, 186, 255])
        state = self.state()
        self.assertLessEqual(state['viewport']['width'], 1440)
        self.assertLessEqual(state['viewport']['height'], 1100)
        self.assertLess(state['viewport']['width'] * state['viewport']['height'], 2000000,
                        '64× zoom must not allocate a 131072-pixel-wide canvas')
        expand = self.control('expand')
        expand.click()
        self.page.wait_for_function('fixtureEditor.getState().expanded')
        self.assertTrue(self.host().evaluate('node=>node.classList.contains("is-expanded")'))
        self.page.keyboard.press('Escape')
        self.page.wait_for_function('!fixtureEditor.getState().expanded')
        self.frames()
        self.assertTrue(self.host().evaluate('node=>node.parentElement.id==="fixtureOwner"'))
        self.assertEqual(self.page.evaluate('document.activeElement.dataset.artworkExpand'), '')
        self.assertEqual(self.page.evaluate('artworkChanges.length'), 1)

    def test_world_background_pixels_render_under_cleanup_and_survive_history_export_and_reload(self):
        self.load_world()
        self.open_world_artwork()
        self.zoom(32)
        original = self.project()
        before = self.world_pixel(1252, 650)
        neighbour = self.world_pixel(1253, 650)
        self.colour('#c925e3ff')
        self.paint(735, 280)
        self.assertEqual(self.world_pixel(735, 280), [201, 37, 227, 255],
                         'The source cleanup pass must not repaint an edited floor pixel')
        self.paint(1252, 650)
        self.assertEqual(self.world_pixel(1252, 650), [201, 37, 227, 255])
        self.assertEqual(self.world_pixel(1253, 650), neighbour, 'A pencil edits exactly one world pixel')
        self.control('undo').click()
        self.frames()
        self.assertEqual(self.world_pixel(1252, 650), before)
        self.assertEqual(self.world_pixel(735, 280), [201, 37, 227, 255], 'One gesture creates one undo entry')
        self.control('redo').click()
        self.frames()
        self.assertEqual(self.world_pixel(1252, 650), [201, 37, 227, 255])
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.exit_editor()
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as download:
            self.page.locator('#devExport').click()
        exported = json.loads(Path(download.value.path()).read_text())
        self.assertIn('background.world', exported['artwork'])
        for field in ('assets', 'collision', 'strokes'):
            self.assertEqual(exported[field], original[field], 'Painting must preserve the reviewed layout')
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#devReset').click()
        self.frames()
        self.assertNotIn('artwork', self.project())
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#devImportFile').set_input_files({
            'name': 'painted-world.json', 'mimeType': 'application/json',
            'buffer': json.dumps(exported).encode()})
        self.page.wait_for_function('!!CodaDeveloperConsole.getProject().artwork?.["background.world"]')
        self.frames()
        self.assertEqual(self.project(), exported)
        self.assertEqual(self.world_pixel(1252, 650), [201, 37, 227, 255])
        invalid = copy.deepcopy(exported)
        invalid['artwork']['background.world']['width'] = 0
        self.page.locator('#devImportFile').set_input_files({
            'name': 'invalid-pixels.json', 'mimeType': 'application/json',
            'buffer': json.dumps(invalid).encode()})
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.includes("Import failed")')
        self.assertEqual(self.project(), exported, 'Invalid pixel data must not replace a working world')
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()')
        self.frames()
        self.assertEqual(self.world_pixel(1252, 650), [201, 37, 227, 255])
        self.open_world_artwork()
        self.assertIn('background.world', self.project()['artwork'])

    def test_custom_asset_pixels_follow_movement_and_resizing(self):
        private = copy.deepcopy(self.published)
        asset = dict(id='asset-test', name='Eight pixel test image', kind='image', ref=None,
                     data=None, crop=None, x=1300, y=650, w=64, h=64, rotation=0,
                     opacity=100, visible=True, locked=False, keepAspect=True,
                     layer='front', anim='none', speed=1, amplitude=0,
                     cols=1, rows=1, frames=1, fps=0)
        private['assets'].append(asset)
        self.context.add_init_script('''(()=>{
          if(sessionStorage.getItem('artworkAssetSeed'))return;
          const project=%s,c=document.createElement('canvas');c.width=c.height=8;
          const g=c.getContext('2d');g.fillStyle='#123456';g.fillRect(0,0,8,8);
          project.assets.at(-1).data=c.toDataURL();project.savedAt=123;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify(project));
          sessionStorage.setItem('artworkAssetSeed','yes');
        })()''' % json.dumps(private))
        self.load_world()
        self.open_world_artwork('asset.asset-test')
        self.zoom(32)
        self.colour('#ea29d8ff')
        self.paint(3, 4)
        self.assertEqual(self.world_pixel(1296, 654), [234, 41, 216, 255])
        self.exit_editor()
        self.page.locator('#devTab-objects').click()
        self.page.locator('#assetList').select_option('asset-test')
        for field, value in [('assetX', '1400'), ('assetW', '128')]:
            control = self.page.locator('#' + field)
            control.fill(value)
            control.press('Tab')
        self.page.locator('#assetGuides').uncheck()
        self.frames()
        self.assertEqual(self.world_pixel(1392, 658), [234, 41, 216, 255],
                         'Edited pixels must remain in image coordinates when resized and moved')
        saved = next(item for item in self.project()['assets'] if item['id'] == 'asset-test')
        self.assertIn('artwork', saved)
        self.assertEqual((saved['artwork']['width'], saved['artwork']['height']), (8, 8))

    def test_character_targets_use_the_existing_directional_sprite_journal(self):
        self.load_world()
        self.open_world_artwork('character.player.down')
        self.zoom(16)
        self.colour('#ff6600ff')
        self.paint(40, 45)
        self.assertIn([40, 45, '#ff6600'], self.project()['sprites']['player']['down'])
        position = self.page.evaluate('CodaArcadeQA.position()')
        # The existing idle animation bobs the body by one pixel. The edit
        # must travel with that body, rather than becoming a mark on the floor.
        body_pixels = [self.world_pixel(round(position['x']), round(position['y']) - 35 + dy)
                       for dy in (-1, 0, 1)]
        self.assertEqual(body_pixels.count([255, 102, 0, 255]), 1,
                         'The normal animated character renderer must show the edited pixel')
        self.select('character.bach.left')
        self.colour('#00ccffff')
        self.paint(40, 45)
        self.assertIn([40, 45, '#00ccff'], self.project()['sprites']['bach']['left'])
        self.assertIn([40, 45, '#ff6600'], self.project()['sprites']['player']['down'])
        self.control('undo').click()
        self.assertNotIn('bach', self.project().get('sprites', {}))
        self.assertIn([40, 45, '#ff6600'], self.project()['sprites']['player']['down'])
        self.exit_editor()
        self.page.locator('#devTab-pixels').click()
        self.assertTrue(self.page.get_by_role('button', name='Full-screen pixel editor', exact=True).is_visible())
        self.page.get_by_role('button', name='Full-screen pixel editor', exact=True).click()
        self.ready('character.player.down')
        self.assertIn([40, 45, '#ff6600'], self.project()['sprites']['player']['down'])

    def test_an_original_object_lifts_with_its_pixel_edit_in_one_undo_step(self):
        self.load_world()
        self.open_world_artwork('object.hall_palm_west')
        self.zoom(16)
        original = self.project()
        before = self.world_pixel(1370, 256)
        self.colour('#24f3a5ff')
        self.paint(30, 40)
        project = self.project()
        self.assertEqual(len(project['assets']), len(original['assets']) + 1)
        self.assertIn('object.hall_palm_west', project['artwork'])
        lifted = [asset for asset in project['assets']
                  if asset.get('origin', {}).get('name') == 'hall_palm_west']
        self.assertEqual(len(lifted), 1)
        self.assertEqual(self.world_pixel(1370, 256), [36, 243, 165, 255])
        self.control('undo').click()
        self.frames()
        self.assertEqual(self.project(), original,
                         'Undo must remove both the pixel edit and its automatic lift together')
        self.assertEqual(self.world_pixel(1370, 256), before)
        self.control('redo').click()
        self.frames()
        self.assertEqual(self.project(), project)
        self.assertEqual(self.world_pixel(1370, 256), [36, 243, 165, 255])

    def test_edited_cabinet_pixels_survive_live_effects_while_the_rest_of_its_screen_animates(self):
        self.load_world()
        self.open_world_artwork('object.cabinet_music_triad')
        self.zoom(16)
        self.colour('#123456ff')
        self.control('tool').select_option('line')
        # These source pixels overlap an animated equalizer bar. The published
        # cabinet has moved 48px north, so observe its actual transformed screen.
        for y in range(72, 77):
            self.center(41, y)
            self.page.mouse.move(**self.point(39, y))
            self.page.mouse.down()
            self.page.mouse.move(**self.point(43, y))
            self.page.mouse.up()
            self.frames(2)
        self.exit_editor()
        geometry = self.page.evaluate('''()=>{
          const asset=CodaDeveloperConsole.getProject().assets.find(asset=>
            asset.origin?.name==='cabinet_music_triad');
          const left=asset.x-asset.w/2,top=asset.y-asset.h/2,
            points=[];
          for(let y=72;y<77;y++)for(let x=39;x<44;x++)
            points.push([left+x,top+y]);
          return {points,untouched:{x:left+19,y:top+56,w:17,h:23}};
        }''')
        baseline = [self.world_pixel(x, y) for x, y in geometry['points']]
        self.assertEqual(baseline, [[18, 52, 86, 255]] * 25)

        def set_fx(label):
            self.page.locator('#worldMenuBtn').click()
            for _ in range(3):
                if self.page.locator('#fxBtn').inner_text().endswith(label):
                    break
                self.page.locator('#fxBtn').click()
            self.page.locator('#worldMenuBtn').click()
            self.assertEqual(self.page.evaluate('CodaArcadeQA.atmosphere().quality'), label.lower())

        def samples(count):
            return self.page.evaluate('''async({geometry,count})=>{
              const result=[];
              for(let frame=0;frame<count;frame++){
                await artworkFrames(6);
                const camera=CodaArcadeQA.camera(),g=document.querySelector('#view').getContext('2d'),
                  protectedPixels=geometry.points.map(([x,y])=>Array.from(g.getImageData(
                    Math.floor((x-camera.x)*camera.zoom),Math.floor((y-camera.y)*camera.zoom),1,1).data)),
                  box=geometry.untouched,data=g.getImageData(
                    Math.floor((box.x-camera.x)*camera.zoom),Math.floor((box.y-camera.y)*camera.zoom),box.w,box.h).data;
                let hash=2166136261;
                for(const byte of data)hash=Math.imul(hash^byte,16777619)>>>0;
                result.push({protectedPixels,untouched:hash});
              }
              return result;
            }''', {'geometry': geometry, 'count': count})

        set_fx('Full')
        live = samples(8)
        for frame in live:
            for actual, expected in zip(frame['protectedPixels'], baseline):
                self.assertLessEqual(max(abs(a-b) for a, b in zip(actual, expected)), 8,
                                     'Live cabinet graphics must not repaint user-edited pixels')
        self.assertGreater(len({frame['untouched'] for frame in live}), 1,
                           'Protecting edited pixels must retain animation elsewhere on the screen')
        set_fx('Off')
        stopped = samples(3)
        self.assertEqual(len({frame['untouched'] for frame in stopped}), 1)

    def test_classroom_background_uses_the_same_editor_and_actual_classroom_render(self):
        self.load_world()
        self.open_world_artwork('background.classroom')
        self.zoom(32)
        self.colour('#eb44c7ff')
        state = self.state()
        x = int(705.5 * state['width'] / 1000)
        y = int(105.5 * state['height'] / 600)
        self.control('tool').select_option('line')
        for yy in range(y - 1, y + 2):
            self.center(x, yy)
            self.page.mouse.move(**self.point(x - 1, yy))
            self.page.mouse.down()
            self.page.mouse.move(**self.point(x + 1, yy))
            self.page.mouse.up()
            self.frames(2)
        patch = self.project()['artwork']['background.classroom']
        self.assertEqual((patch['width'], patch['height']), (state['width'], state['height']))
        self.exit_editor()
        self.page.locator('#assetClose').click()
        enter_room(self.page, 'classroom')
        self.frames()
        actual = self.page.locator('#classroomCanvas').evaluate(
            'canvas=>Array.from(canvas.getContext("2d").getImageData(705,105,1,1).data)')
        self.assertEqual(actual, [235, 68, 199, 255],
                         'The classroom must draw the shared editor background pixels')
        self.assertEqual(self.project()['artwork']['background.classroom'], patch)

    def test_real_console_shortcuts_copy_paste_and_exit_in_arcade_piano_and_cave(self):
        self.load_world()
        for room in [None, 'piano', 'fishing']:
            with self.subTest(room=room or 'arcade'):
                if room:
                    enter_room(self.page, room)
                self.room=room
                self.page.evaluate("CodaDeveloperConsole.open('artwork')")
                target='background.'+(room or 'world')
                self.ready(target)
                self.assertTrue(self.state()['expanded'])
                self.assertTrue(self.control('exit').is_visible())
                self.zoom(16)
                self.colour('#aabbccff')
                self.paint(20,20)
                selected=self.project()
                self.select_rectangle((20,20),(20,20))
                self.control('canvas').focus()
                self.page.keyboard.press('ControlOrMeta+C')
                self.assertTrue(self.state()['clipboard'])
                self.assertEqual(self.project(),selected,'Copy never paints or changes the world history')
                self.page.keyboard.press('ControlOrMeta+V')
                self.assertTrue(self.state()['pasting'],'The parent console must delegate paste shortcuts to the pixel editor')
                self.page.mouse.move(**self.point(22,21))
                self.assertEqual(self.project(),selected)
                self.page.keyboard.press('Enter')
                self.frames()
                self.assertNotEqual(self.project(),selected)
                self.control('picker').click()
                self.paint(22,21)
                self.assertEqual(self.control('hex').input_value(),'#aabbccff')
                self.control('undo').click()
                self.ready(target)
                self.assertEqual(self.project(),selected,'One paste is exactly one whole-project undo step')
                self.exit_editor()
                if room:
                    self.assertTrue(self.page.evaluate('id=>CodaArcadeQA.roomEditor(id).getState().open',room))
                    self.page.locator(f'[data-room-editor="{room}"] [data-room-action="close"]').click()
                    self.page.locator('#closepiano' if room=='piano' else '#fishingClose').click()
                else:
                    self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().open'))
                    self.page.locator('#assetClose').click()
                self.room=None

    def test_room_background_edits_are_native_pixels_and_travel_with_world_exports(self):
        self.load_world()
        for room, colour in [('piano', '#ff3355ff'), ('fishing', '#66ee22ff')]:
            with self.subTest(room=room):
                enter_room(self.page, room)
                self.room = room
                self.page.evaluate("CodaDeveloperConsole.open('artwork')")
                self.ready('background.' + room)
                self.zoom(32)
                self.colour(colour)
                state = self.state()
                # Draw a small native-pixel block; it remains visible after the
                # room's native PNG is scaled into its 1000×620/660 game canvas.
                width, height = state['width'], state['height']
                logical_h = 620
                x, y = int(705.5 * width / 1000), int(105.5 * height / logical_h)
                self.control('tool').select_option('line')
                for yy in range(y - 1, y + 2):
                    self.center(x, yy)
                    self.page.mouse.move(**self.point(x - 1, yy))
                    self.page.mouse.down()
                    self.page.mouse.move(**self.point(x + 1, yy))
                    self.page.mouse.up()
                    self.frames(2)
                project = self.page.evaluate('id=>CodaArcadeQA.roomProject(id)', room)
                self.assertEqual((project['artwork']['width'], project['artwork']['height']), (width, height))
                full = self.project()
                self.assertEqual(full['rooms'][room]['artwork'], project['artwork'])
                canvas = self.page.locator('#pianoRoomCanvas' if room == 'piano' else '#fishingLakeCanvas')
                actual = canvas.evaluate('canvas=>Array.from(canvas.getContext("2d").getImageData(705,105,1,1).data)')
                self.assertEqual(actual, [int(colour[i:i+2], 16) for i in (1, 3, 5, 7)],
                                 'The room must draw the edited native background, not only its preview')
                self.exit_editor()
                self.page.locator(f'[data-room-editor="{room}"] [data-room-action="close"]').click()
                self.page.locator('#closepiano' if room == 'piano' else '#fishingClose').click()
                self.room = None
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        saved = self.project()['rooms']
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()')
        self.assertEqual(self.project()['rooms'], saved)

    def test_first_fullscreen_open_fits_the_world_and_labels_its_zoom(self):
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.load_world()
        self.open_world_artwork('background.world')
        self.frames(5)
        state=self.state()
        self.assertTrue(state['expanded'])
        self.assertGreaterEqual(state['zoom'],.3,'Opening from a hidden console must not leave a tiny postage-stamp map')
        self.assertLessEqual(state['zoom'],1)
        image_width,image_height=state['width']*state['zoom'],state['height']*state['zoom']
        viewport=state['viewport']
        self.assertLessEqual(image_width,viewport['width']+1)
        self.assertLessEqual(image_height,viewport['height']+1)
        self.assertGreaterEqual(max(image_width/viewport['width'],image_height/viewport['height']),.8,
                                'The initial image should use the available editing space')
        self.assertTrue(self.control('zoom').input_value(),'A fitted nonpreset zoom still needs a visible selection')
        self.assertTrue(self.control('zoom').locator('option:checked').inner_text().strip())
        overlap=self.host().evaluate("""host=>{
          const help=host.querySelector('.artwork-help'),target=host.querySelector('[data-artwork-target]').closest('label'),range=document.createRange();
          range.selectNodeContents(help);const bounds=target.getBoundingClientRect();
          return Array.from(range.getClientRects()).some(rect=>Math.min(rect.right,bounds.right)-Math.max(rect.left,bounds.left)>1&&Math.min(rect.bottom,bounds.bottom)-Math.max(rect.top,bounds.top)>1);
        }""")
        self.assertFalse(overlap,'The help instructions must remain clear of the source selector')

    def test_fullscreen_pixel_editor_fits_mobile_and_escape_keeps_the_console_open(self):
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.load_world()
        self.open_world_artwork('background.world')
        self.assertTrue(self.state()['expanded'], 'Pixel editing opens full screen without another button')
        self.assertTrue(self.control('exit').is_visible())
        before = self.project()
        self.zoom(64)
        self.colour('#aabbccff')
        self.paint(1252, 650)
        painted = self.project()
        self.assertNotEqual(painted, before)
        self.control('undo').click()
        self.ready('background.world')
        self.assertEqual(self.project(), before,
                         'Fullscreen Undo must use the real complete-project history')
        self.assertTrue(self.state()['expanded'])
        self.control('redo').click()
        self.ready('background.world')
        self.assertEqual(self.project(), painted)
        for viewport in ({'width': 390, 'height': 844}, {'width': 844, 'height': 390}):
            self.page.set_viewport_size(viewport)
            self.frames()
            metrics = self.host().evaluate('''host=>({
              width:host.getBoundingClientRect().width,scrollWidth:host.scrollWidth,
              controls:Array.from(host.querySelectorAll('button,select,input:not([type=checkbox])'))
                .filter(node=>node.getClientRects().length).map(node=>({
                  tag:node.tagName,w:node.getBoundingClientRect().width,h:node.getBoundingClientRect().height})),
              canvas:host.querySelector('canvas').getBoundingClientRect().height})''')
            exit_bounds=self.control('exit').bounding_box()
            self.assertGreaterEqual(exit_bounds['x'],0)
            self.assertGreaterEqual(exit_bounds['y'],0)
            self.assertLessEqual(exit_bounds['x']+exit_bounds['width'],viewport['width']+1)
            self.assertLessEqual(exit_bounds['y']+exit_bounds['height'],viewport['height']+1,
                                 'Exit pixel editor must stay on screen in either phone orientation')
            self.assertLessEqual(metrics['scrollWidth'], viewport['width'])
            self.assertGreaterEqual(metrics['canvas'], 150)
            self.assertTrue(all(control['w'] >= 43 and control['h'] >= 43 for control in metrics['controls']), metrics)
        self.control('exit').click()
        self.page.wait_for_function('!document.querySelector("[data-artwork-editor].is-expanded")')
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().open'))
        self.assertTrue(self.page.locator('#dev-objects').is_visible())
        self.assertEqual(self.project(), painted, 'Exit keeps the committed pixel changes')


if __name__ == '__main__':
    unittest.main(verbosity=2)
