"""Published Piano Lab collision/layers and local room-save precedence.

The real main game, room editor, movement and layer compositor run in disposable
Chromium contexts. No credentials, live services or existing player saves are used.
"""
import copy
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest

sys.dont_write_bytecode = True

from playwright.sync_api import sync_playwright
from world_navigation_helpers import enter_room

ROOT = Path(__file__).resolve().parents[1]
PIANO_FINGERPRINT = 'ec96df63a727fd3c594967cec2b25858e32f98255d64f3659ffc321b7969c240'
ROOM_KEY = 'codaRoomProjectV1:piano'


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


class PublishedPianoTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.published = json.loads((ROOT / 'published-world-project.json').read_text())
        cls.piano = cls.published['rooms']['piano']
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/world-preview.html'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1600, 'height': 1050})
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page = self.context.new_page()
        self.page.set_default_timeout(12000)
        self.errors, self.failed = [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda message: self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response: self.failed.append(response.url)
                     if response.status >= 400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Published room must not cause page/frame errors')
        self.assertEqual(self.failed, [], 'Room assets and project responses must load')

    def load(self):
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.roomEditor("piano")&&CodaArcadeQA.characters().spriteState.ready')

    def project(self):
        return self.page.evaluate('CodaArcadeQA.roomProject("piano")')

    def room_storage(self):
        return self.page.evaluate('localStorage.getItem("codaRoomProjectV1:piano")')

    def test_reviewed_room_default_controls_real_movement_and_foreground_pixels(self):
        canonical = json.dumps(self.piano, sort_keys=True, separators=(',', ':')).encode()
        self.assertEqual(hashlib.sha256(canonical).hexdigest(), PIANO_FINGERPRINT)
        self.assertEqual((len(self.piano['collision']), len(self.piano['strokes'])), (243, 108))
        self.load()
        self.assertEqual(self.project(), self.piano)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.roomEditor("piano").hasLocalProject()'))
        self.assertIsNone(self.room_storage())
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))
        self.assertTrue(self.page.evaluate('''()=>{
          const editor=CodaArcadeQA.roomEditor('piano');
          return editor.getProject().collision.every(([index,value])=>
            editor.walkable(index%100*10+5,Math.floor(index/100)*10+5,true)===(value===1));
        }'''))
        enter_room(self.page, 'piano')
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        point = self.page.evaluate('''()=>{
          const box=pianoRoomCanvas.getBoundingClientRect(),cam=CodaArcadeQA.piano().camera;
          return {x:box.left+(130-cam.x)*cam.zoom*box.width/1000,
                  y:box.top+(495-cam.y)*cam.zoom*box.height/620};
        }''')
        self.page.mouse.click(**point)
        self.page.wait_for_function('Math.hypot(CodaArcadeQA.piano().player.x-130,CodaArcadeQA.piano().player.y-495)<4')
        self.page.locator('#pianoRoomCanvas').focus()
        self.page.keyboard.down('a')
        self.page.wait_for_timeout(550)
        self.page.keyboard.up('a')
        player = self.page.evaluate('CodaArcadeQA.piano().player')
        self.assertGreaterEqual(player['x'], 110, 'Authored red cell stops actual player movement')
        self.assertLess(player['x'], 120)
        self.assertGreaterEqual(player['y'], 490)
        self.assertLess(player['y'], 500)
        pixels = self.page.evaluate('''()=>{
          const editor=CodaArcadeQA.roomEditor('piano'),source=editor.getBackground();
          const out=document.createElement('canvas');out.width=1000;out.height=620;
          const ctx=out.getContext('2d');editor.beforeScene(ctx);
          ctx.fillStyle='#ff00ff';ctx.fillRect(0,0,1000,620);editor.afterScene(ctx,620);
          const reference=document.createElement('canvas');reference.width=1000;reference.height=620;
          reference.getContext('2d').drawImage(source,0,0,1000,620);
          return {painted:[...ctx.getImageData(72,489,1,1).data],
            expected:[...reference.getContext('2d').getImageData(72,489,1,1).data],
            untouched:[...ctx.getImageData(500,310,1,1).data]};
        }''')
        self.assertEqual(pixels['painted'], pixels['expected'], 'Authored foreground covers actor pixels with current room art')
        self.assertEqual(pixels['untouched'], [255, 0, 255, 255], 'Unpainted room pixels stay behind the actor')
        self.assertIsNone(self.room_storage(), 'Playing published defaults does not create a local editor override')

    def test_existing_standalone_room_edits_keep_priority_and_their_original_bytes(self):
        local = {'version': 1, 'assets': [], 'collision': [[3150, 0]],
                 'strokes': [{'tool': 'paint', 'size': 1, 'points': [[500, 310]]}], 'entities': {}}
        raw = json.dumps(local, separators=(',', ':'))
        self.context.add_init_script('''(()=>{
          if(sessionStorage.getItem('pianoSeeded'))return;
          localStorage.setItem(%s,%s);sessionStorage.setItem('pianoSeeded','yes');
        })()''' % (json.dumps(ROOM_KEY), json.dumps(raw)))
        self.load()
        self.assertEqual(self.project(), local)
        self.assertEqual(self.room_storage(), raw)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.roomEditor("piano").hasLocalProject()'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.roomEditor("piano").walkable(505,315,true)'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.assertEqual(self.project(), local)
        self.assertEqual(self.room_storage(), raw)

    def test_invalid_local_room_is_preserved_as_a_recoverable_backup(self):
        raw = '{"version":99,"private-backup":"keep these original bytes"}'
        self.context.add_init_script('localStorage.setItem(%s,%s)' % (json.dumps(ROOM_KEY), json.dumps(raw)))
        self.load()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.roomEditor("piano").hasLocalProject()'))
        self.assertEqual(self.room_storage(), raw)
        self.assertEqual(self.project()['collision'], [])
        self.assertEqual(self.project()['strokes'], [])

    def test_existing_cave_room_save_keeps_priority_over_published_room_defaults(self):
        cave = {'version': 1, 'assets': [], 'collision': [[2712, 0]],
                'strokes': [{'tool': 'erase', 'size': 1, 'points': [[100, 100]]}], 'entities': {}}
        raw = json.dumps(cave, separators=(',', ':'))
        self.context.add_init_script('localStorage.setItem("codaRoomProjectV1:fishing",%s)' % json.dumps(raw))
        self.load()
        self.assertEqual(self.project(), self.piano)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.roomProject("fishing")'), cave)
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRoomProjectV1:fishing")'), raw)
        self.assertIsNone(self.room_storage())

    def test_later_published_room_updates_load_without_accidental_local_overrides(self):
        next_default = copy.deepcopy(self.published)
        payload = [json.dumps(self.published)]
        self.context.route('**/published-world-project.json*', lambda route: route.fulfill(
            status=200, content_type='application/json', body=payload[0]))
        self.load()
        self.assertEqual(self.project(), self.piano)
        self.assertIsNone(self.room_storage())
        next_default['rooms']['piano']['collision'].append([3150, 0])
        next_default['rooms']['piano']['strokes'].append({'tool': 'paint', 'size': 1, 'points': [[500, 310]]})
        payload[0] = json.dumps(next_default)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.assertEqual(self.project(), next_default['rooms']['piano'])
        self.assertIsNone(self.room_storage())
        self.assertFalse(self.page.evaluate('CodaArcadeQA.roomEditor("piano").hasLocalProject()'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
