"""Phone editor gestures must never save a pinch's first accidental stroke."""
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class RoomEditorInputTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.p=sync_playwright().start()
        cls.browser=cls.p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.p.stop()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.set_content('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}canvas{display:block;width:100%;height:auto;touch-action:none}</style><section id="room"><header></header><canvas width="1000" height="620" tabindex="0"></canvas></section>')
        self.page.add_style_tag(path=str(ROOT/'room-developer-editor.css'))
        self.page.add_script_tag(path=str(ROOT/'room-developer-editor.js'))
        self.page.evaluate('''()=>{window.saves=0;window.changes=0;window.roomEditAllowed=true;window.editor=createCodaRoomDeveloperEditor({
          id:'gesture-test',host:document.querySelector('#room'),canvas:document.querySelector('canvas'),width:1000,height:620,
          canEdit:()=>roomEditAllowed,storage:{getItem:()=>null,setItem:()=>saves++},onProjectChange:()=>changes++});}''')
        self.cdp=self.context.new_cdp_session(self.page)

    def tearDown(self):
        self.assertEqual(self.errors,[])
        self.context.close()

    def touch(self,event,points):
        self.cdp.send('Input.dispatchTouchEvent',{'type':event,'touchPoints':[
            {'id':i,'x':x,'y':y,'radiusX':3,'radiusY':3,'force':1} for i,x,y in points]})

    def state(self):
        return self.page.evaluate('editor.getState()')

    def assert_pristine(self):
        state=self.state()
        self.assertEqual(state['project']['collision'],[])
        self.assertEqual(state['project']['strokes'],[])
        self.assertEqual(state['undo'],0)
        self.assertEqual(self.page.evaluate('[saves,changes]'),[0,0])

    def test_layer_and_collision_pinches_roll_back_first_finger_without_saving(self):
        for tab in ['layers','collision']:
            with self.subTest(tab=tab):
                self.page.evaluate('tab=>editor.open(tab)',tab)
                self.touch('touchStart',[(1,100,100)])
                self.touch('touchMove',[(1,110,110)])
                project=self.state()['project']
                self.assertTrue(project['strokes'] if tab=='layers' else project['collision'])
                self.touch('touchStart',[(1,110,110),(2,210,110)])
                self.assert_pristine()
                before=self.state()['camera']['zoom']
                self.touch('touchMove',[(1,70,110),(2,250,110)])
                self.touch('touchEnd',[])
                self.assertGreater(self.state()['camera']['zoom'],before)
                self.assert_pristine()
                self.page.evaluate('editor.close()')

    def test_real_pointer_cancel_and_blur_discard_unfinished_layer_and_collision(self):
        for tab in ['layers','collision']:
            for ending in ['cancel','blur']:
                with self.subTest(tab=tab,ending=ending):
                    self.page.evaluate('tab=>editor.open(tab)',tab)
                    self.touch('touchStart',[(1,120,100)])
                    self.touch('touchMove',[(1,130,110)])
                    if ending=='cancel':self.touch('touchCancel',[])
                    else:
                        self.page.evaluate("window.dispatchEvent(new Event('blur'))")
                        self.touch('touchEnd',[])
                    self.assert_pristine()
                    self.page.evaluate('editor.close()')


    def test_pending_room_strokes_are_excluded_from_committed_snapshots(self):
        for tab in ['layers','collision']:
            with self.subTest(tab=tab):
                self.page.evaluate('tab=>editor.open(tab)',tab)
                before=self.page.evaluate('editor.getCommittedProject()')
                self.touch('touchStart',[(1,120,100)])
                self.touch('touchMove',[(1,145,110)])
                self.assertNotEqual(self.state()['project'],before,'The live preview should include the draft stroke')
                self.assertEqual(self.page.evaluate('editor.getCommittedProject()'),before,
                                 'A queued world save must not include an unfinished room stroke')
                self.touch('touchCancel',[])
                self.assert_pristine()
                self.assertEqual(self.page.evaluate('editor.getCommittedProject()'),before)
                self.page.evaluate('editor.close()')

    def test_revoking_edit_access_cancels_the_current_stroke_and_blocks_history(self):
        self.page.evaluate("editor.open('layers')")
        self.touch('touchStart',[(1,120,100)])
        self.touch('touchMove',[(1,145,110)])
        self.assertTrue(self.state()['project']['strokes'])
        self.page.evaluate('roomEditAllowed=false')
        self.touch('touchEnd',[])
        self.assert_pristine()
        self.page.evaluate('roomEditAllowed=true')
        self.touch('touchStart',[(1,120,100)])
        self.touch('touchEnd',[])
        committed=self.state()['project']
        self.assertEqual(len(committed['strokes']),1)
        self.assertEqual(self.state()['undo'],1)
        self.assertEqual(self.page.evaluate('[saves,changes]'),[1,1])
        self.page.evaluate('roomEditAllowed=false')
        self.page.locator('[data-room-action="undo"]').click()
        self.page.locator('[data-room-tab="project"]').click()
        self.page.locator('[data-room-action="reset"]').click()
        self.page.locator('[data-room-action="save"]').click()
        self.assertEqual(self.state()['project'],committed,
                         'A console already open when access changes must stop writing immediately')
        self.assertEqual(self.state()['undo'],1)
        self.assertEqual(self.page.evaluate('[saves,changes]'),[1,1])


if __name__=='__main__':unittest.main(verbosity=2)
