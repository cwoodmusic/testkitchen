"""The compact battle graphic responds to rhythm without owning a game clock."""
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/fishing-battle.css"><style>body{background:#142238;color:white;margin:12px;font:15px system-ui}main{max-width:960px;margin:auto}h1{font-size:22px}button{min-height:48px;width:100%;background:#337275;color:white;border:1px solid #baffda;border-radius:6px;font:700 18px system-ui}</style>
<main><h1>A bite! Keep the rhythm</h1><div id="battle"></div><p>Tap each note. Stay quiet for rests.</p><button>Tap rhythm</button></main>
<script src="/fishing-battle.js"></script><script>
window.fish={id:'test-koi',name:'Prism Koi',rarity:'legendary',rarityRank:4,color:'#8de0d0',accent:'#eaa5d6'};
window.battle=createCodaFishingBattle({host:document.querySelector('#battle'),reducedMotion:()=>matchMedia('(prefers-reduced-motion:reduce)').matches});
window.start=()=>battle.start({fish,time:0,id:'battle-one'});window.step=(time,progress=45,kind=null,paused=false)=>battle.update({time,fish,progress,phase:'playing',paused,hits:kind==='hit'?1:0,misses:kind==='miss'?1:0,extras:0,lastJudgement:kind?{kind,time,noteId:'one'}:null});
window.hash=()=>{const canvas=document.querySelector('canvas'),data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let result=2166136261;for(const value of data)result=Math.imul(result^value,16777619);return result>>>0;};start();
</script></html>'''
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/battle-fixture':return super().do_GET()
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(HTML.encode())
class FishingBattleTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)));threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.p=sync_playwright().start();cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):cls.browser.close();cls.p.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1100,'height':800});self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.goto(f'http://127.0.0.1:{self.server.server_port}/battle-fixture')
    def tearDown(self):self.context.close();self.assertEqual(self.errors,[])
    def test_actual_canvas_reacts_to_hits_errors_and_pause_without_replaying_the_announcement(self):
        self.assertEqual(self.page.locator('[role=status] strong').inner_text(),'LEGENDARY FISH!')
        self.page.evaluate("step(.2,70,'hit')");good=self.page.evaluate('battle.getState()');good_hash=self.page.evaluate('hash()')
        self.page.evaluate("step(.4,30,'miss')");bad=self.page.evaluate('battle.getState()');self.assertGreater(bad['line']['mouth']['x'],good['line']['mouth']['x']);self.assertGreater(bad['tension'],good['tension']);self.assertNotEqual(self.page.evaluate('hash()'),good_hash)
        self.assertNotEqual(good['line']['boat'],bad['line']['boat'],'The angler boat should bob and lean while a fish pulls')
        self.page.evaluate('step(.5,30,null,true)');paused_hash=self.page.evaluate('hash()');paused_boat=self.page.evaluate('battle.getState().line.boat');self.page.evaluate('step(30,30,null,true)');self.assertEqual(self.page.evaluate('hash()'),paused_hash);self.assertEqual(self.page.evaluate('battle.getState().line.boat'),paused_boat);self.assertTrue(self.page.evaluate('battle.getState().announcementVisible'))
        self.page.evaluate('step(30,30)');self.page.evaluate('step(34,30)');self.assertFalse(self.page.evaluate('battle.getState().announcementVisible'));self.assertEqual(self.page.evaluate('battle.getState().announcements'),1)
        self.page.locator('#battle').screenshot(path='/tmp/coda-fishing-battle34.png')
    def test_portrait_and_short_landscape_keep_the_widget_compact_and_the_tap_button_reachable(self):
        for width,height,max_height in [(390,844,100),(844,390,66)]:
            self.page.set_viewport_size({'width':width,'height':height});self.page.evaluate('step(.1)');box=self.page.locator('#battle').bounding_box();button=self.page.locator('button').bounding_box()
            self.assertLessEqual(box['height'],max_height);self.assertLessEqual(self.page.locator('body').evaluate('node=>node.scrollWidth'),width);self.assertLess(button['y']+button['height'],height)
            self.assertGreaterEqual(button['height'],44);self.assertLessEqual(self.page.locator('[role=status]').bounding_box()['width'],box['width'])
        self.page.screenshot(path='/tmp/coda-fishing-battle34-phone.png')
    def test_reduced_motion_still_changes_position_with_progress_and_preserves_a_calm_pose(self):
        self.page.emulate_media(reduced_motion='reduce');self.page.evaluate("step(1,75,'hit')");before=self.page.evaluate('battle.getState()');first=self.page.evaluate('hash()');self.page.evaluate("step(2,75,'hit')");after=self.page.evaluate('battle.getState()')
        self.assertEqual(before['fishX'],after['fishX']);self.assertEqual(before['fishY'],after['fishY']);self.assertEqual(self.page.evaluate('hash()'),first);self.assertEqual(after['wiggle'],0);self.assertEqual(before['line']['boat'],after['line']['boat']);self.assertEqual(after['line']['boat']['rock'],0)
if __name__=='__main__':unittest.main(verbosity=2)
