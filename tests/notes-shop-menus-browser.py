"""Focused Notes Shop navigation and purchases against the real wallet and UI."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest

sys.dont_write_bytecode = True
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
HTML = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/activity-menus.css"><link rel="stylesheet" href="/notes-shop.css">
<style>body{margin:0;padding:12px;background:#152037;color:#f7f8ff;font-family:system-ui,sans-serif;box-sizing:border-box}
*{box-sizing:border-box}#panel{max-width:900px;margin:auto}button{cursor:pointer}#panelBody{padding:16px;max-height:calc(100dvh - 24px);overflow:auto;border:1px solid #8899b8;border-radius:16px}</style>
<section id="panel"><div id="panelBody"></div></section>
<script src="/character-renderer.js"></script><script src="/notes-shop.js"></script>
<script>
window.writeFail=false;window.writes=0;window.applied=0;window.wardrobeCalls=0;
window.avatar={name:'Guest',headwear:'none',hairstyle:'short',form:'human',pet:'none'};
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(writeFail)throw Error('quota');writes++;localStorage.setItem(key,value);}};
window.wallet=CodaNotesShop.createWallet({storage,getAvatar:()=>avatar});
window.shop=CodaNotesShop.createShopUI({wallet,renderer:createCodaCharacterRenderer(),panelBody,
 getAvatar:()=>({...avatar}),applyAvatar:next=>{Object.assign(avatar,next);applied++;return true;},
 openWardrobe:()=>wardrobeCalls++,openPanel:(title,options={})=>{panelBody.replaceChildren();panel.hidden=false;window.shopBack=options.onBack;}});
shop.open();
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();if(shopBack?.()!==true)panel.hidden=true;}});
window.fixtureReady=true;
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path == '/notes-shop-fixture':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif self.path == '/favicon.ico':
            self.send_response(204)
            self.end_headers()
        else:
            super().do_GET()


class NotesShopMenuTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium',
                                            args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1366, 'height':768})
        self.page = self.context.new_page()
        self.errors, self.missing = [], []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.missing.append(response.url)
                     if response.status >= 400 else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/notes-shop-fixture')
        self.page.wait_for_function('window.fixtureReady')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.missing, [])

    def action(self, name):
        return self.page.locator('[data-shop-page="' + name + '"]')

    def browse(self, category='all'):
        self.action('categories').click()
        self.page.locator('[data-shop-category="' + category + '"]').click()

    def saved(self):
        return self.page.evaluate('localStorage.getItem(CodaNotesShop.KEY)')

    def test_home_categories_search_and_wallet_are_read_only(self):
        before = self.saved()
        writes = self.page.evaluate('writes')
        self.assertEqual(self.page.locator('.notes-shop').get_attribute('data-shop-view'), 'home')
        self.assertEqual(self.page.locator('.notes-shop [data-shop-item]').count(), 0)
        self.assertEqual(self.page.locator('.kids-menu-grid>.kids-menu-card').count(), 4)
        self.browse()
        self.assertEqual(self.page.locator('[data-shop-item]').count(), self.page.evaluate('wallet.stock.length'))
        self.page.get_by_label('Search shop', exact=True).fill('witch')
        self.assertEqual(self.page.locator('[data-shop-item]').count(), 1)
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('.notes-shop').get_attribute('data-shop-view'), 'categories')
        self.page.keyboard.press('Escape')
        self.action('wallet').click()
        self.assertEqual(self.page.locator('.notes-purse-coin').count(), 5)
        self.assertEqual(self.page.locator('.notes-purse-coin strong').all_text_contents(), ['9','0','1','1','0'])
        self.assertEqual(self.saved(), before)
        self.assertEqual(self.page.evaluate('writes'), writes)
        self.page.keyboard.press('Escape')
        self.action('wardrobe').click()
        self.assertEqual(self.page.evaluate('wardrobeCalls'), 1)

    def test_buy_then_wear_is_explicit_and_does_not_double_spend(self):
        self.browse('headwear')
        self.page.get_by_label('Search shop', exact=True).fill('witch')
        self.page.get_by_role('button', name='Buy Crooked witch hat for 80 Notes', exact=True).click()
        self.assertEqual(self.page.evaluate('wallet.snapshot().balance'), 70)
        self.assertEqual(self.page.evaluate('avatar.headwear'), 'none')
        self.assertEqual(self.page.evaluate('applied'), 0)
        self.page.get_by_role('button', name='Wear Crooked witch hat', exact=True).click()
        self.assertEqual(self.page.evaluate('avatar.headwear'), 'witch')
        self.assertEqual(self.page.evaluate('applied'), 1)
        self.assertEqual(self.page.evaluate('wallet.snapshot().balance'), 70)
        self.assertIn('Now wearing Crooked witch hat', self.page.locator('.notes-shop-status').inner_text())
        self.assertEqual(self.page.evaluate('document.activeElement.getAttribute("aria-label")'), 'Wear Crooked witch hat')

    def test_big_goals_and_saving_failures_preserve_the_wallet(self):
        before = self.saved()
        self.action('premium').click()
        alien = self.page.locator('[data-shop-item="alien"]')
        self.assertIn('12000 Notes', alien.inner_text())
        self.assertIn('11850 more Notes needed', alien.inner_text())
        self.assertTrue(alien.get_by_role('button').is_disabled())
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('.notes-shop').get_attribute('data-shop-view'), 'home')
        self.browse('headwear')
        self.page.get_by_label('Search shop', exact=True).fill('witch')
        self.page.evaluate('writeFail=true')
        self.page.get_by_role('button', name='Buy Crooked witch hat for 80 Notes', exact=True).click()
        self.assertEqual(self.saved(), before)
        self.assertFalse(self.page.evaluate('wallet.owns("witch")'))
        self.assertEqual(self.page.evaluate('wallet.snapshot().balance'), 150)
        self.assertIn('No Notes were spent', self.page.locator('.notes-shop-status').inner_text())
        self.assertTrue(self.page.locator('[data-shop-item="witch"] button').is_disabled())

    def test_phone_browsing_fits_and_escape_walks_back_to_home(self):
        self.page.set_viewport_size({'width':320, 'height':740})
        for view in ['home','categories','items']:
            if view == 'categories':
                self.action('categories').click()
            elif view == 'items':
                self.page.locator('[data-shop-category="headwear"]').click()
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), 320)
            self.assertEqual(self.page.locator('.notes-shop').get_attribute('data-shop-view'), view)
            self.page.locator('[data-shop-heading]').scroll_into_view_if_needed()
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('.notes-shop').get_attribute('data-shop-view'), 'categories')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('.notes-shop').get_attribute('data-shop-view'), 'home')
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#panel').is_hidden())


if __name__ == '__main__':
    unittest.main(verbosity=2)
