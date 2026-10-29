"""Real Bravura rendering and pointer/keyboard editing in a disposable browser."""
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
URL = 'https://cwoodmusic.github.io/coda-arcade/notation-test.html'
HTML = '''<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="music-notation.css"><link rel="stylesheet" href="education-notation.css"><style>body{margin:10px;background:#101327;font-family:sans-serif}main{max-width:1000px;margin:auto}button{touch-action:manipulation}</style><script src="music-notation.js"></script><script src="education-notation.js"></script></head><body><main id="host"></main><script>window.edits=[];window.editable=true;window.editor=CodaEducationNotation.mount({host:document.querySelector('#host'),value:CodaEducationNotation.fromVisual({kind:'staff',position:0}),canEdit:()=>editable,onChange:value=>edits.push(value)});</script></body></html>'''

class EducationNotationBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1100,'height':950})
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/coda-arcade/**',self.route)
        self.page=self.context.new_page();self.errors=[];self.missing=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.missing.append(response.url) if response.status>=400 else None)
        self.page.goto(URL);self.page.wait_for_function('window.editor&&CodaMusicNotation.isReady()')
    def route(self,route):
        path=unquote(urlparse(route.request.url).path).removeprefix('/coda-arcade/')
        if path=='notation-test.html':return route.fulfill(status=200,content_type='text/html',body=HTML)
        file=(ROOT/path).resolve()
        if not file.is_relative_to(ROOT) or not file.is_file():return route.fulfill(status=404,body='Missing file')
        route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.missing,[])
    def state(self):return self.page.evaluate('editor.getValue()')
    def control(self,name):return self.page.locator('[data-notation-control="'+name+'"]')
    def action(self,name):return self.page.locator('[data-notation-action="'+name+'"]')
    def test_select_change_pitch_duration_accidental_and_undo(self):
        self.page.locator('[data-notation-item="0"]').click()
        self.page.locator('.education-notation-canvas').press('ArrowUp')
        self.assertEqual(self.state()['items'][0]['position'],1)
        self.control('duration').select_option('0.5');self.control('dots').select_option('1');self.control('accidental').select_option('sharp')
        value=self.state()['items'][0];self.assertEqual((value['duration'],value['dots'],value['accidental']),(.5,1,'sharp'))
        self.assertEqual(self.page.locator('[data-score-accidental="sharp"]').count(),1)
        self.action('undo').click();self.assertEqual(self.state()['items'][0]['accidental'],'none')
        self.action('redo').click();self.assertEqual(self.state()['items'][0]['accidental'],'sharp')
        self.page.locator('.education-notation-canvas').press('Delete');self.assertEqual(self.state()['items'],[])
        self.action('undo').click();self.assertEqual(len(self.state()['items']),1)
        self.assertGreater(self.page.evaluate('edits.length'),5)
    def test_click_to_add_and_drag_note_preserves_line_space_positions(self):
        self.control('tool').select_option('note')
        svg=self.page.locator('[data-notation-canvas]')
        # The score viewBox is 480 x 200. Add a note at position four.
        box=svg.bounding_box();x=box['x']+200*box['width']/480;y=box['y']+113*box['height']/200
        self.page.mouse.click(x,y)
        self.assertEqual(len(self.state()['items']),2);self.assertEqual(self.state()['items'][1]['position'],4)
        self.control('tool').select_option('select')
        box=svg.bounding_box();x=box['x']+182*box['width']/480;y=box['y']+113*box['height']/200
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x,y-24*box['height']/200,steps=4);self.page.mouse.up()
        self.assertEqual(self.state()['items'][1]['position'],7,'Dragging moves the note by three staff steps')
        self.action('undo').click();self.assertEqual(self.state()['items'][1]['position'],4,'One undo reverses the whole drag')
    def test_grand_staff_repeats_rests_and_clef_changes_render(self):
        self.control('staff').select_option('grand');self.control('meter').select_option('6/8')
        self.assertEqual(self.page.locator('.education-staff-line').count(),10)
        for tool in ['repeat-start','rest','clef','bar','repeat-end']:
            self.control('tool').select_option(tool);self.action('add').click()
        self.assertEqual([item['type'] for item in self.state()['items']],['note','repeat-start','rest','clef','bar','repeat-end'])
        self.control('tool').select_option('select');self.page.locator('[data-notation-item="3"]').click()
        self.control('clef').select_option('bass');self.assertEqual(self.state()['items'][3]['clef'],'bass')
        self.assertIn('\ue086',self.page.locator('svg').text_content());self.assertIn('\ue088',self.page.locator('svg').text_content())
        self.page.screenshot(path='/tmp/education-notation-grand.png')
    def test_phone_tools_fit_and_readonly_guard_prevents_writes(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        for control in self.page.locator('.education-notation-editor button:visible,.education-notation-editor select:visible').all():
            self.assertGreaterEqual(control.bounding_box()['height'],44)
        before=self.state();self.page.evaluate('editable=false')
        self.action('add').click();self.page.locator('.education-notation-canvas').press('Delete')
        self.assertEqual(self.state(),before);self.assertEqual(self.page.evaluate('edits.length'),0)
        self.assertFalse(self.page.evaluate("editor.setValue({version:1,clef:'treble',meter:null,items:[{type:'script'}]})"))
        self.page.screenshot(path='/tmp/education-notation-phone.png')
    def test_long_score_keeps_symbols_readable_and_keyboard_selection_scrolls(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.evaluate("editor.setValue({version:1,clef:'treble',meter:'4/4',items:Array.from({length:64},()=>({type:'note',position:0,duration:1,dots:0,accidental:'none',staff:'treble'}))})")
        canvas=self.page.locator('.education-notation-canvas');svg=canvas.locator('svg')
        self.assertGreater(svg.bounding_box()['width'],4500,'The editor scrolls instead of squeezing 64 symbols into one phone width')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.locator('[data-notation-item="63"]').click()
        canvas.press('ArrowUp');self.assertEqual(self.state()['items'][63]['position'],1)
        self.assertGreater(canvas.evaluate('node=>node.scrollLeft'),4000)
        canvas.press('Home')
        # Moving through the real keyboard selection brings earlier symbols back into view.
        for _ in range(63):canvas.press('ArrowLeft')
        self.assertLess(canvas.evaluate('node=>node.scrollLeft'),100)
        canvas.press('ArrowUp');self.assertEqual(self.state()['items'][0]['position'],1)

if __name__=='__main__':unittest.main(verbosity=2)
