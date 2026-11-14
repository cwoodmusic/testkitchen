"""Real Games menu launch/return, with all external services blocked."""
import importlib.util
import mimetypes
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://cwoodmusic.github.io'
PREFIX = '/testkitchen/'
WORLD = ORIGIN + PREFIX + 'world-preview.html?guest=1'
GAME = ORIGIN + PREFIX + 'games/rhythm-blocks/'
spec = importlib.util.spec_from_file_location('rhythm_blocks_world', ROOT/'tests/learning-world-browser.py')
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)


class RhythmBlocksLaunchTests(world.WorldBrowserCase):
    def route_checkout(self, route):
        path = unquote(urlparse(route.request.url).path)
        if path == '/favicon.ico':
            return route.fulfill(status=204)
        if not path.startswith(PREFIX):
            self.failures.append(path)
            return route.fulfill(status=404, body='Outside the current arcade package')
        file = (ROOT/path.removeprefix(PREFIX)).resolve()
        if file.is_dir():
            file = file/'index.html'
        if not file.is_relative_to(ROOT) or not file.is_file():
            self.failures.append(path)
            return route.fulfill(status=404, body='Missing game resource')
        return route.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0]
                             or 'application/octet-stream')

    def load(self):
        self.page.goto(WORLD, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')

    def open_game(self):
        self.page.locator('#worldGamesBtn').click()
        self.assertEqual(self.page.locator('#panelTitle').inner_text(), 'Arcade games')
        self.assertEqual(self.page.locator('#panelBody [data-arcade-game]').all_text_contents(),
                         ['Pitch Race', 'Music Triad', 'Rhythm Room', 'Song Machine', 'Rhythm Blocks'])
        self.page.locator('[data-arcade-game="rhythm-blocks"]').click()
        self.page.wait_for_function('''prefix=>{
          const frame=document.querySelector('#gameiframe');
          return frame?.contentWindow?.location.href.startsWith(prefix)
            &&frame.contentDocument?.readyState==='complete';
        }''', arg=GAME)
        self.assertTrue(self.page.locator('#gameoverlay').is_visible())
        self.assertEqual(self.page.locator('#activegame').inner_text(), 'Rhythm Blocks')
        return self.page.locator('#gameiframe').element_handle().content_frame()

    def test_menu_launch_and_in_game_return_preserve_the_world_without_a_reward_bridge(self):
        before = self.page.evaluate('''()=>({xp:CodaArcadeQA.progression().xp,
            notes:CodaArcadeQA.notes().balance,rewards:CodaArcadeQA.notes().rewards})''')
        cabinets = self.page.evaluate('CodaArcadeQA.worldObjects().filter(item=>item.game).map(item=>item.game.name)')
        self.assertEqual(cabinets, ['Pitch Race', 'Music Triad', 'Rhythm Room', 'Song Machine'])
        frame = self.open_game()
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.missions().connection'))
        self.assertFalse(frame.evaluate("typeof CodaBridge!=='undefined'"))
        frame.wait_for_function("document.activeElement?.id==='primary-action'")
        self.assertTrue(self.page.evaluate("document.activeElement===document.querySelector('#gameiframe')"))
        self.page.keyboard.press('Enter')
        frame.wait_for_function("rhythmBlocks.state.phase==='falling'")
        frame.get_by_role('link', name=re.compile('arcade', re.I)).click()
        self.page.wait_for_function('!CodaArcadeQA.menu().gameOpen')
        self.assertEqual(self.page.url, WORLD)
        self.assertTrue(self.page.locator('#gameoverlay').is_hidden())
        self.assertEqual(self.page.locator('#gameiframe').get_attribute('src'), 'about:blank')
        self.assertEqual(before, self.page.evaluate('''()=>({xp:CodaArcadeQA.progression().xp,
            notes:CodaArcadeQA.notes().balance,rewards:CodaArcadeQA.notes().rewards})'''))

    def test_close_messages_require_the_active_game_window_origin_and_identity(self):
        frame = self.open_game()
        self.page.evaluate('''()=>{
          const data={coda:1,game:'rhythm-blocks',type:'close'},frame=document.querySelector('#gameiframe');
          dispatchEvent(new MessageEvent('message',{data,origin:location.origin,source:window}));
          dispatchEvent(new MessageEvent('message',{data,origin:'https://untrusted.example',source:frame.contentWindow}));
        }''')
        frame.evaluate("parent.postMessage({coda:1,game:'rhythm',type:'close'},location.origin)")
        self.page.wait_for_timeout(100)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.menu().gameOpen'))
        # A transport-only fixture exercises navigation inside the same iframe:
        # its original src attribute still names Rhythm Blocks after navigation.
        fixture = ORIGIN+PREFIX+'rhythm-blocks-close-fixture.html'
        self.page.route(fixture, lambda route:route.fulfill(status=200, content_type='text/html',
                        body='<!doctype html><title>Same-origin close boundary fixture</title>'))
        frame.goto(fixture)
        self.assertTrue(self.page.locator('#gameiframe').get_attribute('src').startswith(GAME))
        frame.evaluate("parent.postMessage({coda:1,game:'rhythm-blocks',type:'close'},location.origin)")
        self.page.wait_for_timeout(100)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.menu().gameOpen'))
        self.page.locator('#returnworld').click()
        self.page.locator('#worldGamesBtn').click()
        self.page.locator('[data-arcade-game="0"]').click()
        self.page.wait_for_function("document.querySelector('#gameiframe').contentDocument?.documentElement.dataset.codaGame==='pitch'")
        other = self.page.locator('#gameiframe').element_handle().content_frame()
        other.evaluate("parent.postMessage({coda:1,game:'rhythm-blocks',type:'close'},location.origin)")
        self.page.wait_for_timeout(100)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.menu().gameOpen'))
        self.page.locator('#returnworld').click()

    def test_mobile_games_entry_fits_the_existing_header(self):
        self.page.set_viewport_size({'width':390, 'height':844})
        self.load()
        self.assertTrue(self.page.locator('#worldGamesBtn').is_visible())
        self.assertTrue(self.page.locator('#worldGamesBtn').evaluate('button=>{const r=button.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;}'))
        frame = self.open_game()
        frame.get_by_role('link', name=re.compile('arcade', re.I)).click()
        self.page.wait_for_function('!CodaArcadeQA.menu().gameOpen')
        self.assertTrue(self.page.locator('#worldGamesBtn').is_visible())

    def test_standalone_return_stays_under_the_current_package_prefix(self):
        self.page.goto(GAME, wait_until='domcontentloaded')
        back = self.page.get_by_role('link', name=re.compile('arcade', re.I))
        self.assertEqual(back.evaluate('link=>new URL(link.href).pathname'), PREFIX+'world-preview.html')
        back.click()
        self.page.wait_for_url(lambda url:urlparse(url).path==PREFIX+'world-preview.html')


if __name__ == '__main__':
    unittest.main()
