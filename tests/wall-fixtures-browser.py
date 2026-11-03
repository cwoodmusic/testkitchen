"""Real editor moves isolated signs/lamps and restores plain wall underneath."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('wall_fixture_base', Path(__file__).with_name('environment-world-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class WallFixtureTests(fixture.EnvironmentWorldTests):
    # Run only this feature's cases, reusing current-project serving and cleanup.
    def lift(self, name):
        self.open_tab('objects')
        self.page.locator('#devCatalog').select_option(name)
        self.page.locator('#devLift').click()
        self.page.wait_for_function('(name)=>CodaDeveloperConsole.getProject().assets.some(a=>a.origin?.name===name)', arg=name)

    def lamp(self, name='wall_lantern_arcade-west'):
        return self.page.evaluate('(name)=>CodaArcadeQA.lighting().lanterns.filter(l=>l.name===name)', name)

    def test_lantern_move_hide_duplicate_and_reload_keep_sprite_and_glow_together(self):
        self.load()
        current = next(asset for asset in self.project()['assets'] if asset.get('origin', {}).get('name') == 'wall_lantern_arcade-west')
        self.assertEqual(len(self.lamp()), 1 if current['visible'] else 0)
        self.lift('wall_lantern_arcade-west')
        self.page.locator('#assetVisible').check()
        self.field('assetX', 900)
        self.field('assetY', 350)
        self.page.evaluate('publishFrames(3)')
        self.assertAlmostEqual(self.lamp()[0]['x'], 901)
        self.assertAlmostEqual(self.lamp()[0]['y'], 349)
        self.page.locator('#assetVisible').uncheck()
        self.page.evaluate('publishFrames(3)')
        self.assertEqual(self.lamp(), [])
        self.page.locator('#assetVisible').check()
        self.page.locator('#assetDuplicate').click()
        self.page.evaluate('publishFrames(3)')
        self.assertEqual(len(self.lamp()), 2)
        self.page.locator('#devUndo').click()
        self.page.evaluate('publishFrames(3)')
        self.assertEqual(len(self.lamp()), 1)
        self.page.locator('#devRedo').click()
        self.page.evaluate('publishFrames(3)')
        self.assertEqual(len(self.lamp()), 2)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole.ready()&&CodaArcadeQA.characters().spriteState.ready')
        self.assertEqual(len(self.lamp()), 2)
        self.assertEqual(sorted(round(l['x']) for l in self.lamp()), [901, 925])

    def test_signs_are_editable_and_empty_background_has_no_baked_sign_or_lantern(self):
        self.load()
        self.lift('wall_coda_sign')
        self.field('assetX', 1000)
        self.field('assetY', 400)
        self.field('assetRotate', 15)
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.save()'))
        values = self.page.evaluate('''async()=>{
          const image=new Image();image.src='assets/environment/v1/empty-walls.png';await image.decode();
          const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
          const g=canvas.getContext('2d');g.drawImage(image,0,0);
          return [[610,64],[800,70],[295,110],[525,340],[520,585]].map(([x,y])=>Array.from(g.getImageData(x,y,1,1).data));
        }''')
        # Main wall is green, Lounge amber, boutique blue; no white/yellow lamp core.
        self.assertGreater(values[0][1], values[0][0] * 2)
        self.assertGreater(values[1][1], values[1][0] * 2)
        self.assertGreater(values[2][0], values[2][2] * 2)
        self.assertGreater(values[3][2], values[3][0] * 2)
        self.assertGreater(values[4][0], values[4][1] * 2)
        self.assertGreater(values[4][2], values[4][1] * 2)


if __name__ == '__main__':
    # Do not inherit the unrelated world-export cases into this focused suite.
    suite = unittest.TestSuite(WallFixtureTests(name) for name in WallFixtureTests.__dict__ if name.startswith('test_'))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    sys.exit(not result.wasSuccessful())
