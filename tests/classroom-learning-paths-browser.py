"""Real ordered lesson cards, separate quizzes, mobile diagrams, and save guards."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
import threading
import unittest
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
HTML = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/music-notation.css"><link rel="stylesheet" href="/classroom-tutorials.css"><link rel="stylesheet" href="/education-notation.css"><link rel="stylesheet" href="/classroom-exam-study.css"><link rel="stylesheet" href="/classroom-quiz.css"><link rel="stylesheet" href="/classroom-learning-paths.css">
<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#1c2840}#mount{max-width:760px;margin:auto}</style><div id="mount"></div>
<script src="/music-notation.js"></script><script src="/classroom-keyboard.js"></script><script src="/education-notation.js"></script><script src="/classroom-quiz-pool.js"></script><script src="/classroom-quiz.js"></script><script src="/time-signature-lesson.js"></script><script src="/classroom-tutorials.js"></script><script src="/classroom-curriculum-staff.js"></script><script src="/classroom-curriculum-rhythm.js"></script><script src="/classroom-curriculum-expression.js"></script><script src="/final-exam-bank.js"></script><script src="/classroom-exam-curriculum.js"></script><script src="/classroom-exam-study.js"></script><script src="/classroom-accidentals-lesson.js"></script><script src="/classroom-understanding-basics.js"></script><script src="/classroom-understanding-staff.js"></script><script src="/classroom-learning-paths-data.js"></script><script src="/classroom-learning-paths.js"></script>
<script>
window.allow=true;window.quota=false;window.rewardFail=false;window.rewards=[];window.practice=0;
const store={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>{if(quota)throw Error('quota');localStorage.setItem(key,value);}};
window.mountPath=id=>{window.pathUI?.destroy();window.category=CodaClassroomLearningPathsData.getCategory(id);window.pathUI=CodaClassroomLearningPaths.create({host:mount,lessonId:id,storage:store,canRecord:()=>allow,onPractice:()=>practice++,onComplete:async(id)=>{if(rewardFail)return {ok:false,error:'Test reward unavailable'};rewards.push(id);return {ok:true,amount:50};}});pathUI.open();};
mountPath(new URL(location.href).searchParams.get('lesson')||'rhythm-tree');
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path.split('?')[0] != '/path-fixture':
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(HTML.encode())


class LearningPathsBrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width':1100,'height':1000})
        self.context.route('https://**/*', lambda route:route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.missing = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.missing.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/path-fixture')
        self.page.wait_for_function('window.pathUI&&document.fonts.check("64px CodaBravura")')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.missing, [])

    def state(self):
        return self.page.evaluate('pathUI.getState()')

    def current_check(self):
        return self.page.evaluate('''()=>{const state=pathUI.getState(),card=category.sections.find(s=>s.id===state.sectionId).cards[state.study.index];return CodaClassroomLearningPathsData.getChecks(category.id,card)[state.study.checkIndex];}''')

    def finish_section(self, section_id):
        self.page.locator(f'[data-path-section="{section_id}"]').click()
        guard=0
        while self.state()['phase']=='section':
            guard+=1
            self.assertLess(guard,35)
            if self.state()['study']['stage']=='look':
                self.assertEqual(self.page.locator('[data-study-answer]').count(),0)
                self.page.locator('[data-study-try]').click()
            correct=self.current_check()['correct']
            self.page.locator(f'[data-study-answer="{correct}"]').click()
            self.page.locator('[data-study-next]').click()

    def finish_quiz(self, kind):
        self.page.locator(f'[data-path-quiz="{kind}"]').click()
        while self.state()['quiz']['phase']=='question':
            correct=self.page.evaluate('''()=>{const state=pathUI.getState(),model=state.phase==='basics-quiz'?category.basicsQuiz:CodaClassroomQuiz.QUIZZES[category.id];return (state.quiz.question||model.questions[state.quiz.index]).correct;}''')
            self.page.locator(f'[data-quiz-answer="{correct}"]').click()
            self.page.locator('[data-quiz-next]').click()
        self.page.locator('[data-quiz-finish]').click()

    def test_three_checks_retry_resume_and_only_complete_the_step_after_the_last_answer(self):
        self.page.locator('[data-path-section="note-parts"]').click()
        self.page.locator('[data-study-try]').click()
        self.assertEqual(self.page.locator('[data-study-check]').inner_text(),'Check 1 of 3')
        self.assertEqual(self.page.locator('[data-study-next]').count(),0)
        first=self.current_check()
        self.page.locator('[data-study-answer="'+str((first['correct']+1)%len(first['answers']))+'"]').click()
        self.assertIn(first['hint'],self.page.locator('.exam-study-feedback').inner_text())
        self.assertEqual(self.page.locator('[data-study-next]').count(),0)
        self.page.locator('[data-study-answer="'+str(first['correct'])+'"]').click()
        self.assertEqual(self.state()['study']['passed'],[])
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.state()['study']['index'],0)
        self.assertEqual(self.page.locator('[data-study-check]').inner_text(),'Check 2 of 3')
        self.page.reload();self.page.wait_for_function('window.pathUI')
        self.page.locator('[data-path-section="note-parts"]').click()
        self.assertEqual(self.state()['study']['checkIndex'],1)
        self.page.locator('[data-study-try]').click()
        self.page.locator('[data-study-answer="'+str(self.current_check()['correct'])+'"]').click()
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.page.locator('[data-study-check]').inner_text(),'Check 3 of 3')
        before=self.page.evaluate('localStorage.getItem(CodaClassroomLearningPaths.KEY)')
        self.page.evaluate('allow=false')
        self.page.locator('[data-study-answer="'+str(self.current_check()['correct'])+'"]').click()
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaClassroomLearningPaths.KEY)'),before)
        self.assertEqual(self.state()['study']['passed'],[])
        self.page.evaluate('allow=true')
        self.page.locator('[data-study-answer="'+str(self.current_check()['correct'])+'"]').click()
        self.assertEqual(self.state()['study']['passed'],['path-note-head'])
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.state()['study']['index'],1)
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertIsNone(self.page.evaluate('localStorage.getItem(CodaClassroomQuiz.KEY)'))

    def test_staff_maps_show_clean_numbered_lines_and_spaces_on_a_phone(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.evaluate('mountPath("bass-clef")')
        self.finish_section('staff-and-clef')
        self.page.locator('[data-path-section="bass-reminders"]').click()
        self.assertEqual(self.page.locator('svg [data-staff-line]').all_text_contents(),['1','2','3','4','5'])
        self.assertIn('Line 3: D',self.page.locator('.exam-study-example').inner_text())
        self.page.locator('[data-study-try]').click()
        for _ in range(3):
            self.page.locator('[data-study-answer="'+str(self.current_check()['correct'])+'"]').click()
            self.page.locator('[data-study-next]').click()
        self.assertEqual(self.page.locator('svg [data-staff-space]').all_text_contents(),['1','2','3','4'])
        self.assertIn('Space 2: C',self.page.locator('.exam-study-example').inner_text())
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))

    def test_rhythm_teaches_ordered_basics_before_advanced_and_keeps_real_award_proof(self):
        self.assertIsNone(self.page.evaluate('localStorage.getItem(CodaClassroomLearningPaths.KEY)'))
        self.assertTrue(self.page.locator('[data-path-section="note-parts"]').is_enabled())
        self.assertTrue(self.page.locator('[data-path-section="note-symbols"]').is_disabled())
        self.assertTrue(self.page.locator('[data-path-quiz="basic"]').is_disabled())
        self.assertTrue(self.page.locator('[data-path-section="sixteenth-notes"]').is_disabled())
        self.assertFalse(self.page.evaluate('pathUI.openQuiz("full")'))
        self.assertEqual(self.page.locator('[data-path-practice]').count(),0)
        self.finish_section('note-parts')
        self.assertIsNone(self.page.evaluate('localStorage.getItem(CodaClassroomQuiz.KEY)'))
        for section in self.page.evaluate('category.sections.filter(s=>s.tier==="basic"&&s.id!=="note-parts").map(s=>s.id)'):
            self.finish_section(section)
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertTrue(self.page.locator('[data-path-section="sixteenth-notes"]').is_disabled())
        self.finish_quiz('basic')
        self.assertGreater(self.state()['basicsPassedAt'],0)
        self.assertIsNone(self.page.evaluate('localStorage.getItem(CodaClassroomQuiz.KEY)'))
        self.assertIsNone(self.page.evaluate('localStorage.getItem(CodaClassroomTutorials.KEY)'))
        self.assertTrue(self.page.locator('[data-path-section="sixteenth-notes"]').is_enabled())
        self.page.locator('[data-path-practice]').click()
        self.assertEqual(self.page.evaluate('practice'),1)
        self.assertEqual(self.page.evaluate('rewards'),[])
        for section in self.page.evaluate('category.sections.filter(s=>s.tier==="advanced").map(s=>s.id)'):
            self.finish_section(section)
        self.page.evaluate('rewardFail=true')
        self.finish_quiz('full')
        self.page.wait_for_function('pathUI.getState().phase==="reward"&&!pathUI.getState().claiming')
        self.assertIn('unavailable',self.state()['error'])
        self.assertEqual(self.page.evaluate('rewards'),[])
        self.assertTrue(self.page.locator('[data-path-save]').is_visible())
        self.page.evaluate('rewardFail=false')
        self.page.locator('[data-path-save]').click()
        self.page.wait_for_function('pathUI.getState().phase==="complete"')
        self.assertEqual(self.page.evaluate('rewards'),['rhythm-tree'])
        self.assertTrue(self.page.evaluate('JSON.parse(localStorage.getItem(CodaClassroomTutorials.KEY)).lessons["rhythm-tree"].completed'))
        self.assertTrue(self.page.evaluate('JSON.parse(localStorage.getItem(CodaClassroomQuiz.KEY)).quizzes["rhythm-tree"].bestAnswers.length===5'))

    def test_note_part_diagram_is_readable_on_phone_and_failed_progress_retries(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('[data-path-section="note-parts"]').click()
        svg=self.page.locator('.learning-note-parts')
        self.assertIn('Notehead on a eighth note',svg.get_attribute('aria-label'))
        self.assertEqual(self.page.locator('[data-study-answer]').count(),0)
        self.assertGreaterEqual(svg.evaluate('node=>node.getBoundingClientRect().width/node.viewBox.baseVal.width*24'),18)
        self.assertFalse(self.page.evaluate('document.documentElement.scrollWidth>innerWidth'))
        self.page.locator('#mount').screenshot(path='/tmp/classroom-note-parts-phone.png')
        self.page.locator('[data-study-try]').click()
        self.page.locator('[data-study-answer="1"]').click()
        self.assertEqual(self.state()['study']['passed'],[])
        self.page.evaluate('quota=true')
        self.page.locator('[data-study-answer="0"]').click()
        self.assertFalse(self.state()['study']['saved'])
        self.assertTrue(self.page.locator('[data-study-next]').is_disabled())
        self.page.evaluate('quota=false')
        self.page.locator('[data-study-save]').click()
        self.page.locator('[data-study-next]').click()
        self.assertEqual(self.state()['study']['index'],0)
        self.assertEqual(self.state()['study']['checkIndex'],1)
        for _ in range(2):
            self.page.locator('[data-study-answer="'+str(self.current_check()['correct'])+'"]').click()
            self.page.locator('[data-study-next]').click()
        self.assertEqual(self.state()['study']['index'],1)
        self.assertIn('Stem',svg.get_attribute('aria-label'))
        self.page.locator('[data-path-menu]').click()
        self.assertEqual(self.state()['sections'][0]['passed'],1)
        self.assertFalse(self.state()['sections'][0]['completed'])
        self.page.reload()
        self.page.wait_for_function('window.pathUI')
        self.page.locator('[data-path-section="note-parts"]').click()
        self.assertEqual(self.state()['study']['index'],1)

    def test_both_clef_categories_teach_the_sign_before_any_note_naming_and_block_stale_profile(self):
        for category in ['note-naming','bass-clef']:
            self.page.evaluate('(id)=>mountPath(id)',category)
            sections=self.page.evaluate('window.category.sections.filter(s=>s.tier==="basic").map(s=>s.id)')
            for section in sections:
                if section=='staff-and-clef':
                    break
                self.finish_section(section)
            self.page.locator('[data-path-section="staff-and-clef"]').click()
            self.assertEqual(self.page.locator('[data-study-answer]').count(),0)
            self.assertIn('staff',self.page.locator('.exam-study-teach').inner_text().lower())
            self.page.locator('[data-path-menu]').click()
            self.finish_section('staff-and-clef')
            self.assertTrue(self.state()['sections'][1 if category=='note-naming' else 0]['completed'])
        self.page.evaluate('allow=false')
        before=self.page.evaluate('localStorage.getItem(CodaClassroomLearningPaths.KEY)')
        self.assertFalse(self.page.evaluate('pathUI.openSection("bass-reminders")'))
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaClassroomLearningPaths.KEY)'),before)
        self.assertEqual(self.page.evaluate('rewards'),[])


if __name__=='__main__':
    unittest.main(verbosity=2)
