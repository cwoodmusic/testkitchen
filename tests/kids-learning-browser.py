from exam_study_helpers import finish_note_reminders, finish_exam_study
"""Child-friendly classroom steps and uncluttered, fullscreen music rooms.

Run with Python Playwright and Chromium. The production origin is routed to
this checkout; external services are blocked and no live scores are written.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from classroom_quiz_helpers import QUIZ_ANSWERS, answer_quiz
from world_navigation_helpers import enter_room

_spec = importlib.util.spec_from_file_location('kids_learning_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class KidsLearningTests(_world.WorldBrowserCase):
    def setUp(self):
        phone = self._testMethodName.endswith('_phone')
        self.context = self.browser.new_context(
            viewport={'width':390,'height':844} if phone else {'width':1440,'height':1000},
            is_mobile=phone, has_touch=phone)
        self.context.route('https://**/*', lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**', self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        if 'fallback' in self._testMethodName:
            self.context.add_init_script('''
              Object.defineProperty(Element.prototype,'requestFullscreen',{configurable:true,value:undefined});
              Object.defineProperty(Element.prototype,'webkitRequestFullscreen',{configurable:true,value:undefined});
            ''')
        self.page = self.context.new_page();self.page.set_default_timeout(10000)
        self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url)
            if response.status>=400 and '/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load()

    def room(self, name):
        return self.page.evaluate('name=>CodaArcadeQA[name]()', name)

    def state(self):
        return self.page.evaluate('CodaArcadeQA.tutorials()')

    def dismiss(self):
        for _ in range(15):
            close=self.page.get_by_role('button',name='Dismiss notification',exact=True)
            if not close.is_visible():return
            close.click();self.page.wait_for_timeout(40)
        self.fail('Reward notifications did not dismiss')

    def talk_to_haydn(self):
        if not self.room('classroom')['open']:enter_room(self.page,'classroom')
        back=self.page.locator('#classroomBackRoom')
        if back.is_visible():back.click()
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.down('w')
        self.page.wait_for_timeout(850);self.page.keyboard.up('w')
        self.assertEqual(self.room('classroom')['near']['type'],'professor')
        self.page.keyboard.press('e')
        self.assertTrue(self.page.locator('#classroomStart').is_visible())

    def open_lesson(self, lesson):
        self.dismiss()
        if not self.room('classroom')['open']:enter_room(self.page,'classroom')
        all_lessons=self.page.locator('#classroomAllLessons')
        if all_lessons.is_visible():all_lessons.click()
        if not self.page.locator('#classroomStart').is_visible():self.talk_to_haydn()
        self.page.locator('[data-start-lesson="'+lesson+'"]').click()
        self.assertEqual(self.state()['active']['id'],lesson)
        self.assertFalse(self.page.locator('.classroom-library nav').is_visible(), 'Reference books stay out of a guided lesson')

    def ready_quiz(self, lesson, legacy=False):
        self.page.evaluate('''({lesson,legacy})=>{
          const total=CodaClassroomTutorials.LESSONS.find(value=>value.id===lesson).total;
          localStorage.setItem('codaClassroomLessonsV1',JSON.stringify({version:1,
            lessons:{[lesson]:{step:total,completed:legacy,completedAt:legacy?1:0}}}));
        }''', {'lesson':lesson,'legacy':legacy})
        self.load();self.open_lesson(lesson)
        finish_exam_study(self.page, lesson)

    def assert_lesson_below_header(self):
        header=self.page.locator('#musicClassroom .classroom-heading').bounding_box()
        tutorial=self.page.locator('.classroom-tutorial').bounding_box()
        if tutorial['y']<header['y']+header['height']-1:
            self.page.screenshot(path='/tmp/music48-header-overlap-'+str(self.page.viewport_size['width'])+'.png')
            print('Overlap state:',self.state()['active'], 'header:',header,'tutorial:',tutorial,
                  'prompt:',self.page.locator('.classroom-tutorial h3').first.bounding_box(),
                  'roomScroll:',self.page.locator('#musicClassroom').evaluate('node=>node.scrollTop'))
        self.assertGreaterEqual(tutorial['y'],header['y']+header['height']-1,'The guided activity must not sit underneath the room toolbar')
        back=self.page.locator('#classroomAllLessons')
        if back.is_visible():
            box=back.bounding_box()
            if back.evaluate('node=>!!node.closest(".classroom-heading")'):
                self.assertGreaterEqual(box['y'],header['y']-1)
                self.assertLessEqual(box['y']+box['height'],header['y']+header['height']+1)
            else:self.assertGreaterEqual(box['y'],header['y']+header['height']-1)

    def assert_big_and_simple(self, scope, words=75):
        self.assertLessEqual(len(scope.inner_text().split()), words, 'One lesson screen must not become a page of instructions')
        self.assertLessEqual(scope.evaluate('node=>node.scrollWidth'),scope.evaluate('node=>node.clientWidth')+2)
        visible_text=scope.locator('p:visible,h3:visible,.classroom-quiz-question:visible').all()
        for item in visible_text:
            if not item.inner_text().strip():continue
            # Tiny badges/eyebrows do not carry the instruction. The prominent
            # body copy, question, and feedback must remain readable.
            is_progress=item.evaluate('node=>node.matches(".lesson-step-label,.lesson-card-label,.classroom-quiz-progress")')
            size=item.evaluate('node=>parseFloat(getComputedStyle(node).fontSize)')
            self.assertGreaterEqual(size,18 if is_progress else 22,item.inner_text())
        for button in scope.locator('button:visible').all():
            self.assertGreaterEqual(button.bounding_box()['height'],47.5,button.inner_text())

    def begin_try(self, meter=False):
        finish_note_reminders(self.page)
        active=self.state()['active'];step=active['step']
        selector='[data-signature-try]' if meter else '[data-lesson-try]'
        self.assertTrue(self.page.locator(selector).is_visible())
        self.assertEqual(self.page.locator('[data-note-answer]:visible,[data-signature-answer]:visible').count(),0)
        self.assert_big_and_simple(self.page.locator('.classroom-tutorial'))
        self.page.locator(selector).click()
        self.assertEqual(self.state()['active']['step'],step,'Try it introduces practice; it never awards progress')
        self.assertFalse(self.state()['active']['answered'])

    def finish_note_lesson(self, lesson, inspect=False):
        answers=self.page.evaluate('id=>CodaClassroomTutorials.NOTE_LESSONS[id].map(step=>step.answer)',lesson)
        for index,answer in enumerate(answers):
            self.begin_try()
            if inspect and index==0:
                wrong=next(letter for letter in self.page.locator('[data-note-answer]').evaluate_all('nodes=>nodes.map(node=>node.dataset.noteAnswer)') if letter!=answer)
                self.page.locator('[data-note-answer="'+wrong+'"]').first.click()
                self.assertFalse(self.state()['active']['answered'])
                hint=self.page.locator('[data-note-hint]')
                if hint.is_visible():hint.click()
                self.assertFalse(self.state()['active']['answered'],'A hint never answers for the child')
                self.assertTrue(self.page.locator('[data-tutorial-next]').is_disabled())
                self.page.screenshot(path='/tmp/music48-note-try.png')
            self.page.locator('[data-note-answer="'+answer+'"]').first.click()
            self.assertTrue(self.state()['active']['answered'])
            self.page.locator('[data-tutorial-next]').click()
        finish_exam_study(self.page, lesson)
        self.assertEqual(self.state()['active']['phase'],'quiz')

    def finish_rhythm(self):
        # Exploring a single current row is the first hands-on step.
        for _ in range(4):self.page.locator('[data-tree-split]').click()
        self.assertEqual(self.state()['active']['treeLevel'],4)
        self.assertEqual(self.page.locator('.lesson-split-children [data-tree-level]').count(),2)
        self.assertLessEqual(self.page.locator('.lesson-split-picture svg').count(),3,'Only one split is shown, without a full tiny rhythm tree')
        self.page.screenshot(path='/tmp/music48-rhythm.png')
        self.page.locator('[data-tutorial-next]').click()
        for _ in range(2):
            self.begin_try();self.page.locator('[data-rhythm-answer="2"]').click()
            self.page.locator('[data-tutorial-next]').click()
        self.begin_try()
        for units in [4,2,2,8]:self.page.locator('[data-add-value="'+str(units)+'"]').click()
        self.page.locator('[data-check-rhythm]').click()
        if self.state()['active']['phase']!='quiz':self.page.locator('[data-tutorial-next]').click()
        finish_exam_study(self.page, 'rhythm-tree')
        self.assertEqual(self.state()['active']['phase'],'quiz')

    def finish_meter(self):
        steps=self.page.evaluate('CodaTimeSignatureLesson.STEPS')
        for index,step in enumerate(steps):
            self.begin_try(meter=True)
            if step['kind']=='choice':
                if index==0:
                    self.page.locator('[data-signature-answer="'+str((step['correct']+1)%3)+'"]').click()
                    self.assertFalse(self.state()['active']['answered'])
                self.page.locator('[data-signature-answer="'+str(step['correct'])+'"]').click()
            else:
                for beats in step['recipe']:self.page.locator('[data-signature-add="'+str(beats)+'"]').click()
                self.page.locator('[data-signature-check]').click()
            if index==4:self.page.screenshot(path='/tmp/music48-meter.png')
            self.page.locator('[data-tutorial-next]').click()
        finish_exam_study(self.page, 'time-signatures')
        self.assertEqual(self.state()['active']['phase'],'quiz')

    def test_both_rooms_remove_bottom_menus_and_native_fullscreen_exits_without_closing_room(self):
        for name,host,button,close in [('classroom','musicClassroom','classroomFullscreen','classroomClose'),('piano','pianoroom','pianoFullscreen','closepiano')]:
            enter_room(self.page,name)
            if name=='classroom':
                self.assertEqual(self.page.locator('.classroom-mobile-nav,.classroom-room-controls').count(),0)
                self.assertFalse(self.page.locator('#classroomStart').is_visible())
                self.assertFalse(self.page.locator('.classroom-library').is_visible())
            else:
                self.assertEqual(self.page.locator('[data-piano-view]:visible').count(),0)
                self.assertFalse(self.page.locator('#pianoMenuBackdrop').is_visible())
            self.page.locator('#'+button).click()
            self.page.wait_for_function('name=>CodaArcadeQA[name]().fullscreen.active',arg=name)
            self.assertEqual(self.room(name)['fullscreen']['mode'],'native')
            self.assertEqual(self.page.evaluate('document.fullscreenElement?.id'),host)
            self.page.keyboard.press('Escape')
            self.page.wait_for_function('name=>!CodaArcadeQA[name]().fullscreen.active',arg=name)
            self.assertTrue(self.room(name)['open'],'Esc leaves fullscreen before leaving the room')
            self.page.locator('#'+button).click()
            self.page.wait_for_function('name=>CodaArcadeQA[name]().fullscreen.active',arg=name)
            self.page.screenshot(path='/tmp/music48-'+name+'-fullscreen.png')
            self.page.locator('#'+close).click()
            self.page.wait_for_function('!document.fullscreenElement')
            self.assertFalse(self.room(name)['open'])
            enter_room(self.page,name)
            self.assertFalse(self.room(name)['fullscreen']['active'])
            self.page.locator('#'+close).click()
        enter_room(self.page,'classroom');self.talk_to_haydn()
        self.page.locator('[data-start-lesson="note-naming"]').click()
        self.page.locator('#classroomFullscreen').click()
        self.page.wait_for_function('CodaArcadeQA.classroom().fullscreen.active')
        self.page.keyboard.press('Escape')
        self.page.wait_for_function('!CodaArcadeQA.classroom().fullscreen.active')
        self.assertEqual(self.room('classroom')['mobileView'],'books')
        self.assertEqual(self.state()['active']['id'],'note-naming')

    def test_full_window_fallback_keeps_mobile_controls_and_restores_them_phone(self):
        self.page.clock.install();self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+2)
        controls_parent=self.page.locator('.coda-touch-controls').evaluate('node=>node.parentElement.tagName')
        for name,host,button,close in [('classroom','musicClassroom','classroomFullscreen','classroomClose'),('piano','pianoroom','pianoFullscreen','closepiano')]:
            enter_room(self.page,name);self.page.locator('#'+button).click()
            self.assertEqual(self.room(name)['fullscreen']['mode'],'viewport')
            self.assertIsNone(self.page.evaluate('document.fullscreenElement'))
            self.assertTrue(self.page.locator('#'+host+' .coda-joystick').is_visible())
            self.assertEqual(self.page.locator('.coda-touch-controls').evaluate('node=>node.parentElement.id'),host)
            for size in [{'width':390,'height':844},{'width':844,'height':390}]:
                self.page.set_viewport_size(size);self.page.clock.run_for(64)
                box=self.page.locator('#'+host).bounding_box()
                self.assertAlmostEqual(box['width'],size['width'],delta=2)
                self.assertLessEqual(self.page.locator('#'+host).evaluate('node=>node.scrollWidth'),size['width']+2)
                self.assertTrue(self.page.locator('.coda-touch-interact').is_visible())
            before=self.room(name)['player']
            stick=self.page.locator('#'+host+' .coda-joystick').bounding_box()
            x=stick['x']+stick['width']/2;y=stick['y']+stick['height']/2
            self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+60,y)
            self.page.clock.run_for(200);self.page.mouse.up();self.page.clock.run_for(32)
            after=self.room(name)['player']
            self.assertGreater(abs(after['x']-before['x'])+abs(after['y']-before['y']),5,'The fullscreen joystick must actually move the avatar')
            self.page.screenshot(path='/tmp/music48-'+name+'-fallback-phone.png')
            self.page.keyboard.press('Escape')
            self.assertTrue(self.room(name)['open']);self.assertFalse(self.room(name)['fullscreen']['active'])
            self.assertEqual(self.page.locator('.coda-touch-controls').evaluate('node=>node.parentElement.tagName'),controls_parent)
            self.page.locator('#'+close).click();self.page.set_viewport_size({'width':390,'height':844})

    def test_all_five_incremental_lessons_require_practice_and_quizzes_and_award_once(self):
        enter_room(self.page,'classroom');self.talk_to_haydn()
        for lesson in ['note-naming','rhythm-tree','time-signatures','bass-clef','grand-staff']:
            before=self.page.evaluate('CodaArcadeQA.progression().xp')
            self.open_lesson(lesson)
            if lesson in ['note-naming','bass-clef','grand-staff']:self.finish_note_lesson(lesson,inspect=lesson=='note-naming')
            elif lesson=='rhythm-tree':self.finish_rhythm()
            else:self.finish_meter()
            self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before,'Practice alone does not award a completed lesson')
            self.assert_big_and_simple(self.page.locator('.classroom-quiz'))
            answer_quiz(self.page,lesson,finish=False)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before)
            self.page.locator('[data-quiz-finish]').click();self.dismiss()
            self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before+50)
            self.assertIn(lesson,self.state()['completed'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),250)
        self.load();self.open_lesson('bass-clef')
        self.assertTrue(self.state()['active']['complete'])
        self.page.locator('[data-tutorial-quiz]').click();answer_quiz(self.page,'bass-clef');self.dismiss()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),250)

    def test_quiz_retry_save_failure_and_legacy_progress_keep_their_reward_boundaries(self):
        self.ready_quiz('note-naming')
        answer_quiz(self.page,'note-naming',wrong=(0,1),finish=False)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        self.page.locator('[data-quiz-retry]').click()
        self.page.evaluate('''()=>{const set=Storage.prototype.setItem;window.failQuizWrite=true;
          Storage.prototype.setItem=function(key,value){if(failQuizWrite&&key==='codaClassroomQuizzesV1')throw Error('fixture quota');return set.call(this,key,value);};}''')
        answer_quiz(self.page,'note-naming',finish=False)
        self.page.locator('[data-quiz-finish]').click()
        self.assertEqual(self.state()['active']['phase'],'quiz');self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        self.page.evaluate('failQuizWrite=false');self.page.locator('[data-quiz-save]').click()
        self.page.locator('[data-quiz-finish]').click();self.dismiss()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.ready_quiz('bass-clef',legacy=True);self.dismiss()
        self.assertTrue(self.state()['active']['complete']);self.assertIn('bass-clef',self.state()['completed'])
        before=self.page.evaluate('CodaArcadeQA.progression().xp')
        self.page.locator('[data-tutorial-quiz]').click();answer_quiz(self.page,'bass-clef');self.dismiss()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before)

    def test_guided_lessons_and_quizzes_fit_both_phone_orientations_phone(self):
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            for lesson in ['note-naming','rhythm-tree','time-signatures','bass-clef','grand-staff']:
                self.open_lesson(lesson)
                self.assert_big_and_simple(self.page.locator('.classroom-tutorial'))
                self.assert_lesson_below_header()
                self.assertLessEqual(self.page.locator('#musicClassroom').evaluate('node=>node.scrollWidth'),size['width']+2)
                if lesson!='rhythm-tree':self.begin_try(meter=lesson=='time-signatures')
                self.assert_big_and_simple(self.page.locator('.classroom-tutorial'))
                self.assert_lesson_below_header()
                next_button=self.page.locator('[data-tutorial-next]')
                if next_button.is_visible():
                    box=next_button.bounding_box();self.assertLessEqual(box['y']+box['height'],size['height']+1,'Next must stay inside the phone viewport')
            self.page.screenshot(path='/tmp/music48-guided-'+str(size['width'])+'.png')
        self.ready_quiz('rhythm-tree')
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            self.assert_big_and_simple(self.page.locator('.classroom-quiz'))
            self.page.screenshot(path='/tmp/music48-quiz-'+str(size['width'])+'.png')


if __name__=='__main__':
    unittest.main(verbosity=2)
