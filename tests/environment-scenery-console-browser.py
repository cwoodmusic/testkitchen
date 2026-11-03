"""Versioned empty-backdrop projects and legacy editor compatibility.

The environment adapter is deterministic local artwork, so these checks exercise
project/rendering boundaries independently of image-generation revisions.
"""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('environment_console_fixture',
    Path(__file__).with_name('published-world-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)

LEGACY = copy.deepcopy(fixture.BLANK)
REFRESHED = {**LEGACY, 'scenery': 'environment-v1'}

STUB = '''(()=>{
 const raf=window.requestAnimationFrame.bind(window);
 // These tests inspect renderBase explicitly rather than starting the game loop.
 window.requestAnimationFrame=callback=>callback.name==='frame'?0:raf(callback);
 window.makeEnvironmentFixture=()=>{
  let loaded=false,resolve,reject;
  const background=document.createElement('canvas');background.width=1672;background.height=941;
  const g=background.getContext('2d');g.fillStyle='#123456';g.fillRect(0,0,1672,941);
  const sofa=document.createElement('canvas');sofa.width=288;sofa.height=105;
  const p=sofa.getContext('2d');p.fillStyle='#cc55aa';p.fillRect(1,1,286,103);
  const ready=new Promise((yes,no)=>{resolve=()=>{loaded=true;yes();};reject=no;});
  ready.catch(()=>{});
  const environment={ready,isReady:()=>loaded,background:()=>background,
    object:name=>loaded&&name==='lounge_sofa'?sofa:null,
    has:name=>name==='lounge_sofa',structural:()=>null};
  window.environmentFixture={environment,resolve,reject};
  if(window.environmentFixtureMode==='failed')queueMicrotask(()=>reject(Error('Test scenery decode failed')));
  else if(window.environmentFixtureMode!=='delayed')resolve();
  return environment;
 };
})();'''


class EnvironmentSceneryTests(unittest.TestCase):
    setUpClass = classmethod(fixture.PublishedWorldTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.PublishedWorldTests.tearDownClass.__func__)
    tearDown = fixture.PublishedWorldTests.tearDown
    load = fixture.PublishedWorldTests.load
    project = fixture.PublishedWorldTests.project
    reload = fixture.PublishedWorldTests.reload

    def setUp(self):
        fixture.PublishedWorldTests.setUp(self)
        self.context.add_init_script(STUB)
        self.context.route('**/environment-art.js*', lambda route: route.fulfill(
            status=200, content_type='text/javascript',
            body='window.CodaEnvironmentArt={create:window.makeEnvironmentFixture};'))
        source = (fixture.ROOT / 'developer-console.js').read_text()
        source += '''\nconst originalEnvironmentConsole=window.createCodaDeveloperConsole;
window.createCodaDeveloperConsole=api=>{const instance=originalEnvironmentConsole({...api,
 environmentArt:api.environmentArt||window.makeEnvironmentFixture()});window.environmentTestConsole=instance;return instance;};'''
        self.context.route('**/developer-console.js*', lambda route: route.fulfill(
            status=200, content_type='text/javascript', body=source))
        self.context.route('**/published-world-project.json*', lambda route: route.fulfill(
            status=200, content_type='application/json', body=json.dumps(REFRESHED)))

    def base_pixel(self):
        return self.page.evaluate('''()=>{
          const c=document.createElement('canvas');c.width=1672;c.height=941;
          const g=c.getContext('2d');environmentTestConsole.renderBase(g);
          return Array.from(g.getImageData(500,400,1,1).data);
        }''')

    def sofa_pixel(self):
        return self.page.evaluate('''()=>{
          const image=environmentTestConsole.originalPicture({origin:{
            name:'lounge_sofa',bounds:[124,132,288,105]}});
          return Array.from(image.getContext('2d').getImageData(20,50,1,1).data);
        }''')

    def import_project(self, data):
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.locator('#devImportFile').set_input_files({
            'name':'scenery.json','mimeType':'application/json',
            'buffer':json.dumps(data).encode()})
        expected = data.get('scenery')
        self.page.wait_for_function('(expected)=>(environmentTestConsole.getScenery()??null)===expected', arg=expected)
        self.page.evaluate('publishFrames(3)')

    def test_fresh_project_uses_real_empty_background_and_never_clone_fills_it(self):
        self.load()
        self.assertEqual(self.project(), REFRESHED)
        self.assertTrue(self.page.evaluate('environmentTestConsole.isRefreshedScenery()'))
        self.assertEqual(self.base_pixel(), [18,52,86,255])
        self.assertEqual(self.sofa_pixel(), [204,85,170,255])
        self.assertEqual(self.page.evaluate('''()=>{
          const c=document.createElement('canvas');c.width=1672;c.height=941;
          const g=c.getContext('2d');g.fillStyle='#789abc';g.fillRect(0,0,c.width,c.height);
          environmentTestConsole.renderCleanup(g);
          return Array.from(g.getImageData(200,180,1,1).data);
        }'''), [120,154,188,255])
        self.assertIsNone(self.page.evaluate('localStorage.getItem("codaWorldProjectV1")'))

    def test_legacy_local_project_stays_legacy_even_with_new_published_scenery(self):
        self.load(local=LEGACY)
        self.assertEqual(self.project(), LEGACY)
        self.assertFalse(self.page.evaluate('environmentTestConsole.isRefreshedScenery()'))
        self.page.evaluate('environmentTestConsole.open("project")')
        self.assertIn('Export a backup, then Reset project',self.page.locator('#devSceneryNotice').inner_text())
        self.assertNotEqual(self.sofa_pixel(), [204,85,170,255])
        self.assertTrue(self.page.evaluate('environmentTestConsole.save()'))
        self.reload()
        self.assertEqual(self.project(), LEGACY)
        for scenery in ['environment-v2', '', None, {}, 1]:
            self.assertFalse(self.page.evaluate('(project)=>environmentTestConsole.validate(project)',
                                               {**LEGACY,'scenery':scenery}))

    def test_import_undo_redo_export_and_reload_keep_the_scenery_source_in_sync(self):
        self.load(local=LEGACY)
        old_pixel = self.sofa_pixel()
        self.import_project(REFRESHED)
        self.assertEqual(self.project(), REFRESHED)
        self.assertEqual(self.sofa_pixel(), [204,85,170,255])
        self.page.evaluate('environmentTestConsole.undoRedo(true)')
        self.assertEqual(self.project(), LEGACY)
        self.assertEqual(self.sofa_pixel(), old_pixel)
        self.page.evaluate('environmentTestConsole.undoRedo(false)')
        self.assertEqual(self.sofa_pixel(), [204,85,170,255])
        with self.page.expect_download() as pending:
            self.page.evaluate('environmentTestConsole.exportProject()')
        self.assertEqual(json.loads(Path(pending.value.path()).read_text()), REFRESHED)
        self.assertTrue(self.page.evaluate('environmentTestConsole.save()'))
        self.reload()
        self.assertEqual(self.project(), REFRESHED)
        self.assertEqual(self.base_pixel(), [18,52,86,255])

    def test_new_scenery_waits_for_its_artwork_before_applying_or_becoming_ready(self):
        self.context.add_init_script("window.environmentFixtureMode='delayed'")
        self.page.goto(self.url, wait_until='domcontentloaded')
        self.page.wait_for_function('window.environmentFixture&&window.environmentTestConsole')
        self.assertFalse(self.page.evaluate('environmentTestConsole.loadReady()'))
        self.assertFalse(self.page.evaluate('environmentTestConsole.environmentReady()'))
        self.assertIsNone(self.page.evaluate('environmentTestConsole.getScenery()??null'))
        self.page.evaluate('environmentFixture.resolve()')
        self.page.wait_for_function('environmentTestConsole.loadReady()&&environmentTestConsole.loadReady()')
        self.assertEqual(self.project(), REFRESHED)
        self.assertEqual(self.base_pixel(), [18,52,86,255])

    def test_legacy_local_load_does_not_wait_for_pending_new_art(self):
        self.context.add_init_script("window.environmentFixtureMode='delayed'")
        self.load(local=LEGACY)
        self.assertEqual(self.project(), LEGACY)
        self.assertTrue(self.page.evaluate('environmentTestConsole.loadReady()'))
        self.assertFalse(self.page.evaluate('environmentTestConsole.environmentReady()'))
        self.assertEqual(self.page.evaluate('environmentTestConsole.getPublishedProject().scenery'), 'environment-v1')
        self.page.evaluate('environmentTestConsole.open("project")')
        self.page.locator('#devReset').click()
        self.assertEqual(self.project(), LEGACY)
        self.page.once('dialog', lambda dialog: dialog.accept())
        self.page.evaluate('environmentFixture.resolve()')
        self.page.wait_for_function('environmentTestConsole.isRefreshedScenery()')
        self.assertEqual(self.project(), REFRESHED)

    def test_unavailable_new_art_does_not_replace_an_existing_legacy_project(self):
        self.context.add_init_script("window.environmentFixtureMode='failed'")
        self.load(local=LEGACY)
        self.assertEqual(self.project(), LEGACY)
        self.assertFalse(self.page.evaluate('environmentTestConsole.isRefreshedScenery()'))
        self.page.evaluate('environmentTestConsole.open("project")')
        self.page.locator('#devReset').click()
        self.page.wait_for_function('document.querySelector("#devStatus").textContent.includes("Test scenery decode failed")')
        self.assertEqual(self.project(), LEGACY)
        self.assertNotEqual(self.sofa_pixel(), [204,85,170,255])


if __name__ == '__main__':
    unittest.main(verbosity=2)
