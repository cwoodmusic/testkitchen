"""The repaired right dance sofa stays complete when moved in the real editor.

Disposable local sessions only; external services are blocked by the fixture.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('dance_couch_fixture',Path(__file__).with_name('published-world-browser.py'))
fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(fixture)


class DanceCouchTests(unittest.TestCase):
    setUpClass=classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    setUp=fixture.PublishedWorldTests.setUp
    tearDown=fixture.PublishedWorldTests.tearDown
    load=fixture.PublishedWorldTests.load
    project=fixture.PublishedWorldTests.project
    field=fixture.PublishedWorldTests.field
    pixel=fixture.PublishedWorldTests.pixel

    def rendered(self,points):
        return self.page.evaluate('''points=>{
          const camera=CodaArcadeQA.camera(),ctx=document.querySelector('#view').getContext('2d');
          return points.map(([x,y])=>Array.from(ctx.getImageData(
            Math.floor((x-camera.x)*camera.zoom),Math.floor((y-camera.y)*camera.zoom),1,1).data));
        }''',points)

    def test_complete_right_sofa_moves_and_returns_without_fixed_arm_fragments(self):
        self.load();self.page.evaluate("CodaDeveloperConsole.open('objects')")
        self.page.locator('#assetList').select_option('asset-10')
        original=next(asset for asset in self.published['assets'] if asset['id']=='asset-10')
        self.assertEqual(original['origin']['name'],'dance_right_couch')
        # Real seat faces plus the formerly cropped right arm and lower base.
        points=[[642,640],[659,652],[681,666],[700,672],[700,688],[689,696],[675,690],[635,674]]
        expected=[self.pixel('dance_right_couch',x,y,'raw') for x,y in points]
        self.assertTrue(all(pixel[3]==255 for pixel in expected))
        self.page.mouse.move(1550,900);self.page.evaluate('publishFrames(3)')
        self.assertEqual(self.rendered(points),expected)
        self.field('assetX',original['x']+600)
        self.page.mouse.move(1550,900);self.page.evaluate('publishFrames(3)')
        moved=next(asset for asset in self.project()['assets'] if asset['id']=='asset-10')
        self.assertEqual(moved['x'],1225)
        self.assertEqual(self.rendered([[x+600,y] for x,y in points]),expected,
                         'Every seat, right arm and base pixel must move with the sofa')
        cleared=self.rendered(points[3:])
        self.assertTrue(all(actual!=old for actual,old in zip(cleared,expected[3:])),
                        'No fixed repaired arm or base may remain at the old location')
        self.field('assetX',original['x'])
        self.page.mouse.move(1550,900);self.page.evaluate('publishFrames(3)')
        self.assertEqual(self.rendered(points),expected)
        self.assertEqual(self.project(),self.published,
                         'The source repair must not rewrite the shared layout')


if __name__=='__main__':unittest.main(verbosity=2)
