"""Facts authoring changes world content while player discoveries remain separate."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True
from world_navigation_helpers import _close_world_panels

_spec = importlib.util.spec_from_file_location('facts_authoring_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)

PUBLISHED_FACT = '<img src=x onerror="window.factAttack=true"> Bach’s hometown is part of this edited archive.'


class MusicFactsEditorTests(_world.WorldBrowserCase):
    maxDiff = 800

    def route_checkout(self, route):
        if (self._testMethodName == 'test_published_facts_appear_in_the_real_record_as_safe_text'
                and urlparse(route.request.url).path.endswith('/published-world-project.json')):
            publication = json.loads((_world.ROOT / 'published-world-project.json').read_text())
            publication['musicHistoryContent'] = {'version':2, 'facts':{'bach-01':PUBLISHED_FACT}, 'quizzes':{}}
            return route.fulfill(status=200, content_type='application/json', body=json.dumps(publication))
        return super().route_checkout(route)

    def load(self):
        if (self._testMethodName in ['test_published_facts_appear_in_the_real_record_as_safe_text',
                                    'test_linked_quiz_edits_reach_a_real_eligible_quiz']
                and not getattr(self, 'legacy_seeded', False)):
            self.context.add_init_script('''(()=>{
              if(sessionStorage.getItem('factsLegacySeeded'))return;
              localStorage.setItem('codaMusicHistoryV1',JSON.stringify({version:1,
                discovered:Array.from({length:30},(_,i)=>'bach-'+String(i+1).padStart(2,'0'))}));
              sessionStorage.setItem('factsLegacySeeded','yes');
            })()''')
            self.legacy_seeded = True
        super().load()

    def editor(self, person='bach', fact='bach-01'):
        if not self.page.evaluate('CodaDeveloperConsole.getState().open'):
            self.page.keyboard.press('F2')
        self.page.locator('#devTab-facts').click()
        self.page.locator('#devMusicFactText').wait_for()
        self.page.get_by_label('Fact musician',exact=True).select_option(person)
        if fact:self.page.get_by_label('Music fact',exact=True).select_option(fact)
        return self.page.locator('#dev-facts')

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def history_bytes(self):
        return self.page.evaluate('localStorage.getItem("codaMusicHistoryV1")')

    def apply_fact(self, text, person='bach', fact='bach-01'):
        self.editor(person, fact)
        self.page.get_by_label('Music fact text',exact=True).fill(text)
        self.page.locator('#devMusicFactApply').click()
        self.page.wait_for_function('''([fact,text])=>CodaDeveloperConsole.getProject()
          .musicHistoryContent?.facts[fact]===text''',arg=[fact,text])

    def scholar(self):
        if self.page.locator('#assetStudio').is_visible():
            self.page.locator('#view').focus();self.page.keyboard.press('F2')
        _close_world_panels(self.page)
        point = self.page.evaluate('CodaArcadeQA.scholar().approach')
        self.place(point['x'],point['y']);self.page.keyboard.press('e')
        self.page.locator('.music-history[open]').wait_for()
        return self.page.locator('.music-history')

    def test_all_facts_are_browsable_and_search_crosses_musicians_without_unlocking(self):
        before = self.history_bytes();pane = self.editor()
        self.page.get_by_label('Fact musician',exact=True).select_option('')
        self.assertEqual(pane.locator('[data-music-fact]').count(),180)
        self.assertEqual(self.page.get_by_label('Fact musician',exact=True).locator('option').count(),19)
        collection_sizes = self.page.evaluate('Object.values(CodaMusicHistoryData).map(person=>person.facts.length)')
        self.assertEqual(collection_sizes,[10]*18)
        self.page.get_by_label('Fact musician',exact=True).select_option('vivaldi')
        last_fact = self.page.evaluate('CodaMusicHistoryData.vivaldi.facts.at(-1)')
        self.page.get_by_label('Music fact',exact=True).select_option(last_fact['id'])
        self.assertEqual(self.page.get_by_label('Music fact text',exact=True).input_value(),last_fact['text'])
        self.page.get_by_label('Search all music facts',exact=True).fill('Eisenach')
        pane.locator('[data-music-fact="bach-01"]').click()
        self.assertEqual(self.page.get_by_label('Fact musician',exact=True).input_value(),'bach')
        self.assertEqual(self.page.get_by_label('Music fact',exact=True).input_value(),'bach-01')
        self.assertIn('Eisenach',self.page.get_by_label('Music fact text',exact=True).input_value())
        self.assertEqual(self.history_bytes(),before)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().recordedCount'),0)
        self.assertNotIn('musicHistoryContent',self.project())

    def test_phone_drafts_keep_focus_and_survive_other_musician_edits(self):
        self.page.set_viewport_size({'width':390,'height':844});pane = self.editor()
        progress = self.history_bytes();position = self.page.evaluate('CodaArcadeQA.position()')
        text = self.page.get_by_label('Music fact text',exact=True)
        text.fill('Bach draft stays here: wasd q e.');text.press('Space');text.press('ArrowLeft')
        draft = text.input_value()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),position)
        self.page.get_by_label('Fact musician',exact=True).select_option('miles')
        text.fill('Miles Davis explored many sounds with other musicians.')
        self.page.locator('#devMusicFactApply').click()
        self.page.get_by_label('Fact musician',exact=True).select_option('bach')
        self.assertEqual(text.input_value(),draft)
        text.focus()
        self.assertTrue(text.evaluate('el=>el===document.activeElement'))
        self.assertEqual(text.evaluate('el=>getComputedStyle(el).fontSize'),'16px')
        metrics = pane.evaluate('''el=>({width:el.clientWidth,scroll:el.scrollWidth,
          buttons:[...el.querySelectorAll('button')].filter(b=>b.getClientRects().length)
            .map(b=>b.getBoundingClientRect().height)})''')
        self.assertLessEqual(metrics['scroll'],metrics['width']+1)
        self.assertTrue(all(height>=44 for height in metrics['buttons']))
        self.assertNotIn('bach-01',self.project()['musicHistoryContent']['facts'])
        self.assertEqual(self.history_bytes(),progress)
        self.page.locator('#devMusicFactRevert').click()
        self.assertIn('Eisenach',text.input_value())

    def test_apply_undo_save_export_and_old_or_invalid_imports_preserve_progress(self):
        original = self.project();progress = self.history_bytes()
        edited_text = 'Bach was a composer and keyboard player from a large musical family.'
        self.apply_fact(edited_text)
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project().get('musicHistoryContent'),original.get('musicHistoryContent'))
        self.page.locator('#devRedo').click()
        self.assertEqual(self.project()['musicHistoryContent']['facts']['bach-01'],edited_text)
        self.page.locator('#devTab-project').click();self.page.locator('#devSave').click()
        self.page.wait_for_function('/saved/i.test(document.querySelector("#devStatus").textContent)')
        self.load();self.editor()
        self.assertEqual(self.page.get_by_label('Music fact text',exact=True).input_value(),edited_text)
        self.page.locator('#devTab-project').click()
        with self.page.expect_download() as pending:self.page.locator('#devExport').click()
        exported = json.loads(Path(pending.value.path()).read_text())
        self.assertEqual(exported['musicHistoryContent']['version'],2)
        self.assertEqual(exported['musicHistoryContent']['facts']['bach-01'],edited_text)
        self.assertNotIn('codaMusicHistoryV1',exported)
        self.page.once('dialog',lambda dialog:dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'old-world.json','mimeType':'application/json','buffer':json.dumps(original).encode()})
        self.page.wait_for_function('!CodaDeveloperConsole.getProject().musicHistoryContent')
        self.editor();self.assertIn('Eisenach',self.page.get_by_label('Music fact text',exact=True).input_value())
        self.page.locator('#devUndo').click()
        self.assertEqual(self.project()['musicHistoryContent']['facts']['bach-01'],edited_text)
        self.page.locator('#devTab-project').click()
        invalid = copy.deepcopy(exported);invalid['musicHistoryContent']['facts']['unknown-person-01']='Invalid fact target.'
        self.page.locator('#devImportFile').set_input_files({'name':'invalid-facts.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
        self.page.wait_for_function('/Import failed/.test(document.querySelector("#devStatus").textContent)')
        self.assertEqual(self.project()['musicHistoryContent'],exported['musicHistoryContent'])
        self.assertEqual(self.history_bytes(),progress)

    def test_old_authored_content_keeps_retired_work_and_archive_only_exports(self):
        original = self.project();progress = self.history_bytes()
        identities = self.page.evaluate("""()=>({
          retired:CodaMusicHistoryLegacy.FACT_IDS.find(id=>!CodaMusicHistoryContent.FACTS.some(f=>f.id===id)),
          quiz:CodaMusicHistoryContent.QUESTIONS.find(q=>CodaMusicHistoryLegacy.QUIZ_FACTS[q.id]!==q.factId)
        })""")
        legacy = copy.deepcopy(original)
        quiz = identities['quiz']
        authored = {'prompt':'An older quiz question that I edited.',
                    'choices':['First older choice','Second older choice','Third older choice'],'answer':1}
        legacy['musicHistoryContent'] = {'version':1,
            'facts':{identities['retired']:'A fact I edited for the older collection.'},
            'quizzes':{quiz['id']:authored}}
        self.page.keyboard.press('F2');self.page.locator('#devTab-project').click()
        def import_legacy():
            self.page.once('dialog',lambda dialog:dialog.accept())
            self.page.locator('#devImportFile').set_input_files({'name':'older-facts.json',
                'mimeType':'application/json','buffer':json.dumps(legacy).encode()})
            self.page.wait_for_function('count=>{const c=CodaDeveloperConsole.getProject().musicHistoryContent;return c?.version===2&&Object.keys(c.facts).length===count}',arg=len(legacy['musicHistoryContent']['facts']))
        import_legacy()
        migrated = self.project()['musicHistoryContent']
        self.assertIn(identities['retired'],migrated['facts'])
        self.assertEqual(migrated['archivedQuizzes'][quiz['id']],authored)
        self.assertNotIn(quiz['id'],migrated['quizzes'])
        self.assertEqual(self.project()['assets'],original['assets'])
        legacy['musicHistoryContent']['facts'] = {}
        import_legacy()
        with self.page.expect_download() as pending:self.page.locator('#devExport').click()
        exported = json.loads(Path(pending.value.path()).read_text())
        self.assertEqual(exported['musicHistoryContent']['facts'],{})
        self.assertEqual(exported['musicHistoryContent']['archivedQuizzes'][quiz['id']],authored)
        self.assertEqual(self.history_bytes(),progress)

    def test_published_facts_appear_in_the_real_record_as_safe_text(self):
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().recordedCount'),10)
        migrated = self.page.evaluate('CodaArcadeQA.history()')
        bach = next(person for person in migrated['people'] if person['id']=='bach')
        self.assertTrue(bach['quiz']['eligible'])
        self.assertEqual(len(bach['facts']),10)
        self.assertTrue(all(fact['recorded'] for fact in bach['facts']))
        self.assertEqual(migrated['pendingAmount'],0, 'Legacy collections must not earn a second completion prize')
        progress = self.history_bytes()
        self.assertEqual(self.project()['musicHistoryContent']['facts']['bach-01'],PUBLISHED_FACT)
        journal = self.scholar();journal.locator('[data-scholar-action="record"]').click()
        journal.get_by_label('Journal musician',exact=True).select_option('bach')
        fact = journal.locator('[data-history-fact="bach-01"]')
        self.assertEqual(fact.locator('p').inner_text(),PUBLISHED_FACT)
        self.assertEqual(fact.locator('img').count(),0)
        self.assertIsNone(self.page.evaluate('window.factAttack'))
        journal.get_by_role('button',name='Close',exact=True).click()
        self.page.reload();self.page.wait_for_function('CodaDeveloperConsole.ready()')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().people.find(p=>p.id==="bach").facts[0].text'),PUBLISHED_FACT)
        self.assertEqual(self.history_bytes(),progress)

    def test_linked_quiz_edits_reach_a_real_eligible_quiz(self):
        self.assertEqual(self.page.evaluate('CodaArcadeQA.history().recordedCount'),10)
        progress = self.history_bytes();self.editor()
        question = self.page.evaluate('CodaMusicHistoryQuizData.find(q=>q.person==="bach")')
        self.page.get_by_label('Music fact',exact=True).select_option(question['factId'])
        card = self.page.locator('[data-music-fact-quiz="'+question['id']+'"]')
        prompt = 'Which answer belongs to this edited history question?'
        choices = ['Archive answer '+str(index+1) for index in range(len(question['choices']))]
        card.get_by_label('Quiz question 1',exact=True).fill(prompt)
        for index,choice in enumerate(choices):card.get_by_label('Quiz choice '+str(index+1),exact=True).fill(choice)
        card.get_by_label('Correct quiz answer',exact=True).select_option('1')
        card.get_by_role('button',name='Apply quiz question',exact=True).click()
        self.assertEqual(self.project()['musicHistoryContent']['quizzes'][question['id']]['answer'],1)
        self.assertEqual(self.history_bytes(),progress)
        journal = self.scholar();journal.locator('[data-scholar-action="quizzes"]').click()
        journal.locator('[data-history-quiz="bach"] button').click()
        self.assertEqual(journal.locator('[data-quiz-question]').count(),10)
        self.assertEqual(journal.locator('[data-quiz-question="'+question['id']+'"] legend').inner_text().split('. ',1)[1],prompt)
        for field in journal.locator('[data-quiz-question]').all():
            identifier = field.get_attribute('data-quiz-question')
            correct = self.page.evaluate('''id=>{const q=CodaMusicHistoryContent.resolvedQuiz(
              CodaDeveloperConsole.getMusicHistoryContent(),id);return q.choices[q.answer]}''',identifier)
            field.get_by_role('radio',name=correct,exact=True).check()
        journal.get_by_role('button',name='Finish quiz',exact=True).click()
        self.assertIn('10 / 10',journal.inner_text());self.assertIn('Passed!',journal.inner_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
