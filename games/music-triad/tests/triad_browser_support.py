"""Bundled Music Triad and Test Kitchen, routed locally at their deployed paths."""
import mimetypes
import os
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ARCADE_ROOT = Path(os.environ.get('CODA_ARCADE_ROOT', ROOT.parents[1]))
sys.dont_write_bytecode = True
sys.path.insert(0, str(ARCADE_ROOT / 'tests'))
from world_navigation_helpers import approach_musician, open_cabinet, open_destination, talk_to_musician

ORIGIN = 'https://cwoodmusic.github.io'
ARCADE_PATH = '/testkitchen/'
TRIAD_PATH = ARCADE_PATH + 'games/music-triad/'
WORLD = ORIGIN + ARCADE_PATH + 'world-preview.html'
TRIAD = ORIGIN + TRIAD_PATH


class TriadBrowserCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'),
            args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1440, 'height': 1000})
        # Keep real public allowlists and origins; no external service is contacted.
        self.context.route('https://**/*', lambda route: route.abort())
        self.context.route(ORIGIN + '/**', self.route_checkout)
        self.context.add_init_script('''
          window.__messages=[];
          addEventListener('message',event=>{
            if(event.data?.coda===1)window.__messages.push({data:event.data,origin:event.origin});
          });
          if(location.pathname==='/testkitchen/world-preview.html')
            localStorage.setItem('codaArcadeFXV1','off');
        ''')
        self.page = self.context.new_page()
        self.page.set_default_timeout(15000)
        self.errors = []
        self.missing = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def tearDown(self):
        outcome = self._outcome.result
        if any(case is self for case, _ in outcome.errors + outcome.failures):
            for frame in self.page.frames:
                if urlparse(frame.url).path.startswith(TRIAD_PATH):
                    try:
                        print('\nTriad failure state:', json.dumps(frame.evaluate('''()=>({
                          status:document.querySelector('#status')?.textContent,
                          animation:window.MusicTriadAnimationQA?.state(),
                          bridge:window.codaTriadState,cues:window.__cues,
                          audio:window.MusicTriadAudioQA?.snapshot()})'''), sort_keys=True))
                    except Exception:
                        pass
        self.context.close()
        self.assertEqual(self.errors, [], 'Uncaught browser errors')
        self.assertEqual(self.missing, [], 'Missing local resources')

    def route_checkout(self, route):
        path = unquote(urlparse(route.request.url).path)
        if path == '/favicon.ico':
            return route.fulfill(status=204)
        if path.startswith(TRIAD_PATH):
            base, relative = ROOT, path.removeprefix(TRIAD_PATH)
        elif path.startswith(ARCADE_PATH):
            base, relative = ARCADE_ROOT, path.removeprefix(ARCADE_PATH)
        else:
            return route.abort()
        file = (base / (relative or 'index.html')).resolve()
        if not file.is_relative_to(base.resolve()) or not file.is_file():
            self.missing.append(path)
            return route.fulfill(status=404, body='Missing local test resource')
        return route.fulfill(path=str(file), content_type=mimetypes.guess_type(str(file))[0]
                            or 'application/octet-stream')

    def load_world(self):
        self.page.goto(WORLD, wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')

    def cabinet(self):
        open_cabinet(self.page, 1)
        self.page.wait_for_function('document.querySelector("#gameiframe").contentWindow.CodaBridge')
        frame = self.page.locator('#gameiframe').element_handle().content_frame()
        self.assertTrue(frame.url.startswith(TRIAD), 'The cabinet must load the actual bundled Triad files')
        return frame

    def open_mission(self, person):
        approach_musician(self.page, person)
        name = self.page.evaluate('id=>CodaArcadeQA.characters().npcs.find(item=>item.id===id).name', person)
        # Missions live in the musician roster; dialogue now opens history.
        # The distance check still requires standing beside the actual musician.
        self.page.locator('#musiciansBtn').evaluate('button=>button.click()')
        self.page.get_by_role('button', name='Missions from ' + name, exact=True).click()

    def accept_mission(self, person):
        self.open_mission(person)
        self.page.get_by_role('button', name='Accept mission', exact=True).click()
        self.page.locator('#panelClose').click()

    def start(self, frame, advanced=False, difficulty='Normal'):
        if frame.locator('#startScreen').is_visible():
            if frame.locator('#homeModeToggle').is_checked() != advanced:
                frame.locator('label.mode-toggle').click()
            frame.locator('#vsComputer').click()
        frame.locator('#level').select_option(difficulty)
        frame.evaluate('''()=>{
          window.__cues=[];
          if(!window.__originalFanfare){
            window.__originalFanfare=fanfare;
            fanfare=function(kind){
              window.__cues.push({kind,time:performance.now(),
                animation:window.MusicTriadAnimationQA?.state()});
              return window.__originalFanfare(kind);
            };
          }
        }''')

    def position(self, frame, won=True, captures=True):
        """Supply a near-final board; the real hand/cell click executes rules."""
        return frame.evaluate('''({won,captures})=>{
          window.cancelTriadAnimations?.();
          const advanced=window.musicTriadAdvancedSelected(),n=advanced?16:9;
          const empty=advanced?5:4;
          const mine=advanced?[0,2,3,7,10,11]:[0,2];
          board=Array.from({length:n},(_,i)=>i===empty?null:{owner:won&&mine.includes(i)?0:1,
            e:['sn','sn','sn','sn'],meter:'4/4'});
          const attack=won&&captures?'wn':'sn';
          hands=[[{owner:0,e:Array(4).fill(attack),meter:'4/4'}],
                 [{owner:1,e:Array(4).fill('sn'),meter:'4/4'}]];
          selected=null;turn=0;busy=false;endSoundPlayed=false;
          window.codaTriadReset();render();
          return {empty,size:n};
        }''', {'won': won, 'captures': captures})

    def last_move(self, frame, position):
        frame.locator('#hand .pick').first.click()
        frame.evaluate('window.__lastMoveStarted=performance.now()')
        frame.locator('#board .slot').nth(position['empty']).click()

    def settle(self, frame):
        frame.wait_for_function('''()=>{
          const state=window.MusicTriadAnimationQA?.state();
          return state&&!state.pending&&!state.clashes&&!state.captures&&endSoundPlayed;
        }''', timeout=30000)

    def totals(self):
        return self.page.evaluate('''()=>({notes:CodaArcadeQA.notes().balance,
          xp:CodaArcadeQA.progression().xp,
          rewards:CodaArcadeQA.progression().achievementRewards.map(item=>item.id)})''')

    def reports(self):
        return self.page.evaluate('window.__messages.filter(m=>m.data.type==="result").map(m=>m.data)')

    def home(self, frame):
        frame.locator('#homeBtn').click()
        frame.locator('#exitConfirmYes').click()
        frame.wait_for_function('!document.querySelector("#startScreen").classList.contains("hidden")')


__all__ = ['TriadBrowserCase', 'TRIAD', 'ORIGIN', 'open_destination', 'talk_to_musician']
