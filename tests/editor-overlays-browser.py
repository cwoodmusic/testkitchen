"""Visible editor overlays and exact-pixel freehand/line painting."""
import importlib.util
from pathlib import Path
import sys
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[1]
_spec=importlib.util.spec_from_file_location('overlay_world_editor',Path(__file__).with_name('developer-console-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class WorldOverlayTests(unittest.TestCase):
    setUpClass=classmethod(_world.WorldEditorTests.setUpClass.__func__)
    tearDownClass=classmethod(_world.WorldEditorTests.tearDownClass.__func__)
    setUp=_world.WorldEditorTests.setUp
    tearDown=_world.WorldEditorTests.tearDown

    def test_collision_and_layers_stay_visible_without_selecting_a_paint_tool(self):
        self.page.clock.install();self.page.clock.run_for(32)
        original=self.page.evaluate('CodaDeveloperConsole.getProject()')
        original.pop('savedAt',None)
        before=self.page.locator('#view').screenshot()
        for name in ['Collision','Layers']:
            button=self.page.locator('#devShow'+name)
            button.click();self.page.clock.run_for(32)
            self.assertEqual(button.get_attribute('aria-pressed'),'true')
            self.assertTrue(self.page.locator('#devOverlayLegend').is_visible())
            state=self.page.evaluate('CodaDeveloperConsole.getState()')
            self.assertEqual(state['tab'],'objects')
            self.assertTrue(state['overlays'][name.lower()])
            self.assertNotEqual(self.page.locator('#view').screenshot(),before)
            button.click();self.page.clock.run_for(32)
            self.assertEqual(button.get_attribute('aria-pressed'),'false')
        after=self.page.evaluate('CodaDeveloperConsole.getProject()');after.pop('savedAt',None)
        self.assertEqual(after,original,'Overlay buttons must not edit project data')
        self.page.locator('#devTab-layers').click();self.page.clock.run_for(32)
        self.assertEqual(self.page.locator('#devShowLayers').get_attribute('aria-pressed'),'true')
        self.page.locator('#devTab-objects').click();self.page.clock.run_for(32)
        self.assertEqual(self.page.locator('#devShowLayers').get_attribute('aria-pressed'),'true')
        self.page.screenshot(path='/tmp/coda-editor-overlay-world.png')
        self.page.locator('#devPlaytest').click();self.page.clock.run_for(32)
        self.assertTrue(self.page.locator('#devShowLayers').is_disabled())
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.getState().overlays.visible'))

    def test_world_one_pixel_brush_and_line_match_saved_stamps_at_zoom(self):
        self.page.clock.install();self.page.clock.run_for(32)
        self.page.locator('#devTab-layers').click()
        self.page.locator('#devLayerSize').select_option('1')
        self.page.locator('#devLayerShape').select_option('line')
        self.page.clock.run_for(32)
        def point(x,y):
            return self.page.evaluate("""([x,y])=>{const b=view.getBoundingClientRect(),c=CodaArcadeQA.camera();return {x:b.left+(x-c.x)*c.zoom*b.width/1672,y:b.top+(y-c.y)*c.zoom*b.height/941};}""",[x,y])
        baseline=self.page.evaluate('CodaArcadeQA.layerEditor().editedPixels')
        original=self.page.evaluate('CodaDeveloperConsole.getProject().strokes.length')
        self.page.mouse.move(**point(1200.25,650.25));self.page.mouse.down()
        self.page.mouse.move(**point(1200.25,678.25),steps=4)
        self.page.mouse.move(**point(1230.25,680.25),steps=4)
        drawing=self.page.evaluate('CodaArcadeQA.layerEditor().drawing')
        self.assertEqual(drawing['points'],[[1200,650],[1230,680]],'A Line drag must discard intermediate curved pointer positions')
        self.page.mouse.up();self.page.mouse.move(5,5);self.page.clock.run_for(32)
        strokes=self.page.evaluate('CodaDeveloperConsole.getProject().strokes')
        self.assertEqual(len(strokes),original+1)
        self.assertEqual(strokes[-1]['points'],[[1200,650],[1230,680]])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.layerEditor().editedPixels'),baseline+31,
            'A one-pixel straight diagonal should author exactly 31 pixels')
        self.page.locator('#devUndo').click();self.page.clock.run_for(32)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject().strokes.length'),original)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.layerEditor().editedPixels'),baseline)
        self.page.locator('#devLayerShape').select_option('pen')
        for zoom in [2,4]:
            while self.page.evaluate('CodaArcadeQA.camera().targetZoom')<zoom:self.page.locator('#devZoomIn').click()
            self.page.clock.run_for(600)
            camera=self.page.evaluate('CodaArcadeQA.camera()')
            x=int(camera['x']+1672/camera['zoom']*.75);y=int(camera['y']+941/camera['zoom']*.65)
            baseline=self.page.evaluate('CodaArcadeQA.layerEditor().editedPixels')
            self.page.mouse.move(**point(x+.25,y+.25));self.page.clock.run_for(32)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.layerEditor().hover'),[x,y])
            self.page.mouse.down();self.page.mouse.up();self.page.mouse.move(5,5);self.page.clock.run_for(32)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.layerEditor().editedPixels'),baseline+1,
                'Zoom must not enlarge a one-pixel brush footprint')
            self.page.locator('#devUndo').click();self.page.clock.run_for(32)
        self.page.screenshot(path='/tmp/coda-editor-world-line-pixels.png')


class RoomPixelBrushTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1100,'height':700})
        self.page=self.context.new_page();self.errors=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.set_content('<section id="room"><header>Pixel test room</header><canvas id="art" width="64" height="48" style="display:block;margin-left:420px;width:512px;height:384px;image-rendering:pixelated"></canvas></section>')
        self.page.add_style_tag(path=str(ROOT/'room-developer-editor.css'))
        self.page.add_script_tag(path=str(ROOT/'room-developer-editor.js'))
        self.page.evaluate('''()=>{
          const host=document.querySelector('#room'),canvas=document.querySelector('#art'),back=document.createElement('canvas');back.width=64;back.height=48;
          back.getContext('2d').fillStyle='#334455';back.getContext('2d').fillRect(0,0,64,48);
          window.editor=createCodaRoomDeveloperEditor({id:'pixels',host,canvas,width:64,height:48,getBackground:()=>back,baseWalkable:(x,y)=>x<32,storage:{getItem:()=>null,setItem(){}}});
          function draw(){const g=canvas.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,64,48);editor.beforeScene(g);g.drawImage(back,0,0);editor.afterBackground(g);g.fillStyle='#ff0000';g.fillRect(18,18,12,12);editor.afterScene(g);requestAnimationFrame(draw);}draw();editor.open();
        }''')
        self.page.clock.install();self.page.clock.run_for(32)

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[])

    def action(self,name):return self.page.locator('[data-room-action="'+name+'"]')
    def field(self,name):return self.page.locator('[data-room-field="'+name+'"]')
    def point(self,x,y):
        box=self.page.locator('#art').bounding_box();camera=self.page.evaluate('editor.getState().camera')
        return {'x':box['x']+(x-camera['x'])*camera['zoom']*box['width']/64,'y':box['y']+(y-camera['y'])*camera['zoom']*box['height']/48}
    def pixels(self):
        return self.page.evaluate('''()=>{const g=art.getContext('2d'),pixels=[];for(let y=18;y<30;y++)for(let x=18;x<30;x++){const p=g.getImageData(x,y,1,1).data;if(p[0]!==255||p[1]!==0||p[2]!==0)pixels.push([x,y]);}return pixels;}''')
    def select_layers(self):
        self.page.locator('[data-room-tab="layers"]').click();self.action('show-layers').click()
        self.field('layer-size').select_option('1');self.page.clock.run_for(16)

    def test_collision_overlay_shows_unedited_boundary_and_does_not_mutate_project(self):
        original=self.page.evaluate('editor.getProject()')
        self.action('show-collision').click();self.page.clock.run_for(32)
        samples=self.page.evaluate('''()=>{const g=art.getContext('2d');return [Array.from(g.getImageData(10,10,1,1).data),Array.from(g.getImageData(40,10,1,1).data)];}''')
        self.assertGreater(samples[0][1],samples[1][1],'Unedited walkable cells need a green tint')
        self.assertGreater(samples[1][0],samples[0][0],'Original blocked cells need a red tint')
        self.assertEqual(self.page.evaluate('editor.getProject()'),original)
        self.action('show-collision').click();self.page.clock.run_for(32)
        self.assertEqual(self.page.evaluate('editor.getState().undo'),0)

    def test_one_pixel_brush_and_line_have_exact_footprints_and_one_undo(self):
        self.select_layers()
        self.page.mouse.move(**self.point(20.25,20.25));self.page.clock.run_for(16)
        self.assertEqual(self.page.evaluate('editor.getState().brush'),{'x':20,'y':20,'w':1,'h':1,'size':1,'tool':'paint'})
        self.page.mouse.down();self.page.mouse.up();self.page.mouse.move(1000,650);self.page.clock.run_for(32)
        self.assertEqual(self.pixels(),[[20,20]],'A one-pixel brush must affect exactly one authored pixel')
        self.action('undo').click();self.page.clock.run_for(16);self.assertEqual(self.pixels(),[])
        self.field('layer-shape').select_option('line')
        self.page.mouse.move(**self.point(20.25,20.25));self.page.mouse.down()
        self.page.mouse.move(**self.point(25.25,23.25),steps=8);self.page.clock.run_for(16)
        self.assertEqual(self.page.evaluate('editor.getProject().strokes[0].points'),[[20,20],[25,23]])
        self.page.mouse.up();self.page.mouse.move(1000,650);self.page.clock.run_for(32)
        self.assertEqual(self.pixels(),[[20,20],[21,21],[22,21],[23,22],[24,22],[25,23]])
        self.assertEqual(self.page.evaluate('editor.getState().undo'),1,'The entire line must undo as one stroke')
        self.action('undo').click();self.page.clock.run_for(16);self.assertEqual(self.pixels(),[])
        for _ in range(4):self.action('zoom-in').click()
        self.field('layer-size').select_option('4')
        self.page.mouse.move(**self.point(35.25,25.25));self.page.clock.run_for(16)
        self.assertEqual(self.page.evaluate('editor.getState().brush'),{'x':33,'y':23,'w':4,'h':4,'size':4,'tool':'paint'})
        self.page.screenshot(path='/tmp/coda-editor-pixel-line.png')


if __name__=='__main__':unittest.main(verbosity=2)
