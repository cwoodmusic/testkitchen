"""Held-finger steering, map/action multi-touch and large overlaid controls."""
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]

class FingerWalkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},has_touch=True,is_mobile=True)
        self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.set_content('''<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#10203e;color:white;font:15px system-ui}header{height:58px}canvas{touch-action:none}button{font:inherit}</style><body class="coda-mobile-world"><header><b>CODA ARCADE</b></header><main id="worldStage"><canvas id="view" width="1672" height="941"></canvas></main><footer><span>Walk</span><span id="status">Ready to play</span></footer><button id="outside" style="position:fixed;top:70px;left:10px">Outside map</button>''')
        for name in ['mobile-controls.css','world-mobile.css']:self.page.add_style_tag(path=str(ROOT/name))
        for name in ['mobile-controls.js','finger-follow.js']:self.page.add_script_tag(path=str(ROOT/name))
        self.page.evaluate('''() => {
            window.enabled=true;window.calls=[];window.legacy=[];
            window.controls=createCodaMobileControls({getContext:()=>({id:'world',enabled:true,key:(key,held)=>calls.push(['key',key,held])})});
            window.walk=createCodaFingerWalk({canvas:view,enabled:()=>enabled,onStart:()=>calls.push(['start']),onTarget:(x,y)=>calls.push(['target',x,y]),onStop:reason=>calls.push(['stop',reason]),onPinch:info=>calls.push(['pinch',info.phase])});
            view.addEventListener('pointerdown',event=>legacy.push(event.pointerId),true);
        }''')
        self.cdp=self.context.new_cdp_session(self.page)
    def tearDown(self):
        self.page.evaluate('walk.dispose();controls.destroy()');self.context.close();self.assertEqual(self.errors,[])
    def touch(self,kind,points):
        self.cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':[{'id':p[0],'x':p[1],'y':p[2]} for p in points]})
    def test_finger_drag_continues_outside_map_and_lift_stops_immediately(self):
        self.touch('touchStart',[(1,200,300)]);self.assertTrue(self.page.evaluate('walk.getState().following'))
        self.touch('touchMove',[(1,245,340)]);self.assertEqual(self.page.evaluate('walk.getState().target'),{'clientX':245,'clientY':340})
        self.touch('touchMove',[(1,150,30)]);self.page.wait_for_function('walk.getState().target?.clientY===30');self.assertEqual(self.page.evaluate('walk.getState().target'),{'clientX':150,'clientY':30})
        self.touch('touchEnd',[]);self.assertFalse(self.page.evaluate('walk.getState().following'));self.assertIsNone(self.page.evaluate('walk.getState().target'))
        self.assertGreater(len(self.page.evaluate('legacy')),0,'Existing floor handlers should still see events')
    def test_action_finger_preserves_steering_and_second_floor_finger_pinches(self):
        self.touch('touchStart',[(1,220,320)])
        jump=self.page.locator('[data-action="jump"]').bounding_box();x=round(jump['x']+jump['width']/2);y=round(jump['y']+jump['height']/2)
        self.touch('touchStart',[(1,220,320),(2,x,y)])
        self.assertTrue(self.page.evaluate('walk.getState().following'));self.assertEqual(self.page.evaluate('walk.getState().pointerCount'),1)
        self.assertTrue(self.page.evaluate('calls.some(call=>call[0]==="key"&&call[1]===" "&&call[2])'))
        self.touch('touchEnd',[(2,x,y)])
        self.assertTrue(self.page.evaluate('walk.getState().following'))
        self.touch('touchStart',[(1,220,320),(3,290,370)])
        self.assertTrue(self.page.evaluate('walk.getState().pinching'));self.assertFalse(self.page.evaluate('walk.getState().following'))
        self.touch('touchEnd',[(1,220,320)]);self.touch('touchMove',[(1,240,340)])
        self.assertFalse(self.page.evaluate('walk.getState().following'))
        self.touch('touchEnd',[])
    def test_cancel_disabled_room_and_blur_clear_held_targets(self):
        self.touch('touchStart',[(1,200,300)]);self.touch('touchCancel',[]);self.assertFalse(self.page.evaluate('walk.getState().following'))
        self.touch('touchStart',[(2,200,300)]);self.page.evaluate('enabled=false')
        self.assertFalse(self.page.evaluate('walk.getState().following'));self.assertEqual(self.page.evaluate('walk.getState().pointerCount'),0)
        self.touch('touchEnd',[]);self.page.evaluate('enabled=true');self.touch('touchStart',[(3,200,300)])
        self.page.evaluate('dispatchEvent(new Event("blur"))');self.assertFalse(self.page.evaluate('walk.getState().following'));self.touch('touchEnd',[])
    def test_controls_are_large_and_overlaid_with_accessible_open_center(self):
        for width,height in [(390,844),(360,780),(844,390),(667,375)]:
            self.page.set_viewport_size({'width':width,'height':height})
            metric=self.page.evaluate('''() => {
                const host=document.querySelector('.coda-touch-controls'),stage=worldStage.getBoundingClientRect(),pad=host.querySelector('.coda-joystick').getBoundingClientRect(),actions=host.querySelector('.coda-touch-actions').getBoundingClientRect(),centerX=(pad.right+actions.left)/2,centerY=innerHeight-50;
                return {viewport:innerWidth,scroll:document.documentElement.scrollWidth,stageBottom:stage.bottom,pad:{left:pad.left,right:pad.right,bottom:pad.bottom,width:pad.width,height:pad.height},thumb:host.querySelector('.coda-joystick-thumb').getBoundingClientRect().toJSON(),actions:{left:actions.left,right:actions.right,bottom:actions.bottom},sizes:[...host.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>{const r=b.getBoundingClientRect();return [r.width,r.height]}),center:document.elementFromPoint(centerX,centerY)?.id};
            }''')
            self.assertLessEqual(metric['scroll'],width);self.assertAlmostEqual(metric['stageBottom'],height,delta=1)
            self.assertGreaterEqual(metric['pad']['left'],0);self.assertLess(metric['pad']['right'],metric['actions']['left']);self.assertLessEqual(metric['actions']['right'],width)
            self.assertGreaterEqual(metric['pad']['width'],200 if width>height else 216)
            self.assertAlmostEqual(metric['pad']['width'],metric['pad']['height'],delta=1)
            self.assertGreaterEqual(metric['thumb']['width'],88)
            self.assertTrue(all(w>=58 and h>=58 for w,h in metric['sizes']),metric)
            self.assertEqual(metric['center'],'view',metric)

if __name__=='__main__':unittest.main(verbosity=2)
