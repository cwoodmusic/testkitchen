"""Expanded historical roster exchanges visitors through the actual arcade exit."""
import importlib.util
import math
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import advance_world, talk_to_musician

_spec = importlib.util.spec_from_file_location(
    'composer_learning_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class ComposerVisitorsBrowserTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        # The first six original visitors start onsite; the new composers wait.
        self.context.add_init_script('Math.random = () => 0;')
        self.load()
        self.page.clock.install()
        advance_world(self.page, 64)

    def test_new_composer_waits_for_a_real_departure_then_shares_journal_history(self):
        roster = self.page.evaluate('CodaArcadeQA.characters().npcs')
        self.assertEqual(len(roster), 15)
        self.assertEqual(sum(person['id'] == 'bach' for person in roster), 1)
        self.assertEqual(sum(not person['unlockItem'] for person in roster), 12)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.visitors().limit'), 6)
        self.assertEqual(sum(not person['hidden'] for person in roster), 6)
        self.assertTrue(all(person['hidden'] for person in roster if person['unlockItem']))

        appearances = self.page.evaluate('''() => {
          const renderer = createCodaCharacterRenderer();
          return ['schoenberg', 'handel', 'vivaldi'].map(id => ({id, ...renderer.appearanceFor(id)}));
        }''')
        self.assertEqual([person['name'] for person in appearances],
                         ['Arnold Schoenberg', 'George Frideric Handel', 'Antonio Vivaldi'])
        self.assertEqual([person['hairstyle'] for person in appearances],
                         ['bald', 'powderwig', 'long'])
        self.assertEqual(appearances[2]['accessory'], 'violin')
        self.assertEqual(len({person['shirt'] for person in appearances}), 3)

        target = next(person for person in roster if person['id'] == 'schoenberg')
        self.assertTrue(target['hidden'])
        self.assertTrue(self.page.evaluate("CodaArcadeQA.findMusician('schoenberg')"))
        # Finding a musician invites them; it must not immediately spawn a seventh.
        self.assertTrue(self.page.evaluate("CodaArcadeQA.characters().npcs.find(p => p.id === 'schoenberg').hidden"))
        self.page.evaluate('''() => {
          window.__composerExchange = {
            previous: Object.fromEntries(CodaArcadeQA.characters().npcs.map(p => [p.id, p])),
            events: [], violations: [], maxOnsite: 0, running: true
          };
          function observe() {
            const log = window.__composerExchange;
            if (!log.running) return;
            const people = CodaArcadeQA.characters().npcs;
            const onsite = people.filter(p => !p.hidden).length;
            log.maxOnsite = Math.max(log.maxOnsite, onsite);
            if (onsite > 6) log.violations.push('Visitor cap exceeded: ' + onsite);
            for (const person of people) {
              const before = log.previous[person.id];
              if (before.hidden && !person.hidden) {
                log.events.push({type: 'enter', id: person.id, x: person.x, y: person.y});
                if (Math.hypot(person.x - 1450, person.y - 752) > 86)
                  log.violations.push(person.id + ' entered away from the doorway');
              }
              if (!before.hidden && person.hidden) {
                log.events.push({type: 'leave', id: person.id, x: before.x, y: before.y});
                if (Math.hypot(before.x - 1450, before.y - 752) > 86)
                  log.violations.push(person.id + ' disappeared away from the exit');
              }
              log.previous[person.id] = person;
            }
            requestAnimationFrame(observe);
          }
          requestAnimationFrame(observe);
        }''')
        arrived = False
        for _ in range(480):
            advance_world(self.page, 250)
            state = self.page.evaluate('''() => ({
              hidden: CodaArcadeQA.characters().npcs.find(p => p.id === 'schoenberg').hidden,
              violations: __composerExchange.violations
            })''')
            self.assertEqual(state['violations'], [])
            if not state['hidden']:
                arrived = True
                break
        self.assertTrue(arrived, 'The requested composer should enter after an outgoing visitor reaches the exit')
        log = self.page.evaluate('''() => {
          __composerExchange.running = false;
          return {events: __composerExchange.events, maxOnsite: __composerExchange.maxOnsite,
                  violations: __composerExchange.violations};
        }''')
        self.assertEqual(log['violations'], [])
        self.assertLessEqual(log['maxOnsite'], 6)
        arrival = next(index for index, event in enumerate(log['events'])
                       if event['type'] == 'enter' and event['id'] == 'schoenberg')
        self.assertTrue(any(event['type'] == 'leave' for event in log['events'][:arrival]),
                        'An existing visitor must leave before the new composer enters')
        incoming = log['events'][arrival]
        self.assertLessEqual(math.hypot(incoming['x'] - 1450, incoming['y'] - 752), 86)

        talk_to_musician(self.page, 'schoenberg')
        self.assertEqual(self.page.locator('#who').inner_text(), 'Arnold Schoenberg')
        self.page.locator('.musician-choices').get_by_role(
            'button', name='Tell me some music history', exact=True).click()
        journal = self.page.locator('.music-history')
        self.assertIn('born in Vienna in 1874', journal.inner_text())
        self.assertEqual(journal.locator('[data-discovered-fact]').get_attribute('data-discovered-fact'),
                         'schoenberg-01')
        journal.get_by_role('button', name='Open Music History Journal', exact=True).click()
        self.assertEqual(journal.locator('.history-fact:not(.locked)').count(), 1)
        self.assertEqual(journal.locator('.history-fact.locked').count(), 29)
        self.assertIn('1 / 540', journal.inner_text())
        self.page.screenshot(path='/tmp/testkitchen-schoenberg-history.png')


if __name__ == '__main__':
    unittest.main(verbosity=2)
