"""The touch Piano Lab keeps its player, keys, and controls at useful sizes."""
import importlib.util
import math
from pathlib import Path
from world_navigation_helpers import enter_room
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('piano_mobile_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class PianoMobileTests(_world.WorldBrowserCase):
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**',self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url)
            if response.status>=400 and '/coda-arcade/' in response.url else None)
        self.load();self.page.clock.install();self.page.clock.run_for(64)
        enter_room(self.page,'piano')
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        self.page.clock.run_for(96)

    def state(self):return self.page.evaluate('CodaArcadeQA.piano()')

    def menu(self,view):
        if self.state()['dialogueOpen']:self.page.locator('#pianoDialogueClose').tap()
        if not self.state()['menuOpen']:self.page.locator('#pianoMenuButton').tap()
        self.page.locator(f'[data-piano-view="{view}"]').tap();self.page.clock.run_for(64)

    def close_menu(self):
        self.page.locator('#pianoMenuClose').tap();self.page.clock.run_for(64)

    def walk(self,x,y):
        self.page.locator('#pianoRoomCanvas').focus()
        for axis,target,negative,positive in [('x',x,'a','d'),('y',y,'w','s')]:
            for _ in range(25):
                current=self.state()['player'][axis];distance=target-current
                if abs(distance)<5:break
                key=positive if distance>0 else negative
                self.page.keyboard.down(key)
                self.page.clock.run_for(max(16,min(300,round(abs(distance)/220*1000))))
                self.page.keyboard.up(key)
            self.assertAlmostEqual(self.state()['player'][axis],target,delta=8)

    def assert_player_visible(self):
        actual=self.page.evaluate('''()=>{
          const s=CodaArcadeQA.piano(),c=document.querySelector('#pianoRoomCanvas'),
            b=c.getBoundingClientRect(),v=c.parentElement.getBoundingClientRect();
          const x=b.left+(s.player.x-s.camera.x)*s.camera.zoom/1000*b.width,
            y=b.top+(s.player.y-s.camera.y)*s.camera.zoom/620*b.height;
          return {x,y,left:v.left,right:v.right,top:v.top,bottom:v.bottom,
            scale:b.width/1000*s.camera.zoom,hit:document.elementFromPoint(x,y)?.id};
        }''')
        self.assertGreater(actual['x'],actual['left']+4);self.assertLess(actual['x'],actual['right']-4)
        self.assertGreater(actual['y'],actual['top']+4);self.assertLess(actual['y'],actual['bottom']-4)
        self.assertGreater(actual['scale'],.8,'Characters and floor keys must render near native size, not a tiny fit-to-screen map')
        self.assertEqual(actual['hit'],'pianoRoomCanvas','Movement controls must not cover the character at room edges')

    def test_portrait_and_landscape_keep_large_following_room_and_edge_players_visible(self):
        for size in [{'width':390,'height':844},{'width':320,'height':780},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(96)
            self.assertLessEqual(self.page.locator('#pianoroom').evaluate('h=>h.scrollWidth'),size['width'])
            self.assertEqual(self.state()['camera']['zoom'],2)
            direction=self.page.locator('.coda-joystick').bounding_box()
            self.assertGreaterEqual(direction['width'],200 if size['width']>size['height'] else 216)
            self.assertAlmostEqual(direction['height'],direction['width'],delta=1)
            self.assertGreaterEqual(self.page.locator('.coda-joystick-thumb').bounding_box()['width'],88)
            self.assertGreaterEqual(self.page.locator('.coda-touch-interact').bounding_box()['height'],104)
            self.assert_player_visible()
            self.walk(65,300);self.assert_player_visible()
            self.walk(65,365);self.walk(930,365);self.walk(930,300);self.assert_player_visible()
            self.walk(930,365);self.walk(500,365);self.walk(500,310)
            self.assertTrue(self.page.locator('#pianoWallNote').is_visible())
            self.assertFalse(self.page.locator('.piano-workspace').is_visible())
            self.assertFalse(self.page.locator('.piano-mobile-nav').is_visible())
            self.menu('settings')
            self.assertGreaterEqual(self.page.locator('[aria-label="Zoom piano room in"]').bounding_box()['height'],44)
            panel=self.page.locator('.piano-menu-panel').bounding_box()
            self.assertGreaterEqual(panel['x'],0);self.assertLessEqual(panel['x']+panel['width'],size['width'])
            self.close_menu()
            self.page.screenshot(path='/tmp/coda-piano-menu-'+str(size['width'])+'.png')

    def test_zoomed_floor_keys_play_correct_pitch_and_pinch_never_walks_or_emits_notes(self):
        key=next(k for k in self.state()['floorKeys'] if k['midi']==60 and not k['black'])
        x=(key['polygon'][2][0]+key['polygon'][3][0])/2
        y=max(p[1] for p in key['polygon'])-10
        self.walk(x,y)
        self.assertEqual(self.state()['floorNote'],60);self.assertEqual(self.state()['lastWallNote'],60)
        self.assertEqual(self.page.locator('#pianoWallNote').inner_text(),'Back wall: C')
        self.menu('settings');self.page.locator('#pianoKeyNames').check();self.assertTrue(self.state()['showNames']);self.close_menu()
        viewport=self.page.locator('.piano-room-canvas-viewport').bounding_box()
        x0=viewport['x'];y0=viewport['y']+viewport['height']*.55;w=viewport['width']
        client=self.context.new_cdp_session(self.page)
        points=[{'id':1,'x':x0+w*.35,'y':y0},{'id':2,'x':x0+w*.65,'y':y0}]
        before=self.state()['player']
        client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points})
        points=[{'id':1,'x':x0+w*.2,'y':y0},{'id':2,'x':x0+w*.8,'y':y0}]
        client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points});self.page.clock.run_for(64)
        self.assertAlmostEqual(self.state()['camera']['zoom'],3,delta=.03)
        self.assertTrue(self.state()['fingerWalk']['suppressed']);self.assertEqual(self.state()['held'],[])
        self.page.keyboard.down('d');self.page.keyboard.press('Space');self.page.clock.run_for(200);self.page.keyboard.up('d')
        self.assertEqual(self.state()['player'],before)
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[points[1]]});self.page.clock.run_for(64)
        self.assertTrue(self.state()['camera']['pinching'])
        client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});client.detach();self.page.clock.run_for(64)
        self.assertFalse(self.state()['camera']['pinching']);self.assertEqual(self.state()['held'],[])
        self.page.keyboard.down('d');self.page.clock.run_for(100);self.page.keyboard.up('d')
        self.assertGreater(self.state()['player']['x'],before['x']+10)

    def test_chopin_interaction_views_and_developer_camera_remain_usable(self):
        self.walk(780,306);self.assert_player_visible()
        self.page.locator('.coda-touch-interact').tap();self.page.clock.run_for(64)
        self.assertTrue(self.state()['dialogueOpen']);self.assertIsNone(self.state()['lesson'])
        self.assertTrue(self.page.locator('#pianoDialogueText').is_visible())
        self.assertFalse(self.page.evaluate('CodaArcadeQA.touch().visible'))
        self.page.locator('[data-piano-dialogue-action="melodies"]').tap()
        self.page.locator('[data-piano-melody="mary"]').tap()
        self.page.locator('[data-piano-dialogue-action="play"]').tap();self.page.clock.run_for(64)
        self.assertEqual(self.state()['lesson'],'mary');self.assertEqual(self.state()['challengeMode'],'melody')
        self.assertFalse(self.state()['dialogueOpen']);self.assertTrue(self.page.evaluate('CodaArcadeQA.touch().visible'))
        self.menu('games');self.assertTrue(self.state()['menuOpen'])
        self.assertFalse(self.page.evaluate('CodaArcadeQA.touch().visible'))
        self.close_menu();self.assertTrue(self.page.evaluate('CodaArcadeQA.touch().visible'))
        self.page.locator('#pianoRoomCanvas').focus();self.page.keyboard.press('F2');self.page.clock.run_for(64)
        self.assertTrue(self.state()['editor']['editing']);self.assertEqual(self.state()['camera']['zoom'],2)
        self.assertEqual(self.page.locator('.piano-camera-controls:visible').count(),0)
        canvas=self.page.locator('#pianoRoomCanvas').bounding_box();viewport=self.page.locator('.piano-room-canvas-viewport').bounding_box()
        self.assertAlmostEqual(canvas['width'],viewport['width'],delta=2,msg='The editor must regain its full-coordinate fit canvas')
        self.page.keyboard.press('F2');self.page.clock.run_for(64)
        self.assertFalse(self.state()['editor']['editing']);self.assertEqual(self.state()['camera']['zoom'],2)
        self.assert_player_visible()


if __name__=='__main__':unittest.main(verbosity=2)
