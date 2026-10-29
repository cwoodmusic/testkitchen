"""Real phone touch, camera, pinch, room routing and saved-world checks."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from world_navigation_helpers import enter_room,open_destination
import threading
import unittest

from playwright.sync_api import sync_playwright
from mobile_joystick_helpers import direction_point

ROOT=Path(__file__).resolve().parents[1]

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

class MobileWorldTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text) if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.failures.append(response.url)
          if response.status>=400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.url=f'http://127.0.0.1:{self.server.server_port}/world-preview.html'
        self.load();self.cdp=self.context.new_cdp_session(self.page)

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])

    def load(self):
        self.page.goto(self.url,wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.touch()?.mobile')

    def touch(self):
        return self.page.evaluate('CodaArcadeQA.touch()')

    def position(self):
        return self.page.evaluate('CodaArcadeQA.position()')

    def touches(self,kind,*points):
        self.cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':list(points)})

    def button_point(self,label,touch_id):
        if label.startswith('Move '):return direction_point(self.page,label,touch_id,'#codaTouchControls .coda-joystick')
        box=self.page.locator('#codaTouchControls').get_by_role('button',name=label,exact=True).bounding_box()
        self.assertIsNotNone(box,label)
        return {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2,'id':touch_id,'radiusX':3,'radiusY':3,'force':1}

    def menu(self,selector):
        if selector in ('piano','classroom','fishing'):enter_room(self.page,selector)
        elif selector in ('shop','boutique','dj','fame'):open_destination(self.page,selector)
        else:raise ValueError('Unknown physical destination '+selector)

    def place(self,x,y):
        self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)',[x,y]))
        self.page.wait_for_timeout(70)

    def screen_position(self):
        return self.page.evaluate('''()=>{
          const canvas=view.getBoundingClientRect(),stage=worldStage.getBoundingClientRect(),camera=CodaArcadeQA.camera(),p=CodaArcadeQA.position();
          const scale=camera.zoom*canvas.width/1672;
          return {x:canvas.left+(p.x-camera.x)*scale,y:canvas.top+(p.y-camera.y)*scale,
            head:canvas.top+(p.y-camera.y-58)*scale,stage:stage.toJSON(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
        }''')

    def floor_point(self,dx=120,dy=0,touch_id=1):
        """A visible floor position relative to the camera-followed player."""
        player=self.screen_position()
        return {'x':max(20,min(player['width']-20,player['x']+dx)),
          'y':player['y']+dy,'id':touch_id,'radiusX':3,'radiusY':3,'force':1}

    def pinch_points(self,distance=120):
        box=self.page.locator('#worldStage').bounding_box()
        x=box['x']+box['width']/2;y=box['y']+box['height']*.3
        return [{'x':x-distance/2,'y':y,'id':1},{'x':x+distance/2,'y':y,'id':2}]

    def settle_camera(self):
        # Teleportation eases the camera. Wait for it before choosing a held
        # screen-space target, as a player would after looking around.
        self.page.evaluate('window.__mobileCameraCheck=null')
        self.page.wait_for_function('''()=>{
          const camera=CodaArcadeQA.camera(),last=window.__mobileCameraCheck;
          const stable=last&&Math.hypot(camera.x-last.x,camera.y-last.y)<.001?(last.stable+1):0;
          window.__mobileCameraCheck={x:camera.x,y:camera.y,stable};return stable>=3;
        }''')

    def assert_finger_stopped(self):
        self.page.wait_for_function('!CodaArcadeQA.fingerWalk().following')
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.fingerWalk().target'))
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.characters().player.destination'))
        self.page.wait_for_timeout(80)
        position=self.position();self.page.wait_for_timeout(140)
        self.assertEqual(self.position(),position,'Lifting the finger must stop movement rather than finish a path')

    def assert_avatar_visible(self):
        self.page.wait_for_function('''()=>{
          const canvas=view.getBoundingClientRect(),stage=worldStage.getBoundingClientRect(),camera=CodaArcadeQA.camera(),p=CodaArcadeQA.position(),scale=camera.zoom*canvas.width/1672;
          const x=canvas.left+(p.x-camera.x)*scale,y=canvas.top+(p.y-camera.y)*scale;
          return x>=stage.left+4&&x<=stage.right-4&&y>=stage.top+8&&y<=stage.bottom-4;
        }''')
        actual=self.screen_position();stage=actual['stage']
        self.assertGreaterEqual(actual['x'],stage['left']+3)
        self.assertLessEqual(actual['x'],stage['right']-3)
        self.assertGreaterEqual(actual['y'],stage['top']+7)
        self.assertLessEqual(actual['y'],stage['bottom']-3)
        self.assertGreaterEqual(actual['head'],stage['top']-3,'The player’s head must not disappear above the crop')
        self.assertLessEqual(actual['scrollWidth'],actual['width']+1,'The cropped world must not widen the page')

    def test_phone_camera_follows_the_player_at_both_world_edges_and_after_rotation(self):
        self.assertTrue(self.touch()['visible']);self.assert_avatar_visible()
        edge_points=self.page.evaluate('''()=>{
          const points=[];for(let y=185;y<=835;y+=10)for(let x=65;x<=1585;x+=10)if(CodaArcadeQA.walkable(x,y))points.push({x,y});
          const left=points.reduce((a,p)=>p.x<a.x?p:a),right=points.reduce((a,p)=>p.x>a.x?p:a);
          const north=points.reduce((a,p)=>p.y<a.y?p:a),south=points.reduce((a,p)=>p.y>a.y?p:a);
          return [left,right,north,south];
        }''')
        for viewport in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(viewport);self.page.wait_for_timeout(150)
            for point in edge_points:
                with self.subTest(viewport=viewport,point=point):
                    self.place(point['x'],point['y']);self.assert_avatar_visible()

    def test_compact_translucent_controls_leave_the_full_height_world_playable(self):
        for viewport in [{'width':390,'height':844},{'width':360,'height':780},{'width':320,'height':740},{'width':844,'height':390},{'width':667,'height':375}]:
            self.page.set_viewport_size(viewport);self.page.wait_for_timeout(100)
            metric=self.page.evaluate('''()=>{
              const host=document.querySelector('#codaTouchControls'),dpad=host.querySelector('.coda-joystick').getBoundingClientRect(),actions=host.querySelector('.coda-touch-actions').getBoundingClientRect(),stage=worldStage.getBoundingClientRect();
              return {stageBottom:stage.bottom,scrollWidth:document.documentElement.scrollWidth,
                reserve:getComputedStyle(document.body).getPropertyValue('--coda-world-pad-height').trim(),
                dpad:dpad.toJSON(),thumb:host.querySelector('.coda-joystick-thumb').getBoundingClientRect().toJSON(),actions:actions.toJSON(),host:host.getBoundingClientRect().toJSON(),joystickOpacity:Number(getComputedStyle(host.querySelector('.coda-joystick')).opacity),
                center:document.elementFromPoint((dpad.right+actions.left)/2,innerHeight-45)?.id,
                buttons:[...host.querySelectorAll('button')].filter(button=>!button.hidden).map(button=>{const b=button.getBoundingClientRect();return {width:b.width,height:b.height,top:b.top,bottom:b.bottom,opacity:Number(getComputedStyle(button).opacity),direction:!!button.closest('.coda-joystick'),emote:button.classList.contains('coda-touch-emote')};})};
            }''')
            self.assertEqual(metric['reserve'],'0px');self.assertAlmostEqual(metric['stageBottom'],viewport['height'],delta=1)
            self.assertLessEqual(metric['scrollWidth'],viewport['width']+1)
            self.assertGreaterEqual(metric['dpad']['left'],0);self.assertLess(metric['dpad']['right'],metric['actions']['left']);self.assertLessEqual(metric['actions']['right'],viewport['width'])
            landscape=viewport['width']>viewport['height']
            self.assertGreaterEqual(metric['dpad']['width'],120,metric)
            self.assertLessEqual(metric['dpad']['width'],160 if landscape else 170,metric)
            self.assertLessEqual(metric['host']['height'],190 if landscape else 230,metric)
            self.assertLessEqual(metric['joystickOpacity'],.8,metric)
            self.assertGreaterEqual(metric['joystickOpacity'],.5,metric)
            self.assertAlmostEqual(metric['dpad']['height'],metric['dpad']['width'],delta=1)
            self.assertGreaterEqual(metric['thumb']['width'],44,metric)
            self.assertLessEqual(metric['thumb']['width'],64,metric)
            self.assertEqual(self.page.locator('#codaTouchControls .coda-joystick button').count(),0,
                'Directional movement should use the joystick, without hidden replacement buttons')
            for button in metric['buttons']:
                if not button['direction']:
                    self.assertGreaterEqual(button['width'],44,metric)
                    self.assertGreaterEqual(button['height'],44,metric)
                    self.assertLessEqual(button['height'],80,metric)
                    if not button['emote'] or not landscape:self.assertLessEqual(button['width'],96,metric)
                    self.assertGreaterEqual(button['top'],0,metric);self.assertLessEqual(button['bottom'],viewport['height'],metric)
                    self.assertLessEqual(button['opacity'],.85,metric)
                    self.assertGreaterEqual(button['opacity'],.5,metric)
            self.assertEqual(metric['center'],'view','The space between the thumb controls must remain a playable map')

    def test_landscape_npc_dialogue_stays_between_the_large_thumb_controls(self):
        self.page.set_viewport_size({'width':844,'height':390})
        self.page.clock.install();self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        people=self.page.evaluate('CodaArcadeQA.characters().npcs')
        opened=False
        for person in people:
            for dx,dy in [(0,35),(35,0),(-35,0),(0,-35)]:
                if self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)',[person['x']+dx,person['y']+dy]):
                    self.page.clock.run_for(32);self.page.keyboard.press('e');self.page.clock.run_for(32)
                    opened=self.page.evaluate('CodaArcadeQA.conversation().open')
                    if opened:break
            if opened:break
        self.assertTrue(opened,'A real nearby musician should open their conversation')
        self.page.clock.run_for(160)
        for size in [{'width':844,'height':390},{'width':667,'height':375}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(64)
            metrics=self.page.evaluate('''()=>{
              const d=dialog.getBoundingClientRect(),pad=document.querySelector('.coda-joystick').getBoundingClientRect(),
                actions=document.querySelector('.coda-touch-actions').getBoundingClientRect();
              return {dialog:d.toJSON(),pad:pad.toJSON(),actions:actions.toJSON(),
                leftHit:document.elementFromPoint(d.left+20,Math.min(d.bottom-20,innerHeight-35))?.closest('#dialog')?.id};
            }''')
            self.assertGreater(metrics['dialog']['left'],metrics['pad']['right']+8)
            self.assertLess(metrics['dialog']['right'],metrics['actions']['left']-8)
            self.assertGreaterEqual(metrics['dialog']['top'],0)
            self.assertLessEqual(metrics['dialog']['bottom'],size['height'])
            self.assertEqual(metrics['leftHit'],'dialog','Conversation text must not sit beneath the movement joystick')
            self.page.screenshot(path='/tmp/coda-controls37-dialog-'+str(size['width'])+'.png')
        self.page.locator('#codaTouchControls .coda-touch-interact').tap();self.page.clock.run_for(64)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.conversation().open'))

    def test_held_floor_finger_redirects_with_drag_and_stops_on_lift_without_a_path(self):
        self.place(1225,675);self.assert_avatar_visible();self.settle_camera();start=self.position();right=self.floor_point()
        self.touches('touchStart',right)
        self.page.wait_for_function('x=>CodaArcadeQA.fingerWalk().following&&CodaArcadeQA.position().x>x+18',arg=start['x'])
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.characters().player.destination'))
        redirect=self.position();left=self.floor_point(-120)
        self.touches('touchMove',left)
        self.page.wait_for_function('x=>CodaArcadeQA.position().x<x-18',arg=redirect['x'])
        self.assertLess(self.page.evaluate('CodaArcadeQA.fingerWalk().target.clientX'),100)
        self.touches('touchEnd');self.assert_finger_stopped()

    def test_floor_finger_cancel_and_rotation_stop_until_a_new_gesture(self):
        self.place(1225,675);self.assert_avatar_visible();self.settle_camera();right=self.floor_point();start=self.position()
        self.touches('touchStart',right);self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+10',arg=start['x'])
        self.touches('touchCancel');self.assert_finger_stopped()
        start=self.position();right=self.floor_point();self.touches('touchStart',right)
        self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+10',arg=start['x'])
        self.page.set_viewport_size({'width':844,'height':390});self.assert_finger_stopped();self.touches('touchEnd')
        self.assert_avatar_visible();self.settle_camera();start=self.position();left=self.floor_point(-120)
        self.touches('touchStart',left);self.page.wait_for_function('x=>CodaArcadeQA.fingerWalk().following&&CodaArcadeQA.position().x<x-12',arg=start['x'])
        self.touches('touchEnd');self.assert_finger_stopped()

    def test_floor_finger_and_jump_button_work_together_without_losing_steering(self):
        self.place(1225,675);self.assert_avatar_visible();self.settle_camera();start=self.position();right=self.floor_point()
        self.touches('touchStart',right);self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+10',arg=start['x'])
        jump=self.button_point('Jump',2);self.touches('touchStart',right,jump)
        self.page.wait_for_function('CodaArcadeQA.characters().player.jumpHeight>6')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fingerWalk().following'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.fingerWalk().pointerCount'),1)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.jumps'),1)
        jumping=self.position();self.touches('touchEnd',jump)
        self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+12',arg=jumping['x'])
        self.touches('touchEnd');self.assert_finger_stopped()

    def test_held_floor_finger_respects_a_painted_collision_wall(self):
        # A saved, explicitly painted barrier must block direct touch movement.
        # Keep it long enough that a held finger cannot drift around its ends.
        self.page.evaluate('''()=>{
          const project=CodaDeveloperConsole.getProject(),grid=CodaArcadeQA.collisionGrid(),cells=new Map(project.collision);
          for(let row=59;row<=77;row++)cells.set(row*grid.width+126,0);
          project.collision=[...cells];localStorage.setItem('codaWorldProjectV1',JSON.stringify(project));
        }''')
        self.load();self.place(1225,675);self.assert_avatar_visible();self.settle_camera()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1265,675)'))
        right=self.floor_point();self.touches('touchStart',right)
        self.page.wait_for_function('CodaArcadeQA.position().x>1245')
        self.page.wait_for_timeout(250);blocked=self.position();self.page.wait_for_timeout(350)
        self.assertLess(blocked['x'],1260);self.assertAlmostEqual(self.position()['x'],blocked['x'],delta=.01)
        self.assertTrue(self.page.evaluate('p=>CodaArcadeQA.walkable(p.x,p.y)',self.position()))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fingerWalk().following'))
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.characters().player.destination'))
        self.touches('touchEnd');self.assert_finger_stopped()

    def test_two_fingers_can_walk_and_jump_then_release_without_stuck_movement(self):
        self.place(1225,675);self.assert_avatar_visible()
        right=self.button_point('Move right',1);jump=self.button_point('Jump',2);start=self.position()
        self.touches('touchStart',right)
        self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+12',arg=start['x'])
        self.touches('touchStart',right,jump)
        self.page.wait_for_function('CodaArcadeQA.characters().player.jumpHeight>6')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.jumps'),1)
        at_release=self.position();self.touches('touchEnd',jump)
        self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+6',arg=at_release['x'])
        self.assertTrue(self.touch()['joystick']['active'])
        self.touches('touchEnd');self.page.wait_for_timeout(100)
        stop=self.position();self.page.wait_for_timeout(130)
        self.assertEqual(self.position(),stop);self.assertEqual(self.touch()['held'],[])
        self.assertFalse(self.touch()['joystick']['active']);self.assertEqual(self.touch()['joystick']['strength'],0)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.characters().player.walking'))

    def test_diagonal_cancel_and_rotation_clear_all_held_touch_directions(self):
        self.place(1225,675);diagonal=self.button_point('Move up right',1);start=self.position()
        self.touches('touchStart',diagonal)
        self.page.wait_for_function('p=>CodaArcadeQA.position().x>p.x+10&&CodaArcadeQA.position().y<p.y-10',arg=start)
        self.touches('touchCancel');self.page.wait_for_timeout(70)
        self.assertEqual(self.touch()['held'],[])
        right=self.button_point('Move right',1);self.touches('touchStart',right)
        self.page.wait_for_timeout(60);self.page.set_viewport_size({'width':844,'height':390})
        self.page.wait_for_function('CodaArcadeQA.touch().held.length===0&&!CodaArcadeQA.touch().joystick.active')
        self.touches('touchEnd');self.page.wait_for_timeout(80)
        stop=self.position();self.page.wait_for_timeout(150);self.assertEqual(self.position(),stop)
        self.assert_avatar_visible()

    def test_real_pinch_changes_camera_zoom_without_leaving_a_walk_destination(self):
        self.place(1225,675);self.assert_avatar_visible();self.settle_camera();start=self.position()
        points=self.pinch_points()
        before=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        self.touches('touchStart',*points)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fingerWalk().pinching'))
        self.touches('touchMove',*self.pinch_points(210))
        self.page.wait_for_function('before=>CodaArcadeQA.camera().targetZoom>before+.3',arg=before)
        zoomed=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        contracted=self.pinch_points(65);self.touches('touchMove',*contracted)
        self.page.wait_for_function('zoomed=>CodaArcadeQA.camera().targetZoom<zoomed-.3',arg=zoomed)
        self.assertEqual(self.position(),start,'Pinching changes the camera without walking the avatar')
        self.assertEqual(self.page.evaluate('visualViewport.scale'),1,'Pinch must scale the game camera rather than the browser page')
        # CDP touchEnd with a nonempty list identifies the lifted finger.
        # Moving the remaining finger must stay suppressed until it also lifts.
        self.touches('touchEnd',contracted[1])
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fingerWalk().suppressed'))
        self.touches('touchMove',{**contracted[0],'x':contracted[0]['x']+40})
        self.assert_finger_stopped();self.assertEqual(self.position(),start)
        final_zoom=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        self.touches('touchEnd');self.page.wait_for_timeout(100)
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.characters().player.destination'))
        self.assertEqual(self.touch()['held'],[]);self.assert_avatar_visible()
        self.load();self.assertEqual(self.page.evaluate('CodaArcadeQA.camera().targetZoom'),final_zoom)
        self.page.locator('#worldMenuBtn').tap()
        self.assertTrue(self.page.locator('#mobilePinchHint').is_visible())
        self.assertIn('pinch two fingers to zoom',self.page.locator('#mobilePinchHint').inner_text())

    def test_pinch_cancellation_and_rotation_do_not_leave_ghost_fingers(self):
        self.place(1225,675);self.assert_avatar_visible();self.settle_camera()
        self.touches('touchStart',*self.pinch_points())
        self.touches('touchMove',*self.pinch_points(200))
        self.touches('touchCancel');self.assert_finger_stopped()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.fingerWalk().pointerCount'),0)
        before=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        self.touches('touchStart',*self.pinch_points())
        self.touches('touchMove',*self.pinch_points(70))
        self.page.wait_for_function('before=>CodaArcadeQA.camera().targetZoom<before-.3',arg=before)
        self.page.set_viewport_size({'width':844,'height':390})
        self.assert_finger_stopped();self.assertEqual(self.page.evaluate('CodaArcadeQA.fingerWalk().pointerCount'),0)
        self.touches('touchEnd');self.settle_camera()
        before=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        self.touches('touchStart',*self.pinch_points())
        self.touches('touchMove',*self.pinch_points(210))
        self.page.wait_for_function('before=>CodaArcadeQA.camera().targetZoom>before+.3',arg=before)
        self.touches('touchEnd');self.assert_finger_stopped();self.assert_avatar_visible()

    def test_pinch_takes_over_a_held_direction_without_leaving_pad_movement(self):
        self.place(1225,675);self.assert_avatar_visible();self.settle_camera();start=self.position()
        right=self.button_point('Move right',9);self.touches('touchStart',right)
        self.page.wait_for_function('x=>CodaArcadeQA.position().x>x+10',arg=start['x'])
        self.touches('touchStart',right,*self.pinch_points())
        self.assertTrue(self.page.evaluate('CodaArcadeQA.fingerWalk().pinching'))
        self.assertEqual(self.touch()['held'],[])
        start=self.position();before=self.page.evaluate('CodaArcadeQA.camera().targetZoom')
        self.touches('touchMove',right,*self.pinch_points(210))
        self.page.wait_for_function('before=>CodaArcadeQA.camera().targetZoom>before+.3',arg=before)
        self.page.wait_for_timeout(120);self.assertEqual(self.position(),start)
        self.touches('touchEnd');self.assert_finger_stopped();self.assertEqual(self.touch()['held'],[])

    def test_touch_menu_purchases_and_text_entry_preserve_outfit_currency_and_position(self):
        self.menu('shop');self.page.wait_for_function('!CodaArcadeQA.touch().visible')
        self.page.locator('[data-shop-item="witch"] button').tap()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),70)
        self.assertNotEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.headwear'),'witch')
        self.page.locator('#panelClose').tap();self.page.wait_for_function('CodaArcadeQA.touch().visible')
        self.menu('boutique');before=self.position()
        self.page.get_by_label('Hats',exact=True).select_option('witch')
        name=self.page.get_by_label('Arcade nickname',exact=True);name.fill('Touch Musician')
        name.press('w');self.assertEqual(self.position(),before)
        self.assertFalse(self.touch()['visible'])
        self.page.locator('#boutiqueSave').tap();self.load()
        appearance=self.page.evaluate('CodaArcadeQA.characters().player.appearance')
        self.assertEqual(appearance['headwear'],'witch');self.assertIn('Touch Musician',appearance['name'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),70)

    def test_pad_routes_into_rooms_hides_for_books_and_cabinets_and_returns_to_world(self):
        self.menu('piano');main=self.position()
        self.page.wait_for_function('CodaArcadeQA.touch().context==="piano"&&CodaArcadeQA.touch().visible')
        start=self.page.evaluate('CodaArcadeQA.piano().player.y');down=self.button_point('Move down',1)
        self.touches('touchStart',down);self.page.wait_for_function('y=>CodaArcadeQA.piano().player.y>y+8',arg=start)
        self.touches('touchEnd');self.assertEqual(self.position(),main)
        self.assertTrue(self.page.locator('#codaTouchControls [data-action="emote"]').is_hidden())
        self.page.locator('#pianoMenuButton').tap();self.page.wait_for_function('!CodaArcadeQA.touch().visible')
        self.page.locator('#pianoMenuClose').tap();self.page.locator('#closepiano').tap();self.page.wait_for_function('CodaArcadeQA.touch().context==="world"')
        self.menu('classroom');self.page.wait_for_function('CodaArcadeQA.touch().context==="classroom"&&CodaArcadeQA.touch().visible')
        self.assertTrue(self.page.locator('#codaTouchControls [data-action="jump"]').is_hidden())
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.down('w');self.page.wait_for_timeout(900);self.page.keyboard.up('w')
        self.page.keyboard.press('e');self.page.wait_for_function('!CodaArcadeQA.touch().visible')
        self.page.locator('#classroomBrowseBooks').tap()
        self.page.locator('#classroomSearch').fill('interval');self.page.locator('[data-topic="intervals"]').tap()
        self.assertIn('Intervals',self.page.locator('#classroomBookTitle').inner_text())
        self.page.locator('#classroomClose').tap();self.page.wait_for_function('CodaArcadeQA.touch().context==="world"')
        game=self.page.evaluate('CodaArcadeQA.worldObjects().find(object=>object.game?.index===3).game')
        self.place(game['x'],game['y']);self.page.locator('#codaTouchControls [data-action="interact"]').tap()
        self.page.wait_for_function('CodaArcadeQA.menu().gameOpen');self.page.wait_for_function('!CodaArcadeQA.touch().visible')
        self.assertIn('song-machine',self.page.locator('#gameiframe').get_attribute('src'))
        self.page.frame_locator('#gameiframe').locator('#simpleSongGrid').wait_for()
        self.page.locator('#returnworld').tap();self.page.wait_for_function('CodaArcadeQA.touch().visible')
        self.assertEqual(self.touch()['context'],'world');self.assertEqual(self.touch()['held'],[])

if __name__=='__main__':unittest.main(verbosity=2)
