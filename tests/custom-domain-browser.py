"""Actual arcade/game files at the custom domain, with static Worker routing.

All HTTP resources are served from the sibling checkouts; external services are
blocked. The local storage-boundary case uses the real storage facade with
synthetic ownership markers, not a Firebase authentication or permission bypass.
"""
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import parse_qs, unquote, urlparse

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode=True
from world_navigation_helpers import open_cabinet

ROOT=Path(__file__).resolve().parents[1]
SITE='https://www.coda-arcade.com'
PROJECTS={name:ROOT.parent/name for name in ('Pitch-Race','musictriad','rhythmroom')}
PITCH={'mode':'classic','score':3,'correct':3,'misses':0,'streak':3,'won':True,'perfect':True,
       'staff':'treble','clefStats':{'treble':{'correct':3,'misses':0,'bestStreak':3},'bass':{'correct':0,'misses':0,'bestStreak':0}}}
TRIAD={'mode':'computer','rules':'simple','difficulty':'normal','score':6,'captures':2,'won':True,'comeback':False}
RHYTHM={'mode':'tap','total':8,'hits':8,'extra':0,'early':0,'late':0,'accuracy':100,'perfect':True}


class CustomDomainTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw=sync_playwright().start()
        cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.pw.stop()

    def setUp(self):
        self.errors=[];self.missing=[];self.external=[];self.requests=[]
        self.context=self.browser.new_context(viewport={'width':1600,'height':1000},reduced_motion='reduce')
        self.prepare(self.context)
        self.page=self.context.new_page();self.page.set_default_timeout(15000)

    def prepare(self,context):
        context.add_init_script("if(window===window.top&&location.origin==='https://www.coda-arcade.com')localStorage.setItem('codaArcadeFXV1','off')")
        context.route('https://**/*',self.route_static_worker)
        context.on('request',lambda request:self.requests.append(request.url))
        context.on('page',lambda page:page.on('pageerror',lambda error:self.errors.append(str(error))))

    def route_static_worker(self,route):
        parsed=urlparse(route.request.url)
        if parsed.netloc!='www.coda-arcade.com':
            self.external.append(route.request.url);return route.abort()
        path=unquote(parsed.path)
        if path=='/favicon.ico':return route.fulfill(status=204)
        name=next((name for name in PROJECTS if path.startswith('/'+name+'/')),None)
        base=PROJECTS[name] if name else ROOT
        relative=path.removeprefix('/'+name+'/') if name else path.lstrip('/')
        file=(base/(relative or 'index.html')).resolve()
        if not file.is_relative_to(base.resolve()) or not file.is_file():
            self.missing.append(path);return route.fulfill(status=404,body='Missing static fixture resource')
        return route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors,[],'Actual page/frame JavaScript errors')
        self.assertEqual(self.missing,[],'Worker-mapped assets must resolve')
        self.assertEqual(self.external,[],'No SDK or external service should load before an online action')

    def world(self,page=None):
        page=page or self.page
        page.goto(SITE+'/world-preview.html',wait_until='domcontentloaded')
        page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()&&window.CodaClassroomSession')
        self.assertTrue(page.evaluate('CodaClassroomSession.getState().configured'))
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().privacy'))
        return page

    def cabinet(self,index):
        open_cabinet(self.page,index)
        self.page.wait_for_function('!document.querySelector("#gameoverlay").hidden')
        url=self.page.locator('#gameiframe').get_attribute('src')
        self.assertEqual(urlparse(url).netloc,'www.coda-arcade.com')
        self.assertEqual(parse_qs(urlparse(url).query).get('classroom'),['1'])
        frame=self.page.locator('#gameiframe').element_handle().content_frame()
        if index<3:
            frame.wait_for_function('window.CodaBridge&&window.CodaGamePrivacy')
            self.assertTrue(frame.evaluate('CodaGamePrivacy.enabled'))
        else:
            frame.wait_for_function('window.songMachineBridge&&window.CodaSongSimpleMode')
        self.assertTrue(frame.evaluate('localStorage.__codaClassroomScoped===true'))
        return frame

    def test_world_cabinets_keep_scoped_storage_and_reward_connections_at_custom_origin(self):
        self.world()
        for index,result in enumerate((PITCH,TRIAD,RHYTHM)):
            with self.subTest(game=index):
                frame=self.cabinet(index)
                self.page.wait_for_function('CodaArcadeQA.missions().connection?.connected===true')
                if index<2:
                    frame.wait_for_function('CodaBridge.getState().connected')
                balance=self.page.evaluate('CodaArcadeQA.notes().balance')
                frame.evaluate('([id,result])=>CodaBridge.report(id,result)',['custom-domain-fixture-'+str(index),result])
                self.page.wait_for_function('before=>CodaArcadeQA.notes().balance===before+16',arg=balance)
                self.page.locator('#returnworld').click()
        frame=self.cabinet(3)
        frame.locator('#simpleInstrument').wait_for(state='visible')
        self.assertEqual(frame.evaluate('songMachineBridge.get().tracks.length'),2)
        frame.locator('#simpleInstrument').select_option('add')
        self.assertEqual(frame.evaluate('songMachineBridge.get().tracks.length'),3)
        frame.locator('#simpleUndo').click()
        self.assertEqual(frame.evaluate('songMachineBridge.get().tracks.length'),2)
        self.page.locator('#returnworld').click()
        self.assertTrue(self.page.locator('#gameoverlay').is_hidden())

    def test_phone_multiplayer_panels_and_song_machine_stay_same_origin_without_cloud_startup(self):
        self.context.close()
        self.context=self.browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce')
        self.prepare(self.context);self.page=self.context.new_page();self.page.set_default_timeout(15000)
        self.world()
        pitch=self.cabinet(0)
        pitch.locator('#multiCard').click();pitch.locator('#menuPlay').click()
        self.assertTrue(pitch.locator('#multiCreate').is_visible())
        self.assertTrue(pitch.locator('#highScoresButton').is_hidden())
        self.assertFalse(pitch.evaluate('Boolean(window.firebase)'))
        self.page.locator('#returnworld').click()
        triad=self.cabinet(1)
        self.assertTrue(triad.locator('#vsClassmate').is_enabled())
        triad.locator('#vsClassmate').click();self.assertTrue(triad.locator('#mpPanel').is_visible())
        triad.locator('#tournamentMode').click();self.assertTrue(triad.locator('#tourneyPanel').is_visible())
        self.assertFalse(triad.evaluate('Boolean(window.firebase)'))
        self.page.locator('#returnworld').click()
        song=self.cabinet(3);self.assertTrue(song.locator('#simpleInstrument').is_visible())

    def test_classic_arcade_launches_all_games_under_the_custom_origin(self):
        self.page.goto(SITE+'/classic-arcade.html',wait_until='domcontentloaded')
        self.page.wait_for_function('window.CodaLandingQA')
        for index in range(4):
            with self.subTest(game=index):
                self.page.locator('[data-game="'+str(index)+'"]').click()
                src=self.page.locator('#gameframe').get_attribute('src')
                self.assertEqual(urlparse(src).netloc,'www.coda-arcade.com')
                self.assertEqual(parse_qs(urlparse(src).query).get('classroom'),['1'])
                frame=self.page.locator('#gameframe').element_handle().content_frame()
                frame.wait_for_function('window.CodaBridge' if index<3 else 'window.songMachineBridge')
                self.assertTrue(frame.evaluate('localStorage.__codaClassroomScoped===true'))
                self.page.locator('#back').click()
                self.assertTrue(self.page.locator('#gameview').is_hidden())

    def test_captured_child_store_cannot_read_or_overwrite_a_different_tabs_profile(self):
        self.world()
        self.page.evaluate('''()=>{
          CodaClassroomStorageInstance.claim({classId:'classroom_alpha',profileId:'profile_alpha'});
          localStorage.setItem('pitchRaceLevelProgressV1',JSON.stringify({version:1,bestCompleted:3}));
        }''')
        child=self.cabinet(0)
        self.assertEqual(child.evaluate('JSON.parse(localStorage.getItem("pitchRaceLevelProgressV1")).bestCompleted'),3)
        other=self.context.new_page();other.set_default_timeout(15000);self.world(other)
        other.evaluate('''()=>{
          CodaClassroomStorageInstance.claim({classId:'classroom_beta',profileId:'profile_beta'});
          localStorage.setItem('pitchRaceLevelProgressV1',JSON.stringify({version:1,bestCompleted:18}));
        }''')
        self.page.wait_for_function('CodaClassroomStorageInstance.getState().blocked===true')
        self.assertTrue(child.evaluate('localStorage.__codaClassroomScoped===true'))
        self.assertEqual(child.evaluate('JSON.parse(localStorage.getItem("pitchRaceLevelProgressV1")).bestCompleted'),3)
        child.evaluate('localStorage.setItem("pitchRaceLevelProgressV1",JSON.stringify({version:1,bestCompleted:99}))')
        self.assertEqual(other.evaluate('JSON.parse(localStorage.getItem("pitchRaceLevelProgressV1")).bestCompleted'),18)
        self.assertTrue(other.evaluate('CodaClassroomStorageInstance.getState().owned'))


if __name__=='__main__':
    unittest.main(verbosity=2)
