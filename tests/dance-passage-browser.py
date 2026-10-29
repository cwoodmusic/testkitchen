"""Published corridor cleanup preserves the uploaded edit data and NPC routes.

Uses disposable browser contexts, the real published collision map, and the
production NPC behavior module. No accounts or external services are needed.
"""
import functools
import hashlib
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
# Pin the uploaded sections that the requested plant removal does not change.
UPLOAD_DIGESTS={
    'other_assets':'e73fa094c391e076e2993677e1deffeee49d814787b20d176903b8801289d8cd',
    'collision':'57c91841122493deac969c4b0752d42043d8acd3ee3c1248e9d0ebd93dc5d922',
    'strokes':'82affa1d35a3fa992b587ef2b15f799c4ee3b2620e5a4f0900f90b82c4581068',
}


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True,separators=(',',':')).encode()).hexdigest()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):
        pass


class DancePassageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),
            functools.partial(QuietHandler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop()
        cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1600,'height':1000})
        self.context.route('https://**/*',lambda route:route.abort())
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.page=self.context.new_page();self.page.set_default_timeout(8000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('console',lambda message:self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response',lambda response:self.failures.append(response.url)
                     if response.status>=400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/world-preview.html',
                       wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA?.characters().spriteState.ready')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors,[],'Corridor cleanup must not cause browser/frame errors')
        self.assertEqual(self.failures,[],'Failed local corridor/world resources')

    def test_only_the_authorized_plant_changes_from_the_uploaded_project(self):
        project=self.page.evaluate('CodaDeveloperConsole.getProject()')
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProjectSource()'),'published')
        self.assertEqual((len(project['assets']),len(project['collision']),len(project['strokes'])),
                         (8,1085,99))
        other=[asset for asset in project['assets'] if asset['id']!='asset-8']
        self.assertEqual(digest(other),UPLOAD_DIGESTS['other_assets'])
        for key in ['collision','strokes']:
            self.assertEqual(digest(project[key]),UPLOAD_DIGESTS[key],
                             'Removing the plant must preserve all uploaded '+key)
        plant=next(asset for asset in project['assets'] if asset['id']=='asset-8')
        self.assertFalse(plant['visible'],'The removed plant must not draw as a placed asset')
        self.assertEqual(plant['origin']['name'],'dance_passage_plant_leaves')
        x,y,w,h=plant['origin']['bounds']
        self.assertLessEqual(x,754);self.assertLessEqual(y,609)
        self.assertGreaterEqual(x+w,816);self.assertGreaterEqual(y+h,690)
        self.assertEqual(plant['crop'],[0,0,w,h],
                         'The cleanup source must include both the leaves and the pot')

    def test_the_corridor_is_open_while_neighboring_columns_and_walls_stay_solid(self):
        result=self.page.evaluate('''()=>({
          closedStrip:[],openedWalls:[],games:CodaArcadeQA.worldObjects().filter(x=>x.game).map(x=>({
            name:x.game.name,walkable:CodaArcadeQA.walkable(x.game.npcX,x.game.npcY),
            route:CodaArcadeQA.route(1180,388,x.game.x,x.game.y).length
          }))
        })''')
        result.update(self.page.evaluate('''()=>{
          const closedStrip=[],openedWalls=[];
          for(const x of [785,795,805,815])for(let y=605;y<=715;y+=10)
            if(!CodaArcadeQA.walkable(x,y))closedStrip.push([x,y]);
          for(let y=665;y<=705;y+=10)if(CodaArcadeQA.walkable(775,y))openedWalls.push([775,y]);
          for(const x of [835,845,865])for(let y=635;y<=725;y+=10)
            if(CodaArcadeQA.walkable(x,y))openedWalls.push([x,y]);
          return {closedStrip,openedWalls};
        }'''))
        self.assertEqual(result['closedStrip'],[])
        self.assertEqual(result['openedWalls'],[],'The plant removal must not open adjoining masonry')
        self.assertEqual(len(result['games']),4)
        self.assertTrue(all(game['walkable'] and game['route']>0 for game in result['games']))

    def test_npc_movement_crosses_the_former_plant_in_both_directions(self):
        # A controlled musician uses the production behavior module with this
        # world's actual map and A*. A cabinet target makes its destination
        # deterministic; real movement, arrival, and collision checks still run.
        cases=self.page.evaluate('''()=>{
          const qa=CodaArcadeQA;
          return [[[795,585],[405,744]],[[405,744],[795,585]]].map(([start,end])=>{
            const person={id:'bach',x:start[0],y:start[1]},game={index:1,name:'Passage test',
              x:end[0],y:end[1],npcX:end[0],npcY:end[1]};
            const brain=createCodaNPCBehavior({npcs:[person],inside:qa.walkable,route:qa.route,
              getGames:()=>[game],getPlayer:()=>({x:-9999,y:-9999})});
            let enteredPlant=false,enteredPot=false,illegal=0,maxStep=0,totalDistance=0,frames=0,arrived=false;
            for(;frames<600;frames++){
              const before={x:person.x,y:person.y};brain.update(1/30);
              const step=Math.hypot(person.x-before.x,person.y-before.y);
              maxStep=Math.max(maxStep,step);totalDistance+=step;
              if(!qa.walkable(person.x,person.y)||person.hidden)illegal++;
              if(person.x>=763&&person.x<=816&&person.y>=617&&person.y<=689)enteredPlant=true;
              if(person.x>=777&&person.x<=803&&person.y>=658&&person.y<=689)enteredPot=true;
              if(person.arrived&&person.mode==='cabinet'){arrived=true;break;}
            }
            return {start,end,arrived,frames,enteredPlant,enteredPot,illegal,maxStep,totalDistance,
              mode:person.mode,target:brain.snapshot()[0].target,
              remaining:Math.hypot(person.x-end[0],person.y-end[1])};
          });
        }''')
        for case in cases:
            with self.subTest(direction=(case['start'],case['end'])):
                self.assertTrue(case['arrived'],case)
                self.assertTrue(case['enteredPlant'],'The musician must cross the former plant area')
                self.assertEqual(case['illegal'],0,case)
                self.assertGreater(case['totalDistance'],400)
                self.assertLessEqual(case['maxStep'],65/30+.001,'A route must be walked without teleporting')
                self.assertLessEqual(case['remaining'],12.1)
        self.assertTrue(any(case['enteredPot'] for case in cases),
                        'At least one route must exercise the old pot footprint as well as its leaves')


if __name__=='__main__':
    unittest.main(verbosity=2)
