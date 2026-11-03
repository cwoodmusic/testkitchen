"""Boat through painted water that the former oval collision excluded.

All travel uses the live room's keyboard, boarding, Moor and ladder controls.
No room placement, water predicate or movement API is replaced.
"""
import importlib.util
import json
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'fishing_water_world_fixture', Path(__file__).with_name('fishing-biomes-browser.py'))
_biome = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_biome)


class FishingWaterNavigationTests(_biome._fish._world.WorldBrowserCase):
    setUp = _biome.FishingBiomeWorldTests.setUp
    state = _biome.FishingBiomeWorldTests.state
    portal = _biome.FishingBiomeWorldTests.portal
    place = _biome.FishingBiomeWorldTests.place
    enter = _biome.FishingBiomeWorldTests.enter
    walk_to = _biome.FishingBiomeWorldTests.walk_to
    board = _biome.FishingBiomeWorldTests.board
    fishing_option = _biome.FishingBiomeWorldTests.fishing_option
    fishing_action = _biome.FishingBiomeWorldTests.fishing_action
    screen_id = _biome.FishingBiomeWorldTests.screen_id
    sail_axis = _biome.FishingBiomeWorldTests.sail_axis
    clear_home_dock = _biome.FishingBiomeWorldTests.clear_home_dock
    cross = _biome.FishingBiomeWorldTests.cross

    def seed_catch(self):
        catch = {'id': 'legacy-water-check', 'fishId': 'silver-minnow', 'size': 12,
                 'at': 12345, 'rewarded': True,
                 'result': {'id': 'legacy-water-check', 'caught': True}}
        raw = json.dumps({'version': 1, 'catches': [catch]}, separators=(',', ':'))
        self.page.evaluate('value=>localStorage.setItem("codaRhythmFishingV1",value)', raw)
        return raw

    def assert_journal(self, raw):
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRhythmFishingV1")'), raw,
                         'Changing water collision must never rewrite an existing catch journal')

    def press_for(self, key, milliseconds):
        self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.down(key)
        try:
            self.page.clock.run_for(milliseconds)
        finally:
            self.page.keyboard.up(key)
        self.page.clock.run_for(32)

    def assert_new_water(self, x, y):
        boat = self.state()['boat']
        self.assertLess(math.hypot(boat['x'] - x, boat['y'] - y), 7,
                        'Real steering must reach the visible water outside the old oval')
        legacy_edge = max(((x + dx - 550) / 360) ** 2 + ((y + dy - 350) / 185) ** 2
                          for dx, dy in [(0, 0), (-18, 0), (18, 0), (0, -12), (0, 12)])
        self.assertGreaterEqual(legacy_edge, .97,
                                'The regression target must exceed the former oval boat clearance')
        self.assertTrue(self.page.evaluate('''() => {
          const state = CodaArcadeQA.fishing(), b = state.boat;
          return CodaFishingBiomes.isBoatWater(state.screen.id, b.x, b.y)
            && [-18, 0, 18].every(dx => [-12, 0, 12].every(dy =>
              CodaFishingBiomes.isWater(state.screen.id, b.x + dx, b.y + dy)));
        }'''), 'Every hull corner must remain in painted water')

    def test_home_lake_water_is_reachable_while_the_dock_landing_and_banks_remain_solid_phone(self):
        raw = self.seed_catch()
        original = self.page.evaluate('CodaDeveloperConsole.getProject()')
        self.enter()
        self.board()
        self.assertEqual(self.state()['phase'], 'explore')

        # The boat starts immediately south of the real, solid pier.
        self.press_for('w', 900)
        boat = self.state()['boat']
        self.assertGreaterEqual(boat['y'], 422)
        self.assertLess(boat['y'], 435)
        self.press_for('w', 300)
        self.assertAlmostEqual(self.state()['boat']['y'], boat['y'], delta=.1,
                               msg='Boat travel must still stop against the wooden dock')

        self.sail_axis('y', 450)
        self.sail_axis('x', 550)
        self.sail_axis('y', 130)
        self.assert_new_water(550, 130)
        self.press_for('w', 1600)
        bank = self.state()['boat']
        self.assertEqual(self.screen_id(), 'lantern-lake')
        self.assertGreater(bank['y'], 26)
        self.assertLess(bank['y'], 130)
        self.press_for('w', 400)
        self.assertAlmostEqual(self.state()['boat']['y'], bank['y'], delta=.1,
                               msg='The top rock bank must stop the boat at the visible shore')

        self.sail_axis('y', 450)
        self.sail_axis('x', 140)
        self.assert_new_water(140, 450)
        self.press_for('w', 1400)
        landing = self.state()['boat']
        self.assertGreaterEqual(landing['y'], 367)
        self.assertLess(landing['y'], 450)
        self.press_for('w', 250)
        self.assertAlmostEqual(self.state()['boat']['y'], landing['y'], delta=.1,
                               msg='The rectangular stone landing must remain dry and solid')

        self.sail_axis('y', 450)
        self.sail_axis('x', 550)
        self.sail_axis('y', 535)
        self.sail_axis('x', 450)
        self.assert_new_water(450, 535)
        self.fishing_action('#fishingMoor')
        self.assertEqual(self.state()['phase'], 'shore')
        pier = self.state()['boardingPoint']
        player = self.state()['player']
        self.assertLess(math.hypot(player['x'] - pier['x'], player['y'] - pier['y']), 8)
        self.walk_to(145, 300)
        ladder = self.state()['ladder']
        self.walk_to(ladder['x'], ladder['y'])
        self.fishing_action('#fishingClimb')
        self.assertFalse(self.state()['open'])
        self.assert_journal(raw)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject()'), original)

    def test_all_biomes_allow_visible_outer_water_and_resume_the_boat_there(self):
        raw = self.seed_catch()
        self.enter()
        self.board()
        route = [
            ('east', 'mistfen-channel', (350, 150)),
            ('east', 'tidegate-inlet', (350, 150)),
            ('south', 'starlit-expanse', (750, 200)),
            ('west', 'mosswater-basin', (350, 150)),
            ('west', 'glowstone-narrows', (100, 350)),
        ]
        for direction, expected, (x, y) in route:
            self.cross(direction, expected)
            self.sail_axis('y', 350)
            self.sail_axis('x', x)
            self.sail_axis('y', y)
            self.assert_new_water(x, y)
            self.assert_journal(raw)
            self.sail_axis('y', 350)
            self.sail_axis('x', 550)

        self.sail_axis('x', 500)
        self.sail_axis('y', 550)
        self.assert_new_water(500, 550)
        # A small real movement after the ordinary save interval persists the
        # newly reachable position through the normal voyage-save path.
        self.page.clock.run_for(3100)
        self.press_for('d', 32)
        saved = self.page.evaluate('JSON.parse(localStorage.getItem("codaFishingVoyageV1"))')
        self.assertEqual(saved['screenId'], 'glowstone-narrows')
        self.assertGreater(saved['boat']['y'], 540)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA.fishingEntrance()?.visible')
        self.page.clock.run_for(64)
        self.enter()
        self.assertEqual(self.screen_id(), 'glowstone-narrows')
        self.assertEqual(self.state()['phase'], 'explore')
        boat = self.state()['boat']
        self.assertLess(math.hypot(boat['x'] - saved['boat']['x'], boat['y'] - saved['boat']['y']), 6,
                        'Reload must keep an away-screen boat outside the former oval, not reset it to the center')
        self.assertEqual(len(self.state()['voyage']['discovered']), 6)
        self.fishing_action('#fishingMoor')
        self.assertEqual(self.screen_id(), 'lantern-lake')
        self.assertEqual(self.state()['phase'], 'shore')
        self.assert_journal(raw)


if __name__ == '__main__':
    unittest.main(verbosity=2)
