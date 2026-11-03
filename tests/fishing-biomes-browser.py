"""Explore the connected fishing screens through real boat controls.

The world fixture uses the current publication, real shoreline collision and
the existing catch journal. No fishing state or movement API is replaced.
"""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'fishing_biomes_world_fixture', Path(__file__).with_name('fishing-world-browser.py'))
_fish = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_fish)


class FishingBiomeWorldTests(_fish._world.WorldBrowserCase):
    def setUp(self):
        _fish.FishingWorldTests.setUp(self)
        # Advance only through run_for: image decoding and state reads must
        # not keep a steering key moving past its intended passage approach.
        self.page.clock.pause_at(self.page.evaluate('Date.now()/1000') + 1)
        self.page.clock.run_for(64)

    state = _fish.FishingWorldTests.state
    portal = _fish.FishingWorldTests.portal
    place = _fish.FishingWorldTests.place
    enter = _fish.FishingWorldTests.enter
    walk_to = _fish.FishingWorldTests.walk_to
    board = _fish.FishingWorldTests.board
    fishing_option = _fish.FishingWorldTests.fishing_option
    fishing_action = _fish.FishingWorldTests.fishing_action
    approach_shadow = _fish.FishingWorldTests.approach_shadow

    def screen_id(self):
        return self.state()['screen']['id']

    def sail_axis(self, axis, target):
        """Steer one coordinate into a passage; retain real boat collision."""
        start_screen = self.screen_id()
        delta = target - self.state()['boat'][axis]
        if abs(delta) <= 4:
            return
        key = ('d' if delta > 0 else 'a') if axis == 'x' else ('s' if delta > 0 else 'w')
        self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.down(key)
        try:
            for _ in range(120):
                delta = target - self.state()['boat'][axis]
                if abs(delta) <= 4:
                    break
                self.page.clock.run_for(int(min(80, max(16, abs(delta) / 150 * 1000))))
                self.assertEqual(self.screen_id(), start_screen,
                                 'Aligning inside the basin must not change screens')
        finally:
            self.page.keyboard.up(key)
        self.assertAlmostEqual(self.state()['boat'][axis], target, delta=5,
                               msg='The real boat must reach the passage approach')

    def clear_home_dock(self):
        if self.screen_id() == 'lantern-lake' and self.state()['boat']['x'] < 400:
            # Leave the painted pier piles to the south before turning east.
            # The full hull must not cut through either solid corner post.
            if self.state()['boat']['y'] < 450:
                self.sail_axis('y', 450)
            self.sail_axis('x', 400)

    def cross(self, direction, expected):
        self.clear_home_dock()
        if direction in ('east', 'west'):
            self.sail_axis('y', 350)
        else:
            self.sail_axis('x', 550)
        old = self.screen_id()
        self.page.locator('#fishingLakeCanvas').focus()
        key = {'east': 'd', 'west': 'a', 'north': 'w', 'south': 's'}[direction]
        self.page.keyboard.down(key)
        try:
            for _ in range(140):
                self.page.clock.run_for(80)
                if self.screen_id() != old:
                    break
        finally:
            self.page.keyboard.up(key)
        self.assertEqual(self.screen_id(), expected,
                         'Crossing a connected edge must enter the adjacent screen')
        self.page.wait_for_function('CodaArcadeQA.fishing().background.ready')
        self.assertEqual(self.state()['phase'], 'explore')
        self.assertEqual(self.state()['challenge'], None)

    def assert_habitat(self, biome, meter):
        state = self.state()
        self.assertEqual(state['biome']['id'], biome)
        self.assertEqual(state['meter'], meter)
        expected = self.page.evaluate('''([meter,biome])=>
          CodaRhythmFishing.availableFish(meter,undefined,biome).map(fish=>fish.id)
        ''', [meter, biome])
        self.assertGreater(len(expected), 3, 'Every biome needs its own fish as well as shared fish')
        visible = [s for s in state['shadows'] if s['visible'] and s.get('meterAvailable') is not False]
        self.assertTrue(visible)
        self.assertTrue(all(s['fishId'] in expected for s in visible), visible)
        self.assertEqual(self.page.locator('#fishingMeter').input_value(), meter)
        return set(expected)

    def assert_biome_challenge(self, biome, meter):
        before = self.state()['catches']
        self.approach_shadow()
        self.fishing_action('#fishingCast')
        self.page.clock.run_for(2000)
        state = self.state()
        self.assertEqual(state['phase'], 'rhythm')
        self.assertEqual(state['challenge']['meter'], meter)
        self.assertEqual(state['challenge']['biome'], biome)
        self.assertIn(state['challenge']['fish']['id'], self.page.evaluate('''([meter,biome])=>
          CodaRhythmFishing.availableFish(meter,undefined,biome).map(fish=>fish.id)
        ''', [meter, biome]))
        self.page.locator('#fishingCancel').click()
        self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'], 'explore')
        self.assertEqual(self.state()['catches'], before,
                         'Canceling an exploration challenge must not award a catch')

    def test_sailing_explores_the_six_screen_map_with_distinct_habitats_and_meters(self):
        original = self.page.evaluate('CodaDeveloperConsole.getProject()')
        self.enter()
        self.assertEqual(self.screen_id(), 'lantern-lake')
        self.assertEqual(self.state()['phase'], 'shore')
        self.board()
        pools = {'cave': self.assert_habitat('cave', '4/4')}
        self.cross('east', 'mistfen-channel')
        pools['swamp'] = self.assert_habitat('swamp', '6/8')
        self.assert_biome_challenge('swamp', '6/8')
        self.cross('east', 'tidegate-inlet')
        pools['ocean'] = self.assert_habitat('ocean', '2/2')
        self.assert_biome_challenge('ocean', '2/2')
        self.cross('south', 'starlit-expanse')
        self.assert_habitat('ocean', '2/2')
        self.cross('west', 'mosswater-basin')
        self.assert_habitat('swamp', '6/8')
        self.cross('west', 'glowstone-narrows')
        self.assert_habitat('cave', '4/4')
        self.cross('north', 'lantern-lake')
        self.assert_habitat('cave', '4/4')
        self.assertEqual(set.intersection(*pools.values()),
                         {'silver-minnow', 'cave-guppy', 'bluegill'},
                         'Only the designated common species are shared by every biome')
        for biome, fish in pools.items():
            other = set.union(*(value for key, value in pools.items() if key != biome))
            self.assertTrue(fish - other, biome + ' must have exclusive species')
        self.assertEqual(set(self.state()['voyage']['discovered']), {
            'lantern-lake', 'glowstone-narrows', 'mistfen-channel',
            'mosswater-basin', 'tidegate-inlet', 'starlit-expanse'})
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject()'), original,
                         'Exploration must not rewrite authored room projects or the arcade layout')

    def test_away_screen_resume_and_return_to_dock_preserve_existing_catches(self):
        catch = {'id': 'legacy-biome-check', 'fishId': 'silver-minnow', 'size': 12,
                 'at': 12345, 'rewarded': True,
                 'result': {'id': 'legacy-biome-check', 'caught': True}}
        journal = {'version': 1, 'catches': [catch]}
        raw = json.dumps(journal, separators=(',', ':'))
        self.page.evaluate('value=>localStorage.setItem("codaRhythmFishingV1",value)', raw)
        self.enter()
        self.assertEqual(self.state()['catches'], [catch])
        self.board()
        self.cross('east', 'mistfen-channel')
        self.cross('east', 'tidegate-inlet')
        self.cross('south', 'starlit-expanse')
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA.fishingEntrance()?.visible')
        self.page.clock.run_for(64)
        self.enter()
        self.assertEqual(self.screen_id(), 'starlit-expanse')
        self.assertEqual(self.state()['phase'], 'explore')
        self.assert_habitat('ocean', '2/2')
        self.assertEqual(self.state()['catches'], [catch])
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRhythmFishingV1")'), raw,
                         'The new voyage save must leave the existing catch journal byte-exact')
        self.fishing_action('#fishingMoor')
        self.assertEqual(self.screen_id(), 'lantern-lake')
        self.assertEqual(self.state()['phase'], 'shore')
        self.assertEqual(self.state()['meter'], '4/4')
        self.assertEqual(self.state()['catches'], [catch])

    def test_returning_to_dock_cancels_an_area_image_still_loading(self):
        pattern = '**/assets/world/fishing/mistfen-channel.png*'
        held = []

        def delay(route):
            held.append(route)

        self.context.route(pattern, delay)
        self.enter()
        self.board()
        self.clear_home_dock()
        self.sail_axis('y', 350)
        self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.down('d')
        try:
            for _ in range(140):
                self.page.clock.run_for(80)
                if self.state()['voyage']['pending']:
                    break
        finally:
            self.page.keyboard.up('d')
        self.assertTrue(held, 'The destination image request must actually be delayed')
        self.assertEqual(self.state()['voyage']['pending'], 'mistfen-channel')
        self.assertEqual(self.screen_id(), 'lantern-lake')
        self.assertTrue(self.page.locator('#fishingPractice').is_disabled(),
                        'Practice must wait until a pending screen change is resolved')
        self.assertTrue(self.page.locator('#fishingCast').is_disabled(),
                        'A pending screen change must not permit a fishing cast')
        self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.press('e')
        self.page.clock.run_for(64)
        self.assertEqual(self.state()['phase'], 'explore')
        self.assertIsNone(self.state()['challenge'],
                          'Keyboard interaction must not start a challenge while travel is pending')
        self.assertEqual(self.state()['voyage']['pending'], 'mistfen-channel')
        self.fishing_action('#fishingMoor')
        self.assertEqual(self.state()['phase'], 'shore')
        self.assertIsNone(self.state()['voyage']['pending'])
        self.context.unroute(pattern, delay)
        for route in held:
            route.fulfill(path=str(_fish._world.ROOT / 'assets/world/fishing/mistfen-channel.png'),
                          content_type='image/png')
        self.page.evaluate('''async()=>{
          const image=new Image();image.src='assets/world/fishing/mistfen-channel.png?v=fishing-world-20261031-1';
          await image.decode();
        }''')
        self.page.clock.run_for(160)
        self.assertEqual(self.screen_id(), 'lantern-lake',
                         'A late destination onload must not undo Return to dock')
        self.assertEqual(self.state()['phase'], 'shore')
        self.assertEqual(self.state()['meter'], '4/4')


if __name__ == '__main__':
    unittest.main(verbosity=2)
