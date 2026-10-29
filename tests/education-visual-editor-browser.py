"""The visual palette edits real plain-data keyboard, clef, and staff pictures."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HTML = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/education-notation.css"><link rel="stylesheet" href="/education-visual-editor.css">
<style>*{box-sizing:border-box}body{margin:12px;background:#142437}main{max-width:850px;margin:auto}</style><main id="mount"></main>
<script src="/music-notation.js"></script><script src="/education-notation.js"></script><script src="/classroom-keyboard.js"></script><script src="/classroom-quiz.js"></script><script src="/classroom-tutorials.js"></script><script src="/education-visual-editor.js"></script>
<script>window.editable=true;window.changes=[];window.editor=CodaEducationVisualEditor.mount({host:mount,value:null,prefix:'main',canEdit:()=>editable,onChange:value=>changes.push(value)});</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if urlparse(self.path).path == '/visual-fixture':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif urlparse(self.path).path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()


class VisualEditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1100, 'height':1000})
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page()
        self.errors, self.failed = [], []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failed.append(response.url) if response.status>=400 else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/visual-fixture')
        self.page.wait_for_function('window.editor&&CodaMusicNotation.isReady()')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failed, [])

    def field(self, name):
        return self.page.locator('[data-visual-field="'+name+'"]')

    def value(self):
        return self.page.evaluate('editor.getValue()')

    def test_keyboard_highlights_spellings_descriptions_and_clear_are_real_changes(self):
        self.assertEqual(self.page.evaluate('changes'), [])
        self.field('type').select_option('keyboard')
        self.assertEqual(self.value(), {'kind':'keyboard', 'notes':[]})
        self.page.locator('[data-visual-key="C-sharp"]').click()
        self.assertEqual(self.value()['notes'], ['C-sharp'])
        self.assertEqual(self.page.locator('svg [data-piano-black="C-sharp"][data-piano-highlight]').count(), 1)
        self.field('keyboard-spelling').select_option('flat')
        self.assertEqual(self.value()['notes'], ['D-flat'])
        self.assertIn('D♭', self.page.locator('[data-visual-preview]').inner_text())
        self.field('keyboard-label').fill('Compare two neighboring keys')
        self.assertEqual(self.value()['label'], 'Compare two neighboring keys')
        self.assertIn('Compare two neighboring keys', self.page.locator('svg').get_attribute('aria-label'))
        self.page.locator('[data-visual-action="clear-keys"]').click()
        self.assertEqual(self.value()['notes'], [])
        self.assertEqual(self.page.locator('svg [data-piano-highlight]').count(), 0)

    def test_notes_and_clef_palette_edit_their_actual_diagrams(self):
        self.page.evaluate("editor.setValue({kind:'staff',clef:'treble',position:0})")
        self.assertEqual(self.page.evaluate('changes'), [], 'Opening an old staff must not convert it into an edit')
        self.page.locator('[data-notation-item="0"]').click()
        self.page.locator('[data-notation-control="duration"]').select_option('0.5')
        self.assertEqual(self.value()['kind'], 'notation')
        self.assertEqual(self.value()['score']['items'][0]['duration'], .5)
        self.field('type').select_option('clef')
        self.field('clef').select_option('bass')
        self.field('clef-page').select_option('spaces')
        self.assertEqual(self.value(), {'kind':'clef-intro','clef':'bass','page':'spaces'})
        self.assertGreater(self.page.locator('[data-visual-preview] svg').count(), 0)

    def test_keyboard_text_can_be_renamed_or_hidden_without_changing_the_key_map(self):
        self.field('type').select_option('keyboard')
        self.assertEqual(self.value(), {'kind':'keyboard','notes':[]}, 'Default visibility options are not unsaved edits')
        self.page.locator('[data-visual-action="keyboard-text-options"]').click()
        self.field('keyboard-two-label').fill('A pair of black keys')
        self.field('keyboard-three-label').fill('A trio of black keys')
        self.field('keyboard-lower-label').fill('Down in pitch')
        self.field('keyboard-higher-label').fill('Up in pitch')
        self.assertEqual(self.page.locator('svg [data-piano-group="2"]').text_content(), 'A pair of black keys')
        self.assertEqual(self.page.locator('svg [data-keyboard-direction="higher"]').text_content(), 'Up in pitch')
        self.field('keyboard-show-labels').uncheck()
        self.field('keyboard-show-groups').uncheck()
        self.field('keyboard-show-directions').uncheck()
        self.assertEqual(self.page.locator('svg [data-keyboard-white-label],svg [data-piano-group],svg [data-keyboard-direction]').count(), 0)
        self.assertEqual(self.page.locator('svg [data-piano-white]').count(), 8)
        self.assertEqual(self.value()['groupLabels'], {'two':'A pair of black keys','three':'A trio of black keys'})
        self.field('keyboard-show-groups').check()
        self.assertEqual(self.page.locator('svg [data-piano-group="3"]').text_content(), 'A trio of black keys')

    def test_legacy_piano_gold_key_and_other_existing_pictures_remain_editable(self):
        self.page.evaluate("editor.setValue({kind:'piano',target:7})")
        self.assertEqual(self.page.evaluate('changes'), [])
        self.assertEqual(self.page.locator('[data-visual-piano-target="7"]').get_attribute('aria-pressed'), 'true')
        self.page.locator('[data-visual-piano-target="0"]').click()
        self.assertEqual(self.value(), {'kind':'piano','target':0})
        self.assertEqual(self.page.locator('svg rect[fill="#f5d98d"]').count(), 1)
        before = self.page.evaluate('changes.length')
        self.page.evaluate("editor.setValue({kind:'scale',notes:['C','E-flat','G']})")
        self.assertEqual(self.page.evaluate('changes.length'), before)
        self.assertEqual(self.value()['notes'], ['C','E-flat','G'])
        self.field('type').select_option('keyboard')
        self.assertEqual(self.value(), {'kind':'keyboard','notes':[]})

    def test_phone_fit_and_revoked_permissions_prevent_late_event_writes(self):
        self.field('type').select_option('keyboard')
        self.page.set_viewport_size({'width':320,'height':800})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 320)
        for control in self.page.locator('button:visible,input:visible,select:visible').all():
            self.assertGreaterEqual(control.bounding_box()['height'], 44)
        before = self.page.evaluate('JSON.stringify(changes)')
        self.page.evaluate("editable=false;document.querySelector('[data-visual-key=\"C\"]').onclick()")
        self.assertEqual(self.value()['notes'], [])
        self.assertEqual(self.page.evaluate('JSON.stringify(changes)'), before)
        self.assertTrue(self.field('type').is_disabled())
        self.page.screenshot(path='/tmp/education-visual-editor-phone.png')


if __name__=='__main__':
    unittest.main(verbosity=2)
