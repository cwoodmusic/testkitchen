"""Use Haydn's complete, taught exam curriculum through the assembled arcade.

All lesson navigation, study checks, staff rendering, save/reload, end quizzes,
and XP awards remain production code. The browser profile is disposable and
external services are blocked; no real classroom profiles are used.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

from classroom_quiz_helpers import answer_quiz
from exam_study_helpers import finish_note_reminders
from world_navigation_helpers import enter_room

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'exam_curriculum_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class ExamCurriculumWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.wait_for_function('''window.CodaExamCurriculum?.getCoverage().complete
          &&window.CodaEducationContent?.getStore().getState().loaded''')

    def active(self):
        return self.page.evaluate('CodaArcadeQA.classroom().tutorials.active')

    def xp(self):
        return self.page.evaluate('CodaArcadeQA.progression().xp')

    def cards(self, lesson):
        return self.page.evaluate('id=>CodaEducationContent.getStudyCards(id)', lesson)

    def panel(self):
        return self.page.locator('.classroom-exam-study')

    def contrast(self, element):
        return element.evaluate('''node=>{
          const rgb=value=>(value.match(/[\\d.]+/g)||[]).map(Number);
          const luminance=channels=>channels.slice(0,3).map(value=>{
            value/=255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;
          }).reduce((sum,value,index)=>sum+value*[.2126,.7152,.0722][index],0);
          const foreground=rgb(getComputedStyle(node).color);let background=[0,0,0];
          for(let ancestor=node;ancestor;ancestor=ancestor.parentElement){
            const value=rgb(getComputedStyle(ancestor).backgroundColor);
            if(value.length>=3&&(value.length===3||value[3]>=.99)){background=value;break;}
          }
          const a=luminance(foreground),b=luminance(background);
          return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
        }''')

    def talk_to_haydn(self):
        if not self.page.evaluate('CodaArcadeQA.classroom().open'):
            enter_room(self.page, 'classroom')
        if self.page.locator('#classroomAllLessons').is_visible():
            self.page.locator('#classroomAllLessons').click()
            return
        if self.page.locator('#classroomStart').is_visible():
            return
        self.page.locator('#classroomCanvas').focus()
        self.page.keyboard.down('w')
        self.page.wait_for_timeout(850)
        self.page.keyboard.up('w')
        self.page.keyboard.press('e')
        self.page.wait_for_function('!document.querySelector("#classroomStart").hidden')

    def exam_study(self, lesson):
        self.talk_to_haydn()
        self.page.locator('#classroomFinalExam').click()
        self.assertEqual(self.page.locator('[data-exam-study]').count(), 8)
        self.page.locator('[data-exam-study="' + lesson + '"]').click()
        self.assertEqual(self.active()['id'], lesson)
        self.assertEqual(self.active()['phase'], 'study')
        self.assertEqual(self.panel().get_attribute('data-study-lesson'), lesson)

    def assert_picture(self, card):
        visual = card.get('visual')
        if not visual:
            return
        picture = self.panel().locator('.exam-study-visual')
        self.assertTrue(picture.is_visible(), card['id'] + ' displays its teaching picture')
        kind = visual['kind']
        if kind == 'meter':
            self.assertEqual(picture.locator('svg').get_attribute('aria-label'),
                             visual['meter'] + ' time signature')
        elif kind == 'tie':
            self.assertTrue(picture.locator('.exam-study-tie').is_visible())
            self.assertIn('Hold one sound', picture.get_attribute('aria-label'))
            self.assertGreaterEqual(picture.locator('.exam-study-tie path').count(), 2)
        elif kind == 'rhythm' and any(note.get('rest') for note in visual['notes']):
            self.assertTrue(picture.locator('.coda-music-glyph').count() > 0,
                            'Written rests use the actual notation font')
            self.assertTrue(any(0xE4E3 <= ord(char) <= 0xE4E7
                                for char in picture.inner_text()),
                            'Rest glyphs must appear rather than only explanatory text')
        elif kind == 'staff':
            self.assertTrue(picture.locator('svg').is_visible())

    def answer_study_card(self, card, wrong=False):
        state = self.active()['study']
        self.assertEqual(self.panel().get_attribute('data-study-stage'), 'look')
        self.assertEqual(self.panel().locator('.exam-study-title').inner_text(), card['title'])
        self.assertEqual(self.panel().locator('.exam-study-teach').inner_text(), card['teach'])
        self.assertIn(card['example'], self.panel().locator('.exam-study-example').inner_text())
        self.assertEqual(self.panel().locator('[data-study-answer]').count(), 0,
                         'Instruction is shown before asking the check')
        self.assert_picture(card)
        self.panel().locator('[data-study-try]').click()
        self.assertEqual(self.panel().locator('.exam-study-title').inner_text(), card['prompt'])
        checks=self.page.evaluate('({lesson,card})=>CodaClassroomLearningPathsData.getChecks(lesson,card)',{'lesson':self.active()['id'],'card':card})
        for index,check in enumerate(checks[state.get('checkIndex',0):],start=state.get('checkIndex',0)):
            if len(checks)>1:
                self.assertEqual(self.panel().locator('[data-study-check]').inner_text(),'Check '+str(index+1)+' of '+str(len(checks)))
            if wrong:
                incorrect = (check['correct'] + 1) % len(check['answers'])
                self.panel().locator('[data-study-answer="' + str(incorrect) + '"]').click()
                self.assertEqual(self.panel().locator('.exam-study-feedback').get_attribute('data-correct'), 'false')
                self.assertIn(check['hint'], self.panel().locator('.exam-study-feedback').inner_text())
                self.assertEqual(self.active()['study']['passed'], state['passed'])
                self.assertEqual(self.panel().locator('[data-study-next]').count(), 0,
                                 'An incorrect check cannot skip the taught concept')
            self.panel().locator('[data-study-answer="' + str(check['correct']) + '"]').click()
            self.assertEqual(self.panel().locator('.exam-study-feedback').get_attribute('data-correct'), 'true')
            if index==len(checks)-1:
                self.assertIn(card['id'], self.active()['study']['passed'])
            elif card['id'] not in state['passed']:
                self.assertNotIn(card['id'],self.active()['study']['passed'])
            self.assertFalse(self.panel().locator('[data-study-next]').is_disabled())
            self.panel().locator('[data-study-next]').click()

    def complete_study(self, lesson, wrong=False):
        cards = self.cards(lesson)
        while self.active()['phase'] == 'study':
            current = self.active()['study']['index']
            self.answer_study_card(cards[current], wrong=wrong)

    def test_all_eight_exam_links_teach_and_check_all_106_cards_without_awarding_xp(self):
        categories = self.page.evaluate('CodaExamCurriculum.IDS')
        expected=set(self.page.evaluate('CodaExamCurriculum.IDS.flatMap(id=>CodaEducationContent.getStudyCards(id).map(card=>card.id))'))
        visited = set()
        visual_kinds = set()
        initial = self.page.evaluate('''()=>Object.fromEntries(Object.entries(
          CodaClassroomProfileData.KEYS).map(([slot,key])=>[slot,localStorage.getItem(key)]))''')
        for lesson in categories:
            with self.subTest(lesson=lesson):
                self.exam_study(lesson)
                cards = self.cards(lesson)
                self.assertGreaterEqual(len(cards), 5)
                for index, card in enumerate(cards):
                    self.assertEqual(self.active()['study']['index'], index)
                    visited.add(card['id'])
                    if card.get('visual'):
                        visual_kinds.add(card['visual']['kind'])
                    if (card.get('visual') or {}).get('kind') == 'tie':
                        self.panel().screenshot(path='/tmp/exam-study-world-tie-desktop.png')
                    self.answer_study_card(card, wrong=True)
                    self.assertEqual(self.xp(), 0)
                self.assertEqual(self.active()['phase'], 'lesson')
                self.assertEqual(self.page.locator('.classroom-quiz').count(), 0,
                                 'Exam study links do not force a quiz or award a lesson')
                self.assertTrue(self.page.locator('[data-tutorial-study]').is_visible())
                self.page.locator('[data-tutorial-study]').click()
                self.assertTrue(self.active()['study']['completed'],
                                'The same study sequence is reachable from ordinary lesson controls')
                self.panel().locator('[data-study-exit]').click()
        self.assertEqual(visited,expected)
        self.assertGreaterEqual(len(visited),106)
        self.assertTrue({'staff', 'scale', 'rhythm', 'tie', 'meter', 'dynamic', 'tempo'} <= visual_kinds)
        final = self.page.evaluate('''()=>Object.fromEntries(Object.entries(
          CodaClassroomProfileData.KEYS).map(([slot,key])=>[slot,localStorage.getItem(key)]))''')
        self.assertEqual(final, initial, 'Studying cannot edit exam/quiz proofs, XP, Notes, or the avatar')
        journal = self.page.evaluate('JSON.parse(localStorage.getItem(CodaClassroomExamStudy.KEY))')
        self.assertEqual(sum(len(item['passed']) for item in journal['lessons'].values()),len(expected))

    def test_normal_activity_then_study_then_quiz_awards_the_lesson_once(self):
        self.talk_to_haydn()
        self.page.locator('[data-start-lesson="note-naming"]').click()
        for letter in ['C', 'F', 'D', 'A', 'E', 'F', 'G', 'A', 'B', 'C']:
            finish_note_reminders(self.page)
            self.page.locator('[data-lesson-try]').click()
            self.page.locator('.classroom-tutorial [data-note-answer="' + letter + '"]').first.click()
            self.page.locator('[data-tutorial-next]').click()
        self.assertEqual(self.active()['phase'], 'study')
        self.assertEqual(self.active()['step'], 10)
        self.assertEqual(self.xp(), 0)
        self.assertEqual(self.page.locator('[data-quiz-answer]').count(), 0)
        self.complete_study('note-naming')
        self.assertEqual(self.active()['phase'], 'quiz')
        self.assertEqual(self.xp(), 0)
        answer_quiz(self.page, 'note-naming')
        self.assertEqual(self.active()['phase'], 'complete')
        self.assertEqual(self.xp(), 50)
        self.page.locator('[data-tutorial-study]').click()
        self.assertTrue(self.active()['study']['completed'])
        self.panel().locator('[data-study-exit]').click()
        self.assertEqual(self.active()['phase'], 'complete')
        self.assertEqual(self.xp(), 50)
        self.load()
        self.talk_to_haydn()
        self.page.locator('[data-start-lesson="note-naming"]').click()
        self.assertEqual(self.active()['phase'], 'complete')
        self.assertEqual(self.xp(), 50)

    def test_reloading_resumes_the_current_study_card_and_keeps_its_passed_concepts(self):
        self.exam_study('tempo')
        cards = self.cards('tempo')
        for card in cards[:3]:
            self.answer_study_card(card)
        before = self.active()['study']
        self.assertEqual(before['index'], 3)
        self.load()
        self.exam_study('tempo')
        after = self.active()['study']
        self.assertEqual(after['index'], 3)
        self.assertEqual(after['passed'], before['passed'])
        self.assertEqual(self.panel().locator('.exam-study-title').inner_text(), cards[3]['title'])
        self.assertEqual(self.xp(), 0)

    def test_a_preexisting_completed_lesson_can_review_new_material_without_losing_its_reward(self):
        self.page.evaluate('''()=>{
          const data=CodaClassroomProfileData.blank(),now=Date.now();
          data.lessons.lessons['note-naming']={step:10,completed:true,completedAt:now};
          data.quizzes.quizzes['note-naming']={bankVersion:1,index:5,answers:[0,1,2,0,1],bestAnswers:[0,1,2,0,1],completedAt:now};
          data.progression={version:1,xp:50,events:[{id:'achievement:classroom-note-naming',xp:50}],bestPitchLevel:0};
          for(const slot of ['lessons','quizzes','progression'])localStorage.setItem(CodaClassroomProfileData.KEYS[slot],JSON.stringify(data[slot]));
        }''')
        self.load()
        self.talk_to_haydn()
        self.page.locator('[data-start-lesson="note-naming"]').click()
        self.assertEqual(self.active()['phase'], 'complete')
        self.assertEqual(self.xp(), 50)
        self.page.locator('[data-tutorial-study]').click()
        self.assertEqual(self.active()['study']['index'], 0)
        self.answer_study_card(self.cards('note-naming')[0])
        self.panel().locator('[data-study-exit]').click()
        self.assertEqual(self.active()['phase'], 'complete')
        self.assertEqual(self.xp(), 50)
        self.assertTrue(self.page.evaluate('JSON.parse(localStorage.getItem(CodaClassroomProfileData.KEYS.lessons)).lessons["note-naming"].completed'))

    def test_phone_portrait_and_landscape_keep_teaching_large_and_staff_pictures_inside_the_room(self):
        examples = [('time-signatures', 'time-signatures-two-four'),
                    ('time-signatures', 'time-signatures-three-four'),
                    ('rhythm-tree', 'rhythm-tree-ties'),
                    ('grand-staff', 'grand-middle-c-same-key')]
        for lesson, card_id in examples:
            self.page.set_viewport_size({'width': 390, 'height': 844})
            self.exam_study(lesson)
            cards = self.cards(lesson)
            target = next(index for index, card in enumerate(cards) if card['id'] == card_id)
            while self.active()['study']['index'] < target:
                self.answer_study_card(cards[self.active()['study']['index']])
            for size in [{'width': 390, 'height': 844}, {'width': 844, 'height': 390}]:
                with self.subTest(card=card_id, size=size):
                    self.page.set_viewport_size(size)
                    for selector in ['.exam-study-title', '.exam-study-teach', '.exam-study-example']:
                        element = self.panel().locator(selector)
                        self.assertGreaterEqual(element.evaluate('node=>parseFloat(getComputedStyle(node).fontSize)'), 20)
                        self.assertGreaterEqual(self.contrast(element), 4.5,
                                                selector + ' stays readable in the assembled classroom theme')
                    for selector in ['#musicClassroom', '.classroom-books', '.classroom-exam-study']:
                        element = self.page.locator(selector)
                        self.assertLessEqual(element.evaluate('node=>node.scrollWidth'), element.evaluate('node=>node.clientWidth') + 2,
                                             selector + ' fits the visible phone width')
                    self.assert_picture(cards[target])
                    self.panel().locator('[data-study-try]').click()
                    for answer in self.panel().locator('[data-study-answer]').all():
                        self.assertGreaterEqual(answer.evaluate('node=>parseFloat(getComputedStyle(node).fontSize)'), 20)
                        self.assertGreaterEqual(answer.bounding_box()['height'], 48)
                    self.panel().locator('[data-study-learn]').click()
            self.page.set_viewport_size({'width': 390, 'height': 844})
            self.panel().screenshot(path='/tmp/exam-study-world-' + card_id + '-phone.png')
        self.assertEqual(self.xp(), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
