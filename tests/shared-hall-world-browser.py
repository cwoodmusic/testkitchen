"""Assembled Hall views use the real adapter with synthetic, local-only scores."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import parse_qs, urlparse

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('shared_hall_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)
OUT = Path('/workspace/.onboarding/shared-hall')

PROBE = r'''(()=>{
 if(window.__hallWorldProbeInstalled)return;window.__hallWorldProbeInstalled=true;
 window.__hallClassReads=[];window.__hallPublishCalls=[];
 let classroom,library;
 Object.defineProperty(window,'CodaClassroom',{configurable:true,get(){return classroom;},set(value){
  classroom={...value,create(options){const service=value.create(options);return {...service,
   getHallContext(){return window.__hallStudentFixture?
    {identity:'synthetic-student',student:true,classId:'class_fixture_0001',classLabel:'Fixture music class',teacher:false,alias:'Blue Fox 14'}:service.getHallContext();},
   loadHallBoard(options){if(window.__hallStudentFixture&&options.scope==='class'){
    __hallClassReads.push(options);return Promise.resolve({ok:true,ownId:'profile_fixture_0001',rows:[
     {id:'profile_fixture_0001',alias:'Blue Fox 14',score:1234,tiebreak:30,at:1700000000000},
     {id:'profile_fixture_0002',alias:'Mint Owl 23',score:900,tiebreak:20,at:1700000000000}]});}
    return service.loadHallBoard(options);},
   publishHallRecord(row){__hallPublishCalls.push(row);return service.publishHallRecord(row);}
  };}};
 }});
 Object.defineProperty(window,'CodaHallOfFame',{configurable:true,get(){return library;},set(value){
  library={...value,create(options){return window.__hallWorldInstance=value.create(options);}};
 }});
})();'''


class SharedHallWorldTests(_world.WorldBrowserCase):
    def load(self):
        if not hasattr(self, 'shared_requests'):
            self.shared_requests = []
            self.sdk_requests = []
            self.context.add_init_script(PROBE)
            self.context.route('https://pitch-race-default-rtdb.firebaseio.com/classroomV1/hallOfFame/global/**', self.shared_board)
            self.context.on('request', lambda request: self.sdk_requests.append(request.url)
                            if '/firebasejs/' in request.url else None)
        super().load()

    def shared_board(self, route):
        self.shared_requests.append(route.request.url)
        rows = {
            'profile_fixture_0001': {'alias':'Blue Fox 14','score':123400,'tiebreak':30,'rank':123400*1000001+30,'at':1700000000000},
            'profile_fixture_0002': {'alias':'Mint Owl 23','score':90000,'tiebreak':20,'rank':90000*1000001+20,'at':1700000000000},
        }
        route.fulfill(status=200, content_type='application/json',
                      headers={'access-control-allow-origin':'*'}, body=json.dumps(rows))

    def open_hall(self):
        self.page.locator('#hallFameBtn').evaluate('button=>button.click()')
        self.page.wait_for_selector('#fame-scope-global')

    def preview(self, name):
        OUT.mkdir(parents=True, exist_ok=True)
        self.page.evaluate('''()=>{const p=document.createElement('p');p.textContent='Sample scores — local test';
          p.style.cssText='color:#b5f6df;font:700 14px system-ui';document.querySelector('#panelBody').prepend(p);}''')
        self.page.locator('#panel').screenshot(path=str(OUT/name))

    def test_guest_global_reads_real_adapter_without_auth_and_keeps_personal_records(self):
        self.page.evaluate('''()=>{localStorage.setItem(CodaHallOfFame.KEY,JSON.stringify({version:1,records:{
          'triad:computer':CodaHallOfFame.resultRow('triad','synthetic-completed-run',
           {mode:'computer',score:9,captures:4},'Fixture guest')}}));}''')
        self.load();self.open_hall()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.hallOfFame().recordsScope'), 'best')
        self.assertIn('9 cards', self.page.locator('.hall-of-fame').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.hallOfFame().records["triad:computer"].name'), 'Fixture guest')
        self.assertEqual(self.shared_requests, [])
        self.page.locator('#fame-scope-global').click()
        self.page.wait_for_selector('.fame-leaderboard-row')
        self.assertEqual(self.page.locator('.fame-leaderboard-row').count(), 2)
        self.assertIn('Blue Fox 14', self.page.locator('.fame-leaderboard-row').first.inner_text())
        self.assertRegex(self.page.locator('.fame-leaderboard-row').first.inner_text(), r'1,?234 points')
        query = parse_qs(urlparse(self.shared_requests[0]).query)
        self.assertEqual(query.get('orderBy'), ['"rank"'])
        self.assertEqual(query.get('limitToLast'), ['20'])
        self.assertEqual(self.sdk_requests, [], 'Reading global scores must not start Firebase Auth')
        self.preview('desktop.png')
        self.page.locator('#fame-scope-class').click()
        self.assertRegex(self.page.locator('.hall-of-fame').inner_text(), r'(?i)(player card|sign in|classroom profile)')
        self.page.locator('#fame-scope-best').click()
        self.assertIn('9 cards', self.page.locator('.hall-of-fame').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.hallOfFame().records["triad:computer"].score'), 9)
        self.page.locator('#fame-tab-achievements').click()
        self.page.locator('#fame-achievement-status').select_option('locked')
        self.assertTrue(self.page.locator('[data-achievement-id]').count() > 0)
        self.assertEqual(self.page.locator('[data-achievement-id][data-earned="true"]').count(), 0)

    def test_student_class_context_defaults_and_phone_controls_fit(self):
        self.context.add_init_script('window.__hallStudentFixture=true')
        self.load();self.open_hall()
        self.page.wait_for_selector('.fame-leaderboard-row')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.hallOfFame().recordsScope'), 'class')
        self.assertEqual(self.page.evaluate('__hallClassReads[0].classId'), 'class_fixture_0001')
        self.assertEqual(self.page.locator('.fame-leaderboard-row.is-you').count(), 1)
        self.page.set_viewport_size({'width':390,'height':844})
        metrics = self.page.locator('.hall-of-fame').evaluate('''section=>({
          width:innerWidth,scroll:document.documentElement.scrollWidth,
          targets:[...section.querySelectorAll('button,select')].filter(node=>node.getClientRects().length).map(node=>{
            const r=node.getBoundingClientRect();return {id:node.id,width:r.width,height:r.height};})})''')
        self.assertLessEqual(metrics['scroll'], metrics['width']+1)
        for target in metrics['targets']:
            self.assertGreaterEqual(target['width'], 44, target)
            self.assertGreaterEqual(target['height'], 44, target)
        self.preview('phone.png')

    def test_developer_preview_never_reads_or_publishes_shared_scores(self):
        self.page.goto(_world.WORLD+'?dev-test=1', wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()&&CodaArcadeQA?.testMode().seeded')
        self.open_hall();self.page.locator('#fame-scope-global').click()
        self.page.wait_for_function('CodaArcadeQA.hallOfFame().shared.status!=="loading"')
        self.assertEqual(self.shared_requests, [])
        self.assertTrue(self.page.evaluate('''__hallWorldInstance.record('triad','synthetic-preview-result',
          {mode:'computer',score:16,captures:4})'''))
        self.page.wait_for_timeout(50)
        self.assertEqual(self.page.evaluate('__hallPublishCalls'), [])
        self.assertEqual(self.sdk_requests, [])


if __name__ == '__main__': unittest.main(verbosity=2)
