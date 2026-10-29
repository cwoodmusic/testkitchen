"""Real touch gestures in the responsive Song Machine composer."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

class SongMobileTests(unittest.TestCase):
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
        self.context.add_init_script('''(()=>{
          window.mobileSources=[];const Base=window.AudioContext;
          window.AudioContext=class extends Base{
            createOscillator(){const node=super.createOscillator(),original=node.stop.bind(node);node.mobileStops=[];node.mobileEnded=false;
              node.addEventListener('ended',()=>node.mobileEnded=true);
              node.stop=(when)=>{node.mobileStops.push(when===undefined?'now':when);return original(when);};mobileSources.push(node);return node;}
            createBufferSource(){const node=super.createBufferSource(),original=node.stop.bind(node);node.mobileStops=[];node.mobileEnded=false;
              node.addEventListener('ended',()=>node.mobileEnded=true);
              node.stop=(when)=>{node.mobileStops.push(when===undefined?'now':when);return original(when);};mobileSources.push(node);return node;}
          };
        })()''')
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/song-machine/index.html',wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge')
        self.page.evaluate("songMachineBridge.setEditorMode('advanced')")
        self.cdp=self.context.new_cdp_session(self.page)
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])
    def song(self):return self.page.evaluate('songMachineBridge.get()')
    def touch(self,kind,x=None,y=None):
        points=[] if x is None else [{'x':x,'y':y,'id':1}]
        self.cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})
    def swipe(self,start,end):
        self.touch('touchStart',*start)
        for step in range(1,9):
            self.touch('touchMove',start[0]+(end[0]-start[0])*step/8,start[1]+(end[1]-start[1])*step/8)
            self.page.wait_for_timeout(22)
        self.touch('touchEnd');self.page.wait_for_timeout(220)
        # Wait for native momentum to finish before choosing/capturing a cell.
        # A fixed delay can record coordinates while the grid still drifts.
        self.page.evaluate('''()=>new Promise((resolve,reject)=>{
          let previous='',stable=0,frames=0;
          function next(){
            const position=JSON.stringify([scrollX,scrollY,...Array.from(
              document.querySelectorAll('.grid-wrap'),node=>[node.scrollLeft,node.scrollTop])]);
            stable=position===previous?stable+1:0;previous=position;
            if(stable>=4)return resolve();
            if(++frames>180)return reject(Error('Touch scrolling did not settle'));
            requestAnimationFrame(next);
          }
          requestAnimationFrame(next);
        })''')
    def grid(self):
        wrap=self.page.locator('#tracks>.track').first.locator('.grid-wrap')
        wrap.scroll_into_view_if_needed();self.page.wait_for_timeout(50);return wrap
    def blank_cell(self,span=None):
        if span is None:span=int(self.page.locator('#duration').input_value())
        self.grid()
        return self.page.evaluate('''span=>{
          const wrap=document.querySelector('#tracks .grid-wrap'),box=wrap.getBoundingClientRect();
          for(const cell of wrap.querySelectorAll('.cell:not(.filled)')){
            const r=cell.getBoundingClientRect();
            const clear=Array.from({length:span},(_,offset)=>wrap.querySelector(
              '.cell[data-pitch="'+cell.dataset.pitch+'"][data-step="'+(+cell.dataset.step+offset)+'"]'))
              .every(node=>node&&!node.classList.contains('filled'));
            if(!clear)continue;
            if(r.left>=box.left+54&&r.right+(span-1)*36<box.right-2&&r.top>box.top+27&&r.bottom<Math.min(box.bottom,innerHeight-100))
              return {x:r.x+r.width/2,y:r.y+r.height/2,pitch:+cell.dataset.pitch,step:+cell.dataset.step};
          }throw Error('No empty visible touch cell');
        }''',span)
    def test_portrait_and_landscape_have_no_page_overflow_and_reachable_transport(self):
        for width,height in [(390,844),(844,390)]:
            self.page.set_viewport_size({'width':width,'height':height});self.page.wait_for_timeout(100)
            metrics=self.page.evaluate('''()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
              dock:document.querySelector('.transport').getBoundingClientRect().toJSON(),
              buttons:Array.from(document.querySelectorAll('.transport>button')).map(b=>b.getBoundingClientRect().toJSON())})''')
            self.assertLessEqual(metrics['scroll'],width)
            self.assertAlmostEqual(metrics['dock']['bottom'],height,delta=1)
            self.assertTrue(all(button['height']>=44 and button['width']>=44 for button in metrics['buttons']))
            self.assertEqual(self.page.locator('#tracks>.track').count(),2)
        self.page.locator('#add').tap();self.assertEqual(self.page.locator('#tracks>.track').count(),3)
        self.page.locator('#undo').tap();self.assertEqual(self.page.locator('#tracks>.track').count(),2)
    def test_touch_tap_edits_and_horizontal_swipe_only_scrolls(self):
        before=self.song();wrap=self.grid();box=wrap.bounding_box()
        self.swipe((box['x']+box['width']-30,box['y']+110),(box['x']+80,box['y']+110))
        self.assertGreater(wrap.evaluate('(node)=>node.scrollLeft'),80)
        self.assertEqual(self.song(),before,'Scrolling must not create, erase, or resize notes')
        point=self.blank_cell();offset=wrap.evaluate('(node)=>({left:node.scrollLeft,top:node.scrollTop})')
        self.page.touchscreen.tap(point['x'],point['y'])
        notes=self.song()['tracks'][0]['notes'];self.assertEqual(len(notes),len(before['tracks'][0]['notes'])+1)
        self.assertTrue(any(note['p']==point['pitch'] and note['t']==point['step'] and note['d']==4 for note in notes))
        wrap=self.page.locator('#tracks .grid-wrap').first
        after_scroll=wrap.evaluate('(node)=>({left:node.scrollLeft,top:node.scrollTop})')
        for axis in ['left','top']:
            # Native touch scrolling may round by one CSS pixel when the grid
            # is rebuilt; a jump to an earlier bar or pitch is still a failure.
            self.assertAlmostEqual(after_scroll[axis],offset[axis],delta=1,
                                   msg='Editing must retain the visible bar and pitch')
        self.page.touchscreen.tap(point['x'],point['y']);self.assertEqual(self.song(),before)
    def test_touch_draw_sets_duration_and_cancel_never_places_a_note(self):
        self.page.locator('#duration').select_option('1')
        self.page.get_by_role('button',name='Draw notes',exact=False).tap()
        point=self.blank_cell(span=4);before=self.song()
        self.swipe((point['x'],point['y']),(point['x']+3*36,point['y']))
        self.assertTrue(any(note['p']==point['pitch'] and note['t']==point['step'] and note['d']==4 for note in self.song()['tracks'][0]['notes']))
        self.page.locator('#undo').tap()
        # Touch activation dispatches a compatibility click after pointerup.
        # Await its real undo result instead of racing that browser event.
        self.page.wait_for_function('expected=>JSON.stringify(songMachineBridge.get())===JSON.stringify(expected)',arg=before)
        self.assertEqual(self.song(),before)
        point=self.blank_cell();self.touch('touchStart',point['x'],point['y']);self.touch('touchCancel')
        self.assertEqual(self.song(),before)
        self.page.get_by_role('button',name='Tap & scroll',exact=False).tap();wrap=self.grid();box=wrap.bounding_box()
        self.swipe((box['x']+130,box['y']+150),(box['x']+130,box['y']+40))
        self.assertEqual(self.song(),before,'A vertical pan must never commit a drawn note')
    def test_mobile_track_controls_and_hold_to_clear_can_be_canceled_and_undone(self):
        self.page.get_by_label('Melody options',exact=True).tap()
        self.assertEqual(self.page.get_by_label('Melody sound',exact=True).locator('option').count(),18)
        self.assertEqual(self.page.get_by_label('Melody sound',exact=True).locator('option:disabled').count(),8)
        before=self.song();button=self.page.get_by_role('button',name='Hold for 3 seconds to clear notes for Melody',exact=True)
        button.scroll_into_view_if_needed();box=button.bounding_box()
        self.touch('touchStart',box['x']+box['width']/2,box['y']+box['height']/2);self.touch('touchCancel')
        self.page.wait_for_timeout(3050);self.assertEqual(self.song(),before)
        button=self.page.get_by_role('button',name='Hold for 3 seconds to clear notes for Melody',exact=True)
        box=button.bounding_box();self.touch('touchStart',box['x']+box['width']/2,box['y']+box['height']/2)
        self.page.wait_for_timeout(3100);self.touch('touchEnd')
        self.assertEqual(self.song()['tracks'][0]['notes'],[])
        self.page.locator('#undo').tap();self.assertEqual(self.song(),before)
    def test_play_and_stop_silence_scheduled_audio_from_the_fixed_touch_dock(self):
        # Capture active audio in the same click event that invokes Stop. Short
        # percussion may finish naturally while Playwright waits to tap; those
        # historical sources correctly need no second stop() call.
        self.page.evaluate('''()=>document.querySelector('#stop').addEventListener('click',()=>{
          window.mobileSourcesAtStop=mobileSources.filter(source=>!source.mobileEnded);
        },{capture:true})''')
        self.page.locator('#play').tap();self.page.wait_for_function('mobileSources.length>0')
        self.assertIn('Playing',self.page.locator('#status').inner_text())
        self.page.wait_for_function('mobileSources.some(source=>source.mobileEnded)')
        self.page.locator('#stop').tap();self.assertIn('Stopped',self.page.locator('#status').inner_text())
        self.assertGreater(self.page.evaluate('mobileSourcesAtStop.length'),0,'The stop check must include active audio')
        self.assertTrue(self.page.evaluate("mobileSourcesAtStop.every(source=>source.mobileStops.includes('now'))"),
                        'Stop releases already sounding and scheduled sources')
        self.page.locator('#settings-toggle').tap()
        self.assertTrue(self.page.locator('#settings-panel').is_visible())
        self.assertTrue(self.page.locator('#load').is_visible())
        self.assertEqual(self.page.locator('#load').inner_text().lower(),'import song file')
        self.assertEqual(self.page.get_by_label('Meter',exact=True).evaluate('(node)=>getComputedStyle(node).fontSize'),'16px')

if __name__=='__main__':unittest.main(verbosity=2)
