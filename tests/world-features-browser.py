"""Exercise detailed editing, musician identities, DJ playback, and live lighting.

Uses disposable Chromium profiles and the connected world's real published
layout. No login, network service, or existing browser save is required.
"""
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class WorldFeatureTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(
            ('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(
            executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.playwright.stop()
        cls.server.shutdown(); cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1600, 'height':1000})
        self.context.route('https://**/*', lambda route:route.abort())
        self.context.add_init_script('''(()=>{
          localStorage.setItem('codaArcadeFXV1','off');
          window.featureFrames=count=>new Promise(resolve=>{
            const next=()=>{if(--count<=0)resolve();else requestAnimationFrame(next);};
            requestAnimationFrame(next);
          });
        })()''')
        self.page = self.context.new_page(); self.page.set_default_timeout(10000)
        self.errors = []; self.failures = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('console', lambda message:self.errors.append(message.text)
                     if 'Arcade frame error:' in message.text else None)
        self.page.on('response', lambda response:self.failures.append(response.url)
                     if response.status>=400 and '127.0.0.1' in response.url
                     and not response.url.endswith('favicon.ico') else None)
        self.load()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], 'New world features must not cause frame/page errors')
        self.assertEqual(self.failures, [], 'Failed local world feature resources')

    def load(self):
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/world-preview.html',
                       wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.characters().spriteState.ready')
        self.page.evaluate('featureFrames(3)')

    def frames(self, count=3):
        self.page.evaluate('(count)=>featureFrames(count)', count)

    def field(self, name, value):
        target = self.page.locator('#'+name)
        target.fill(str(value)); target.press('Tab')

    def canvas_point(self, x, y):
        self.page.locator('#view').scroll_into_view_if_needed()
        return self.page.evaluate('''([x,y])=>{
          const box=view.getBoundingClientRect(),cam=CodaArcadeQA.camera();
          return {x:box.left+(x-cam.x)*cam.zoom*box.width/1672,
                  y:box.top+(y-cam.y)*cam.zoom*box.height/941};
        }''', [x,y])

    def quality(self, name):
        open_settings(self.page)
        for _ in range(3):
            if self.page.evaluate('CodaArcadeQA.atmosphere().quality') == name:
                close_settings(self.page);self.frames(); return
            self.page.locator('#fxBtn').click()
        self.fail('Unable to select FX quality '+name)

    def test_detail_zoom_reaches_eight_times_and_keeps_paint_coordinates_correct(self):
        self.page.keyboard.press('F2')
        self.page.evaluate('CodaArcadeQA.setZoom(8)')
        self.page.wait_for_function('Math.abs(CodaArcadeQA.camera().zoom-8)<.001')
        self.assertEqual(self.page.locator('#zoomReset').inner_text(), '800%')
        self.assertTrue(self.page.locator('#zoomIn').is_disabled())
        self.page.locator('#view').focus(); self.page.keyboard.press('c')
        point = self.page.evaluate('''()=>{
          const c=CodaArcadeQA.camera();return {x:c.x+c.visibleWidth*.76,y:c.y+c.visibleHeight*.61};
        }''')
        before = self.page.evaluate('([x,y])=>CodaArcadeQA.walkable(x,y)', [point['x'],point['y']])
        self.page.get_by_label('Collision tool', exact=True).select_option('block' if before else 'open')
        self.page.get_by_label('Collision brush', exact=True).select_option('1')
        screen = self.canvas_point(point['x'],point['y'])
        self.assertTrue(self.page.evaluate('({x,y})=>document.elementFromPoint(x,y)===view',screen))
        self.page.mouse.click(**screen)
        self.assertNotEqual(self.page.evaluate('([x,y])=>CodaArcadeQA.walkable(x,y)',
                                              [point['x'],point['y']]), before)
        self.page.locator('#devUndo').click()
        self.assertEqual(self.page.evaluate('([x,y])=>CodaArcadeQA.walkable(x,y)',
                                           [point['x'],point['y']]), before)
        self.page.locator('#devPlaytest').click()
        self.page.wait_for_function('CodaArcadeQA.camera().zoom<=3.001')
        self.assertLessEqual(self.page.evaluate('CodaArcadeQA.camera().targetZoom'),3)
        self.page.locator('#devPlaytest').click(); self.page.evaluate('CodaArcadeQA.setZoom(8)')
        self.page.wait_for_function('CodaArcadeQA.camera().zoom>7.99')
        self.page.locator('#view').focus(); self.page.keyboard.press('F2')
        self.page.wait_for_function('CodaArcadeQA.camera().zoom<=3.001')
        self.assertLessEqual(float(self.page.evaluate('localStorage.getItem("codaArcadeCameraZoomV1")')),3)
        self.load()
        self.assertLessEqual(self.page.evaluate('CodaArcadeQA.camera().targetZoom'),3)

    def test_each_historical_musician_has_a_distinct_pixel_silhouette(self):
        result = self.page.evaluate('''()=>{
          const renderer=createCodaCharacterRenderer({reducedMotion:()=>true});
          const ids=['bach','mozart','beethoven','clara','joplin','ellington','ella','nina','miles'];
          return ids.map(id=>{
            const canvas=Object.assign(document.createElement('canvas'),{width:128,height:140});
            const g=canvas.getContext('2d');renderer.drawNPC(g,{id,x:64,y:120,facing:'down',activity:'idle'},0);
            const p=g.getImageData(0,0,128,140).data;let alpha=2166136261,rgba=2166136261,count=0;
            for(let at=0;at<p.length;at+=4){
              const bit=p[at+3]>128?1:0;alpha=Math.imul(alpha^bit,16777619);count+=bit;
              for(let c=0;c<4;c++)rgba=Math.imul(rgba^p[at+c],16777619);
            }
            return {id,alpha:alpha>>>0,rgba:rgba>>>0,count};
          });
        }''')
        self.assertEqual(len({row['rgba'] for row in result}),9)
        self.assertEqual(len({row['alpha'] for row in result}),9,
                         'Individual musicians must differ in shape and styling as well as colors')
        self.assertTrue(all(row['count']>350 for row in result),result)
        visitors=self.page.evaluate('CodaArcadeQA.characters().npcs.filter(person=>!person.hidden).slice(0,2)')
        self.assertEqual(len(visitors),2)
        descriptions=[]
        for person in visitors:
            talk_to_musician(self.page,person['id'])
            self.assertEqual(self.page.locator('#who').inner_text(),person['name'])
            descriptions.append(self.page.locator('.musician-description').inner_text())
            self.page.keyboard.press('Escape')
        self.assertNotEqual(*descriptions)

    def test_fantasy_boutique_options_render_without_clipping_and_persist(self):
        catalog = self.page.evaluate('createCodaCharacterRenderer().catalog')
        for group,minimum in {'headwear':24,'eyewear':14,'accessories':22,'shoes':16,'emotes':16}.items():
            self.assertGreaterEqual(len(catalog[group]),minimum,group)
        open_destination(self.page,'boutique')
        self.page.locator('#avatarPreviewMode').select_option('idle')
        hats = self.page.get_by_label('Hats',exact=True)
        ids = self.page.evaluate('''()=>{
          const options=Array.from(document.querySelector('#boutique-headwear').options);
          return ['witch','wizard'].map(word=>options.find(o=>o.textContent.toLowerCase().includes(word))?.value);
        }''')
        self.assertTrue(all(ids),'Both witch and wizard hats must be available')
        silhouettes=[]
        for hat in ids:
            hats.select_option(hat); self.frames()
            metrics=self.page.locator('.avatar-preview-views canvas').evaluate_all('''canvases=>canvases.map(c=>{
              const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
              return {image:c.toDataURL(),top:p.slice(0,c.width*4).some((v,i)=>i%4===3&&v>0)};
            })''')
            self.assertTrue(all(not view['top'] for view in metrics),'Tall hats must fit every preview direction')
            silhouettes.append(metrics[0]['image'])
        self.assertNotEqual(*silhouettes,'Witch and wizard hats need visibly different drawings')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        self.assertTrue(self.page.locator('#panel').is_visible(),'Unpurchased premium items remain previews')
        self.assertIn('Notes',self.page.locator('.panelMsg').inner_text())
        open_destination(self.page,'shop')
        self.page.locator('[data-shop-item="wizard"] button').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),60)
        open_destination(self.page,'boutique')
        self.page.get_by_label('Hats',exact=True).select_option(ids[-1])
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        self.assertTrue(self.page.locator('#panel').is_hidden(),'Purchased fantasy items must be guest-usable')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.headwear'),ids[-1])
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.headwear'),ids[-1])

    def test_dj_is_visible_behind_the_console_and_plays_music_for_guests(self):
        dj=self.page.evaluate('CodaArcadeQA.dj()')
        self.assertTrue(dj['visible'])
        self.assertEqual(dj['name'],'DJ Coda')
        self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)',
                                          [dj['approachX'],dj['approachY']]))
        self.frames(); self.page.locator('#view').focus(); self.page.keyboard.press('e')
        self.page.wait_for_function('!document.querySelector("#panel").hidden')
        self.assertIn('Jukebox',self.page.locator('#panelTitle').inner_text())
        tracks=self.page.locator('[data-jukebox-track]')
        self.assertGreaterEqual(tracks.count(),3,'The DJ needs playable guest tracks without Google sign-in')
        tracks.first.click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().playing&&CodaArcadeQA.jukebox().audioState==="running"')
        playing=self.page.evaluate('CodaArcadeQA.jukebox()')
        self.assertEqual(playing['source'],'house')
        self.assertTrue(playing['title'])
        self.page.locator('#jukeboxStop').click()
        self.page.wait_for_function('!CodaArcadeQA.jukebox().playing')
        composition=self.page.evaluate('CodaDJLibrary.songs[0].composition')
        for row in composition['drums']:
            for note in row['notes']:
                note.pop('p',None)
        self.page.locator('#djSongImport').set_input_files({
            'name':'classroom-loop.json','mimeType':'application/json',
            'buffer':json.dumps(composition).encode()})
        self.page.get_by_role('button',name='Play classroom-loop',exact=True).click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().source==="import"&&CodaArcadeQA.jukebox().audioState==="running"')
        self.page.locator('#jukeboxStop').click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.jukebox().playing'))
        self.page.locator('#panelClose').click();open_destination(self.page,'dj')
        self.assertEqual(self.page.get_by_role('button',name='Play classroom-loop',exact=True).count(),1)

    def test_dj_follows_the_edited_turntable_and_hides_with_it(self):
        before=self.page.evaluate('CodaArcadeQA.dj()')
        self.page.keyboard.press('F2');self.page.locator('#assetList').select_option('asset-3')
        original=self.page.evaluate('CodaDeveloperConsole.getProject().assets.find(a=>a.id==="asset-3")')
        self.field('assetX',original['x']+100);self.field('assetY',original['y']+20);self.frames()
        moved=self.page.evaluate('CodaArcadeQA.dj()')
        self.assertAlmostEqual(moved['x']-before['x'],100,places=3)
        self.assertAlmostEqual(moved['y']-before['y'],20,places=3)
        self.assertTrue(moved['visible'])
        self.page.locator('#assetVisible').uncheck();self.frames()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.dj().visible'))

    def test_lantern_cores_pulse_and_disco_pins_ignore_collision(self):
        self.quality('full')
        sample=self.page.evaluate('CodaArcadeQA.lighting()')
        self.assertGreater(sample['rayCount'],0)
        self.assertGreater(sample['spotCount'],0)
        self.assertLessEqual(sample['spotCount'],64)
        witnesses=self.page.evaluate('''async()=>{
          const values=[];
          for(let n=0;n<12;n++){
            await featureFrames(6);const snapshot=CodaArcadeQA.lighting();
            const lamp=snapshot.lanterns.find(l=>l.id==='dance-passage-lantern');
            const cam=CodaArcadeQA.camera(),g=view.getContext('2d');
            values.push({intensity:lamp.intensity,pixel:Array.from(g.getImageData(
              Math.round((843-cam.x)*cam.zoom),Math.round((650-cam.y)*cam.zoom),1,1).data),
              spots:snapshot.spots.map(p=>[Math.round(p.x*100),Math.round(p.y*100)]),
              closed:snapshot.spots.filter(p=>!CodaArcadeQA.walkable(p.x,p.y)).length,
              textures:snapshot.glowTextures});
          }return values;
        }''')
        self.assertGreater(max(x['intensity'] for x in witnesses)-min(x['intensity'] for x in witnesses),.04)
        self.assertGreater(len({tuple(x['pixel']) for x in witnesses}),2,
                           'The actual painted lantern core must pulse, beyond an invisible outer glow')
        self.assertGreater(len({str(x['spots']) for x in witnesses}),2)
        self.assertTrue(any(x['closed']>0 for x in witnesses),'Reflected light must pass across blocked walking cells')
        self.assertLessEqual(max(x['textures'] for x in witnesses),16,'Glow textures must stay bounded')
        self.quality('lite');lite=self.page.evaluate('CodaArcadeQA.lighting()')
        self.assertLessEqual(lite['spotCount'],24)
        self.quality('off');off=self.page.evaluate('CodaArcadeQA.lighting()')
        self.assertEqual((off['rayCount'],off['spotCount']),(0,0))

    def test_disco_projection_follows_moved_balls_and_respects_rays_switch(self):
        self.quality('full')
        self.page.keyboard.press('F2')
        self.page.locator('#devCatalog').select_option('disco_ball_dance')
        self.page.locator('#devLift').click();self.frames()
        ball=self.page.evaluate('CodaArcadeQA.lighting().balls.find(b=>b.id.includes("dance"))')
        self.assertIsNotNone(ball)
        x=float(self.page.locator('#assetX').input_value())
        y=float(self.page.locator('#assetY').input_value())
        self.field('assetX',x+60);self.field('assetY',y+20);self.frames(4)
        moved=self.page.evaluate('CodaArcadeQA.lighting().balls.find(b=>b.id.includes("dance"))')
        self.assertAlmostEqual(moved['x']-ball['x'],60,places=3)
        self.assertAlmostEqual(moved['y']-ball['y'],20,places=3)
        self.page.locator('#devDiscoRays').uncheck();self.frames(4)
        data=self.page.evaluate('CodaArcadeQA.lighting()')
        self.assertEqual([s for s in data['spots'] if s['ballId']==ball['id']],[])
        self.assertEqual([b for b in data['beams'] if b['ballId']==ball['id']],[])
        self.page.locator('#devDiscoRays').check();self.page.locator('#assetPlay').uncheck();self.frames(4)
        a=self.page.evaluate('CodaArcadeQA.lighting().spots.filter(s=>s.ballId.includes("dance")).map(s=>[s.x,s.y])')
        self.frames(24)
        b=self.page.evaluate('CodaArcadeQA.lighting().spots.filter(s=>s.ballId.includes("dance")).map(s=>[s.x,s.y])')
        self.assertTrue(a,'The frozen ball must still project visible pins')
        self.assertEqual(a,b,'Pausing placed-asset animation must freeze that ball\'s projection')
        self.page.locator('#assetVisible').uncheck();self.frames(4)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.lighting().balls.find(b=>b.id.includes("dance")).visible'))

    def test_reduced_motion_keeps_new_light_motion_steady(self):
        self.page.emulate_media(reduced_motion='reduce');self.load();self.quality('full')
        before=self.page.evaluate('CodaArcadeQA.lighting()')
        self.assertTrue(before['reducedMotion'])
        self.assertGreater(before['spotCount'],0)
        self.frames(30)
        after=self.page.evaluate('CodaArcadeQA.lighting()')
        self.assertEqual([(p['x'],p['y']) for p in before['spots']],
                         [(p['x'],p['y']) for p in after['spots']])
        self.assertEqual([p['intensity'] for p in before['lanterns']],
                         [p['intensity'] for p in after['lanterns']])


if __name__ == '__main__':
    unittest.main(verbosity=2)
