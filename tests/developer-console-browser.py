"""Run against a disposable browser profile and a temporary local static server.

Requires the environment's Python Playwright package and Chromium. No npm setup.
"""
import base64
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
from world_navigation_helpers import advance_world, enter_room, open_destination, talk_to_musician, open_settings, close_settings
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class WorldEditorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = f'http://127.0.0.1:{cls.server.server_port}/world-preview.html'
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1600, 'height': 1000})
        # These editor mechanics tests intentionally start from an empty local
        # project. Fresh published-layout behavior has its own browser suite.
        self.context.add_init_script('''(()=>{
          if(location.protocol!=='http:'||sessionStorage.getItem('editorFixtureSeeded'))return;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify({
            format:'CodaArcadeWorldProject',version:1,world:{width:1672,height:941},
            assets:[],collision:[],strokes:[],savedAt:Date.now()
          }));
          sessionStorage.setItem('editorFixtureSeeded','yes');
        })()''')
        # Cloud login is optional; these local editor tests must not contact Firebase.
        self.context.route('https://**/*', lambda route: route.abort())
        self.page = self.context.new_page()
        self.page.set_default_timeout(7000)
        self.errors = []
        self.local_failures = []
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))
        self.page.on('console', lambda msg: self.errors.append(msg.text) if 'Arcade frame error:' in msg.text else None)
        self.page.on('response', lambda response: self.local_failures.append(response.url) if response.status >= 400 and '127.0.0.1' in response.url and not response.url.endswith('favicon.ico') else None)
        self.page.goto(self.url, wait_until='domcontentloaded')
        try:self.page.wait_for_function('window.CodaDeveloperConsole?.ready() && window.CodaArcadeQA?.characters().spriteState.ready')
        except Exception as error:
            raise AssertionError({'errors':self.errors,'failures':self.local_failures,'initialization':self.page.evaluate('({developer:typeof CodaDeveloperConsole,qa:typeof CodaArcadeQA,renderer:typeof createCodaCharacterRenderer})')}) from error
        self.page.wait_for_function('window.CodaArcadeQA?.foregroundPixelAlpha("dance_right_couch",625,650)!==null')
        # Use the shipped FX control to keep pixel assertions and CI timing stable.
        open_settings(self.page);self.page.locator('#fxBtn').click()
        self.page.locator('#fxBtn').click();close_settings(self.page)
        self.page.keyboard.press('F2')

    def tearDown(self):
        errors, failures = self.errors[:], self.local_failures[:]
        self.context.close()
        self.assertEqual(errors, [], 'Browser script/frame errors')
        self.assertEqual(failures, [], 'Failed local resources')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def tab(self, name):
        self.page.locator('#devTab-' + name).click()

    def field(self, name, value):
        target = self.page.locator('#' + name)
        target.fill(str(value))
        target.press('Tab')

    def point(self, x, y):
        return self.page.evaluate('''([x,y])=>{const b=document.querySelector('#view').getBoundingClientRect(),cam=CodaArcadeQA.camera();return {x:b.left+(x-cam.x)*cam.zoom*b.width/1672,y:b.top+(y-cam.y)*cam.zoom*b.height/941}}''', [x, y])

    def map_click(self, x, y):
        point = self.point(x, y)
        self.page.mouse.click(point['x'], point['y'])

    def lift(self):
        self.page.locator('#devCatalog').select_option('dance_right_couch')
        self.page.locator('#devLift').click()
        return self.project()['assets'][0]

    def import_project(self, data, accept=True):
        self.tab('project')
        if accept:
            self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'project.json','mimeType':'application/json','buffer':json.dumps(data).encode()})

    def test_original_movement_resize_layers_replace_and_reload(self):
        # Decorative lighting is off for a meaningful source-patch pixel comparison.
        before = self.page.locator('#view').evaluate('(c)=>Array.from(c.getContext("2d").getImageData(590,620,55,45).data)')
        original = self.lift()
        self.field('assetX', 1030)
        self.field('assetY', 600)
        self.page.wait_for_timeout(100)
        after = self.page.locator('#view').evaluate('(c)=>Array.from(c.getContext("2d").getImageData(590,620,55,45).data)')
        self.assertGreater(sum(a != b for a,b in zip(before, after)), 1000, 'Old artwork must be patched, rather than duplicated')
        self.assertEqual(self.project()['assets'][0]['origin']['bounds'], original['origin']['bounds'])
        self.field('assetW', 240)
        asset = self.project()['assets'][0]
        self.assertAlmostEqual(asset['w'] / asset['h'], original['w'] / original['h'])
        self.page.locator('#assetLayer').select_option('front')
        self.assertEqual(self.project()['assets'][0]['layer'], 'front')
        # Drag, resize and rotate through the real canvas input handlers.
        self.page.locator('#assetStudio').evaluate('(el)=>el.scrollTop=0')
        p0, p1 = self.point(1030,600), self.point(1070,620)
        self.page.mouse.move(**p0)
        self.page.mouse.down()
        self.page.mouse.move(**p1, steps=5)
        self.page.mouse.up()
        asset = self.project()['assets'][0]
        self.assertNotEqual(asset['x'], 1030)
        corner = self.point(asset['x']+asset['w']/2, asset['y']+asset['h']/2)
        end = self.point(asset['x']+asset['w']/2+24, asset['y']+asset['h']/2+24)
        self.page.mouse.move(**corner);self.page.mouse.down();self.page.mouse.move(**end,steps=4);self.page.mouse.up()
        self.assertGreater(self.project()['assets'][0]['w'], asset['w'])
        self.assertAlmostEqual(self.project()['assets'][0]['w']/self.project()['assets'][0]['h'], asset['w']/asset['h'])
        self.field('assetRotate', 25)
        self.page.locator('#devSolid').check()
        self.assertIn('collider', self.project()['assets'][0])
        # Replacement keeps placement and the original cleanup ownership.
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFOkAAAAASUVORK5CYII=')
        self.page.locator('#devReplaceFile').set_input_files({'name':'replacement.png','mimeType':'image/png','buffer':png})
        self.page.wait_for_function('window.CodaDeveloperConsole.getProject().assets[0].kind==="image"')
        self.assertIn('origin', self.project()['assets'][0])
        # Duplicate must detach ownership; saving it must remain valid on reload.
        self.page.locator('#assetDuplicate').click()
        self.assertNotIn('origin', self.project()['assets'][1])
        expected = self.project()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaDeveloperConsole.ready() && window.CodaArcadeQA.characters().spriteState.ready')
        self.assertEqual(self.project(), expected)

    def test_collision_layers_history_export_import_and_rejection(self):
        self.tab('collision')
        # This is an original structural wall, formerly impossible to open.
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(835,715)'))
        self.page.get_by_label('Collision tool', exact=True).select_option('open')
        self.map_click(835,715)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(835,715)'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.route(835,715,835,715).length>0'))
        self.page.locator('#devUndo').click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(835,715)'))
        self.page.locator('#devRedo').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.walkable(835,715)'))
        self.page.get_by_label('Collision tool', exact=True).select_option('block')
        self.map_click(1185,395)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1185,395)'))
        self.tab('layers')
        self.map_click(1000,500)
        self.assertEqual(len(self.project()['strokes']), 1)
        self.page.locator('#devLayerTool').select_option('erase')
        self.map_click(1000,500)
        self.assertEqual(self.project()['strokes'][-1]['tool'], 'erase')
        self.page.locator('#devUndo').click()
        self.assertEqual(len(self.project()['strokes']), 1)
        # Even a footprint narrower than a navigation cell must divert routes.
        self.tab('objects')
        self.page.locator('#assetPreset').click()
        self.page.locator('#assetAnim').select_option('none')
        for name,value in [('assetX',1230.5),('assetY',605),('assetW',100)]:
            self.field(name,value)
        self.page.locator('#devSolid').check()
        for name,value in [('devColX',0),('devColY',-25),('devColW',1),('devColH',50)]:
            self.field(name,value)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.walkable(1231,605)'))
        route = self.page.evaluate('CodaArcadeQA.route(1185,605,1285,605)')
        self.assertGreater(len(route), 1, 'Thin collision must divert navigation rather than be skipped')
        expected = self.project()
        self.tab('project')
        with self.page.expect_download() as download:
            self.page.locator('#devExport').click()
        exported = json.loads(Path(download.value.path()).read_text())
        self.assertEqual(exported, expected)
        invalid = json.loads(json.dumps(expected))
        invalid['collision'].append(invalid['collision'][0])
        self.import_project(invalid, accept=False)
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.startsWith("Import failed:")')
        self.assertEqual(self.project(), expected, 'Rejected imports must leave all edits intact')
        self.page.once('dialog', lambda d:d.accept())
        self.page.locator('#devReset').click()
        published=json.loads((ROOT/'published-world-project.json').read_text())
        self.assertEqual(self.project(),published,'Reset must restore the shared published layout')
        self.import_project(exported)
        self.page.wait_for_function('window.CodaDeveloperConsole.getProject().strokes.length===1')
        # Legacy world-only exports predate room editing. Their missing rooms
        # field must not erase newer Piano Lab / cave edits on this device.
        restored = {**expected, **({'rooms': published['rooms']} if published.get('rooms') else {})}
        self.assertEqual(self.project(), restored, 'A world-only import preserves room edits')
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project(),published,'One undo must revert the entire import')
        # An explicit empty rooms object is the current format's request to
        # replace those room edits too, and remains a single undo step.
        self.import_project({**exported, 'rooms': {}})
        self.page.wait_for_function('window.CodaDeveloperConsole.getProject().strokes.length===1')
        self.assertEqual(self.project(), expected, 'Explicit empty room data clears room overrides')
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project(), published)

    def test_delete_restore_typing_shortcuts_playtest_and_zoom(self):
        original = self.lift()
        self.field('assetName', 'wasd c l f')
        self.assertTrue(self.page.locator('#assetStudio').is_visible())
        self.assertEqual(self.project()['assets'][0]['name'], 'wasd c l f')
        self.page.locator('#assetRemove').click()
        self.assertFalse(self.project()['assets'][0]['visible'], 'Deleting an original must keep its source removed')
        self.page.locator('#devUndo').click()
        self.assertTrue(self.project()['assets'][0]['visible'])
        self.page.locator('#devRestore').click()
        self.assertEqual(self.project()['assets'], [])
        self.page.locator('#devUndo').click()
        self.page.locator('#devPlaytest').click()
        before = self.page.evaluate('CodaArcadeQA.position()')
        self.page.keyboard.down('d');self.page.wait_for_timeout(250);self.page.keyboard.up('d')
        after = self.page.evaluate('CodaArcadeQA.position()')
        self.assertGreater(after['x'], before['x'], 'Playtest must resume actual movement')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('#devPlaytest').get_attribute('aria-pressed'), 'false')
        self.page.keyboard.press('F2')
        self.page.keyboard.press('Shift+L')
        self.assertTrue(self.page.locator('#dev-layers').is_visible())
        self.assertFalse(self.page.locator('#layerEditor').is_visible(), 'Legacy layer pane must not bypass project history')
        self.page.keyboard.press('F2')
        self.page.keyboard.press('c')
        self.assertTrue(self.page.locator('#dev-collision').is_visible())
        # Zoom and edit the same world cell through the shared camera transform.
        self.page.evaluate('CodaArcadeQA.setZoom(2)')
        self.page.wait_for_function('CodaArcadeQA.camera().zoom>1.99')
        self.page.get_by_label('Collision tool', exact=True).select_option('open')
        self.map_click(1105,395)
        self.assertTrue(any(i == 39*168+110 and v == 1 for i,v in self.project()['collision']))
        self.tab('objects')
        pixel = self.page.evaluate('''()=>{for(let y=450;y<525;y+=5)for(let x=1150;x<1210;x+=5)if(CodaArcadeQA.foregroundPixelAlpha('main_counter_left_palm',x,y)>200)return [x,y]}''')
        self.assertIsNotNone(pixel)
        camera_before = self.page.evaluate('CodaArcadeQA.camera()')
        # Target the pixel center rather than an alpha edge while zoom settles.
        self.map_click(pixel[0]+.5, pixel[1]+.5)
        self.assertEqual(self.project()['assets'][-1]['origin']['name'], 'main_counter_left_palm')
        self.assertIsNotNone(self.page.evaluate('CodaAssetStudioQA.get().selected'))
        self.assertAlmostEqual(self.page.evaluate('CodaArcadeQA.camera().x'), camera_before['x'], delta=2, msg='Canvas selection must not recenter before its drag begins')

    def test_disco_catalog_lighting_controls_and_saved_transforms(self):
        options=self.page.locator('#devCatalog option').evaluate_all('(options)=>options.map(o=>o.value)')
        for name in ['disco_ball_arcade','disco_ball_dance','cabinet_pitch_race','cabinet_music_triad','cabinet_rhythm_room','cabinet_song_machine']:
            self.assertIn(name,options)
        before=self.page.locator('#view').evaluate('(c)=>Array.from(c.getContext("2d").getImageData(860,114,32,30).data)')
        for index,name in enumerate(['disco_ball_arcade','disco_ball_dance']):
            self.page.locator('#devCatalog').select_option(name)
            self.page.locator('#devLift').click()
            self.field('assetX',1000+index*200)
            self.field('assetY',420)
            self.field('assetW',100)
            self.field('assetRotate',25)
            self.field('devDiscoSpin',0.25+index)
            self.page.locator('#devDiscoRays').uncheck()
            state=self.page.evaluate('(name)=>CodaArcadeQA.worldObjects().find(o=>o.name===name)',name)
            self.assertAlmostEqual(state['spin'],0.25+index)
            self.assertFalse(state['rays'])
            self.assertGreater(state['anchor']['x'],900)
            self.assertGreater(state['anchor']['y'],380)
        self.page.wait_for_timeout(100)
        after=self.page.locator('#view').evaluate('(c)=>Array.from(c.getContext("2d").getImageData(860,114,32,30).data)')
        self.assertGreater(sum(a!=b for a,b in zip(before,after)),500,'Moving a disco ball must clear its original sphere')
        self.page.locator('#devDiscoRays').check()
        # Exercise the actual transformed light/sphere renderers at the shipped Lite setting.
        open_settings(self.page);self.page.locator('#fxBtn').click();self.page.locator('#fxBtn').click();close_settings(self.page)
        self.page.wait_for_timeout(150)
        self.page.locator('#assetVisible').uncheck()
        state=self.page.evaluate('CodaArcadeQA.worldObjects().find(o=>o.name==="disco_ball_dance")')
        self.assertFalse(state['visible']);self.assertFalse(state['rays'])
        self.page.locator('#devUndo').click()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.worldObjects().find(o=>o.name==="disco_ball_dance").rays'))
        expected=self.project()
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.CodaDeveloperConsole.ready() && window.CodaArcadeQA.characters().spriteState.ready')
        self.assertEqual(self.project(),expected,'Catalog originals and light settings must survive reload')

    def test_four_cabinet_interactions_follow_moves_and_restoration(self):
        names=['cabinet_pitch_race','cabinet_music_triad','cabinet_rhythm_room','cabinet_song_machine']
        game_names=['Pitch Race','Music Triad','Rhythm Room','Song Machine']
        for index,name in enumerate(names):
            self.page.locator('#devCatalog').select_option(name);self.page.locator('#devLift').click()
            self.field('assetX',950+index*145);self.field('assetY',610);self.field('assetW',120)
            self.assertTrue(self.page.locator('#devRelease').is_checked())
            self.assertTrue(self.page.locator('#devSolid').is_checked())
            state=self.page.evaluate('(name)=>CodaArcadeQA.worldObjects().find(o=>o.name===name)',name)
            game=state['game'];self.assertGreater(game['y'],650)
            self.assertGreater(game['npcY'],game['y'])
            self.page.locator('#devPlaytest').click()
            self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)',[game['x'],game['y']]))
            self.page.wait_for_timeout(100);self.page.keyboard.press('e')
            self.assertTrue(self.page.locator('#gameoverlay').is_visible())
            self.assertEqual(self.page.locator('#activegame').inner_text(),game_names[index])
            self.assertIn(game['url'],self.page.locator('#gameiframe').get_attribute('src'))
            self.page.locator('#returnworld').click();self.page.locator('#devPlaytest').click()
        # A hidden cabinet must lose its game prompt; restoring must restore the original anchor.
        self.page.locator('#assetVisible').uncheck()
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.worldObjects().find(o=>o.name==="cabinet_song_machine").game'))
        self.page.locator('#devUndo').click()
        self.page.locator('#devRestore').click()
        original=self.page.evaluate('CodaArcadeQA.worldObjects().find(o=>o.name==="cabinet_song_machine").game')
        self.assertEqual((original['x'],original['y']),(1064,315))

    def test_clean_background_and_foreground_do_not_redraw_painted_characters(self):
        samples=[[300,178],[379,199],[166,247],[230,284],[385,275],[516,395],
                 [729,285],[844,285],[964,285],[1081,285],[1308,158],[1491,305],
                 [1206,340],[915,380],[761,399],[1083,405],[1351,474],[1223,743],[1345,739],
                 [392,610],[221,679],[295,697],[403,713],[495,691],[570,690],[661,715],
                 [128,747],[211,735],[296,764],[403,795],[493,760],[626,774],[230,808]]
        self.page.wait_for_function('CodaArcadeQA.floorGrid()?.ready')
        mismatches=self.page.evaluate('''async(samples)=>{
          const image=new Image();image.src='assets/world/arcade-flat-floor-world.png';await image.decode();
          const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
          const reference=canvas.getContext('2d');reference.drawImage(image,0,0);
          const game=document.querySelector('#view').getContext('2d'),floor=CodaArcadeQA.floorGrid();
          const characters=CodaArcadeQA.characters(),dj=CodaArcadeQA.dj(),actors=[characters.player,...characters.npcs.filter(p=>!p.hidden),...(dj.visible?[dj]:[]),...CodaArcadeQA.shopkeepers().filter(p=>p.visible)];
          return samples.filter(([x,y])=>!actors.some(p=>Math.abs(p.x-x)<45&&y>p.y-90&&y<p.y+8)).flatMap(([x,y])=>{
            const rebuilt=floor.maskAt(x,y)>0,a=game.getImageData(x,y,1,1).data,
              b=rebuilt?floor.pixelAt(x,y):reference.getImageData(x,y,1,1).data;
            return [0,1,2].some(i=>Math.abs(a[i]-b[i])>2)?[{x,y,rebuilt,actual:Array.from(a),expected:Array.from(b)}]:[];
          });
        }''',samples)
        self.assertEqual(mismatches,[],'Foreground masks must not put the old people back over the clean background')
        # Fresh cabinet cutouts must include the reconstructed front, without customer holes.
        self.page.locator('#devCatalog').select_option('cabinet_pitch_race');self.page.locator('#devLift').click()
        self.assertGreater(self.page.locator('#devCatalogPreview').evaluate('(canvas)=>canvas.getContext("2d").getImageData(160,68,1,1).data[3]'),0)

    def test_musician_cast_moves_directionally_on_the_collision_map(self):
        characters=self.page.evaluate('CodaArcadeQA.characters()')
        self.assertGreaterEqual(len(characters['npcs']),9)
        self.assertIn('Miles Davis',[p['name'] for p in characters['npcs']])
        visible=[person for person in characters['npcs'] if not person['hidden']]
        self.assertGreaterEqual(len(visible),3)
        self.assertEqual(len({(p['x'],p['y']) for p in visible}),len(visible))
        self.page.keyboard.press('F2')
        start=self.page.evaluate('CodaArcadeQA.characters().npcs')
        self.page.wait_for_timeout(1200)
        end=self.page.evaluate('CodaArcadeQA.characters().npcs')
        self.assertGreater(sum(abs(a['x']-b['x'])+abs(a['y']-b['y'])>1 for a,b in zip(start,end)),2)
        self.assertTrue(any(p['walking'] and p['facing']!='down' and p['phase']>0 for p in end))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.characters().npcs.every(p=>p.hidden||CodaArcadeQA.walkable(p.x,p.y))'))
        talk_to_musician(self.page,'miles')
        self.assertEqual(self.page.locator('#who').inner_text(),'Miles Davis')
        self.assertTrue(self.page.locator('.musician-description').inner_text())
        self.assertTrue(self.page.locator('.musician-choices').get_by_role('button',name='mission',exact=False).is_visible())
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.conversation().open'))

    def test_miles_conversation_pauses_only_him_and_has_musical_topics(self):
        self.page.keyboard.press('F2')
        talk_to_musician(self.page,'miles')
        self.assertEqual(self.page.locator('#who').inner_text(),'Miles Davis')
        self.assertTrue(self.page.locator('#dialog').is_visible())
        self.assertIn('Imagined dialogue',self.page.locator('#dialog').inner_text())
        self.page.get_by_role('button',name='Tell me about your music',exact=True).click()
        self.assertIn('Kind of Blue',self.page.locator('#words').inner_text())
        self.assertIn('1959',self.page.locator('#words').inner_text())
        start=self.page.evaluate('CodaArcadeQA.characters().npcs')
        self.page.wait_for_timeout(600)
        end=self.page.evaluate('CodaArcadeQA.characters().npcs')
        a=next(p for p in start if p['id']=='miles');b=next(p for p in end if p['id']=='miles')
        self.assertEqual((a['x'],a['y'],a['phase']),(b['x'],b['y'],b['phase']))
        self.assertEqual(b['activity'],'chatting')
        self.assertTrue(any(abs(x['x']-y['x'])+abs(x['y']-y['y'])>1 for x,y in zip(start,end) if x['id']!='miles'))
        self.page.get_by_role('button',name='Give me a musical tip',exact=True).click()
        self.assertIn('pause',self.page.locator('#words').inner_text())
        self.page.keyboard.press('e')
        self.assertFalse(self.page.locator('#dialog').is_visible())
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.conversation().id'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.characters().npcs.find(p=>p.id==="miles").conversation'))

    def test_npc_recovers_when_editor_blocks_their_standing_position(self):
        self.tab('collision')
        self.page.get_by_label('Collision tool',exact=True).select_option('block')
        self.page.get_by_label('Collision brush',exact=True).select_option('5')
        person=self.page.evaluate('''()=>{
          const canvas=document.querySelector('#view'),box=canvas.getBoundingClientRect(),cam=CodaArcadeQA.camera();
          return CodaArcadeQA.characters().npcs.find(person=>{
            if(person.hidden)return false;
            const x=box.left+(person.x-cam.x)*cam.zoom*box.width/1672,
              y=box.top+(person.y-cam.y)*cam.zoom*box.height/941;
            return document.elementFromPoint(x,y)===canvas;
          })||null;
        }''')
        self.assertIsNotNone(person,'Choose a visible NPC whose standing cell can actually be painted')
        self.assertTrue(self.page.evaluate('id=>CodaArcadeQA.findMusician(id)',person['id']))
        self.map_click(person['x'],person['y'])
        self.assertFalse(self.page.evaluate('person=>CodaArcadeQA.walkable(person.x,person.y)',person),
                         'The real collision brush must first block the NPC’s standing cell')
        self.assertTrue(self.page.evaluate('id=>CodaArcadeQA.characters().npcs.find(p=>p.id===id).hidden',person['id']),'An invalid standing location should despawn rather than walk through a new wall')
        self.page.keyboard.press('F2')
        self.page.wait_for_function('id=>!CodaArcadeQA.characters().npcs.find(p=>p.id===id).hidden',arg=person['id'],timeout=10000)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.characters().npcs.every(p=>p.hidden||CodaArcadeQA.walkable(p.x,p.y))'))
        self.assertFalse(self.page.evaluate('id=>CodaArcadeQA.characters().npcs.find(p=>p.id===id).hidden',person['id']),'A requested musician should safely reenter through the arcade entrance')

    def test_avatar_preview_matches_saved_in_world_customization(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.page.evaluate('localStorage.setItem("musicArcadeV1",JSON.stringify({name:"Guest",walked:600,collectedTokens:7}))')
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.CodaDeveloperConsole.ready() && window.CodaArcadeQA.characters().spriteState.ready')
        open_destination(self.page,'boutique')
        self.assertEqual(self.page.locator('.avatar-preview-views canvas').count(),4)
        self.page.locator('#avatarPreviewMode').select_option('idle')
        self.page.wait_for_timeout(50)
        before=self.page.locator('.avatar-preview-views canvas').first.evaluate('(c)=>c.toDataURL()')
        self.page.get_by_label('Arcade nickname',exact=True).fill('Jazz Explorer')
        self.page.get_by_label('Hairstyle',exact=True).select_option('buns')
        self.page.get_by_label('Outfit',exact=True).select_option('overalls')
        self.page.get_by_label('Accessories',exact=True).select_option('headphones')
        self.page.get_by_label('Shoes',exact=True).select_option('boots')
        self.page.get_by_label('Outfit color',exact=True).evaluate('(input)=>{input.value="#4678ab";input.dispatchEvent(new Event("input",{bubbles:true}));}')
        self.page.wait_for_timeout(100)
        after=self.page.locator('.avatar-preview-views canvas').first.evaluate('(c)=>c.toDataURL()')
        self.assertNotEqual(before,after)
        self.assertNotEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.shirt'),'#4678ab','Preview changes must stay drafts until Save')
        self.page.get_by_role('button',name='Save my look',exact=True).click()
        expected=self.page.evaluate('CodaArcadeQA.characters().player.appearance')
        self.assertEqual((expected['name'],expected['shirt'],expected['accessory'],expected['outfit']),('Jazz Explorer','#4678ab','headphones','overalls'))
        self.assertEqual(self.page.evaluate('JSON.parse(localStorage.musicArcadeV1).collectedTokens'),7)
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.CodaDeveloperConsole.ready() && window.CodaArcadeQA.characters().spriteState.ready')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance'),expected)


if __name__ == '__main__':
    unittest.main(verbosity=2)
