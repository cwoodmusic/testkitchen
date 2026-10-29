"""Simple Song Machine edits use the same composition and audio as Advanced."""
import copy
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass


class SongSimpleTests(unittest.TestCase):
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
        self.context=None;self.errors=[];self.failures=[]
        self.load()

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])

    def load(self,width=1280,height=1000,mobile=False):
        if self.context:self.context.close()
        self.context=self.browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,has_touch=mobile,device_scale_factor=1)
        self.context.route('https://**/*',lambda route:route.abort())
        self.page=self.context.new_page();self.page.set_default_timeout(10000)
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url)
            if response.status>=400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/song-machine/index.html',wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge?.getEditorMode')
        self.cdp=self.context.new_cdp_session(self.page)

    def song(self):return self.page.evaluate('songMachineBridge.get()')

    def cell(self,track,pitch,step):
        return self.page.locator(f'#simpleSongGrid .simple-song-cell[data-track="{track}"][data-pitch="{pitch}"][data-step="{step}"]')

    def test_simple_is_the_default_single_grid_with_three_octaves_and_three_drums(self):
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),'simple')
        self.assertEqual(self.page.locator('body').get_attribute('data-editor-mode'),'simple')
        self.assertTrue(self.page.locator('#simpleSongEditor').is_visible())
        self.assertFalse(self.page.locator('#tracks').is_visible())
        labels=self.page.locator('#simpleSongGrid .simple-song-row-label[data-pitch]')
        pitches=labels.evaluate_all('(nodes)=>nodes.map(node=>+node.dataset.pitch)')
        self.assertEqual(pitches,list(range(83,47,-1)))
        self.assertEqual(self.page.locator('#simpleSongGrid [data-drum-row]').count(),3)
        self.assertEqual(self.page.locator('#simpleSongGrid .simple-song-pitch-grid').count(),1)
        self.assertTrue(all(not any(character.isdigit() for character in name) for name in labels.all_text_contents()))
        lengths=self.page.locator('#simpleNotePalette button[data-duration]')
        self.assertEqual(set(lengths.evaluate_all('(nodes)=>nodes.map(node=>+node.dataset.duration)')),{1,2,4,8,16})
        self.assertEqual(lengths.locator('svg').count(),5,'Every note length needs an actual notation icon')
        self.assertTrue(all(value for value in lengths.evaluate_all('(nodes)=>nodes.map(node=>node.getAttribute("aria-label")||node.title)')))

    def test_melody_and_drum_edits_use_selected_length_and_the_same_undo_history(self):
        before=self.song()
        self.page.locator('#simpleNotePalette [data-duration="8"]').click()
        self.cell('1',60,16).click()
        after=self.song()
        self.assertIn({'p':60,'t':16,'d':8},after['tracks'][0]['notes'])
        self.assertEqual(after['tracks'][1],before['tracks'][1]);self.assertEqual(after['drums'],before['drums'])
        self.page.locator('#simpleUndo').click();self.assertEqual(self.song(),before)
        self.page.locator('#simpleNotePalette [data-duration="4"]').click()
        self.cell('d1',0,16).click()
        self.assertIn({'t':16,'d':4},self.song()['drums'][1]['notes'])
        self.assertEqual(self.song()['tracks'],before['tracks'])
        self.page.locator('#simpleUndo').click();self.assertEqual(self.song(),before)
        self.page.locator('#simpleInstrument').select_option('2')
        self.cell('2',64,16).click()
        self.assertIn({'p':64,'t':16,'d':4},self.song()['tracks'][1]['notes'])
        self.assertEqual(self.song()['tracks'][0],before['tracks'][0])
        self.page.locator('#songEditorMode').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),'advanced')
        self.page.locator('#undo').click();self.assertEqual(self.song(),before)

    def test_simple_instrument_picker_can_add_undo_and_change_an_unlocked_voice(self):
        before=self.song()
        self.page.locator('#simpleInstrument').select_option('add')
        self.assertEqual(len(self.song()['tracks']),3)
        selected=self.page.locator('#simpleInstrument').input_value()
        self.assertEqual(int(selected),self.song()['tracks'][-1]['id'])
        self.page.locator('#simpleUndo').click();self.assertEqual(self.song(),before)
        self.page.locator('#simpleSoundPicker').click()
        options=self.page.locator('#simpleSoundList [data-sound-option]')
        self.assertEqual(options.count(),18)
        self.assertEqual(self.page.locator('#simpleSoundList [data-locked="true"]').count(),8)
        self.page.locator('#simpleSoundList [data-sound-option="7"]').click()
        self.assertEqual(self.song()['tracks'][0]['sound'],7)
        self.assertEqual(self.song()['tracks'][1],before['tracks'][1])
        self.assertEqual(self.song()['drums'],before['drums'])

    def test_modes_keep_every_imported_track_setting_voice_and_out_of_range_note(self):
        imported=self.song();imported.update({'bpm':148,'bars':8,'meter':'6/8','root':3,'scale':'minor'})
        imported['tracks'][0].update({'sound':17,'volume':.38,'mute':True,'clef':'bass',
            'notes':[{'p':36,'t':0,'d':8},{'p':61,'t':8,'d':4},{'p':96,'t':44,'d':16}]})
        imported['tracks'].append({'id':7,'name':'Imported strings','sound':12,'clef':'treble','volume':.62,'mute':False,'notes':[{'p':81,'t':60,'d':2}]})
        imported['drums'][2].update({'sound':3,'volume':.41,'mute':True})
        self.page.evaluate('song=>songMachineBridge.load(song)',imported)
        self.assertEqual(self.song(),imported)
        for expected in ['advanced','simple','advanced','simple']:
            self.page.locator('#songEditorMode').click()
            self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),expected)
            self.assertEqual(self.song(),imported,'Changing the editor must never rewrite the song')
        self.page.locator('#simpleInstrument').select_option('7')
        self.page.locator('#simpleNotePalette [data-duration="1"]').click()
        self.cell('7',65,20).click()
        after=self.song();self.assertEqual(after['tracks'][:2],imported['tracks'][:2])
        self.assertEqual(after['drums'],imported['drums']);self.assertIn({'p':65,'t':20,'d':1},after['tracks'][2]['notes'])
        self.assertEqual([note['p'] for note in after['tracks'][0]['notes']],[36,61,96])

    def test_json_file_import_and_bridge_load_are_available_in_simple_mode(self):
        imported=copy.deepcopy(self.song());imported['bpm']=92
        imported['tracks'][0]['notes']=[{'p':59,'t':4,'d':8},{'p':88,'t':20,'d':2}]
        self.page.locator('#simpleMenu').click()
        self.assertTrue(self.page.locator('#settings-panel').is_visible())
        self.assertTrue(self.page.locator('#load').is_visible())
        self.page.locator('#file').set_input_files({'name':'class-song.json','mimeType':'application/json','buffer':json.dumps(imported).encode()})
        self.page.wait_for_function('songMachineBridge.get().bpm===92')
        self.assertEqual(self.song(),imported)
        self.assertEqual(self.page.evaluate('songMachineBridge.getEditorMode()'),'simple')
        self.page.locator('#simpleMenuClose').click()
        imported['bpm']=137
        self.page.evaluate('song=>songMachineBridge.load(song)',imported)
        self.assertEqual(self.song(),imported)
        self.assertTrue(self.page.locator('#simpleSongEditor').is_visible())

    def test_simple_play_stop_and_loop_use_the_real_transport(self):
        self.page.locator('#simplePlay').click()
        self.page.wait_for_function('document.querySelector("#status").textContent.includes("Playing")')
        self.assertIn('Playing',self.page.locator('#simpleStatus').inner_text())
        self.page.locator('#simpleStop').click()
        self.assertIn('Stopped',self.page.locator('#simpleStatus').inner_text())
        self.page.locator('#simpleLoop').click()
        self.assertIn('On',self.page.locator('#loop').inner_text())
        self.page.locator('#songEditorMode').click()
        self.assertIn('On',self.page.locator('#loop').inner_text())

    def touch(self,kind,x=None,y=None):
        points=[] if x is None else [{'x':x,'y':y,'id':1,'radiusX':3,'radiusY':3,'force':1}]
        self.cdp.send('Input.dispatchTouchEvent',{'type':kind,'touchPoints':points})

    def swipe(self,start,end):
        self.touch('touchStart',*start)
        for step in range(1,9):
            self.touch('touchMove',start[0]+(end[0]-start[0])*step/8,start[1]+(end[1]-start[1])*step/8)
            self.page.wait_for_timeout(22)
        self.touch('touchEnd');self.page.wait_for_timeout(220)

    def blank_visible_cell(self):
        return self.page.evaluate('''()=>{
          const wrap=document.querySelector('#simpleSongGrid'),box=wrap.getBoundingClientRect();
          for(const cell of wrap.querySelectorAll('.simple-song-cell:not(.filled)')){
            if(cell.dataset.track.startsWith('d'))continue;
            const rect=cell.getBoundingClientRect();
            if(rect.left>box.left+70&&rect.right<box.right-8&&rect.top>box.top+40&&rect.bottom<Math.min(box.bottom-8,innerHeight-120))
              return {x:rect.x+rect.width/2,y:rect.y+rect.height/2,pitch:+cell.dataset.pitch,step:+cell.dataset.step};
          }throw Error('No blank touch cell is visible');
        }''')

    def test_mobile_grid_scrolls_without_editing_and_taps_or_cancels_cleanly(self):
        self.load(390,844,True)
        self.page.locator('#simpleNotePalette [data-duration="1"]').tap()
        wrap=self.page.locator('#simpleSongGrid');wrap.scroll_into_view_if_needed();box=wrap.bounding_box();before=self.song()
        self.swipe((box['x']+box['width']-25,box['y']+110),(box['x']+95,box['y']+110))
        self.assertGreater(wrap.evaluate('(node)=>node.scrollLeft'),50)
        self.assertEqual(self.song(),before,'Swiping for later bars must never add a note')
        self.page.wait_for_function('''()=>{
          const grid=document.querySelector('#simpleSongGrid'),last=window.__simpleScrollCheck;
          const stable=last&&last.left===grid.scrollLeft&&last.top===grid.scrollTop?last.stable+1:0;
          window.__simpleScrollCheck={left:grid.scrollLeft,top:grid.scrollTop,stable};return stable>=5;
        }''')
        point=self.blank_visible_cell();scroll=wrap.evaluate('(node)=>({left:node.scrollLeft,top:node.scrollTop})')
        self.page.touchscreen.tap(point['x'],point['y'])
        self.assertIn({'p':point['pitch'],'t':point['step'],'d':1},self.song()['tracks'][0]['notes'])
        after=wrap.evaluate('(node)=>({left:node.scrollLeft,top:node.scrollTop})')
        for axis in ['left','top']:self.assertAlmostEqual(after[axis],scroll[axis],delta=1)
        self.page.locator('#simpleUndo').tap();self.assertEqual(self.song(),before)
        point=self.blank_visible_cell();self.touch('touchStart',point['x'],point['y']);self.touch('touchCancel')
        self.assertEqual(self.song(),before)
        for width,height in [(320,780),(844,390)]:
            self.page.set_viewport_size({'width':width,'height':height});self.page.wait_for_timeout(100)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            for name in ['#simplePlay','#simpleStop','#simpleUndo','#songEditorMode']:
                rect=self.page.locator(name).bounding_box();self.assertGreaterEqual(rect['height'],44)
            self.assertEqual(self.song(),before)


if __name__=='__main__':unittest.main(verbosity=2)
