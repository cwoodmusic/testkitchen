"""Render restored JavaScript characters without image, manifest or rig assets.

Uses disposable Chromium contexts and a local fixture. The tests exercise real
Canvas pixels, all four facings, musician appearances and cosmetic removal.
"""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]


class FixtureHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass

    def do_GET(self):
        if self.path.split('?')[0]!='/javascript-character-fixture.html':
            return super().do_GET()
        html=b'''<!doctype html><title>JavaScript character fixture</title>
<script src="character-renderer.js"></script><script>
window.characterRenderer=createCodaCharacterRenderer();
window.charactersReady=false;window.characterError=null;
characterRenderer.ready.then(()=>charactersReady=true).catch(e=>characterError=e.message);
window.drawCharacter=(profile={},motion={},time=0,npcId=null,still=false)=>{
  const canvas=Object.assign(document.createElement('canvas'),{width:200,height:200});
  const g=canvas.getContext('2d');
  const renderer=still?window.stillRenderer:characterRenderer;
  if(npcId){g.save();g.translate(100,150);g.scale(2,2);
    renderer.drawNPC(g,{id:npcId,x:0,y:0,...motion,appearance:profile},time);g.restore();}
  else renderer.drawPlayer(g,profile,{x:100,y:150,scale:2,...motion},time);
  const data=g.getImageData(0,0,200,200).data,colors=new Set();
  let x1=200,y1=200,x2=-1,y2=-1,count=0;
  for(let y=0;y<200;y++)for(let x=0;x<200;x++){
    const at=(y*200+x)*4;if(data[at+3]>128){count++;x1=Math.min(x1,x);x2=Math.max(x2,x);y1=Math.min(y1,y);y2=Math.max(y2,y);
      colors.add(data[at]+','+data[at+1]+','+data[at+2]);}
  }
  return {png:canvas.toDataURL(),count,colors:colors.size,x1,y1,x2,y2};
};
</script>'''
        self.send_response(200)
        self.send_header('Content-Type','text/html; charset=utf-8')
        self.send_header('Content-Length',str(len(html)))
        self.end_headers();self.wfile.write(html)


class JavaScriptCharacterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(FixtureHandler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context()
        self.context.add_init_script('''(()=>{
          window.characterIO=[];window.characterRects=0;
          window.fetch=()=>{characterIO.push('fetch');throw Error('No character asset requests');};
          window.Image=class{constructor(){characterIO.push('Image');throw Error('No character image loading');}};
          CanvasRenderingContext2D.prototype.drawImage=function(){characterIO.push('drawImage');throw Error('Characters must draw their own pixels');};
          const rect=CanvasRenderingContext2D.prototype.fillRect;
          CanvasRenderingContext2D.prototype.fillRect=function(...args){characterRects++;return rect.apply(this,args);};
        })()''')
        self.page=self.context.new_page();self.errors=[];self.failures=[];self.requests=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('request',lambda request:self.requests.append(request.url))
        self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/javascript-character-fixture.html',wait_until='load')
        self.page.wait_for_function('charactersReady||characterError')
        self.assertIsNone(self.page.evaluate('characterError'))

    def tearDown(self):
        self.assertEqual(self.page.evaluate('characterIO'),[],'No image loading or image blitting may support these characters')
        self.assertEqual([url for url in self.requests if '/assets/characters/' in url],[])
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])

    def assert_visible(self,frame):
        self.assertGreater(frame['count'],700,'A complete character must remain visible')
        self.assertGreater(frame['colors'],8)
        self.assertTrue(0<frame['x1']<frame['x2']<199)
        self.assertTrue(0<frame['y1']<frame['y2']<199)
        self.assertGreater(frame['y2'],140,'The character must retain its gameplay foot origin')

    def test_all_facings_walk_and_emote_using_actual_javascript_pixels(self):
        result=self.page.evaluate('''()=>{
          const rows=[];
          for(const facing of ['down','left','up','right']){
            const idle=drawCharacter({}, {facing});
            const walk=Array.from({length:16},(_,n)=>drawCharacter({}, {facing,walking:true,phase:n/16*Math.PI*2},.6));
            const actions=['wave','dance','robot','disco','playing','sit'].map(emote=>({emote,...drawCharacter({}, {facing,emote,emoteTime:.6},.6)}));
            rows.push({facing,idle,walk,actions});
          }return rows;
        }''')
        self.assertEqual(self.page.evaluate('characterRenderer.getState().mode'),'javascript-characters')
        self.assertGreater(self.page.evaluate('characterRects'),100)
        self.assertEqual(len({row['idle']['png'] for row in result}),4)
        for row in result:
            with self.subTest(facing=row['facing']):
                self.assert_visible(row['idle'])
                self.assertGreater(len({frame['png'] for frame in row['walk']}),3)
                for frame in row['walk']+row['actions']:
                    self.assert_visible(frame)
                for action in row['actions']:
                    self.assertNotEqual(action['png'],row['idle']['png'],action['emote'])

    def test_each_optional_hat_can_be_removed_without_changing_the_plain_base(self):
        rows=self.page.evaluate('''()=>{
          const rows=[];
          for(const facing of ['down','left','up','right']){
            const plain=drawCharacter({}, {facing});
            for(const headwear of ['cap','beanie','bucket','crown','headwrap']){
              const worn=drawCharacter({headwear}, {facing}),removed=drawCharacter({headwear:'none'}, {facing});
              rows.push({facing,headwear,plain:plain.png,worn:worn.png,removed:removed.png});
            }
          }return rows;
        }''')
        for row in rows:
            with self.subTest(facing=row['facing'],headwear=row['headwear']):
                self.assertNotEqual(row['worn'],row['plain'])
                self.assertEqual(row['removed'],row['plain'])

    def test_all_musician_costumes_animate_and_reduced_motion_keeps_idle_quiet(self):
        rows=self.page.evaluate('''()=>{
          const rows=[];
          for(const id of ['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles'])for(const facing of ['down','left','up','right']){
            const frames=Array.from({length:8},(_,n)=>drawCharacter({}, {facing,walking:true,phase:n/8*Math.PI*2},.6,id));
            rows.push({id,facing,frames});
          }return rows;
        }''')
        self.assertEqual(len(rows),36)
        for row in rows:
            with self.subTest(musician=row['id'],facing=row['facing']):
                self.assertGreater(len({frame['png'] for frame in row['frames']}),2)
                for frame in row['frames']:
                    self.assert_visible(frame)
        frozen=self.page.evaluate('''async()=>{
          window.stillRenderer=createCodaCharacterRenderer({reducedMotion:()=>true});await stillRenderer.ready;
          return [0,.5,2,9].map(time=>drawCharacter({hairstyle:'buns',headwear:'crown'}, {facing:'down',walking:false,phase:time*4,emote:'dance',emoteTime:time},time,null,true).png);
        }''')
        self.assertEqual(len(set(frozen)),1,'Reduced motion must keep a quiet pose')

    def test_reduced_motion_walking_changes_feet_without_bobbing_the_head(self):
        rows=self.page.evaluate('''async()=>{
          const renderer=createCodaCharacterRenderer({reducedMotion:()=>true});await renderer.ready;
          const rows=[];
          for(const id of ['player','bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles'])
            for(const facing of ['down','left','up','right']){
              const feet=new Set(),heads=new Set();
              for(let step=0;step<8;step++){
                const phase=step/8*Math.PI*2,frame=renderer.renderPixelFrame(id,{},
                  {facing,walking:true,phase},0,{base:true}),ctx=frame.getContext('2d');
                feet.add(Array.from(ctx.getImageData(25,72,30,17).data).join(','));
                heads.add(Array.from(ctx.getImageData(20,12,40,42).data).join(','));
              }
              rows.push({id,facing,feet:feet.size,heads:heads.size});
            }
          return rows;
        }''')
        for row in rows:
            with self.subTest(character=row['id'],facing=row['facing']):
                self.assertGreater(row['feet'],1,'A moving character must retain visible step feedback')
                self.assertEqual(row['heads'],1,'Reduced motion still removes head/body bobbing')


if __name__=='__main__':
    unittest.main(verbosity=2)
