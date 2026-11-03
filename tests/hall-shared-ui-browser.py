"""Hall scopes use adapter results and never expose another player's response."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;padding:10px;background:#10101e;color:#e9def9;font:16px system-ui}button,select{font:inherit}#panel{width:min(620px,100%);padding:18px;border:2px solid #c69be9;border-radius:12px;background:#231c3b;margin:auto}.muted{color:#c1b4d7}button,select{background:#392f58;color:white;border:1px solid #ba8fdf;border-radius:6px;padding:9px 12px}</style>
<link rel="stylesheet" href="/hall-of-fame.css"><main id="panel"><h1 id="panelTitle">Hall fixture</h1><div id="panelBody"></div></main>
<script src="/hall-of-fame.js"></script><script>
const kind=new URL(location.href).searchParams.get('kind')||'guest';
window.sharedContext=kind==='student'?{identity:'student-a',student:true,classId:'class-a',classLabel:'Room 4',teacher:false,alias:'Blue Fox 14'}:
 kind==='teacher'?{identity:'teacher-a',student:false,classId:'not-authorized',classLabel:'Private class',teacher:true,alias:''}:
 {identity:'guest',student:false,classId:null,classLabel:'',teacher:false,alias:''};
window.sharedCalls=[];window.sharedResolvers=[];window.classCalls=0;window.writes=0;window.publications=[];window.legacyFetches=0;
window.classResult={ok:true,classes:[{classId:'class-a',label:'Room 4'},{classId:'class-b',label:'Room 5'}]};
window.resolveShared=(index,value)=>sharedResolvers[index](value);
window.achievementState={categories:[{id:'pitch',label:'Pitch Race'},{id:'fishing',label:'Fishing'}],items:[
 {id:'pitch-first',category:'pitch',title:'First Notes',description:'Finish a Pitch Race run.',earned:true},
 {id:'pitch-ten',category:'pitch',title:'Read Ten',description:'Read 10 notes correctly.',earned:false,progress:3,target:10}
]};
window.hall=CodaHallOfFame.create({panelBody,openPanel:title=>{panelTitle.textContent=title;panelBody.replaceChildren();},
 storage:{getItem(){return null;},setItem(){writes++;}},config:{mode:'classroom',classroom:{privacy:true}},
 getAvatar:()=>({name:'Private Learner Real Name'}),getNotes:()=>({rewards:[]}),
 getAchievements:()=>JSON.parse(JSON.stringify(achievementState)),
 getSharedContext:()=>({...sharedContext}),
 loadShared:input=>{sharedCalls.push({...input});return new Promise(resolve=>sharedResolvers.push(resolve));},
 listSharedClasses:async()=>{classCalls++;return JSON.parse(JSON.stringify(classResult));},
 publishRecord:async input=>{publications.push({...input});return {ok:true};},
 fetch:()=>{legacyFetches++;throw Error('The shared adapter must own network access');}
});window.ready=true;
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if urlsplit(self.path).path == '/hall-shared-fixture':
            body = FIXTURE.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            super().do_GET()


class HallSharedUITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',
            args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.context = self.browser.new_context(viewport={'width': 1280, 'height': 1000})
        self.page = self.context.new_page()
        self.errors, self.failures, self.external = [], [], []
        self.context.route('https://**/*', self.block_external)
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failures.append(response.url)
            if response.status >= 400 and not response.url.endswith('favicon.ico') else None)
        self.base = f'http://127.0.0.1:{self.server.server_port}/hall-shared-fixture'

    def block_external(self, route):
        self.external.append(route.request.url)
        route.abort()

    def tearDown(self):
        if self.page.locator('body').count():
            self.assertEqual(self.page.evaluate('window.legacyFetches||0'), 0)
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failures, [])
        self.assertEqual(self.external, [])

    def load(self, kind='guest'):
        self.page.goto(self.base+'?kind='+kind, wait_until='domcontentloaded')
        self.page.wait_for_function('window.ready')
        self.page.evaluate('hall.open()')

    def wait_calls(self, count):
        self.page.wait_for_function('count=>sharedCalls.length===count', arg=count)

    def answer(self, index, rows=None, **fields):
        response = {'ok':True, 'rows':[] if rows is None else rows, **fields}
        self.page.evaluate('({index,value})=>resolveShared(index,value)',
            {'index':index, 'value':response})

    def rows(self):
        return self.page.locator('.fame-leaderboard-row[data-row-id]')

    def test_guest_starts_with_personal_best_and_can_read_alias_only_global_scores(self):
        self.load()
        self.assertEqual(self.page.evaluate('hall.snapshot().recordsScope'), 'best')
        self.assertEqual(self.page.evaluate('sharedCalls.length'), 0)
        for scope, label in [('global','Global'),('class','My class'),('best','My best')]:
            self.assertEqual(self.page.locator('#fame-scope-'+scope).inner_text(), label)
        self.page.locator('#fame-scope-class').click()
        self.assertRegex(self.page.locator('.hall-of-fame').inner_text(), r'(?i)(player card|sign in)')
        self.assertEqual(self.page.evaluate('sharedCalls.length'), 0)
        self.page.locator('#fame-scope-global').click()
        self.wait_calls(1)
        self.assertEqual(self.page.evaluate('sharedCalls[0]'), {'scope':'global','board':'pitch-classic'})
        self.assertRegex(self.page.locator('.hall-of-fame').inner_text(), r'(?i)loading')
        self.answer(0, [
            {'id':'fox','alias':'Blue Fox 14','score':820,'tiebreak':10,'at':100},
            {'id':'owl','alias':'Green Owl 6','score':610,'tiebreak':8,'at':200},
            {'id':'untrusted','name':'Private Child Name','score':999,'tiebreak':9,'at':300}
        ], ownId='fox')
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertEqual(self.rows().count(), 2)
        text = self.rows().all_inner_texts()
        self.assertIn('Blue Fox 14', text[0])
        self.assertIn('Green Owl 6', text[1])
        self.assertNotIn('Private Child Name', self.page.locator('.hall-of-fame').inner_text())
        self.assertNotIn('Private Learner Real Name', self.page.locator('.hall-of-fame').inner_text())
        self.assertTrue(self.page.locator('[data-row-id="fox"]').evaluate('el=>el.classList.contains("is-you")'))
        self.assertEqual(self.page.evaluate('writes'), 0)
        self.assertEqual(self.page.evaluate('publications'), [])

    def test_active_student_defaults_to_their_class_and_boards_separate_each_game_mode(self):
        self.load('student')
        self.wait_calls(1)
        self.assertEqual(self.page.evaluate('hall.snapshot().recordsScope'), 'class')
        self.assertEqual(self.page.evaluate('sharedCalls[0]'), {'scope':'class','board':'pitch-classic','classId':'class-a'})
        self.assertIn('Room 4', self.page.locator('.hall-of-fame').inner_text())
        self.page.locator('#fame-game').select_option('triad')
        self.wait_calls(2)
        self.assertEqual(self.page.evaluate('sharedCalls[1].board'), 'triad-computer')
        self.page.locator('#fame-mode').select_option('multiplayer')
        self.wait_calls(3)
        self.assertEqual(self.page.evaluate('sharedCalls[2].board'), 'triad-multiplayer')
        self.answer(2, [{'id':'student-a','alias':'Blue Fox 14','score':9,'tiebreak':3,'at':100}], ownId='student-a')
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertIn('9', self.rows().inner_text())
        self.assertIn('cards', self.rows().inner_text())
        self.page.locator('#fame-game').select_option('rhythm')
        self.wait_calls(4)
        self.assertEqual(self.page.evaluate('sharedCalls[3].board'), 'rhythm-tap')
        self.answer(3, [{'id':'student-a','alias':'Blue Fox 14','score':96.25,'tiebreak':32,'at':100}])
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertIn('96.25', self.rows().inner_text())
        self.assertIn('%', self.rows().inner_text())

    def test_scope_and_identity_changes_discard_late_scores_from_the_previous_view(self):
        self.load('student')
        self.wait_calls(1)
        self.page.locator('#fame-scope-global').click()
        self.wait_calls(2)
        self.answer(0, [{'id':'old-class','alias':'Old Class Alias','score':999,'tiebreak':1,'at':1}])
        self.answer(1, [{'id':'global','alias':'Global Fox 2','score':700,'tiebreak':1,'at':1}])
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertNotIn('Old Class Alias', self.page.locator('.hall-of-fame').inner_text())
        self.page.locator('#fame-scope-class').click()
        self.wait_calls(3)
        self.page.evaluate('''()=>{
          sharedContext={identity:'student-b',student:true,classId:'class-b',classLabel:'Room 5',teacher:false,alias:'Red Owl 8'};
          hall.refresh();
        }''')
        self.wait_calls(4)
        self.assertEqual(self.page.evaluate('sharedCalls[3].classId'), 'class-b')
        self.answer(2, [{'id':'student-a','alias':'Previous Player Alias','score':1000,'tiebreak':1,'at':1}])
        self.answer(3, [{'id':'student-b','alias':'Red Owl 8','score':600,'tiebreak':1,'at':1}])
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertNotIn('Previous Player Alias', self.page.locator('.hall-of-fame').inner_text())
        self.assertIn('Red Owl 8', self.rows().inner_text())

    def test_failed_shared_read_retries_to_an_honest_empty_board(self):
        self.load()
        self.page.locator('#fame-scope-global').click()
        self.wait_calls(1)
        self.page.evaluate('resolveShared(0,{ok:false,code:"unavailable"})')
        self.page.wait_for_function('hall.snapshot().shared.status==="error"')
        retry = self.page.locator('#fame-shared-retry')
        self.assertTrue(retry.is_visible())
        retry.click()
        self.wait_calls(2)
        self.answer(1)
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertEqual(self.rows().count(), 0)
        self.assertRegex(self.page.locator('.hall-of-fame').inner_text(), r'(?i)(no .*score|no .*record|first .*score)')
        self.assertEqual(self.page.evaluate('publications'), [])

    def test_teacher_class_choices_come_only_from_the_authorized_class_list(self):
        self.load('teacher')
        self.page.locator('#fame-scope-class').click()
        self.page.wait_for_function('classCalls===1')
        self.wait_calls(1)
        options = self.page.locator('#fame-class option').evaluate_all('nodes=>nodes.map(node=>({value:node.value,text:node.textContent}))')
        self.assertEqual(options, [{'value':'class-a','text':'Room 4'},{'value':'class-b','text':'Room 5'}])
        self.assertNotIn('not-authorized', self.page.locator('#fame-class').inner_html())
        self.assertEqual(self.page.evaluate('sharedCalls[0].classId'), 'class-a')
        self.page.locator('#fame-class').select_option('class-b')
        self.wait_calls(2)
        self.assertEqual(self.page.evaluate('sharedCalls[1].classId'), 'class-b')
        self.answer(1)
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')

    def test_shared_refresh_preserves_achievement_filters_and_keyboard_focus(self):
        self.load()
        self.page.locator('#fame-scope-global').click()
        self.wait_calls(1)
        self.page.locator('#fame-tab-records').focus()
        self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'fame-tab-achievements')
        self.page.locator('#fame-achievement-status').select_option('locked')
        self.page.locator('#fame-achievement-category').select_option('pitch')
        self.page.locator('#fame-achievement-category').focus()
        self.answer(0, [{'id':'fox','alias':'Blue Fox 14','score':800,'tiebreak':2,'at':1}])
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        self.assertEqual(self.page.locator('#fame-tab-achievements').get_attribute('aria-selected'), 'true')
        self.assertEqual(self.page.locator('#fame-achievement-status').input_value(), 'locked')
        self.assertEqual(self.page.locator('#fame-achievement-category').input_value(), 'pitch')
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'fame-achievement-category')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(), 1)
        self.assertEqual(self.page.evaluate('writes'), 0)

    def test_phone_and_landscape_shared_controls_have_large_targets_without_overflow(self):
        self.load()
        self.page.locator('#fame-scope-global').click()
        self.wait_calls(1)
        self.answer(0, [{'id':'long-alias','alias':'Blue Fox With A Very Long Player Alias 14','score':999999,'tiebreak':99,'at':1}])
        self.page.wait_for_function('hall.snapshot().shared.status==="ready"')
        for width,height in [(320,568),(390,844),(844,390)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'), width)
            for selector in ['#fame-tab-records','#fame-tab-achievements',
                             '#fame-scope-global','#fame-scope-class','#fame-scope-best',
                             '#fame-game','#fame-mode']:
                bounds = self.page.locator(selector).bounding_box()
                self.assertGreaterEqual(bounds['width'], 44, selector)
                self.assertGreaterEqual(bounds['height'], 44, selector)
                self.assertGreaterEqual(bounds['x'], 0, selector)
                self.assertLessEqual(bounds['x']+bounds['width'], width, selector)
        self.assertEqual(self.page.evaluate('writes'), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
