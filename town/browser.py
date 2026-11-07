"""Town integration checks. Uses disposable browser state and no external services."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_): pass

class TownTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f'http://127.0.0.1:{cls.server.server_port}'
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop(); cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1280, 'height':900})
        self.page = self.context.new_page(); self.errors = []
        self.page.on('pageerror', lambda e:self.errors.append(str(e)))
        self.context.route('**/*', lambda r:r.continue_() if r.request.url.startswith(self.base) else r.abort())

    def tearDown(self):
        self.context.close(); self.assertEqual(self.errors, [])

    def test_arcade_entry_map_and_return(self):
        self.page.goto(self.base+'/world-preview.html')
        self.page.locator('#visitTown').click()
        frame = self.page.frame_locator('iframe[title="Coda Town"]')
        frame.locator('#mapButton').click()
        self.assertEqual(frame.locator('#directory > div').count(), 18)
        frame.get_by_role('button', name='Close map').click()
        frame.locator('#leaveButton').click()
        expect(self.page.locator('dialog[aria-label="Coda Town"]')).not_to_be_visible()
        self.assertFalse(self.page.locator('body').evaluate('(el)=>el.classList.contains("town-open")'))

    def test_home_lock_invitation_and_revocation(self):
        # Fixture moves the start to Bach's step; production has no teleport hook.
        source=(ROOT/'town/town.mjs').read_text().replace('player={...START}','player={x:1540,y:1710}')
        self.context.route('**/town/town.mjs', lambda r:r.fulfill(body=source,content_type='text/javascript'))
        fixture='''<iframe style="width:100vw;height:100vh;border:0" title="Town fixture" src="/town/"></iframe><script>
        let points=4; window.send=()=>document.querySelector('iframe').contentWindow.postMessage({type:'coda-town-state-result',people:[{id:'bach',relationship:{count:points}}]},location.origin);
        window.setPoints=n=>{points=n;send()};addEventListener('message',e=>{if(e.data.type==='coda-town-state')send()});</script>'''
        self.context.route('**/town-fixture',lambda r:r.fulfill(body=fixture,content_type='text/html'))
        self.page.goto(self.base+'/town-fixture')
        f=self.page.frame_locator('iframe');expect(f.locator('#prompt')).to_contain_text('Bach');f.locator('#world').focus();f.locator('#world').press('e')
        expect(f.locator('#storyText')).to_contain_text('private for now')
        f.get_by_role('button',name='Close conversation').click()
        self.page.evaluate('setPoints(5)');self.page.wait_for_timeout(150)
        f.locator('#world').press('e');self.page.wait_for_timeout(150)
        self.assertEqual(f.locator('#district').inner_text(),'Organ loft')
        self.page.evaluate('setPoints(0)');self.page.wait_for_timeout(150)
        self.assertEqual(f.locator('#district').inner_text(),'Coda Commons')

    def test_mobile_map_and_controls(self):
        self.context.close()
        self.context=self.browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
        self.page=self.context.new_page()
        self.page.goto(self.base+'/town/')
        self.assertTrue(self.page.locator('#touch').is_visible())
        self.page.locator('#mapButton').click()
        self.assertEqual(self.page.locator('#directory > div').count(),18)
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth <= innerWidth'))

    def test_walk_up_and_down_real_porch_stairs(self):
        source=(ROOT/'town/town.mjs').read_text().replace('player={...START}','player={x:1540,y:2040}')
        self.context.route('**/town/town.mjs',lambda r:r.fulfill(body=source,content_type='text/javascript'))
        self.page.goto(self.base+'/town/')
        world=self.page.locator('#world')
        expect(world).to_have_attribute('data-ground-height','96')
        world.focus();self.page.keyboard.down('w');self.page.wait_for_timeout(1900);self.page.keyboard.up('w')
        expect(world).to_have_attribute('data-ground-height','144')
        self.page.keyboard.down('s');self.page.wait_for_timeout(2200);self.page.keyboard.up('s')
        expect(world).to_have_attribute('data-ground-height','96')

    def test_cliff_cannot_be_walked_through(self):
        source=(ROOT/'town/town.mjs').read_text().replace('player={...START}','player={x:3000,y:3340}')
        self.context.route('**/town/town.mjs',lambda r:r.fulfill(body=source,content_type='text/javascript'))
        self.page.goto(self.base+'/town/')
        world=self.page.locator('#world');expect(world).to_have_attribute('data-ground-height','0')
        world.focus();self.page.keyboard.down('w');self.page.wait_for_timeout(800);self.page.keyboard.up('w')
        self.assertGreaterEqual(int(world.get_attribute('data-player-y')),3300)
        expect(world).to_have_attribute('data-ground-height','0')

if __name__=='__main__': unittest.main(verbosity=2)
