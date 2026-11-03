"""Room artwork can retain its depth inside Send to background masks."""
import importlib.util
import json
from pathlib import Path
import unittest

_spec=importlib.util.spec_from_file_location('room_mask_fixture',Path(__file__).with_name('room-layer-selection-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)


class RoomMaskOverrideTests(unittest.TestCase):
    setUpClass=classmethod(fixture.RoomLayerSelectionTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.RoomLayerSelectionTests.tearDownClass.__func__)
    setUp=fixture.RoomLayerSelectionTests.setUp
    tearDown=fixture.RoomLayerSelectionTests.tearDown
    action=fixture.RoomLayerSelectionTests.action
    state=fixture.RoomLayerSelectionTests.state
    project=fixture.RoomLayerSelectionTests.project
    pixel=fixture.RoomLayerSelectionTests.pixel

    def setup_masked_foreground_asset(self):
        self.page.evaluate('''()=>{
          const p=editor.getProject();p.assets[0].layer='foreground';
          p.strokes=[{tool:'erase',size:1,points:[[180,130]],selection:{x:180,y:130,width:40,height:40}}];
          editor.applyProject(p);editor.open('objects');
        }''')
        self.page.locator('[data-room-field="asset"]').select_option('witness')

    def checkbox(self):
        return self.page.locator('[data-room-field="ignore-background-masks"]')

    def test_override_reveals_the_asset_above_the_actor_and_is_one_undoable_edit(self):
        self.setup_masked_foreground_asset()
        self.assertEqual(self.pixel(200,150),[18,52,239,255])
        self.assertEqual(self.pixel(160,110),[238,9,206,255])
        before=self.project()
        self.checkbox().check()
        self.assertEqual(self.project()['assets'][0]['ignoreBackgroundMasks'],True)
        self.assertEqual(self.pixel(200,150),[238,9,206,255])
        self.assertEqual(self.state()['undo'],1)
        self.assertEqual(self.project()['strokes'],before['strokes'])
        self.action('undo').click()
        self.assertEqual(self.project(),before)
        self.assertEqual(self.pixel(200,150),[18,52,239,255])
        self.action('redo').click()
        self.assertEqual(self.pixel(200,150),[238,9,206,255])
        self.page.locator('[data-room-field="asset"]').select_option('witness')
        self.checkbox().uncheck()
        self.assertEqual(self.pixel(200,150),[18,52,239,255])

    def test_override_keeps_transparency_and_list_order_and_does_not_change_paint(self):
        self.setup_masked_foreground_asset()
        self.page.evaluate('''async()=>{
          const c=document.createElement('canvas');c.width=c.height=8;
          const ctx=c.getContext('2d');ctx.fillStyle='rgba(255,0,0,.5)';ctx.fillRect(0,0,8,8);
          const p=editor.getProject();p.assets[0].data=c.toDataURL();p.assets[0].ignoreBackgroundMasks=true;
          editor.applyProject(p);await editor.getArtworkSource('room.selection-test.asset.witness');
        }''')
        # Only one alpha blend over the actor: no extra behind-mask copy.
        actual=self.pixel(200,150)
        for value,want in zip(actual,[137,26,119,255]):self.assertAlmostEqual(value,want,delta=1)
        self.page.evaluate('''async()=>{
          const p=editor.getProject(),c=document.createElement('canvas');c.width=c.height=8;
          c.getContext('2d').fillStyle='#00ff00';c.getContext('2d').fillRect(0,0,8,8);
          p.assets.push({...p.assets[0],id:'later',name:'Later foreground image',data:c.toDataURL(),ignoreBackgroundMasks:true});
          editor.applyProject(p);await editor.getArtworkSource('room.selection-test.asset.later');
        }''')
        self.assertEqual(self.pixel(200,150),[0,255,0,255],'Later artwork still draws last')
        self.page.evaluate('''async()=>{
          const p=editor.getProject();p.assets=p.assets.slice(0,1);p.assets[0].layer='background';
          p.strokes[0].tool='paint';editor.applyProject(p);await editor.getArtworkSource('room.selection-test.asset.witness');
        }''')
        actual=self.pixel(200,150)
        self.assertNotEqual(actual,[18,52,239,255])
        self.page.evaluate('''async()=>{const p=editor.getProject();p.assets[0].ignoreBackgroundMasks=false;editor.applyProject(p);await editor.getArtworkSource('room.selection-test.asset.witness');}''')
        self.assertEqual(self.pixel(200,150),actual,'Paint foreground behavior stays the same')

    def test_override_round_trips_and_invalid_values_cannot_replace_the_project(self):
        self.setup_masked_foreground_asset();self.checkbox().check()
        expected=self.project()
        self.page.evaluate('''async()=>{
          editor.destroy();startEditor();
          await editor.getArtworkSource('room.selection-test.asset.witness');editor.open('objects');
        }''')
        self.assertEqual(self.project(),expected)
        if self.action('show-layers').get_attribute('aria-pressed')=='true':self.action('show-layers').click()
        self.assertEqual(self.pixel(200,150),[238,9,206,255])
        self.page.evaluate("editor.open('project')")
        with self.page.expect_download() as download:self.action('export').click()
        exported=json.loads(Path(download.value.path()).read_text())
        self.assertTrue(exported['assets'][0]['ignoreBackgroundMasks'])
        self.assertTrue(self.page.evaluate('p=>editor.applyProject(p)',exported))
        self.assertEqual(self.project()['assets'],expected['assets'])
        self.assertEqual(self.project()['strokes'],expected['strokes'])
        expected=self.project()
        for value in ['yes',1,None,{}]:
            invalid=json.loads(json.dumps(expected));invalid['assets'][0]['ignoreBackgroundMasks']=value
            self.assertFalse(self.page.evaluate('p=>editor.applyProject(p)',invalid))
            self.assertEqual(self.project(),expected)


if __name__=='__main__':unittest.main(verbosity=2)
