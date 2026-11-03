"""Real relationship quest, carried discovery, scholar hand-in, records and quizzes."""
from settings_menu_helpers import settings_page
import importlib.util
from pathlib import Path
import sys
from urllib.parse import urlparse
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import talk_to_musician,open_settings,open_cabinet,_close_world_panels,advance_world
spec=importlib.util.spec_from_file_location('history_world',Path(__file__).with_name('learning-world-browser.py'))
world=importlib.util.module_from_spec(spec);spec.loader.exec_module(world)
PITCH='''<!doctype html><html data-coda-game="pitch"><meta charset="utf-8"><button id="finishHistoryRun">Complete fixture race</button><script>
let token='';window.CodaBridge={report(id,result){parent.postMessage({coda:1,type:'result',game:'pitch',token,runId:id,result},location.origin)}};
addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='init')token=event.data.token});
finishHistoryRun.onclick=()=>CodaBridge.report('scholar-browser-run',{mode:'classic',score:120,correct:12,misses:0,streak:12,won:true,perfect:true});
parent.postMessage({coda:1,type:'ready',game:'pitch'},location.origin);
</script></html>'''

class MusicHistoryBrowserTests(world.WorldBrowserCase):
    def route_checkout(self,route):
        if urlparse(route.request.url).path=='/Pitch-Race/':return route.fulfill(status=200,content_type='text/html',body=PITCH)
        return super().route_checkout(route)

    def close_history(self):
        self.page.locator('.music-history').get_by_role('button',name='Close',exact=True).click()

    def scholar(self):
        _close_world_panels(self.page)
        point=self.page.evaluate('CodaArcadeQA.scholar().approach')
        self.place(point['x'],point['y']);self.page.keyboard.press('e')
        self.page.locator('.music-history[open]').wait_for()

    def scholar_page(self, action):
        journal = self.page.locator('.music-history')
        back = journal.locator('[data-scholar-back]')
        if back.is_visible():
            back.click()
        journal.locator('[data-scholar-action="' + action + '"]').click()
        return journal

    def talk_history(self,person='bach'):
        # Let an invited musician walk through the front doorway before E;
        # the doorway's exit intentionally takes priority over nearby people.
        visitor = self.page.evaluate('id=>CodaArcadeQA.characters().npcs.find(p=>p.id===id)', person)
        if visitor['hidden']:
            self.assertTrue(self.page.evaluate('id=>CodaArcadeQA.findMusician(id)', person))
        self.place(1180, 620)
        self.page.wait_for_function('''id=>{
          const person=CodaArcadeQA.characters().npcs.find(p=>p.id===id);
          const exit=CodaArcadeQA.arcadeExit();
          return person&&!person.hidden&&Math.hypot(person.x-exit.x,person.y-exit.y)>exit.radius+35;
        }''', arg=person, timeout=30000)
        talk_to_musician(self.page,person)
        self.page.locator('[data-history-owner-prompt="'+person+'"]').click()

    def test_scholar_is_seated_outside_visitor_cap_and_records_begin_locked(self):
        self.assertEqual(self.page.evaluate('CodaArcadeQA.visitors().limit'),6)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.characters().npcs.some(p=>p.id==="scholar")'))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.scholar().visible'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.scholar().activity'),'relaxing')
        self.scholar();journal=self.page.locator('.music-history')
        self.scholar_page('record')
        self.assertIn('0 / 180',journal.inner_text());self.assertEqual(journal.locator('.history-fact.locked').count(),180)
        self.assertNotIn('born in Eisenach',journal.text_content())
        journal.get_by_label('Search recorded facts').fill('Eisenach');self.assertEqual(journal.locator('.history-fact').count(),0)
        journal.get_by_label('Search recorded facts').fill('');journal.get_by_label('Journal musician').select_option('bach');self.assertEqual(journal.locator('.history-fact.locked').count(),10)
        self.scholar_page('quizzes')
        self.assertTrue(journal.locator('[data-history-quiz="bach"] button').is_disabled())
        self.scholar_page('help')
        self.assertIn('friendship quest', journal.inner_text())
        self.page.keyboard.press('Escape')
        self.assertTrue(journal.locator('[data-scholar-action="pouch"]').is_visible())
        self.page.keyboard.press('Escape')
        self.assertFalse(journal.is_visible())
        settings_page(self.page, 'help')
        self.assertEqual(self.page.locator('#worldMusicHistory').inner_text(),'Find the scholar')

    def test_spam_cannot_unlock_facts_but_real_quest_unlocks_one_then_scholar_rewards_it(self):
        self.talk_history();journal=self.page.locator('.music-history')
        for _ in range(3):
            self.assertIn('No new facts',journal.inner_text());self.assertEqual(journal.locator('[data-discovered-fact]').count(),0)
            self.assertEqual(journal.get_by_role('button',name='Tell me another fact').count(),0)
            self.close_history();self.page.locator('[data-history-owner-prompt="bach"]').click()
        journal.get_by_role('button',name='Accept friendship quest',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().active.game'),'pitch')
        self.close_history();open_cabinet(self.page,0)
        self.page.frame_locator('#gameiframe').locator('#finishHistoryRun').click()
        self.page.wait_for_function('CodaArcadeQA.history().people.find(p=>p.id==="bach").hasNewFact')
        self.page.locator('#returnworld').click();talk_to_musician(self.page,'bach')
        prompt=self.page.locator('[data-history-owner-prompt="bach"]');self.assertIn('!',prompt.inner_text());prompt.click()
        self.assertEqual(journal.locator('[data-discovered-fact]').get_attribute('data-discovered-fact'),'bach-01')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().carriedIDs'),['bach-01'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().recordedCount'),0)
        self.close_history();self.page.locator('[data-history-owner-prompt="bach"]').click()
        self.assertIn('No new facts',journal.inner_text());self.assertEqual(journal.locator('[data-discovered-fact]').count(),0)
        self.close_history();balance=self.page.evaluate('CodaArcadeQA.notes().balance')
        saved = self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")')
        self.scholar();self.scholar_page('pouch')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), balance)
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")'), saved)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().carriedIDs'), ['bach-01'])
        journal.get_by_role('button',name='Give carried facts to the scholar',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance+50)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().carriedIDs'),[])
        self.scholar_page('record');journal.get_by_label('Journal musician').select_option('bach')
        self.assertEqual(journal.locator('.history-fact:not(.locked)').count(),1);self.assertEqual(journal.locator('.history-fact.locked').count(),9)
        expected = self.page.evaluate('CodaMusicHistoryContent.resolvedFact(CodaDeveloperConsole.getMusicHistoryContent(), "bach-01").text')
        self.assertEqual(journal.locator('[data-history-fact="bach-01"] p').inner_text(), expected)
        self.close_history()
        self.page.reload();self.page.wait_for_function('window.CodaDeveloperConsole?.ready()');self.assertEqual(self.page.evaluate('CodaArcadeQA.history().recordedCount'),1)

    def test_progression_controls_use_temporary_player_and_quiz_requires_full_record(self):
        native=self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")')
        self.page.keyboard.press('F2');self.page.locator('#devTab-history').click()
        pane=self.page.locator('#dev-history')
        self.assertIn('read-only',pane.inner_text());self.assertEqual(pane.get_by_role('button',name='Set all 10 facts recorded').count(),0)
        pane.get_by_role('button',name='Open temporary progression test',exact=True).click()
        self.page.wait_for_function('window.CodaDeveloperTestMode?.isEnabled()&&window.CodaDeveloperConsole?.ready()')
        self.page.keyboard.press('F2');self.page.locator('#devTab-history').click();pane.get_by_label('History progression character').select_option('bach')
        # The isolated player still uses the real pouch and scholar hand-in.
        for _ in range(9):pane.get_by_role('button',name='Add next fact to pouch',exact=True).click()
        self.page.keyboard.press('F2');self.scholar();journal=self.page.locator('.music-history')
        self.scholar_page('pouch')
        journal.get_by_role('button',name='Give carried facts to the scholar',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().people.find(p=>p.id==="bach").recordedCount'),9)
        self.scholar_page('quizzes')
        self.assertTrue(journal.locator('[data-history-quiz="bach"] button').is_disabled())
        self.assertFalse(self.page.evaluate('CodaArcadeQA.history().people.find(p=>p.id==="bach").quiz.eligible'))
        self.close_history();self.page.locator('#view').focus();self.page.keyboard.press('F2')
        self.page.locator('#devTab-history').click();pane.get_by_label('History progression character').select_option('bach')
        pane.get_by_role('button',name='Set all 10 facts recorded',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().people.find(p=>p.id==="bach").recordedCount'),10)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.history().people.find(p=>p.id==="bach").quiz.eligible'))
        self.page.keyboard.press('F2');self.scholar();journal=self.page.locator('.music-history')
        self.scholar_page('quizzes');journal.locator('[data-history-quiz="bach"] button').click()
        self.assertEqual(journal.locator('[data-quiz-question]').count(),10)
        self.assertTrue(journal.get_by_role('button',name='Finish quiz',exact=True).is_disabled())
        self.page.keyboard.press('Escape')
        self.assertTrue(journal.locator('[data-history-quiz="bach"] button').is_visible())
        journal.locator('[data-history-quiz="bach"] button').click()
        for field in journal.locator('[data-quiz-question]').all():
            identifier=field.get_attribute('data-quiz-question')
            correct=self.page.evaluate('id=>{const q=CodaMusicHistoryContent.resolvedQuiz(CodaDeveloperConsole.getMusicHistoryContent(),id);return q.choices[q.answer]}',identifier)
            field.get_by_role('radio',name=correct,exact=True).check()
        journal.get_by_role('button',name='Finish quiz',exact=True).click()
        self.assertIn('10 / 10',journal.inner_text());self.assertIn('Passed!',journal.inner_text())
        balance=self.page.evaluate('CodaArcadeQA.notes().balance')
        journal.get_by_role('button',name='Back to history quizzes').click();journal.locator('[data-history-quiz="bach"] button').click()
        for field in journal.locator('[data-quiz-question]').all():field.get_by_role('radio').first.check()
        journal.get_by_role('button',name='Finish quiz',exact=True).click();self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),balance)
        self.close_history();self.page.goto(world.WORLD,wait_until='domcontentloaded');self.page.wait_for_function('window.CodaDeveloperConsole?.ready()')
        self.assertEqual(self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")'),native)

    def test_phone_record_and_scholar_pouch_are_readable(self):
        for width in (390, 320):
            with self.subTest(width=width):
                self.page.set_viewport_size({'width':width,'height':844})
                self.scholar();journal=self.page.locator('.music-history')
                for action in (None, 'pouch', 'record'):
                    if action:
                        self.scholar_page(action)
                    if action == 'record':
                        journal.get_by_label('Journal musician').select_option('bach')
                    dimensions=journal.evaluate('(el)=>({width:el.clientWidth,scroll:el.scrollWidth,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right})')
                    self.assertLessEqual(dimensions['scroll'],dimensions['width']+1)
                    self.assertGreaterEqual(dimensions['left'],0)
                    self.assertLessEqual(dimensions['right'],width)
                self.page.screenshot(path='/tmp/coda-scholar-phone-'+str(width)+'.png')
                self.close_history()

if __name__=='__main__':unittest.main(verbosity=2)
