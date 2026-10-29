"""Exercise collision editing through keyboard, fullscreen, and live movement.

Uses disposable browser profiles and the actual published world project.
Requires Python Playwright and Chromium; no accounts or external services.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class CollisionIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1600, 'height':1000})
        self.context.route('https://**/*', lambda route:route.abort())
        self.context.add_init_script('''(()=>{
          localStorage.setItem('codaArcadeFXV1','off');
          window.collisionFrames=count=>new Promise(resolve=>{
            const next=()=>{if(--count<=0)resolve();else requestAnimationFrame(next);};
            requestAnimationFrame(next);
          });
        })()''')
        self.page = self.context.new_page(); self.page.set_default_timeout(7000)
        self.errors = []; self.failures = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('console', lambda message:self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response:self.failures.append(response.url)
                     if response.status>=400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/world-preview.html',
                       wait_until='domcontentloaded')
        try:self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.characters().spriteState.ready')
        except Exception as error:
            raise AssertionError({'errors':self.errors,'failures':self.failures,'initialization':self.page.evaluate('({developer:typeof CodaDeveloperConsole,qa:typeof CodaArcadeQA,renderer:typeof createCodaCharacterRenderer})')}) from error

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'Collision editing must not cause frame/page errors')
        self.assertEqual(self.failures, [], 'Failed local world resources')

    def canvas_point(self, x, y):
        self.page.locator('#view').scroll_into_view_if_needed()
        return self.page.evaluate('''([x,y])=>{
          const box=view.getBoundingClientRect(),cam=CodaArcadeQA.camera();
          return {x:box.left+(x-cam.x)*cam.zoom*box.width/1672,
                  y:box.top+(y-cam.y)*cam.zoom*box.height/941};
        }''', [x,y])

    def paint(self, x, y, tool='block', size='1'):
        self.page.get_by_label('Collision tool', exact=True).select_option(tool)
        self.page.get_by_label('Collision brush', exact=True).select_option(size)
        point = self.canvas_point(x,y)
        self.assertTrue(self.page.evaluate('''({x,y})=>document.elementFromPoint(x,y)===view''', point),
                        'The map must remain reachable alongside the collision controls')
        self.page.mouse.click(**point)

    def open_collision(self):
        self.page.locator('#view').focus()
        self.page.keyboard.press('c')
        self.assertTrue(self.page.locator('#dev-collision').is_visible())

    def test_collision_shortcut_switches_tabs_and_exits_playtest(self):
        self.page.locator('#worldDeveloperBtn').click()
        for tab in ['objects','layers','project']:
            with self.subTest(tab=tab):
                self.page.locator('#devTab-'+tab).click()
                self.open_collision()
                self.assertEqual(self.page.locator('#devTab-collision').get_attribute('aria-selected'), 'true')
        self.page.locator('#devTab-objects').click()
        self.page.locator('#assetName').focus(); self.page.keyboard.press('c')
        self.assertTrue(self.page.locator('#dev-objects').is_visible(), 'Typing must keep the current editor tab')
        for modifier in ['Control','Meta','Alt']:
            self.page.locator('#view').focus(); self.page.keyboard.press(modifier+'+c')
            self.assertTrue(self.page.locator('#dev-objects').is_visible(), modifier+'+C is not an editor shortcut')
        self.page.locator('#devPlaytest').click()
        self.assertEqual(self.page.locator('#devPlaytest').get_attribute('aria-pressed'), 'true')
        self.open_collision()
        self.assertEqual(self.page.locator('#devPlaytest').get_attribute('aria-pressed'), 'false')
        self.paint(1205,505,'open')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(1205,505)'))

    def test_fullscreen_keeps_collision_controls_and_map_in_the_same_view(self):
        open_settings(self.page);self.page.locator('#fs').click();close_settings(self.page)
        self.page.wait_for_function('document.fullscreenElement')
        self.open_collision()
        self.assertTrue(self.page.evaluate('document.fullscreenElement.contains(assetStudio)'),
                        'The fullscreen surface must contain the developer console')
        self.paint(1205,505,'open')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(1205,505)'))
        self.paint(1205,505,'block')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1205,505)'))

    def test_mobile_collision_controls_leave_the_map_accessible(self):
        self.page.set_viewport_size({'width':390, 'height':844})
        self.page.locator('#worldDeveloperBtn').click()
        self.page.locator('#devTab-collision').click()
        self.page.locator('#view').scroll_into_view_if_needed()
        # The phone keeps its 150% world framing. This east-side target starts
        # just outside the viewport, so bring it onto the map using the actual
        # editor's right-drag gesture instead of changing camera internals.
        before=self.page.evaluate('CodaArcadeQA.camera()')
        start={'x':250,'y':350};end={'x':150,'y':350}
        self.assertTrue(self.page.evaluate('''point=>document.elementFromPoint(point.x,point.y)===view''',start))
        self.page.mouse.move(**start);self.page.mouse.down(button='right')
        self.page.mouse.move(**end,steps=5);self.page.mouse.up(button='right')
        self.assertGreater(self.page.evaluate('CodaArcadeQA.camera().x'),before['x']+30)
        self.assertTrue(self.page.locator('#assetStudio .dev-camera').evaluate('''node=>{
          const box=node.getBoundingClientRect();return box.top>=0&&box.bottom<=innerHeight;
        }'''),'Camera controls stay visible while panning and painting the map')
        self.paint(1205,505,'open')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(1205,505)'))
        self.paint(1205,505,'block')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1205,505)'))
        self.page.locator('#devPlaytest').click()
        self.assertEqual(self.page.locator('#devPlaytest').get_attribute('aria-pressed'), 'true')

    def test_opening_collision_editor_finishes_an_active_conversation(self):
        for entry,tool,expected in [('shortcut','open',True),('button','block',False)]:
            with self.subTest(entry=entry):
                self.assertTrue(self.page.evaluate('''()=>{
                  for(const npc of CodaArcadeQA.characters().npcs)if(!npc.hidden)
                    for(const [dx,dy]of [[30,0],[-30,0],[0,30],[0,-30]])
                      if(CodaArcadeQA.place(npc.x+dx,npc.y+dy))return true;
                  return false;
                }'''))
                self.page.evaluate('collisionFrames(3)')
                self.page.locator('#view').focus(); self.page.keyboard.press('e')
                self.page.wait_for_function('CodaArcadeQA.conversation().open')
                if entry=='shortcut':
                    self.open_collision()
                else:
                    self.page.locator('#worldDeveloperBtn').click()
                    self.page.locator('#devTab-collision').click()
                self.assertFalse(self.page.evaluate('CodaArcadeQA.conversation().open'))
                self.paint(1205,505,tool)
                self.assertEqual(self.page.evaluate('CodaArcadeQA.walkable(1205,505)'),expected)
                self.page.locator('#assetClose').click()

    def test_displayed_collision_cells_match_walking_everywhere(self):
        result=self.page.evaluate('''()=>{
          const grid=CodaArcadeQA.collisionGrid(),mismatches=[];let checked=0;
          for(let gy=0;gy<grid.height;gy++)for(let gx=0;gx<grid.width;gx++)
            for(const [dx,dy]of [[1,1],[1,5],[5,1],[5,5],[9,5],[5,9],[9,9]]){
              const x=gx*grid.cellSize+dx,y=gy*grid.cellSize+dy;
              if(x>=1672||y>=941)continue;
              const expected=!!grid.cells[gy*grid.width+gx],actual=CodaArcadeQA.walkable(x,y);
              checked++;if(expected!==actual&&mismatches.length<12)mismatches.push({x,y,expected,actual});
            }
          return {checked,mismatches};
        }''')
        self.assertGreater(result['checked'],100000)
        self.assertEqual(result['mismatches'],[],
                         'Old geometry rules must not contradict green/red collision cells')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(1205,459)'),
                        'The green cell above the counter includes its entire visible edge')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1591,355)'),
                         'Old blue floor annotations must not reopen a red cell')

    def test_restoring_a_green_cell_releases_the_old_hidden_wall_edge(self):
        self.open_collision()
        # Build the neighboring barrier explicitly; the published user layout
        # may legitimately make this next cell green as well.
        self.paint(1205,465,'block');self.paint(1205,455,'block')
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(1205,445)'))
        self.page.locator('#view').focus();self.page.keyboard.down('s')
        self.page.evaluate('collisionFrames(18)');self.page.keyboard.up('s')
        self.assertLess(self.page.evaluate('CodaArcadeQA.position().y'),450)
        self.page.locator('#devPlaytest').click();self.paint(1205,455,'restore')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(1205,459)'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1205,465)'),
                         'Restoring one cell must preserve the neighboring painted barrier')
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(1205,455)'))
        self.page.locator('#view').focus();self.page.keyboard.down('s')
        self.page.evaluate('collisionFrames(18)');self.page.keyboard.up('s')
        position=self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(position['y'],457.5,
                           'Walking must reach the green cell edge instead of the old hidden boundary')
        self.assertLess(position['y'],460,'The next red cell must still stop walking')

    def test_red_cells_stop_walking_in_the_old_blue_dance_passage(self):
        self.open_collision();self.paint(815,665,'block')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(815,665)'))
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(815,645)'))
        self.page.locator('#view').focus();self.page.keyboard.down('s')
        self.page.evaluate('collisionFrames(18)');self.page.keyboard.up('s')
        self.assertLess(self.page.evaluate('CodaArcadeQA.position().y'),660,
                        'A red cell must stop WASD inside the formerly forced-open corridor')
        self.page.mouse.click(**self.canvas_point(815,705))
        self.page.wait_for_function('CodaArcadeQA.position().y>695')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(815,665)'),
                         'Click navigation must find another way without reopening the blocked cell')
        self.page.locator('#devPlaytest').click();self.paint(815,665,'open')
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(815,645)'))
        self.page.locator('#view').focus();self.page.keyboard.down('s')
        self.page.evaluate('collisionFrames(18)');self.page.keyboard.up('s')
        self.assertGreater(self.page.evaluate('CodaArcadeQA.position().y'),675,
                           'Changing the same corridor cell to green must release movement')

    def test_painted_cells_control_live_walking_routes_and_survive_reload(self):
        initial_assets=self.page.evaluate('CodaDeveloperConsole.getProject().assets')
        self.open_collision(); self.paint(1005,425,'block','5')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1005,425)'))
        route = self.page.evaluate('CodaArcadeQA.route(950,425,1060,425)')
        self.assertTrue(route, 'Click navigation must find a route around the painted obstacle')
        self.assertTrue(any(point['y']<400 or point['y']>=450 for point in route), route)
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(950,425)'))
        self.page.locator('#view').focus(); self.page.keyboard.down('d')
        self.page.evaluate('collisionFrames(36)'); self.page.keyboard.up('d')
        blocked = self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(blocked['x'],960)
        self.assertLess(blocked['x'],980,'Manual walking must stop at the painted boundary')
        self.page.mouse.click(**self.canvas_point(1060,425))
        self.page.wait_for_function('CodaArcadeQA.position().x>1045&&Math.abs(CodaArcadeQA.position().y-425)<15')
        self.page.locator('#devPlaytest').click(); self.paint(1005,425,'open','5')
        self.page.locator('#devPlaytest').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.place(950,425)'))
        self.page.locator('#view').focus(); self.page.keyboard.down('d')
        self.page.evaluate('collisionFrames(30)'); self.page.keyboard.up('d')
        self.assertGreater(self.page.evaluate('CodaArcadeQA.position().x'),1025,
                           'Allow walking must release the same painted cells')
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole.ready()')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(1005,425)'))
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().assets'),initial_assets,
                         'Collision painting and reload must preserve every published asset')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'),'local')


if __name__=='__main__':
    unittest.main(verbosity=2)
