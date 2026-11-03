"""Sparse floor stars in the real world and Canvas, without external services."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('floor_star_world', Path(__file__).with_name('learning-world-browser.py'))
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)


class FloorStarTests(world.WorldBrowserCase):
    def test_sparse_stars_pulse_and_respect_motion_and_fx_preferences(self):
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','full')")
        self.load()
        first = self.page.evaluate('CodaArcadeQA.floorStars()')
        self.assertEqual(first['count'], 53)
        self.assertEqual([(star['x'], star['y']) for star in first['stars'][-5:]],
                         [(155, 236), (245, 189), (332, 224), (291, 309), (410, 248)])
        self.assertTrue(first['visible'] and first['animated'])
        self.page.wait_for_timeout(350)
        second = self.page.evaluate('CodaArcadeQA.floorStars()')
        self.assertGreater(sum(abs(a['alpha']-b['alpha']) > .005 for a,b in zip(first['stars'],second['stars'])), 8)
        pixels = self.page.evaluate('''()=>{
          const canvas=document.createElement('canvas');canvas.width=1672;canvas.height=941;
          const g=canvas.getContext('2d');let time=0;
          const stars=CodaFloorStars.create({getTime:()=>time});
          const draw=()=>{g.fillStyle='#091d38';g.fillRect(0,0,1672,941);stars.draw(g);
            return {main:[...g.getImageData(569,218,1,1).data],lounge:[...g.getImageData(155,236,1,1).data]};};
          const first=draw();time=3;const second=draw();
          return {first,second,clear:[...g.getImageData(577,226,1,1).data]};
        }''')
        self.assertNotEqual(pixels['first'],pixels['second'])
        self.assertNotEqual(pixels['first']['lounge'],pixels['second']['lounge'], 'Lounge glass uses the same sparse animated star effect')
        self.assertEqual(pixels['clear'],[9,29,56,255], 'Only the tiny star points may paint the glass floor')
        self.page.evaluate("localStorage.setItem('arcadeAnimations','off')")
        fixed = self.page.evaluate('CodaArcadeQA.floorStars()')
        self.assertFalse(fixed['animated'])
        self.page.wait_for_timeout(180)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.floorStars()'),fixed)
        self.page.evaluate("localStorage.setItem('arcadeAnimations','on')")
        self.page.emulate_media(reduced_motion='reduce')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.floorStars().animated'))
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.load()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.floorStars().visible'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
