"""The real Bravura font loads locally and places music on measured staff lines."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != '/notation-fixture':
            return super().do_GET()
        html = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-notation.css"><style>
*{box-sizing:border-box}body{margin:12px;background:#152239;color:white;font:15px system-ui}.staves{display:flex;gap:16px;flex-wrap:wrap}.staff-panel{width:340px;max-width:100%}.lesson-staff{display:block;width:100%;height:auto}.staff-panel h2{font:16px system-ui;margin:12px 0}canvas{display:block;max-width:100%;height:auto;background:#1d3047;border:1px solid #9dc9c8;margin:20px 0}h1{font-size:22px}
</style><h1>Music notation</h1><main class="staves" id="staves"></main><canvas id="rhythm" width="720" height="210" aria-label="Quarter, eighth, sixteenth, dotted quarter, and rests"></canvas>
<script src="/music-notation.js"></script><script src="/classroom-tutorials.js"></script><script>
for(const [position,label]of [[0,'E · bottom line'],[1,'F · bottom space'],[4,'B · middle line'],[5,'C · third space']]){
const panel=document.createElement('section');panel.className='staff-panel';panel.id='staff'+position;const title=document.createElement('h2');title.textContent=label;panel.append(title);const picture=document.createElement('div');picture.className='picture';picture.innerHTML=CodaClassroomTutorials.staffSVG(position);panel.append(picture);staves.append(panel);}
window.notationReady=CodaMusicNotation.ready.then(ready=>{const g=rhythm.getContext('2d');g.strokeStyle='#c6e8df';g.beginPath();g.moveTo(12,90);g.lineTo(708,90);g.stroke();
for(const [at,beats,rest]of [[0,1,false],[1,.5,false],[2,.25,false],[3,1.5,false],[4,1,true],[5,.5,true]])CodaMusicNotation.drawRhythm(g,{x:58+at*102,y:90,beats,rest,fontSize:64,color:'#f4e7bd'});
for(const [at,meter]of ['4/4','6/8','2/2'].entries()){CodaMusicNotation.drawTimeSignature(g,{x:58+at*204,y:172,meter,fontSize:48,color:'#a6f5e6'});}return ready;});
</script>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())


class MusicNotationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1100, 'height': 800}, device_scale_factor=1)
        self.page = self.context.new_page()
        self.errors, self.failures, self.font_requests = [], [], []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('response', lambda response: self.failures.append(response.url) if response.status >= 400 and not response.url.endswith('favicon.ico') else None)
        self.page.on('response', lambda response: self.font_requests.append(response.status) if 'Bravura.woff2' in response.url else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/notation-fixture')
        self.assertTrue(self.page.evaluate('notationReady'))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failures, [])

    def test_actual_self_hosted_music_font_is_loaded_and_used_by_both_clefs_and_notes(self):
        self.assertEqual(self.font_requests, [200])
        self.assertTrue(self.page.evaluate('CodaMusicNotation.isReady()'))
        faces = self.page.evaluate('Array.from(document.fonts).filter(face=>face.family.includes("CodaBravura")).map(face=>face.status)')
        self.assertEqual(faces, ['loaded'])
        self.assertEqual(self.page.locator('.staff-clef').first.text_content(), '\ue050')
        self.assertIn('CodaBravura', self.page.locator('.staff-note').first.evaluate('(node)=>getComputedStyle(node).fontFamily'))
        self.assertEqual(self.page.locator('.staff-clef').first.get_attribute('y'), '105')

    def test_noteheads_sit_on_the_correct_lines_and_spaces_with_normal_stem_directions(self):
        for position in [0, 1, 4, 5]:
            picture = self.page.locator(f'#staff{position} .picture')
            path = f'/tmp/coda-bravura-staff31-{position}.png'
            picture.screenshot(path=path)
            image = Image.open(path).convert('RGB')
            expected = 125-position*10
            coverage = []
            for y in range(max(0, expected-15), min(image.height, expected+16)):
                count = sum(1 for x in range(185, 224) if (lambda c:c[0] > 100 and c[1] < 100 and c[2] > 115)(image.getpixel((x, y))))
                coverage.append((count, y))
            count, y = max(coverage)
            self.assertGreater(count, 15, 'The music font must render an actual filled notehead')
            self.assertAlmostEqual(y, expected, delta=4, msg='The notehead must be centred on its line or space')
            self.assertEqual(self.page.locator(f'#staff{position} .staff-note').get_attribute('data-stem'), 'down' if position >= 4 else 'up')
        self.page.screenshot(path='/tmp/coda-bravura-classroom31.png')

    def test_canvas_rhythm_and_meter_symbols_remain_visible_on_phone_and_landscape(self):
        info = self.page.locator('#rhythm').evaluate('''canvas=>{
          const context=canvas.getContext('2d'),read=(x,y,w,h)=>{const pixels=context.getImageData(x,y,w,h).data;let ink=0;for(let at=3;at<pixels.length;at+=4)if(pixels[at]>0)ink++;return ink;};
          return {notes:[0,1,2,3,4,5].map(at=>read(30+at*102,22,70,100)),meters:[0,1,2].map(at=>read(30+at*204,140,70,60))};
        }''')
        self.assertTrue(all(value > 150 for value in info['notes']), info)
        self.assertTrue(all(value > 150 for value in info['meters']), info)
        for viewport in [{'width': 390, 'height': 844}, {'width': 844, 'height': 390}]:
            self.page.set_viewport_size(viewport)
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), viewport['width'])
            self.assertTrue(self.page.evaluate('CodaMusicNotation.isReady()'))
        self.page.locator('#rhythm').screenshot(path='/tmp/coda-bravura-rhythm31.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
