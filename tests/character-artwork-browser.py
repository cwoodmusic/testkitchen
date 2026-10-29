"""Actual renderer pixels for the shared character/artwork adapter.

Uses a disposable Chromium context and local scripts; external services blocked.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path != '/character-artwork-fixture':
            return super().do_GET()
        html = '''<!doctype html><title>Character artwork fixture</title>
        <script src="pixel-selection.js"></script><script src="character-renderer.js"></script><script src="pixel-editor.js"></script>
        <script src="artwork-editor.js"></script><script src="character-artwork-adapter.js"></script>
        <script>
        window.renderer=createCodaCharacterRenderer();window.sprites={};
        window.adapter=CodaCharacterArtworkAdapter.create({renderer,getSprites:()=>sprites,
          setSprites:next=>{sprites=next;return renderer.setPixelEdits(next);},
          getTargets:()=>[{id:'player',name:'Your avatar'},{id:'haydn',name:'Professor Haydn'}]});
        window.framePixel=(target,x,y,facing='down',options={})=>Array.from(
          renderer.renderPixelFrame(target,{}, {facing},0,options).getContext('2d').getImageData(x,y,1,1).data);
        </script>'''
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(html.encode())


class CharacterArtworkTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',
            args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context()
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/character-artwork-fixture')
        self.page.wait_for_function('window.adapter&&window.renderer')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])

    def test_rgba_overrides_replace_the_original_character_pixel_in_every_facing(self):
        result = self.page.evaluate('''()=>{
          const source=framePixel('player',40,45),data={};
          for(const facing of ['down','left','up','right'])
            data['character.player.'+facing]=CodaArtworkEditor.changePixels({},'test',80,96,
              [[40,45]],'#11223380').test;
          adapter.onChange(data);
          const pixels=['down','left','up','right'].map(facing=>framePixel('player',40,45,facing));
          const baseline=Array.from(adapter.getSource('character.player.down')
            .getContext('2d').getImageData(40,45,1,1).data);
          return {source,pixels,baseline,stored:sprites.player.down[0]};
        }''')
        self.assertEqual(result['source'][3], 255)
        self.assertEqual(result['baseline'], result['source'],
                         'The source must remain unmodified for Restore and future edits')
        self.assertEqual(result['stored'], [40,45,'#11223380'])
        for pixel in result['pixels']:
            self.assertEqual(pixel[3], 128,
                             'Partial alpha replaces the old pixel rather than tinting over it')
            for actual, expected in zip(pixel[:3], [17,34,51]):
                self.assertLessEqual(abs(actual-expected), 1)

    def test_copied_background_rgba_can_be_pasted_into_the_sprite_editor(self):
        self.page.add_style_tag(path=str(ROOT / 'artwork-editor.css'))
        self.page.evaluate("""()=>{
          const host=document.createElement('section');host.id='crossArtwork';host.style.width='650px';document.body.append(host);
          const source=document.createElement('canvas');source.width=source.height=2;
          const g=source.getContext('2d'),image=g.createImageData(2,2);
          image.data.set([18,34,50,128,0,0,0,0,6,23,50,255,255,127,0,255]);g.putImageData(image,0,0);
          window.copiedExpected=Array.from(g.getImageData(0,0,2,2).data);
          window.crossArtwork=CodaArtworkEditor.mount({host,getTargets:()=>[{id:'background.copy',name:'Copy source'}],getSource:()=>source,getData:()=>({}),onChange:()=>{throw Error('Copy must not change its source');}});
        }""")
        self.page.wait_for_function('crossArtwork.getState().width===2&&!crossArtwork.getState().loading')
        self.page.locator('[data-artwork-select]').click()
        canvas=self.page.locator('[data-artwork-canvas]');canvas.scroll_into_view_if_needed()
        state=self.page.evaluate('crossArtwork.getState()');box=canvas.bounding_box()
        def point(x,y):
            return {'x':box['x']+(state['pan']['x']+(x+.5)*state['zoom'])*box['width']/state['viewport']['width'],
                    'y':box['y']+(state['pan']['y']+(y+.5)*state['zoom'])*box['height']/state['viewport']['height']}
        self.page.mouse.move(**point(0,0));self.page.mouse.down();self.page.mouse.move(**point(1,1));self.page.mouse.up()
        self.page.locator('[data-artwork-copy]').click()
        self.page.evaluate("""()=>{
          crossArtwork.dispose();document.querySelector('#crossArtwork').remove();
          const host=document.createElement('section');host.id='crossSprite';host.style.width='360px';document.body.append(host);
          window.crossChanges=0;window.crossSprite=CodaPixelEditor.mount({host,renderer,getData:()=>sprites,getProfile:()=>({}),getTargets:()=>[{id:'player',name:'Your avatar'}],onChange:next=>{sprites=next;renderer.setPixelEdits(next);crossChanges++;}});
        }""")
        self.page.get_by_label('Animate sprite preview',exact=True).uncheck()
        self.page.get_by_role('button',name='Paste',exact=True).click()
        canvas=self.page.locator('#pixelEditCanvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
        self.page.mouse.click(box['x']+40.5*4,box['y']+45.5*4)
        actual=self.page.evaluate("()=>[[40,45],[41,45],[40,46],[41,46]].flatMap(([x,y])=>framePixel('player',x,y))")
        self.assertEqual(actual,self.page.evaluate('copiedExpected'))
        self.assertEqual(self.page.evaluate('crossChanges'),1,'Cross-editor paste is one normal reversible sprite change')

    def test_restoring_character_art_preserves_animation_and_other_character_views(self):
        result = self.page.evaluate('''()=>{
          const data={
            'character.player.down':CodaArtworkEditor.changePixels({},'test',80,96,[[40,45]],'#ff00ffff').test,
            'character.haydn.up':CodaArtworkEditor.changePixels({},'test',80,96,[[40,45]],'#00000000').test
          };
          adapter.setData(data);
          const signature=phase=>Array.from(renderer.renderPixelFrame('player',{},
            {facing:'down',walking:true,phase},0).getContext('2d').getImageData(0,0,80,96).data).join(',');
          const animated=signature(.1)!==signature(1.6),painted=framePixel('player',40,45),
            erased=framePixel('haydn',40,45,'up'),kept=adapter.getData();
          delete kept['character.player.down'];adapter.setData(kept);
          return {animated,painted,erased,restored:framePixel('player',40,45),
            original:framePixel('player',40,45,'down',{base:true}),sprites};
        }''')
        self.assertTrue(result['animated'])
        self.assertEqual(result['painted'], [255,0,255,255])
        self.assertEqual(result['erased'][3], 0)
        self.assertEqual(result['restored'], result['original'])
        self.assertEqual(result['sprites'], {'haydn':{'up':[[40,45,None]]}})


if __name__ == '__main__':
    unittest.main(verbosity=2)
