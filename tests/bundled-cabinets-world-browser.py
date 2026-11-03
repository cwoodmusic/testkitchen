"""Real bundled cabinets at Test Kitchen's deployed path.

Game pages, privacy wrappers, bridge handshakes, and menus are production files.
One explicitly labelled completion fixture uses each game's public result bridge;
it verifies integration and deduplication, not the game's scoring algorithm.
All services outside this checkout are blocked. No authentication is forged.
"""
import importlib.util
import json
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse

sys.dont_write_bytecode = True
from profile_menu_helpers import show_profile_page
from settings_menu_helpers import settings_page
from world_navigation_helpers import close_settings, open_cabinet

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://cwoodmusic.github.io'
PREFIX = '/testkitchen/'
WORLD = ORIGIN + PREFIX + 'world-preview.html?guest=1'
GAME_PATHS = ['games/pitch-race/', 'games/music-triad/', 'games/rhythm-room/', 'song-machine/']
GAME_IDS = ['pitch', 'triad', 'rhythm']

spec = importlib.util.spec_from_file_location('bundled_real_world', ROOT/'tests/learning-world-browser.py')
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)


class BundledCabinetsWorldTests(world.WorldBrowserCase):
    def route_checkout(self, route):
        path = unquote(urlparse(route.request.url).path)
        if path == '/favicon.ico':
            return route.fulfill(status=204)
        if not path.startswith(PREFIX):
            self.unexpected_project_paths.append(path)
            return route.fulfill(status=404, body='Standalone project paths are not bundled cabinets')
        file = (ROOT/path.removeprefix(PREFIX)).resolve()
        if file.is_dir():
            file = file/'index.html'
        if not file.is_relative_to(ROOT) or not file.is_file():
            self.failures.append(path)
            return route.fulfill(status=404, body='Missing bundled resource')
        return route.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0]
                             or 'application/octet-stream')

    def setUp(self):
        self.requests = []
        self.unexpected_project_paths = []
        self.listening = False
        super().setUp()

    def load(self):
        if not self.listening:
            self.context.on('request', lambda request:self.requests.append(request.url))
            self.listening = True
        self.page.goto(WORLD, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')

    def tearDown(self):
        super().tearDown()
        self.assertEqual(self.unexpected_project_paths, [], 'Cabinets must stay inside Test Kitchen')
        self.assertEqual([url for url in self.requests if 'firebasejs/' in url], [],
                         'Classroom single-player games must not load another Firebase SDK')
        self.assertEqual([url for url in self.requests if '.firebaseio.com/' in url], [],
                         'Local cabinet play must not read or write a live database')

    def cabinet(self, index):
        open_cabinet(self.page, index)
        expected = ORIGIN + PREFIX + GAME_PATHS[index]
        self.page.wait_for_function('''prefix=>{
          const frame=document.querySelector('#gameiframe');
          return frame?.contentWindow?.location.href.startsWith(prefix)
            &&frame.contentDocument?.readyState==='complete';
        }''', arg=expected)
        frame = self.page.locator('#gameiframe').element_handle().content_frame()
        self.assertTrue(frame.url.startswith(expected), frame.url)
        if index < 3:
            frame.wait_for_function('typeof CodaBridge?.report==="function"')
            self.page.wait_for_function('CodaArcadeQA.missions().connection?.connected===true')
            self.assertEqual(frame.locator('html').get_attribute('data-coda-game'), GAME_IDS[index])
            if index < 2:
                self.assertTrue(frame.evaluate('CodaBridge.getState().connected'))
            self.assertTrue(frame.evaluate('CodaGamePrivacy.enabled'))
        self.assertTrue(frame.evaluate('localStorage===parent.localStorage'))
        self.assertTrue(frame.evaluate('localStorage.__codaClassroomScoped===true'))
        return frame

    def return_world(self):
        self.page.locator('#returnworld').click()
        self.page.wait_for_function('!CodaArcadeQA.menu().gameOpen')
        self.assertTrue(self.page.locator('#gameoverlay').is_hidden())

    def test_real_cabinet_pages_handshake_and_inherit_the_existing_scoped_store(self):
        for index, name in enumerate(['Pitch Race', 'Music Triad', 'Rhythm Room', 'Song Machine']):
            with self.subTest(game=name):
                frame = self.cabinet(index)
                parent = self.page.evaluate("localStorage.getItem('codaPianoTakeV1')")
                marker = json.dumps({'bundled_scope_fixture': name})
                frame.evaluate("value=>localStorage.setItem('codaPianoTakeV1',value)", marker)
                self.assertEqual(self.page.evaluate("localStorage.getItem('codaPianoTakeV1')"), marker)
                frame.evaluate("value=>value===null?localStorage.removeItem('codaPianoTakeV1'):localStorage.setItem('codaPianoTakeV1',value)", parent)
                self.return_world()

    def test_public_bridge_completion_fixture_updates_world_records_once_per_bundled_game(self):
        fixtures = [
            {'mode':'classic','score':120,'correct':12,'misses':0,'streak':12,'won':True,'perfect':True},
            {'mode':'computer','score':9,'captures':4,'won':True,'comeback':False},
            {'mode':'tap','total':16,'hits':12,'missed':4,'extra':0,'early':0,'late':0,'perfect':False},
        ]
        for index, result in enumerate(fixtures):
            with self.subTest(game=GAME_IDS[index]):
                frame = self.cabinet(index)
                run = 'bundled-public-bridge-fixture-' + GAME_IDS[index]
                before = self.page.evaluate('CodaArcadeQA.progression().xp')
                # Explicit boundary fixture: real bridge implementation, no fake
                # parent token and no modification to the game's scoring state.
                frame.evaluate('''({run,result})=>CodaBridge.report(run,result)''', {'run':run,'result':result})
                self.page.wait_for_function('xp=>CodaArcadeQA.progression().xp>xp', arg=before)
                recorded = self.page.evaluate('''()=>({xp:CodaArcadeQA.progression().xp,
                    notes:CodaArcadeQA.notes().balance,rewards:CodaArcadeQA.notes().rewards})''')
                frame.evaluate('''({run,result})=>CodaBridge.report(run,result)''', {'run':run,'result':result})
                self.page.wait_for_timeout(100)
                self.assertEqual(self.page.evaluate('''()=>({xp:CodaArcadeQA.progression().xp,
                    notes:CodaArcadeQA.notes().balance,rewards:CodaArcadeQA.notes().rewards})'''), recorded)
                self.return_world()

    def test_actual_single_player_starts_do_not_connect_to_external_profile_services(self):
        frame = self.cabinet(0)
        frame.locator('#classicCard').click()
        frame.locator('#menuPlay').click()
        frame.locator('#playerStaff').wait_for(state='visible')
        self.return_world()
        frame = self.cabinet(1)
        frame.locator('#vsComputer').click()
        frame.locator('#hand .pick').first.wait_for(state='visible')
        self.return_world()
        frame = self.cabinet(2)
        frame.locator('#choose-tap').click()
        frame.locator('#tap-pad').wait_for(state='visible')
        self.return_world()

    def test_settings_profile_and_card_options_remain_available_after_return_and_reload(self):
        frame = self.cabinet(0)
        self.assertTrue(frame.evaluate('CodaGamePrivacy.enabled'))
        self.return_world()
        settings_page(self.page, 'reading')
        self.assertTrue(self.page.locator('#worldMenu .dialogue-text-settings').is_visible())
        close_settings(self.page)
        self.page.locator('#levelBtn').click()
        self.assertTrue(self.page.locator('.player-profile').is_visible())
        show_profile_page(self.page, 'learning')
        self.assertTrue(self.page.locator('.profile-lessons').is_visible())
        show_profile_page(self.page, 'home')
        self.page.get_by_role('button', name='Classroom profile', exact=True).click()
        self.assertTrue(self.page.locator('#classpassJoinInput').is_visible())
        self.assertTrue(self.page.locator('#classpassJoin').is_visible())
        self.page.locator('#panelClose').click()
        self.load()
        self.assertEqual(urlparse(self.page.url).path, PREFIX+'world-preview.html')
        self.cabinet(1)
        self.return_world()


if __name__ == '__main__':
    unittest.main()
