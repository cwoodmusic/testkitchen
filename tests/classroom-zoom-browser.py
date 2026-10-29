"""Actual classroom camera mapping, settings cleanup, and phone pinch controls."""
import functools
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/classroom-zoom':return super().do_GET()
        body='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-classroom.css"><button id="enter">Enter classroom</button><section id="room" hidden></section>
<script src="/character-renderer.js"></script><script src="/finger-follow.js"></script><script src="/cave-camera.js"></script><script src="/room-fullscreen.js"></script><script src="/music-classroom.js"></script>
<script>window.viewChanges=[];window.classroom=createCodaMusicClassroom({host:room,renderer:createCodaCharacterRenderer(),onViewChange:view=>viewChanges.push(view)});enter.onclick=()=>classroom.open();</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(body.encode())

class ClassroomZoomTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):self.context=None;self.page=None;self.errors=[];self.failures=[]
    def tearDown(self):
        if self.context:self.context.close()
        self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])
    def open(self,mobile=False):
        self.context=self.browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1280,'height':1000},is_mobile=mobile,has_touch=mobile)
        self.page=self.context.new_page();self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/classroom-zoom')
        self.page.clock.install();self.page.clock.pause_at(datetime.now(timezone.utc)+timedelta(seconds=1))
        self.page.locator('#enter').click();self.page.clock.run_for(64)
    def state(self):return self.page.evaluate('classroom.getState()')
    def point(self,x,y):
        box=self.page.locator('#classroomCanvas').bounding_box();camera=self.state()['camera']
        return {'x':box['x']+(x-camera['x'])*camera['zoom']*box['width']/1000,
                'y':box['y']+(y-camera['y'])*camera['zoom']*box['height']/600}
    def zoom(self,value):
        self.page.locator('#classroomSettingsButton').click()
        while self.state()['camera']['zoom']<value:self.page.get_by_label('Zoom classroom in',exact=True).click()
        while self.state()['camera']['zoom']>value:self.page.get_by_label('Zoom classroom out',exact=True).click()
        self.page.keyboard.press('Escape');self.page.clock.run_for(32)
    def test_desktop_settings_zoom_maps_clicks_and_escape_only_closes_settings(self):
        self.open();self.assertEqual(self.state()['camera']['zoom'],1)
        self.page.evaluate('classroom.controlMove(.5,0)');self.page.clock.run_for(64)
        self.page.locator('#classroomSettingsButton').click();self.assertTrue(self.state()['blocked'])
        self.assertFalse(self.page.evaluate('classroom.controlMove(1,0)'))
        before=self.state()['player'];self.page.clock.run_for(200);self.assertEqual(self.state()['player'],before)
        for _ in range(4):self.page.get_by_label('Zoom classroom in',exact=True).click()
        self.assertEqual(self.state()['camera']['zoom'],2)
        self.page.keyboard.press('Escape');self.page.clock.run_for(32)
        self.assertTrue(self.state()['open']);self.assertFalse(self.state()['settingsOpen'])
        before=self.state()['player'];self.page.clock.run_for(200);self.assertEqual(self.state()['player'],before)
        point=self.point(450,510);self.page.mouse.click(point['x'],point['y']);self.page.clock.run_for(600)
        actual=self.state()['player'];self.assertAlmostEqual(actual['x'],450,delta=4);self.assertAlmostEqual(actual['y'],510,delta=4)
        self.page.mouse.move(point['x'],point['y']);self.page.mouse.wheel(0,-100);self.page.clock.run_for(32)
        self.assertEqual(self.state()['camera']['zoom'],2.25)
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.press('Tab');self.assertTrue(self.state()['settingsOpen'])
        self.page.get_by_label('Reset classroom zoom',exact=True).click();self.assertEqual(self.state()['camera']['zoom'],1)
        self.page.keyboard.press('Escape');self.assertTrue(self.state()['open'])
    def test_mobile_pinch_stops_movement_and_zoomed_finger_target_tracks_world_position(self):
        self.open(True);self.assertEqual(self.state()['camera']['zoom'],1)
        canvas=self.page.locator('#classroomCanvas').bounding_box();cx=canvas['x']+canvas['width']/2;cy=canvas['y']+canvas['height']/2
        cdp=self.context.new_cdp_session(self.page)
        points=[{'id':1,'x':cx-30,'y':cy},{'id':2,'x':cx+30,'y':cy}]
        before=self.state()['player'];cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':points});self.page.clock.run_for(32)
        points[0]['x']=cx-60;points[1]['x']=cx+60;cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':points});self.page.clock.run_for(64)
        self.assertAlmostEqual(self.state()['camera']['zoom'],2,delta=.05)
        self.assertEqual(self.state()['player'],before);self.assertTrue(self.state()['camera']['pinching'])
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});self.page.clock.run_for(32)
        self.assertFalse(self.state()['camera']['pinching'])
        point=self.point(450,510);point['id']=3;cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[point]});self.page.clock.run_for(160)
        self.assertLess(self.state()['player']['x'],before['x']-10)
        cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});self.page.clock.run_for(32)
        stopped=self.state()['player'];self.page.clock.run_for(160);self.assertEqual(self.state()['player'],stopped)
        self.zoom(3)
        self.page.evaluate("classroom.selectTopic('note-naming',true)");self.page.clock.run_for(32)
        self.assertEqual(self.state()['camera']['zoom'],3);self.assertFalse(self.page.evaluate('classroom.controlMove(1,0)'))
        self.assertFalse(self.page.locator('#classroomSettingsButton').is_visible())
        self.page.locator('#classroomBackRoom').click();self.page.clock.run_for(32)
        self.assertEqual(self.state()['camera']['zoom'],3)
        for width,height in [(320,780),(390,844),(844,390)]:
            self.page.set_viewport_size({'width':width,'height':height});self.page.clock.run_for(64)
            self.page.locator('#classroomSettingsButton').click()
            box=self.page.locator('#classroomSettingsPanel').bounding_box()
            self.assertGreaterEqual(box['x'],0);self.assertLessEqual(box['x']+box['width'],width)
            self.assertGreaterEqual(box['y'],0);self.assertLessEqual(box['y']+box['height'],height)
            self.assertLessEqual(self.page.locator('#room').evaluate('node=>node.scrollWidth'),width)
            self.assertGreaterEqual(self.page.get_by_label('Zoom classroom out',exact=True).bounding_box()['height'],44)
            self.page.keyboard.press('Escape');self.page.clock.run_for(32)
        self.page.screenshot(path='/tmp/coda-classroom-zoom42-mobile.png')

if __name__=='__main__':unittest.main(verbosity=2)
