"""Real world visitors give the avatar room and resume their normal routines."""
import importlib.util
import math
from pathlib import Path
import unittest

from world_navigation_helpers import advance_world, talk_to_musician

_spec = importlib.util.spec_from_file_location(
    'spacing_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_world)


class NPCSpacingWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.context.add_init_script('Math.random=()=>0;')
        self.load()
        self.page.clock.install()
        advance_world(self.page, 96)

    def people(self):
        return self.page.evaluate('CodaArcadeQA.characters().npcs.filter(person=>!person.hidden)')

    def person(self, identity):
        return self.page.evaluate(
            'id=>CodaArcadeQA.characters().npcs.find(person=>person.id===id)', identity)

    def assert_walkable(self, people):
        self.assertTrue(self.page.evaluate(
            'people=>people.every(person=>CodaArcadeQA.walkable(person.x,person.y))', people))

    def test_walking_onto_a_visitor_does_not_trap_them_or_move_the_player(self):
        placed = self.page.evaluate('''()=>{
          const people=CodaArcadeQA.characters().npcs.filter(person=>!person.hidden);
          for(const person of people){
            if(!person.target||Math.hypot(person.x-person.target.x,person.y-person.target.y)<160)continue;
            if(!Array.from({length:16},(_,i)=>i*Math.PI/8).every(angle=>
                CodaArcadeQA.walkable(person.x+Math.cos(angle)*65,person.y+Math.sin(angle)*65)))continue;
            if(CodaArcadeQA.place(person.x,person.y))return {id:person.id,x:person.x,y:person.y,phase:person.phase};
          }
          return null;
        }''')
        self.assertIsNotNone(placed, 'A moving visitor needs an open floor for the overlap regression')
        previous = placed
        for _ in range(30):
            advance_world(self.page, 100)
            person = self.person(placed['id'])
            self.assertFalse(person['hidden'])
            self.assertLessEqual(math.hypot(person['x']-previous['x'], person['y']-previous['y']), 10)
            self.assert_walkable([person])
            previous = person
        person = self.person(placed['id'])
        self.assertGreaterEqual(math.hypot(person['x']-placed['x'], person['y']-placed['y']), 43.9)
        self.assertGreater(person['phase'], placed['phase'])
        advance_world(self.page, 7000)
        person = self.person(placed['id'])
        self.assertGreater(math.hypot(person['x']-placed['x'], person['y']-placed['y']), 100,
            'Giving space must finish and return to a routine rather than freeze at the clearance boundary')
        position = self.page.evaluate('CodaArcadeQA.position()')
        self.assertEqual(position['x'], placed['x']); self.assertEqual(position['y'], placed['y'])

    def test_stationary_player_does_not_collect_a_stopped_crowd_on_the_main_floor(self):
        position = self.page.evaluate('''()=>{
          for(const point of [{x:1180,y:620},{x:1065,y:405},{x:1340,y:655}]){
            if(CodaArcadeQA.place(point.x,point.y))return point;
          }
          return null;
        }''')
        self.assertIsNotNone(position)
        advance_world(self.page, 2500)
        before = {person['id']: person for person in self.people()}
        travelled = set()
        for _ in range(48):
            advance_world(self.page, 250)
            people = self.people(); self.assert_walkable(people)
            for person in people:
                self.assertGreaterEqual(math.hypot(person['x']-position['x'], person['y']-position['y']), 43.9,
                    person['id']+' should give the stationary avatar personal space')
                prior = before.get(person['id'])
                if prior and math.hypot(person['x']-prior['x'], person['y']-prior['y'])>30:
                    travelled.add(person['id'])
        self.assertGreaterEqual(len(travelled), 3, 'Visitors should keep exploring instead of collecting around the player')

    def test_talking_still_pauses_the_selected_musician_then_they_move_on(self):
        people = self.people()
        identity = next(person['id'] for person in people if all(
            other['id']==person['id'] or math.hypot(person['x']-other['x'],person['y']-other['y'])>110
            for other in people))
        talk_to_musician(self.page, identity)
        person = self.person(identity)
        self.assertTrue(person['conversation'])
        before = {key: person[key] for key in ('x','y','phase')}
        advance_world(self.page, 3000)
        person = self.person(identity)
        self.assertEqual({key: person[key] for key in before}, before)
        self.assertFalse(person['walking'])
        self.page.keyboard.press('Escape')
        self.assertFalse(self.page.locator('#dialog').is_visible())
        advance_world(self.page, 3000)
        person = self.person(identity)
        self.assertFalse(person['conversation'])
        self.assertGreater(math.hypot(person['x']-before['x'], person['y']-before['y']), 43.9)
        self.assertGreater(person['phase'], before['phase'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
