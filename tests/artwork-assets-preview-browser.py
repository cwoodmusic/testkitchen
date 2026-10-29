"""Asset guides in the real background editor never become artwork pixels."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))
spec = importlib.util.spec_from_file_location(
    'asset_preview_artwork_fixture', Path(__file__).with_name('artwork-editor-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)
base = fixture.ArtworkEditorBrowserTests


class ArtworkAssetPreviewTests(unittest.TestCase):
    setUpClass = classmethod(base.setUpClass.__func__)
    tearDownClass = classmethod(base.tearDownClass.__func__)
    setUp = base.setUp
    tearDown = base.tearDown
    editor = base.editor
    state = base.state
    host = base.host
    control = base.control
    ready = base.ready
    frames = base.frames
    load_world = base.load_world
    open_world_artwork = base.open_world_artwork
    select = base.select
    zoom = base.zoom
    colour = base.colour
    center = base.center
    point = base.point
    paint = base.paint
    exit_editor = base.exit_editor
    project = base.project

    def seed_asset(self):
        project = copy.deepcopy(self.published)
        project['assets'].append(dict(
            id='asset-preview-fixture', name='Solid asset preview fixture',
            kind='image', ref=None, data=None, crop=None,
            x=1300, y=650, w=64, h=64, rotation=0, opacity=100,
            visible=True, locked=False, keepAspect=True, layer='front',
            anim='none', speed=1, amplitude=0, cols=1, rows=1, frames=1, fps=0))
        self.context.add_init_script('''(()=>{
          if(sessionStorage.getItem('assetPreviewFixtureSeed'))return;
          const project=%s,source=document.createElement('canvas');
          source.width=source.height=8;
          const g=source.getContext('2d');g.fillStyle='#e111ac';g.fillRect(0,0,8,8);
          project.assets.at(-1).data=source.toDataURL();project.savedAt=123;
          localStorage.setItem('codaWorldProjectV1',JSON.stringify(project));
          sessionStorage.setItem('assetPreviewFixtureSeed','yes');
        })()''' % json.dumps(project))

    def canvas_pixel(self, x=1300, y=650):
        state = self.state()
        return self.control('canvas').evaluate('''(canvas,p)=>Array.from(
          canvas.getContext('2d').getImageData(
            Math.floor(p.pan.x+(p.x+.5)*p.zoom),
            Math.floor(p.pan.y+(p.y+.5)*p.zoom),1,1).data)''',
            {'pan': state['pan'], 'zoom': state['zoom'], 'x': x, 'y': y})

    def export_png(self):
        with self.page.expect_download() as pending:
            self.control('export').click()
        value = Path(pending.value.path()).read_bytes()
        self.frames()
        return value

    def test_asset_guide_is_visible_but_never_changes_project_export_or_sampled_pixels(self):
        self.seed_asset()
        self.load_world()
        self.open_world_artwork()
        self.zoom(4)
        self.center(1300, 650)
        toggle = self.control('assets')
        self.assertTrue(toggle.is_visible())
        self.assertFalse(toggle.is_checked())
        background = self.canvas_pixel()
        self.assertNotEqual(background, [225, 17, 172, 255])
        original = self.project()
        stored = self.page.evaluate('localStorage.getItem("codaWorldProjectV1")')
        history = [self.control(name).is_disabled() for name in ('undo', 'redo')]
        original_png = self.export_png()

        toggle.check()
        self.frames(5)
        self.assertEqual(self.canvas_pixel(), [225, 17, 172, 255],
                         'Visible placed assets should guide painting in their real positions')
        self.assertEqual(self.project(), original)
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'), stored)
        self.assertEqual([self.control(name).is_disabled() for name in ('undo', 'redo')], history)
        self.assertEqual(self.export_png(), original_png,
                         'Background PNG exports must omit the temporary asset guide')
        self.control('picker').click()
        self.page.mouse.click(**self.point(1300, 650))
        self.frames()
        self.assertEqual(self.state()['rgba'], '#' + ''.join(f'{v:02x}' for v in background),
                         'Eyedropper must read editable background pixels beneath asset guides')
        self.assertEqual(self.project(), original)

        self.select('asset.asset-preview-fixture')
        self.assertFalse(self.control('assets').is_visible())
        self.select('character.player.down')
        self.assertFalse(self.control('assets').is_visible())
        self.select('background.classroom')
        self.assertFalse(self.control('assets').is_visible(),
                         'The classroom has no separate placed-asset layer')
        self.select('background.world')
        self.assertTrue(self.control('assets').is_checked(),
                        'Switching artwork keeps the temporary preview preference')
        self.zoom(4)
        self.center(1300, 650)
        toggle.uncheck()
        self.frames()
        self.assertEqual(self.canvas_pixel(), background)
        self.assertEqual(self.project(), original)
        for width, height in ((390, 844), (844, 390)):
            self.page.set_viewport_size({'width': width, 'height': height})
            self.frames()
            self.assertTrue(toggle.is_visible())
            bounds = toggle.locator('..').bounding_box()
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertLessEqual(bounds['x'] + bounds['width'], width + 1)
            self.assertGreaterEqual(bounds['height'], 44,
                                    'The asset guide toggle needs a usable touch label')
            toggle.check()
            toggle.uncheck()
            self.assertEqual(self.project(), original)

    def test_background_can_be_painted_beneath_assets_without_editing_the_assets(self):
        self.seed_asset()
        self.load_world()
        self.open_world_artwork()
        self.zoom(8)
        self.center(1300, 650)
        original_assets = self.project()['assets']
        self.control('assets').check()
        self.control('tool').select_option('pencil')
        self.colour('#27e109ff')
        self.page.mouse.click(**self.point(1300, 650))
        self.frames()
        self.assertEqual(self.project()['assets'], original_assets)
        self.assertIn('background.world', self.project()['artwork'])
        self.assertEqual(self.canvas_pixel(), [225, 17, 172, 255])
        self.control('assets').uncheck()
        self.frames()
        self.assertEqual(self.canvas_pixel(), [39, 225, 9, 255])
        self.control('undo').click()
        self.ready('background.world')
        self.assertNotIn('background.world', self.project().get('artwork', {}))
        self.assertEqual(self.project()['assets'], original_assets)

    def test_piano_and_cave_backgrounds_offer_the_same_transient_preview(self):
        self.load_world()
        for room in ('piano', 'fishing'):
            with self.subTest(room=room):
                fixture.enter_room(self.page, room)
                self.room = room
                self.page.evaluate("CodaDeveloperConsole.open('artwork')")
                self.ready('background.' + room)
                toggle = self.control('assets')
                self.assertTrue(toggle.is_visible())
                original = self.project()
                toggle.check()
                self.frames()
                self.assertEqual(self.project(), original)
                toggle.uncheck()
                self.assertEqual(self.project(), original)
                self.exit_editor()
                self.page.locator(f'[data-room-editor="{room}"] [data-room-action="close"]').click()
                self.page.locator('#closepiano' if room == 'piano' else '#fishingClose').click()
                self.room = None


del base  # Keep unittest discovery focused on this suite, not the imported fixture.

if __name__ == '__main__':
    unittest.main(verbosity=2)
