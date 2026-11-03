"""Leave the fishing boat by interacting with the nearby physical dock."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'dock_biome_world_fixture', Path(__file__).with_name('fishing-biomes-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class FishingDockTests(_world._fish._world.WorldBrowserCase):
    setUp = _world.FishingBiomeWorldTests.setUp
    state = _world.FishingBiomeWorldTests.state
    portal = _world.FishingBiomeWorldTests.portal
    place = _world.FishingBiomeWorldTests.place
    enter = _world.FishingBiomeWorldTests.enter
    walk_to = _world.FishingBiomeWorldTests.walk_to
    board = _world.FishingBiomeWorldTests.board
    fishing_option = _world.FishingBiomeWorldTests.fishing_option
    fishing_action = _world.FishingBiomeWorldTests.fishing_action
    screen_id = _world.FishingBiomeWorldTests.screen_id
    sail_axis = _world.FishingBiomeWorldTests.sail_axis
    clear_home_dock = _world.FishingBiomeWorldTests.clear_home_dock
    cross = _world.FishingBiomeWorldTests.cross

    def seed_catch(self):
        raw = json.dumps({'version': 1, 'catches': [{
            'id': 'dock-interact-saved-catch', 'fishId': 'silver-minnow',
            'size': 12, 'at': 12345, 'rewarded': True,
            'result': {'id': 'dock-interact-saved-catch', 'caught': True},
        }]}, separators=(',', ':'))
        self.page.evaluate('value=>localStorage.setItem("codaRhythmFishingV1",value)', raw)
        return raw

    def assert_shore(self, catch):
        state = self.state()
        self.assertEqual(state['phase'], 'shore')
        self.assertEqual(state['screen']['id'], 'lantern-lake')
        self.assertEqual(state['player']['x'], state['boardingPoint']['x'])
        self.assertEqual(state['player']['y'], state['boardingPoint']['y'])
        self.assertTrue(self.page.evaluate('''() => {
          const p = CodaArcadeQA.fishing().player;
          return CodaFishingCaveLayout.isShore(p.x, p.y);
        }'''))
        self.assertIsNone(state['challenge'])
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRhythmFishingV1")'), catch)

    def key(self, value):
        self.page.locator('#fishingLakeCanvas').focus()
        self.page.keyboard.press(value)
        self.page.clock.run_for(32)

    def point(self, x, y):
        box = self.page.locator('#fishingLakeCanvas').bounding_box()
        camera = self.state()['camera']
        return {'x': box['x'] + (x - camera['x']) * camera['zoom'] / 1000 * box['width'],
                'y': box['y'] + (y - camera['y']) * camera['zoom'] / 620 * box['height']}

    def assert_dock_target(self):
        state = self.state()
        self.assertEqual(state['phase'], 'explore')
        self.assertTrue(state['dock']['near'])
        self.assertEqual(state['near'], 'dock')
        self.assertIn('leave the boat', self.page.locator('#fishingLocation').inner_text())

    def test_nearby_keyboard_and_dock_click_leave_the_boat_before_casting(self):
        catch = self.seed_catch()
        project = self.page.evaluate('CodaDeveloperConsole.getProject()')
        self.enter()
        self.board()
        self.assert_dock_target()
        # A real fish is in range at the berth. E must select the dock rather
        # than entering a rhythm challenge for that nearby shadow.
        self.assertTrue(any(f['visible'] and
                            (f['x'] - self.state()['boat']['x']) ** 2 +
                            (f['y'] - self.state()['boat']['y']) ** 2 < 130 ** 2
                            for f in self.state()['shadows']))
        self.key('e')
        self.assert_shore(catch)
        self.board()
        # A boat beside the long edge is close to the actual wooden dock,
        # even though it is well outside the old boarding-point radius.
        self.sail_axis('y', 450)
        self.sail_axis('x', 355)
        self.sail_axis('y', 390)
        self.assert_dock_target()
        self.assertGreater(abs(self.state()['boat']['x'] - self.state()['boardingPoint']['x']), 70)
        target = self.point(270, 390)
        self.page.mouse.click(target['x'], target['y'])
        self.page.clock.run_for(32)
        self.assert_shore(catch)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject()'), project)

    def test_mobile_interact_disembarks_with_menu_editor_and_pinch_guards_phone(self):
        catch = self.seed_catch()
        self.enter()
        self.board()
        self.assert_dock_target()
        self.page.wait_for_function('document.querySelector(".coda-touch-interact").textContent.includes("Leave boat")')
        self.page.locator('#fishingMenuButton').click()
        self.page.keyboard.press('e')
        self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'], 'explore')
        self.assertTrue(self.state()['menuOpen'])
        self.page.keyboard.press('Escape')
        self.page.clock.run_for(32)
        self.key('F2')
        self.assertTrue(self.state()['editor']['editing'])
        self.page.keyboard.press('e')
        self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'], 'explore')
        self.key('F2')
        self.assertFalse(self.state()['editor']['editing'])
        scene = self.page.locator('.fishing-cave-scene').bounding_box()
        points = [{'id': 1, 'x': scene['x'] + scene['width'] * .4,
                   'y': scene['y'] + scene['height'] * .4},
                  {'id': 2, 'x': scene['x'] + scene['width'] * .6,
                   'y': scene['y'] + scene['height'] * .4}]
        client = self.context.new_cdp_session(self.page)
        client.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': points})
        self.page.clock.run_for(32)
        self.assertTrue(self.state()['camera']['pinching'])
        self.page.keyboard.press('e')
        self.page.clock.run_for(32)
        self.assertEqual(self.state()['phase'], 'explore')
        client.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        client.detach()
        self.page.clock.run_for(32)
        self.assert_dock_target()
        self.page.locator('.coda-touch-interact').tap()
        self.page.clock.run_for(64)
        self.assert_shore(catch)

    def test_remote_dock_and_another_screen_do_not_offer_disembark(self):
        catch = self.seed_catch()
        self.enter()
        self.board()
        self.clear_home_dock()
        self.sail_axis('x', 550)
        self.sail_axis('y', 130)
        self.assertFalse(self.state()['dock']['near'])
        target = self.point(270, 390)
        self.page.mouse.click(target['x'], target['y'])
        self.assertEqual(self.state()['phase'], 'explore', 'A remote click cannot teleport the boat to shore')
        # Keyboard steering clears the remote click destination.
        self.sail_axis('y', 350)
        self.cross('east', 'mistfen-channel')
        self.sail_axis('x', 270)
        self.sail_axis('y', 435)
        self.assertFalse(self.state()['dock']['near'])
        self.assertNotEqual(self.state()['near'], 'dock')
        self.key('e')
        self.assertNotEqual(self.state()['phase'], 'shore', 'There is no home dock in another biome')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaRhythmFishingV1")'), catch)


if __name__ == '__main__':
    unittest.main(verbosity=2)
