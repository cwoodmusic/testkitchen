"""Foreground paint must promote the pixels currently visible in the world.

Uses real developer controls in disposable local browser contexts. Expected
artwork is captured before the avatar overlaps it, without editor overlays.
External services and classroom accounts are never contacted.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'foreground_published_fixture', Path(__file__).with_name('published-world-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class ForegroundPaintTests(unittest.TestCase):
    setUpClass = classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    tearDown = fixture.PublishedWorldTests.tearDown
    project = fixture.PublishedWorldTests.project
    field = fixture.PublishedWorldTests.field

    def setUp(self):
        fixture.PublishedWorldTests.setUp(self)
        self.page.emulate_media(reduced_motion='reduce')

    def load(self, local=None):
        fixture.PublishedWorldTests.load(self, local=local)
        self.tab('objects')

    def frames(self):
        self.page.evaluate('publishFrames(3)')

    def tab(self, name):
        self.page.evaluate('(name)=>CodaDeveloperConsole.open(name)', name)
        # Opening a tool can enable its diagnostics. Pixel comparisons inspect
        # the scene itself, not the separately tinted editor overlays.
        for selector in ('#devShowCollision', '#devShowLayers'):
            if self.page.locator(selector).get_attribute('aria-pressed') == 'true':
                self.page.locator(selector).click()
        self.move_pointer(1460, 730)
        self.frames()

    def screen(self, x, y):
        return self.page.evaluate('''([x,y])=>{
          const box=view.getBoundingClientRect(),camera=CodaArcadeQA.camera();
          return {x:box.left+(x-camera.x)*camera.zoom*box.width/1672,
                  y:box.top+(y-camera.y)*camera.zoom*box.height/941};
        }''', [x, y])

    def move_pointer(self, x, y):
        self.page.mouse.move(**self.screen(x, y))

    def click_world(self, x, y):
        self.page.mouse.click(**self.screen(x+.5, y+.5))

    def scene_pixel(self, x, y):
        return self.page.evaluate('''([x,y])=>{
          const camera=CodaArcadeQA.camera();
          return Array.from(view.getContext('2d').getImageData(
            Math.floor((x+.5-camera.x)*camera.zoom),
            Math.floor((y+.5-camera.y)*camera.zoom),1,1).data);
        }''', [x, y])

    def avatar_face_pixel(self):
        return self.page.evaluate('''()=>{
          const player=CodaArcadeQA.characters().player,canvas=document.createElement('canvas');
          canvas.width=canvas.height=100;
          const renderer=createCodaCharacterRenderer({reducedMotion:()=>true});
          renderer.setPixelEdits(CodaDeveloperConsole.getProject().sprites||{});
          renderer.drawPlayer(canvas.getContext('2d'),player.appearance,
            {x:50,y:80,facing:player.facing,walking:false},0);
          return Array.from(canvas.getContext('2d').getImageData(50,39,1,1).data);
        }''')

    def place_over(self, x, y):
        self.tab('collision')
        self.page.get_by_label('Collision tool', exact=True).select_option('open')
        self.page.get_by_label('Collision brush', exact=True).select_option('3')
        self.click_world(x, y+41)
        self.assertTrue(self.page.evaluate('([x,y])=>CodaArcadeQA.place(x,y)', [x, y+41]))
        self.tab('objects')
        return self.scene_pixel(x, y)

    def paint(self, x, y, tool='paint', depth=120, shape='pen'):
        self.tab('layers')
        self.page.locator('#devLayerTool').select_option(tool)
        self.page.locator('#devLayerSize').select_option('8')
        self.page.locator('#devLayerShape').select_option(shape)
        if depth is not None:
            self.field('devLayerDepth', depth)
        self.click_world(x, y)
        self.tab('objects')

    def assert_promoted_then_erased(self, x, y):
        expected = self.scene_pixel(x, y)
        actor = self.place_over(x, y)
        self.assertNotEqual(actor, expected, 'The witness must initially show the avatar')
        self.paint(x, y)
        self.assertGreater(self.project()['strokes'][-1]['depth'], y+41,
                           'The promoted fragment must be sorted in front of this avatar')
        self.assertEqual(self.scene_pixel(x, y), expected,
                         'Foreground paint must promote current artwork over the avatar')
        self.paint(x, y, tool='erase')
        self.assertEqual(self.scene_pixel(x, y), actor,
                         'Erase must return that same artwork behind the avatar')

    def test_plain_floor_paint_is_a_working_control_case(self):
        self.load()
        self.assert_promoted_then_erased(1100, 600)

    def test_default_paint_puts_floor_pixels_in_front_without_a_depth_workaround(self):
        self.load()
        expected = self.scene_pixel(1100, 600)
        actor = self.place_over(1100, 600)
        self.assertNotEqual(expected, actor)
        self.paint(1100, 600, depth=None)
        self.assertEqual(self.scene_pixel(1100, 600), expected,
                         'Paint foreground must work without adjusting an actor-depth offset')
        self.page.locator('#devUndo').click();self.frames()
        self.assertEqual(self.scene_pixel(1100, 600), actor)
        self.page.locator('#devRedo').click();self.frames()
        self.assertEqual(self.scene_pixel(1100, 600), expected)

    def test_unlifted_fixture_paint_is_a_working_control_case(self):
        self.load()
        self.assert_promoted_then_erased(1370, 282)

    def test_foreground_paint_promotes_the_relocated_cabinet_art(self):
        self.load()
        # This is the current cabinet front: source y287 moved north by48px.
        self.assert_promoted_then_erased(843, 239)

    def test_foreground_paint_promotes_the_lifted_counter_art(self):
        self.load()
        self.assert_promoted_then_erased(1350, 555)

    def test_foreground_paint_uses_the_repaired_pixel_edited_floor(self):
        private = copy.deepcopy(self.published)
        private['artwork'] = {'background.world': {
            'width': 1672, 'height': 941,
            'tiles': {'11,4': [[1567, 1, '#c925e3ff']]}}}
        self.load(private)
        self.assertEqual(self.scene_pixel(735, 280), [201, 37, 227, 255])
        self.assert_promoted_then_erased(735, 280)

    def test_zoomed_panned_line_paint_survives_history_and_project_reload(self):
        self.load()
        x,y=1165,600
        expected=self.scene_pixel(x,y)
        actor=self.place_over(x,y)
        self.assertNotEqual(actor,expected)
        self.page.evaluate('CodaArcadeQA.setZoom(2)')
        self.page.wait_for_function('CodaArcadeQA.camera().zoom===2')
        box=self.page.locator('#view').bounding_box()
        center={'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
        witness=self.screen(x+.5,y+.5)
        self.page.mouse.move(**center);self.page.mouse.down(button='right')
        self.page.mouse.move(center['x']+center['x']-witness['x'],
                             center['y']+center['y']-witness['y'])
        self.page.mouse.up(button='right');self.frames()
        camera=self.page.evaluate('CodaArcadeQA.camera()')
        self.tab('layers')
        self.page.locator('#devLayerTool').select_option('paint')
        self.page.locator('#devLayerSize').select_option('8')
        self.page.locator('#devLayerShape').select_option('line')
        self.page.mouse.move(**self.screen(x-20+.5,y+.5));self.page.mouse.down()
        end=self.screen(x+20+.5,y+.5)
        self.page.mouse.move(end['x'],end['y'],steps=4);self.page.mouse.up()
        self.tab('objects')
        stroke=self.project()['strokes'][-1]
        self.assertEqual(stroke['points'],[[x-20,y],[x+20,y]],
                         'The saved straight line uses source world pixels at2×zoom')
        self.assertEqual(self.scene_pixel(x,y),expected)
        after=self.page.evaluate('CodaArcadeQA.camera()')
        for field in ('x','y','zoom'):
            self.assertAlmostEqual(camera[field],after[field],places=3,
                                   msg='Switching paint tools must preserve the panned camera')
        self.page.locator('#devUndo').click();self.frames()
        self.assertEqual(self.scene_pixel(x,y),actor)
        self.page.locator('#devRedo').click();self.frames()
        self.assertEqual(self.scene_pixel(x,y),expected)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.tab('project')
        with self.page.expect_download() as download:
            self.page.locator('#devExport').click()
        exported=json.loads(Path(download.value.path()).read_text())
        self.assertEqual(exported['strokes'][-1],stroke)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
        self.tab('objects')
        self.assertEqual(self.project()['strokes'][-1],stroke)
        # The game restores the saved gameplay zoom on reload. Return to the
        # complete map before testing persistence so the avatar foot and source
        # pixel are both visible, independently of the restored follow camera.
        self.page.locator('#devZoomReset').click()
        self.page.wait_for_function('CodaArcadeQA.camera().zoom===1')
        self.frames()
        self.place_over(x,y)
        self.assertEqual(self.scene_pixel(x,y),expected,
                         'Saved foreground placement must still cover the avatar after reload')

    def seed_uploaded_asset(self, layer='world'):
        private = copy.deepcopy(self.published)
        private['assets'].append(dict(
            id='asset-test', name='Foreground test image', kind='image', ref=None,
            data=None, crop=None, x=1100, y=600, w=80, h=80, rotation=0,
            opacity=100, visible=True, locked=False, keepAspect=True,
            layer=layer, anim='none', speed=1, amplitude=0,
            cols=1, rows=1, frames=1, fps=0))
        self.context.add_init_script('''(()=>{
          if(sessionStorage.getItem('foregroundAssetSeed'))return;
          const project=%s,image=document.createElement('canvas');image.width=image.height=8;
          const context=image.getContext('2d');context.fillStyle='#cf196a';context.fillRect(0,0,8,8);
          project.assets.at(-1).data=image.toDataURL();project.savedAt=123;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify(project));
          sessionStorage.setItem('foregroundAssetSeed','yes');
        })()''' % json.dumps(private))
        self.load()
        self.assertEqual(self.scene_pixel(1100, 620), [207, 25, 106, 255])


    def test_foreground_paint_preserves_an_uploaded_assets_actual_pixels(self):
        self.seed_uploaded_asset('world')
        self.assert_promoted_then_erased(1100, 620)

    def test_foreground_paint_promotes_an_uploaded_background_asset(self):
        self.seed_uploaded_asset('back')
        self.assert_promoted_then_erased(1100, 620)

    def test_erase_sends_an_uploaded_foreground_asset_behind_the_avatar(self):
        self.seed_uploaded_asset('front')
        expected = self.scene_pixel(1100, 620)
        self.place_over(1100, 620)
        self.assertEqual(self.scene_pixel(1100, 620), expected,
                         'A foreground image starts above the avatar')
        self.paint(1100, 620, tool='erase')
        erased = self.scene_pixel(1100, 620)
        self.assertNotEqual(erased, expected, 'Erase must send uploaded image pixels behind actors')
        self.assertEqual(erased, self.avatar_face_pixel(),
                         'Erased foreground artwork must reveal the opaque avatar face')
        self.paint(1100, 620)
        self.assertEqual(self.scene_pixel(1100, 620), expected)


if __name__ == '__main__':
    unittest.main(verbosity=2)
