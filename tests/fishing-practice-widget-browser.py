"""Practice settings preserve choices and stay usable with touch and a keyboard."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/rhythm-fishing.css"><link rel="stylesheet" href="/fishing-practice.css">
<main id="room" class="rhythm-fishing"><button id="launch">Practice rhythm</button></main>
<script src="/fishing-practice.js"></script><script>
window.calls=[];window.outsideKeys=[];
window.practice=createCodaFishingPractice({host:document.querySelector('#room'),
 onOpen:state=>calls.push({kind:'open',...state}),
 onClose:state=>calls.push({kind:'close',...state}),
 onStart:settings=>calls.push({kind:'start',...settings})});
document.querySelector('#launch').onclick=()=>practice.open();
addEventListener('keydown',event=>outsideKeys.push(event.key));
</script></html>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != '/practice-widget':
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(HTML.encode())


class FishingPracticeWidgetTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.p = sync_playwright().start()
        cls.browser = cls.p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.p.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1100, 'height': 800}, has_touch=True)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/practice-widget')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def choice(self, value):
        return self.page.locator('.fishing-practice-choice').filter(has=self.page.locator(f'input[value="{value}"]'))

    def test_all_meter_and_difficulty_choices_start_once_and_are_remembered(self):
        for meter in ['4/4', '6/8', '2/2']:
            for rarity in ['common', 'uncommon', 'rare', 'epic', 'legendary']:
                self.page.locator('#launch').click()
                self.choice(meter).click()
                self.choice(rarity).click()
                self.page.locator('#fishingPracticeStart').click()
                state = self.page.evaluate('practice.getState()')
                self.assertEqual(state, {'open': False, 'meter': meter, 'rarity': rarity})
                calls = self.page.evaluate('calls.slice(-3)')
                self.assertEqual([call['kind'] for call in calls], ['open', 'close', 'start'])
                self.assertEqual(calls[1]['reason'], 'start')
                self.assertEqual(calls[2], {'kind': 'start', 'meter': meter, 'rarity': rarity})
                self.assertFalse(self.page.locator('#fishingPracticePanel').is_visible())
        self.page.locator('#launch').click()
        self.assertTrue(self.page.locator('input[value="legendary"]').is_checked())
        self.assertTrue(self.page.locator('input[value="2/2"]').is_checked())
        self.assertEqual(len(self.page.evaluate('calls.filter(call=>call.kind==="start")')), 15)

    def test_keyboard_focus_escape_and_cleanup_do_not_leak_controls_outside_the_modal(self):
        self.page.locator('#launch').click()
        self.assertTrue(self.page.locator('input[value="4/4"]').evaluate('node=>node===document.activeElement'))
        self.page.keyboard.press('ArrowRight')
        self.assertTrue(self.page.locator('input[value="6/8"]').is_checked())
        self.page.locator('#fishingPracticeStart').focus()
        self.page.keyboard.press('Tab')
        self.assertTrue(self.page.locator('#fishingPracticeClose').evaluate('node=>node===document.activeElement'))
        self.page.keyboard.press('Shift+Tab')
        self.assertTrue(self.page.locator('#fishingPracticeStart').evaluate('node=>node===document.activeElement'))
        self.page.keyboard.press('a')
        self.assertEqual(self.page.evaluate('outsideKeys'), [])
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('practice.getState().open'))
        self.assertTrue(self.page.locator('#launch').evaluate('node=>node===document.activeElement'))
        self.assertEqual(self.page.evaluate('calls.filter(call=>call.kind==="start")'), [])
        self.page.evaluate('practice.open({meter:"2/2",rarity:"legendary"});practice.destroy()')
        self.assertEqual(self.page.locator('#fishingPracticeBackdrop').count(), 0)
        self.page.keyboard.press('d')
        self.assertEqual(self.page.evaluate('outsideKeys'), ['d'])
        self.assertFalse(self.page.evaluate('practice.open()'))

    def test_portrait_narrow_and_landscape_have_large_touch_choices_and_a_reachable_start_button(self):
        for size in [{'width': 390, 'height': 844}, {'width': 320, 'height': 700}, {'width': 844, 'height': 390}]:
            self.page.set_viewport_size(size)
            self.page.locator('#launch').tap()
            panel = self.page.locator('#fishingPracticePanel').bounding_box()
            self.assertGreaterEqual(panel['x'], 0)
            self.assertLessEqual(panel['x'] + panel['width'], size['width'])
            self.assertLessEqual(panel['height'], size['height'] - 15)
            self.assertLessEqual(self.page.locator('#fishingPracticePanel').evaluate('node=>node.scrollWidth'), panel['width'])
            for value in ['4/4', '6/8', '2/2', 'common', 'uncommon', 'rare', 'epic', 'legendary']:
                choice = self.choice(value)
                choice.scroll_into_view_if_needed()
                box = choice.bounding_box()
                self.assertGreaterEqual(box['height'], 60)
                choice.tap()
                self.assertTrue(choice.locator('input').is_checked())
            start = self.page.locator('#fishingPracticeStart')
            start.scroll_into_view_if_needed()
            box = start.bounding_box()
            self.assertGreaterEqual(box['height'], 56)
            self.assertLessEqual(box['y'] + box['height'], size['height'])
            self.page.screenshot(path=f'/tmp/coda-practice37-{size["width"]}.png')
            start.tap()
            self.assertFalse(self.page.evaluate('practice.getState().open'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
