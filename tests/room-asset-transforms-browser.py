"""Room image transforms preserve source pixels, geometry, and portable edits."""
import importlib.util
import json
from pathlib import Path
import unittest

_spec = importlib.util.spec_from_file_location('room_transform_fixture', Path(__file__).with_name('room-layer-selection-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class RoomAssetTransformTests(unittest.TestCase):
    setUpClass = classmethod(fixture.RoomLayerSelectionTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.RoomLayerSelectionTests.tearDownClass.__func__)
    tearDown = fixture.RoomLayerSelectionTests.tearDown
    action = fixture.RoomLayerSelectionTests.action
    state = fixture.RoomLayerSelectionTests.state
    project = fixture.RoomLayerSelectionTests.project
    pixel = fixture.RoomLayerSelectionTests.pixel
    point = fixture.RoomLayerSelectionTests.point

    def setUp(self):
        fixture.RoomLayerSelectionTests.setUp(self)
        self.page.evaluate('''async()=>{
          const source=document.createElement('canvas');source.width=source.height=8;
          const ctx=source.getContext('2d');
          for(const [x,y,color]of [[0,0,'#ff0000'],[4,0,'#00ff00'],[0,4,'#0000ff'],[4,4,'#ffff00']]){ctx.fillStyle=color;ctx.fillRect(x,y,4,4);}
          const project=editor.getProject();project.assets=[{id:'witness',name:'Four-color image',x:200,y:150,w:100,h:60,visible:true,layer:'foreground',data:source.toDataURL()}];
          project.strokes=[];editor.applyProject(project);await editor.getArtworkSource('room.selection-test.asset.witness');editor.open('objects');
        }''')
        self.choose()

    def choose(self):
        self.page.locator('[data-room-field="asset"]').select_option('witness')

    def asset(self):
        return self.project()['assets'][0]

    def quadrants(self):
        return [self.pixel(x,y)[:3] for x,y in [(180,130),(220,130),(180,170),(220,170)]]

    def test_flip_and_rotate_change_visible_pixels_once_without_changing_the_source(self):
        original = self.project()
        self.assertEqual(self.quadrants(), [[255,0,0],[0,255,0],[0,0,255],[255,255,0]])
        self.action('asset-flip-x').click()
        self.assertEqual(self.quadrants(), [[0,255,0],[255,0,0],[255,255,0],[0,0,255]])
        self.assertEqual(self.state()['undo'],1)
        self.action('undo').click()
        self.assertEqual(self.project(),original)
        self.action('redo').click()
        self.choose()
        self.action('asset-flip-y').click()
        self.assertEqual(self.quadrants(), [[255,255,0],[0,0,255],[0,255,0],[255,0,0]])
        self.action('asset-rotate-right').click()
        self.assertEqual(self.quadrants(), [[0,255,0],[255,255,0],[255,0,0],[0,0,255]])
        self.assertEqual((self.asset()['x'],self.asset()['y'],self.asset()['w'],self.asset()['h']), (200,150,100,60))
        self.assertEqual(self.asset()['rotation'],90)
        self.assertEqual(self.asset()['data'],original['assets'][0]['data'], 'Transforms keep the editable source image intact')
        self.assertEqual(self.page.evaluate('''async()=>{const image=await editor.getArtworkSource('room.selection-test.asset.witness'),canvas=document.createElement('canvas');canvas.width=canvas.height=8;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return [...ctx.getImageData(1,1,1,1).data];}'''), [255,0,0,255])

    def test_rotated_hit_resize_and_flipped_footprint_follow_the_image(self):
        self.page.locator('[data-room-field="asset-rotation"]').fill('90')
        self.page.locator('[data-room-field="asset-rotation"]').press('Tab')
        before = self.project()
        self.page.mouse.click(**self.point(240,150))
        self.assertIsNone(self.state()['selected'], 'The old unrotated bounds must not intercept selection')
        self.page.mouse.click(**self.point(200,190))
        self.assertEqual(self.state()['selected'], {'type':'asset','id':'witness'})
        self.assertEqual(self.project(),before)
        self.page.mouse.move(**self.point(170,200))
        self.page.mouse.down()
        self.page.mouse.move(**self.point(160,210), steps=4)
        self.page.mouse.up()
        self.assertEqual((self.asset()['w'],self.asset()['h'],self.asset()['x'],self.asset()['y']), (120,80,200,150))
        self.page.evaluate('''()=>{const p=editor.getProject();Object.assign(p.assets[0],{w:100,h:60,rotation:0,solid:true,flipY:false});editor.applyProject(p);editor.open('objects');}''')
        self.assertFalse(self.page.evaluate('editor.walkable(200,174,true)'))
        self.assertTrue(self.page.evaluate('editor.walkable(200,126,true)'))
        self.choose();self.action('asset-flip-y').click()
        self.assertTrue(self.page.evaluate('editor.walkable(200,174,true)'))
        self.assertFalse(self.page.evaluate('editor.walkable(200,126,true)'))
        self.action('asset-rotate-right').click()
        self.assertFalse(self.page.evaluate('editor.walkable(224,150,true)'))
        self.assertTrue(self.page.evaluate('editor.walkable(176,150,true)'))

    def test_transforms_round_trip_and_invalid_values_or_edit_gates_keep_the_project(self):
        self.action('asset-flip-x').click();self.action('asset-flip-y').click();self.action('asset-rotate-left').click()
        expected = self.project()
        self.page.evaluate('''async()=>{editor.destroy();startEditor();await editor.getArtworkSource('room.selection-test.asset.witness');editor.open('objects');}''')
        self.assertEqual(self.project(),expected)
        self.page.evaluate("editor.open('project')")
        with self.page.expect_download() as download:
            self.action('export').click()
        exported = json.loads(Path(download.value.path()).read_text())
        self.assertEqual(exported['assets'],expected['assets'])
        self.assertTrue(self.page.evaluate('p=>editor.applyProject(p)',exported))
        before = self.project()
        for key,value in [('flipX',1),('flipY','yes'),('flipX',None),('rotation','90'),('rotation',None),('rotation',3601)]:
            invalid = json.loads(json.dumps(before));invalid['assets'][0][key] = value
            self.assertFalse(self.page.evaluate('p=>editor.applyProject(p)',invalid))
            self.assertEqual(self.project(),before)
        self.page.evaluate("editor.open('objects');allowed=false")
        self.choose()
        self.assertTrue(self.action('asset-flip-x').is_disabled())
        self.page.locator('[data-room-action="asset-flip-x"]').evaluate('(button)=>button.onclick()')
        self.assertEqual(self.project(),before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
