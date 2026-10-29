from exam_study_helpers import finish_note_reminders, finish_exam_study
"""Author content in the real developer console, then use it in Haydn's room.

The normal arcade, developer controls, content persistence, notation, classroom,
assessment grading, and XP flow remain real. External services are blocked and
the browser profile is disposable. There are no live student accounts.
"""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'education_world_fixture', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class EducationEditorWorldTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.wait_for_function('window.CodaEducationContent?.getStore().getState().loaded')

    def editor(self):
        return self.page.locator('[data-education-editor].is-expanded')

    def field(self, name):
        return self.editor().locator('[data-education-field="' + name + '"]')

    def action(self, name):
        return self.editor().locator('[data-education-action="' + name + '"]')

    def open_editor(self, room=None, mode='exam'):
        if room:
            self.page.locator('#pianoRoomCanvas' if room == 'piano' else '#fishingLakeCanvas').focus()
            self.page.keyboard.press('F2')
            self.page.locator('[data-room-editor="' + room + '"] [data-room-tab="education"]').click()
        else:
            self.page.locator('#view').focus()
            if not self.page.evaluate('CodaDeveloperConsole.getState().open'):
                self.page.keyboard.press('F2')
            self.page.locator('#devTab-education').click()
        self.editor().wait_for(state='visible')
        if mode is not None:
            self.field('mode').select_option(mode)

    def close_editor(self):
        self.action('exit').click()
        self.assertEqual(self.page.locator('[data-education-editor].is-expanded').count(), 0)
        self.page.keyboard.press('F2')

    def document(self):
        return self.page.evaluate('CodaEducationContent.getDocument()')

    def scoped_bytes(self):
        return self.page.evaluate('''()=>Object.fromEntries(
          Object.entries(CodaClassroomProfileData.KEYS).map(([slot,key])=>[slot,localStorage.getItem(key)]))''')

    def import_document(self, document):
        self.field('import-file').set_input_files({
            'name': 'teacher-content.json', 'mimeType': 'application/json',
            'buffer': json.dumps(document).encode(),
        })
        self.page.wait_for_function('''()=>document.querySelector(
          '[data-education-editor].is-expanded [data-education-status]')?.textContent.includes('Imported')''')

    def choose_content(self, mode, category='note-naming', selected=None):
        self.field('mode').select_option(mode)
        self.field('category').select_option(category)
        if selected is not None:
            self.field('list').select_option(str(selected))

    def add_notation(self, clef='bass'):
        visual = self.visual_editor('main')
        visual.locator('[data-visual-field="type"]').select_option('notation')
        visual.locator('[data-notation-control="staff"]').select_option(clef)
        visual.locator('[data-notation-control="meter"]').select_option('6/8')
        visual.locator('[data-notation-action="add"]').click()
        self.assertEqual(self.editor().locator('[data-education-preview] .education-score').get_attribute('data-score-clef'), clef)

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

    def exam_state(self):
        return self.page.evaluate('CodaArcadeQA.classroom().finalExam')

    def visual_editor(self, prefix):
        return self.editor().locator('[data-visual-editor="' + prefix + '"]')

    def test_authored_pitch_text_questions_and_all_three_visual_types_reach_the_live_lesson(self):
        self.open_editor(mode=None)
        self.assertEqual(self.field('mode').input_value(), 'study')
        self.choose_content('study', selected='treble-musical-alphabet')
        before = self.document()
        self.editor().locator('.education-editor-lesson-settings > summary').click()
        self.field('lesson-title').fill('Our editable pitch course')
        self.field('lesson-intro').fill('Learn these keys with our own examples.')
        self.field('section-title-0').fill('Our first piano chapter')
        self.action('save-lesson-settings').click()
        self.field('title').fill('Our piano pitch lesson')
        self.field('teach').fill('Find the named white keys and their black-key neighbors.')
        self.field('example').fill('The highlighted black key is C-sharp. The bass clef and note picture are our other examples.')
        self.field('hint').fill('Follow the labeled keys from left to right.')
        keyboard = self.visual_editor('main')
        keyboard.locator('[data-visual-field="type"]').select_option('keyboard')
        keyboard.locator('[data-visual-key="C-sharp"]').click()
        keyboard.locator('[data-visual-field="keyboard-label"]').fill('Our editable piano picture')
        keyboard.locator('[data-visual-action="keyboard-text-options"]').click()
        keyboard.locator('[data-visual-field="keyboard-two-label"]').fill('Pair of black keys')
        keyboard.locator('[data-visual-field="keyboard-lower-label"]').fill('Lower pitches')
        self.action('add-visual').click()
        clef = self.visual_editor('extra-0')
        clef.locator('[data-visual-field="type"]').select_option('clef')
        clef.locator('[data-visual-field="clef"]').select_option('bass')
        clef.locator('[data-visual-field="clef-page"]').select_option('clef')
        self.action('add-visual').click()
        notes = self.visual_editor('extra-1')
        notes.locator('[data-visual-field="type"]').select_option('notation')
        notes.locator('[data-notation-control="staff"]').select_option('treble')
        notes.locator('[data-notation-action="add"]').click()
        check = self.editor().locator('[data-education-check-index="0"]')
        check.locator('[data-education-field$="prompt"]').fill('Our follow-up: name the note after G.')
        check.locator('[data-education-field$="hint"]').fill('Our explanation: the seven music letters start again at A.')
        for index, answer in enumerate(['B', 'A', 'H']):
            check.locator('.education-editor-answer input[type="text"]').nth(index).fill(answer)
        check.locator('.education-editor-answer input[type="radio"]').nth(1).check()
        self.visual_editor('check-0').locator('[data-visual-field="type"]').select_option('keyboard')
        preview = self.editor().locator('[data-education-preview]')
        self.assertTrue(preview.locator('.lesson-piano-keyboard').first.is_visible())
        self.assertTrue(preview.locator('.education-score').first.is_visible())
        self.action('save').click()
        saved = self.document()
        card = next(item for item in saved['lessons']['note-naming']['study'] if item['id'] == 'treble-musical-alphabet')
        self.assertEqual(card['title'], 'Our piano pitch lesson')
        self.assertEqual(card['visual']['notes'], ['C-sharp'])
        self.assertEqual(card['visual']['label'], 'Our editable piano picture')
        self.assertEqual(card['visual']['groupLabels']['two'], 'Pair of black keys')
        self.assertEqual(card['visual']['directionLabels']['lower'], 'Lower pitches')
        self.assertEqual([visual['kind'] for visual in card['visuals']], ['clef-intro', 'notation'])
        self.assertEqual(card['checks'][0]['prompt'], 'Our follow-up: name the note after G.')
        self.assertEqual(card['checks'][0]['answers'], ['B', 'A', 'H'])
        self.assertEqual(card['checks'][0]['correct'], 1)
        self.assertEqual(saved['exam'], before['exam'])
        self.assertEqual(saved['quizzes'], before['quizzes'])
        with self.page.expect_download() as exported:
            self.action('export').click()
        self.assertEqual(json.loads(Path(exported.value.path()).read_text()), saved)
        self.close_editor()
        self.load()
        self.assertEqual(self.document(), saved, 'Every authored picture and follow-up survives a reload.')
        self.talk_to_haydn()
        self.page.locator('[data-start-lesson="note-naming"]').click()
        self.assertIn('Our editable pitch course', self.page.locator('.classroom-learning-paths').inner_text())
        self.assertIn('Learn these keys with our own examples.', self.page.locator('.classroom-learning-paths').inner_text())
        self.assertIn('Our first piano chapter', self.page.locator('[data-path-section="alphabet-and-keys"]').inner_text())
        self.page.locator('[data-path-section="alphabet-and-keys"]').click()
        panel = self.page.locator('.classroom-exam-study')
        self.assertEqual(panel.locator('.exam-study-title').inner_text(), 'Our piano pitch lesson')
        self.assertIn(card['teach'], panel.inner_text())
        self.assertIn(card['example'], panel.inner_text())
        self.assertEqual(panel.locator('.exam-study-visual').count(), 3)
        self.assertIn('Our editable piano picture', panel.locator('.lesson-piano-keyboard').get_attribute('aria-label'))
        self.assertEqual(panel.locator('[data-piano-group="2"]').text_content(), 'Pair of black keys')
        self.assertIn('Lower pitches', panel.locator('.lesson-piano-keyboard').text_content())
        self.assertEqual(panel.locator('[data-piano-black="C-sharp"][data-piano-highlight]').count(), 1)
        self.assertEqual(panel.locator('.education-score').get_attribute('data-score-clef'), 'treble')
        panel.locator('[data-study-try]').click()
        panel.locator('[data-study-answer="' + str(card['correct']) + '"]').click()
        self.assertIn(card['hint'], panel.locator('.exam-study-feedback').inner_text())
        panel.locator('[data-study-next]').click()
        self.assertEqual(panel.locator('.exam-study-title').inner_text(), card['checks'][0]['prompt'])
        self.assertTrue(panel.locator('.lesson-piano-keyboard').is_visible())
        panel.locator('[data-study-answer="' + str(card['checks'][0]['correct']) + '"]').click()
        self.assertIn(card['checks'][0]['hint'], panel.locator('.exam-study-feedback').inner_text())

    def test_real_console_question_crud_preview_reload_and_keyboard_exit(self):
        before = self.scoped_bytes()
        self.open_editor()
        self.assertEqual(self.editor().get_attribute('role'), 'dialog')
        original_id = self.field('list').input_value()
        prompt = 'Teacher question: <b>this stays plain text</b>'
        self.field('prompt').fill(prompt)
        for index, answer in enumerate(['Quietly', 'Loudly', 'Smoothly'], 1):
            self.editor().get_by_label('Answer ' + str(index), exact=True).fill(answer)
        self.action('add-answer').click()
        self.editor().get_by_label('Answer 4', exact=True).fill('Steadily')
        self.editor().get_by_label('Answer 4 is correct', exact=True).check()
        self.field('explanation').fill('Keep an even beat.')
        preview = self.editor().locator('[data-education-preview]')
        self.assertIn(prompt, preview.inner_text())
        self.assertEqual(preview.locator('b').count(), 0)
        preview.locator('[data-preview-answer="3"]').click()
        self.assertIn('Correct. Keep an even beat.', preview.inner_text())
        self.action('save').click()
        changed = next(item for item in self.document()['exam']['questions'] if item['id'] == original_id)
        self.assertEqual(changed['prompt'], prompt)
        self.assertEqual(changed['answers'], ['Quietly', 'Loudly', 'Smoothly', 'Steadily'])
        self.assertEqual(changed['correct'], 3)
        total = len(self.document()['exam']['questions'])
        self.action('duplicate').click()
        duplicate_id = self.field('list').input_value()
        self.assertNotEqual(duplicate_id, original_id)
        self.assertEqual(len(self.document()['exam']['questions']), total + 1)
        self.action('delete').click()
        self.action('confirm').click()
        self.assertEqual(len(self.document()['exam']['questions']), total)
        self.action('undo').click()
        self.assertIn(duplicate_id, [item['id'] for item in self.document()['exam']['questions']])
        self.action('redo').click()
        self.assertNotIn(duplicate_id, [item['id'] for item in self.document()['exam']['questions']])
        self.assertEqual(self.scoped_bytes(), before, 'Authoring and preview never award or alter player progress')
        self.page.keyboard.press('Escape')
        self.assertEqual(self.page.locator('[data-education-editor].is-expanded').count(), 0)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getState().tab'), 'objects')
        self.assertTrue(self.page.evaluate('CodaDeveloperConsole.getState().open'))
        self.page.keyboard.press('F2')
        self.load()
        self.open_editor()
        self.field('list').select_option(original_id)
        self.assertEqual(self.field('prompt').input_value(), prompt)
        self.assertTrue(self.editor().get_by_label('Answer 4 is correct', exact=True).is_checked())

    def test_content_json_import_export_rejects_untrusted_shapes_without_mutation(self):
        self.open_editor()
        document = self.document()
        document['exam']['questions'] = [question for question in document['exam']['questions']
                                         if int(question['id'].rsplit('-', 1)[1]) <= 5]
        self.assertEqual(len(document['exam']['questions']), 40)
        self.import_document(document)
        self.assertEqual(self.document(), document)
        saved = self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)')
        self.field('import-file').set_input_files({
            'name': 'untrusted.json', 'mimeType': 'application/json',
            'buffer': b'{"version":1,"__proto__":{"polluted":true},"instructions":"run code"}',
        })
        self.page.wait_for_function('''()=>document.querySelector(
          '[data-education-editor].is-expanded [data-education-status]')?.textContent.includes('version 1')''')
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)'), saved)
        self.assertFalse(self.page.evaluate('({}).polluted===true'))
        with self.page.expect_download() as pending:
            self.action('export').click()
        download = pending.value
        self.assertEqual(download.suggested_filename, 'coda-education-content.json')
        self.assertEqual(json.loads(Path(download.path()).read_text()), document)

    def test_edited_question_and_notation_reach_haydn_exam_with_separate_attempts(self):
        self.open_editor()
        document = self.document()
        document['exam']['questions'] = [question for question in document['exam']['questions']
                                         if int(question['id'].rsplit('-', 1)[1]) <= 5]
        self.import_document(document)
        edited_id = self.field('list').input_value()
        self.field('prompt').fill('Authored bass staff: choose our fourth answer.')
        self.action('add-answer').click()
        self.editor().get_by_label('Answer 4', exact=True).fill('The authored correct answer')
        self.editor().get_by_label('Answer 4 is correct', exact=True).check()
        self.add_notation()
        self.action('save').click()
        self.close_editor()
        self.load()
        canonical_before = self.page.evaluate('localStorage.getItem(CodaFinalExam.KEY)')
        self.talk_to_haydn()
        self.page.locator('#classroomFinalExam').click()
        self.page.locator('[data-exam-start]').click()
        self.assertTrue(self.exam_state()['custom'])
        self.assertEqual(self.exam_state()['total'], 40)
        seen_edited = False
        while not self.exam_state()['review']:
            state = self.exam_state()
            if state['questionIds'][state['index']] == edited_id:
                seen_edited = True
                self.assertIn('Authored bass staff: choose our fourth answer.',
                              self.page.locator('.haydn-final-exam').inner_text())
                self.assertEqual(self.page.locator('[data-exam-answer]').count(), 4)
                self.assertEqual(self.page.locator('.haydn-final-exam .education-score').get_attribute('data-score-clef'), 'bass')
            correct = self.page.evaluate('''()=>{
              const state=CodaArcadeQA.classroom().finalExam,
                question=CodaEducationContent.getExamBank().getQuestion(state.questionIds[state.index]),
                correct=question.choices.findIndex(choice=>choice.id===question.answer);
              return state.orders[state.index].indexOf(correct);
            }''')
            self.page.locator('[data-exam-answer="' + str(correct) + '"]').click()
            self.page.locator('[data-exam-next]').click()
        self.assertTrue(seen_edited)
        self.page.locator('[data-exam-submit]').click()
        self.page.wait_for_function('CodaArcadeQA.classroom().finalExam.phase==="result"&&!CodaArcadeQA.classroom().finalExam.claiming')
        self.assertEqual(self.exam_state()['score'], 40)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'), 200)
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaFinalExam.KEY)'), canonical_before)
        self.assertIsNotNone(self.page.evaluate('localStorage.getItem(CodaFinalExam.CUSTOM_KEY)'))

    def test_lesson_copy_and_quiz_answer_changes_reach_the_live_classroom(self):
        self.open_editor()
        self.choose_content('lesson', selected='0')
        self.field('teach').fill('Teacher says: find C beside the two black keys.')
        self.field('prompt').fill('Your turn: choose C for our edited lesson.')
        self.add_notation('treble')
        self.action('save').click()
        self.choose_content('quiz')
        first_quiz_id = self.field('list').input_value()
        self.field('prompt').fill('Our teacher-authored quiz: which answer means C?')
        self.action('add-answer').click()
        self.editor().get_by_label('Answer 4', exact=True).fill('Teacher C')
        self.editor().get_by_label('Answer 4 is correct', exact=True).check()
        self.add_notation('bass')
        self.action('save').click()
        self.close_editor()
        canonical_before = self.page.evaluate('''()=>({
          lessons:localStorage.getItem(CodaClassroomTutorials.KEY),
          quizzes:localStorage.getItem(CodaClassroomQuiz.KEY)})''')
        self.talk_to_haydn()
        self.page.locator('[data-start-lesson="note-naming"]').click()
        self.page.locator('[data-path-practice]').click()
        tutorial = self.page.locator('.classroom-tutorial')
        self.assertIn('Teacher says: find C beside the two black keys.', tutorial.inner_text())
        self.assertEqual(tutorial.locator('.education-score').get_attribute('data-score-clef'), 'treble')
        while self.page.evaluate('CodaArcadeQA.classroom().tutorials.active.phase') == 'lesson':
            active = self.page.evaluate('CodaArcadeQA.classroom().tutorials.active')
            expected = self.page.evaluate('index=>CodaEducationContent.getLessonSteps("note-naming")[index]', active['step'])
            finish_note_reminders(self.page)
            self.page.locator('[data-lesson-try]').click()
            if active['step'] == 0:
                self.assertIn('Your turn: choose C for our edited lesson.', tutorial.inner_text())
            if expected['kind'] == 'keys':
                self.page.locator('[data-pitch="' + str(expected['pitch']) + '"]').click()
            else:
                self.page.locator('[data-note-answer="' + expected['answer'] + '"]').click()
            self.page.locator('[data-tutorial-next]').click()
        finish_exam_study(self.page, 'note-naming')
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroom().tutorials.active.quiz.custom'))
        saw_edited_question=False
        while self.page.locator('[data-quiz-answer]').count():
            quiz = self.page.evaluate('CodaArcadeQA.classroom().tutorials.active.quiz')
            question=quiz['question']
            if question['prompt']=='Our teacher-authored quiz: which answer means C?':
                saw_edited_question=True
                self.assertEqual(tutorial.locator('[data-quiz-answer]').count(), 4)
                self.assertEqual(tutorial.locator('.education-score').get_attribute('data-score-clef'), 'bass')
            correct = question['correct']
            self.page.locator('[data-quiz-answer="' + str(correct) + '"]').click()
            self.page.locator('[data-quiz-next]').click()
        self.assertTrue(saw_edited_question)
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.classroom().tutorials.active.phase'), 'complete')
        self.assertGreater(self.page.evaluate('CodaArcadeQA.progression().xp'), 0)
        self.assertEqual(self.page.evaluate('''()=>({
          lessons:localStorage.getItem(CodaClassroomTutorials.KEY),
          quizzes:localStorage.getItem(CodaClassroomQuiz.KEY)})'''), canonical_before)
        self.assertTrue(self.page.evaluate('''()=>{
          const journal=JSON.parse(localStorage.getItem(CodaClassroomTutorials.CUSTOM_KEY));
          return journal.lessons['note-naming'].completed;
        }'''))
        self.assertIsNotNone(first_quiz_id)

    def test_room_console_mounts_shared_editor_and_student_workspace_cannot_save(self):
        enter_room(self.page, 'piano')
        self.open_editor('piano')
        self.field('prompt').fill('A shared edit made from Piano Lab.')
        selected = self.field('list').input_value()
        self.action('save').click()
        self.close_editor()
        self.page.keyboard.press('Escape')
        self.page.wait_for_function('!CodaArcadeQA.piano().open')
        enter_room(self.page, 'fishing')
        self.open_editor('fishing')
        self.field('list').select_option(selected)
        self.assertEqual(self.field('prompt').input_value(), 'A shared edit made from Piano Lab.')
        saved = self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)')
        result = self.page.evaluate('''()=>{
          CodaClassroomStorageInstance.claim({classId:'fixture_class_001',profileId:'fixture_student_001'});
          const store=CodaEducationContent.getStore(),document=store.getDocument();
          document.exam.questions[0].prompt='A student cannot author content';
          return {state:store.getState(),save:store.saveDocument(document)};
        }''')
        self.assertFalse(result['state']['canEdit'])
        self.assertFalse(result['state']['usingDraft'])
        self.assertFalse(result['save']['ok'])
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaEducationContent.KEY)'), saved)
        self.assertFalse(self.page.evaluate('CodaDeveloperConsole.open("education")'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
