"""Actual connected-world head, Boot and UI with disposable Firebase emulators.

Only the test browser's config and SDK loader are injected. The HTML, gameplay,
profile/boutique UI, boot lifecycle, service, DTO and storage are production.
"""
import importlib.util
import json
from pathlib import Path
import urllib.parse
import unittest

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, expect

_spec=importlib.util.spec_from_file_location('coda_service_fixture',Path(__file__).with_name('classroom-service-browser.py'))
fixture=importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)


class ClassroomWorldBrowserTests(unittest.TestCase):
    setUpClass=classmethod(fixture.ClassroomServiceBrowserTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.ClassroomServiceBrowserTests.tearDownClass.__func__)
    setUp=fixture.ClassroomServiceBrowserTests.setUp
    tearDown=fixture.ClassroomServiceBrowserTests.tearDown
    device=fixture.ClassroomServiceBrowserTests.device
    start=fixture.ClassroomServiceBrowserTests.start
    call=fixture.ClassroomServiceBrowserTests.call
    assert_ok=fixture.ClassroomServiceBrowserTests.assert_ok
    cloud=fixture.ClassroomServiceBrowserTests.cloud

    def world(self):
        context=self.browser.new_context(viewport={'width':1280,'height':900})
        self.contexts.append(context)
        self.world_requests=[];self.world_navigations=[];self.failed_assets=[]
        config={'enabled':True,'mode':'classroom','classroom':{'enabled':True,'privacy':True,'namespace':'classroomV1','emulators':{'auth':'http://'+fixture.AUTH_HOST,'database':{'host':'127.0.0.1','port':int(fixture.DB_HOST.split(':')[1])}}},'firebase':{'apiKey':'fake-api-key','projectId':fixture.PROJECT,'databaseURL':'https://'+fixture.NS+'.firebaseio.com','authDomain':fixture.PROJECT+'.firebaseapp.com'}}
        sdk_wrapper=b'''
;(()=>{const api=window.CodaClassroom;window.CodaClassroom={...api,create:options=>api.create({...options,sdkLoader:async()=>window.fixtureSDK})};
const read=fixtureSDK.get;fixtureSDK.get=async reference=>{if(window.fixtureHoldLookup&&String(reference).includes('/passes/')){window.fixtureLookupHeld=true;await new Promise(resolve=>window.fixtureReleaseLookup=()=>{window.fixtureHoldLookup=false;resolve();});}return read(reference);};})();
'''
        game_page='''<!doctype html><meta charset="utf-8"><title>Emulated cabinet boundary</title><script>
window.fixtureBridge=null;addEventListener('message',event=>{if(event.data?.coda===1&&event.data.type==='init')window.fixtureBridge=event.data;});
parent.postMessage({coda:1,type:'ready',game:'pitch'},'*');
</script>Cabinet boundary fixture'''
        def route(request_route):
            url=urllib.parse.urlsplit(request_route.request.url)
            if url.hostname=='cwoodmusic.github.io' and url.path.startswith('/Pitch-Race/'):
                self.world_requests.append(request_route.request.url)
                request_route.fulfill(status=200,content_type='text/html',body=game_page)
            elif url.hostname!='127.0.0.1':
                self.external.append(request_route.request.url);request_route.abort()
            elif url.path=='/account-config.js':
                request_route.fulfill(status=200,content_type='text/javascript',body='window.ARCADE_ACCOUNTS_CONFIG='+json.dumps(config)+';')
            elif url.path=='/classroom-service.js':
                request_route.fulfill(status=200,content_type='text/javascript',body=self.server.sdk_bundle+(fixture.ROOT/'classroom-service.js').read_bytes()+sdk_wrapper)
            elif url.path=='/piano-lab.js':
                capture=b";(()=>{const create=window.createCodaPianoLab;window.createCodaPianoLab=options=>{window.fixturePianoReward=options.onReward;return create(options);};})();"
                request_route.fulfill(status=200,content_type='text/javascript',body=(fixture.ROOT/'piano-lab.js').read_bytes()+capture)
            else:
                request_route.continue_()
        context.route('**/*',route)
        page=context.new_page()
        page.add_init_script('window.fixtureTeacherToken='+json.dumps(self.token)+';')
        page.on('pageerror',lambda error:self.page_errors.append(str(error)))
        page.on('framenavigated',lambda frame:self.world_navigations.append(frame.url) if frame==page.main_frame else None)
        page.on('response',lambda response:self.failed_assets.append((response.status,response.url)) if response.status>=400 and urllib.parse.urlsplit(response.url).hostname=='127.0.0.1' else None)
        page.on('websocket',lambda socket:self.external.append(socket.url) if urllib.parse.urlsplit(socket.url).hostname!='127.0.0.1' else None)
        page.goto(self.url.rsplit('/',1)[0]+'/world-preview.html')
        self.ready(page)
        return page

    def ready(self,page,profile=None):
        page.wait_for_function('window.CodaArcadeQA&&window.CodaClassroomSession&&window.CodaDeveloperConsole?.ready?.()',timeout=30000)
        if profile:
            try:
                page.wait_for_function('id=>window.CodaClassroomSession?.getState().profile?.profileId===id&&!window.CodaClassroomSession?.getState().loading&&window.CodaArcadeQA?.classroomSession().canPlay',arg=profile['profileId'],timeout=30000)
            except Exception:
                print('World boot diagnostics:',page.evaluate('({url:location.pathname,session:window.CodaClassroomSession?.getState(),boot:window.CodaClassroomBoot?.getState(),qa:window.CodaArcadeQA?.classroomSession(),navigationCount:performance.getEntriesByType("navigation").length,body:document.body.innerText.slice(-500)})'))
                print('Observed world navigations:',len(self.world_navigations))
                raise
        else:
            page.wait_for_function('!CodaClassroomSession.getState().loading',timeout=30000)

    def open_card_ui(self,page):
        page.locator('#levelBtn').click()
        if page.locator('#classpassJoinInput').count()==0:
            page.get_by_role('button',name='Classroom profile',exact=True).click()
        expect(page.locator('#classpassJoinInput')).to_be_visible()

    def join_world(self,page,card=None):
        card=card or self.card
        self.open_card_ui(page)
        page.locator('#classpassJoinInput').fill(card['pass'])
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassJoin').click()
        self.ready(page,card)
        page.wait_for_function('!document.documentElement.classList.contains("classroom-preparing")')

    def enter_shop(self,page):
        page.locator('#panelClose').click() if page.locator('#panel').is_visible() else None
        point=page.evaluate('CodaArcadeQA.shopkeepers().find(person=>person.type==="shop").approaches.find(point=>CodaArcadeQA.walkable(point.x,point.y))')
        self.assertIsNotNone(point)
        self.assertTrue(page.evaluate('point=>CodaArcadeQA.place(point.x,point.y)',point))
        page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
        page.wait_for_function('document.querySelector("#status").textContent.includes("Visit Pip")')
        page.locator('#view').focus();page.keyboard.press('e')
        try:
            page.locator('#boutique-name').wait_for(state='visible',timeout=1500)
        except PlaywrightTimeoutError:
            self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
            page.locator('#view').focus();page.keyboard.press('e')
        expect(page.locator('#boutique-name')).to_be_visible()

    def enter_pitch(self,page):
        if page.locator('#panel').is_visible():
            page.locator('#panelClose').click()
        game=page.evaluate('CodaArcadeQA.worldObjects().find(object=>object.game?.index===0).game')
        candidates=[{'x':game.get('npcX',game['x']),'y':game.get('npcY',323)}]
        candidates += [{'x':game['x']+dx,'y':game['y']+dy} for dy in [35,50,65,-35] for dx in [0,-15,15]]
        for point in candidates:
            if not page.evaluate('point=>CodaArcadeQA.place(point.x,point.y)',point):
                continue
            page.wait_for_function('document.querySelector("#status").textContent.includes("E")')
            page.locator('#view').focus();page.keyboard.press('e')
            if page.locator('#gameoverlay').is_visible():
                break
        expect(page.locator('#gameoverlay')).to_be_visible()
        src=page.locator('#gameiframe').get_attribute('src')
        self.assertEqual(urllib.parse.parse_qs(urllib.parse.urlsplit(src).query).get('classroom'),['1'])
        self.assertEqual(page.locator('#externalgame').count(),0)
        frame=page.frame_locator('#gameiframe')
        expect(frame.locator('body')).to_contain_text('Cabinet boundary fixture')
        page.wait_for_function('document.querySelector("#gameiframe").contentWindow!==null')
        child=page.frames[-1]
        child.wait_for_function('window.fixtureBridge?.token')
        return child.evaluate('fixtureBridge')

    def test_real_world_joins_once_resumes_stably_and_profile_boutique_use_alias(self):
        page=self.world()
        page.evaluate('localStorage.musicArcadeV1=JSON.stringify({version:1,name:"PRIVATE WORLD GUEST"});localStorage.codaPianoTakeV1="GUEST TAKE"')
        self.join_world(page)
        navigations=len(self.world_navigations)
        self.assertEqual(navigations,2,'Initial load and one identity reload')
        page.wait_for_timeout(2200)
        self.assertEqual(len(self.world_navigations),navigations,'Resume must not repeatedly reload')
        self.assertEqual(page.evaluate('CodaArcadeQA.classroomSession().alias'),self.card['alias'])
        page.locator('#levelBtn').click()
        expect(page.locator('.profile-identity h2')).to_have_text(self.card['alias'])
        page.get_by_role('button',name='Classroom profile',exact=True).click()
        expect(page.locator('#panelBody')).to_contain_text(self.card['alias'])
        page.locator('#panelClose').click()
        self.enter_shop(page)
        expect(page.locator('#boutique-name')).to_have_value(self.card['alias'])
        self.assertTrue(page.locator('#boutique-name').evaluate('input=>input.readOnly'))
        self.assertEqual(page.locator('#boutique-target option').count(),1)
        self.assertFalse(page.evaluate('CodaDeveloperConsole.open()'))
        page.keyboard.press('Escape');page.keyboard.press('F2')
        self.assertFalse(page.evaluate('CodaDeveloperConsole.getState().open'))
        self.assertEqual(self.failed_assets,[])
        page.locator('#levelBtn').click();page.get_by_role('button',name='Classroom profile',exact=True).click()
        page.locator('#classpassLeave').click()
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassConfirm').click()
        page.wait_for_url('**/index.html')
        expect(page.locator('#titleGuest')).to_be_visible()
        page.wait_for_timeout(400)
        self.assertEqual(len(self.world_navigations),navigations+1,'Leaving returns to the title after restoring guest data')
        self.assertEqual(page.evaluate('JSON.parse(localStorage.musicArcadeV1).name'),'PRIVATE WORLD GUEST')
        self.assertEqual(page.evaluate('localStorage.codaPianoTakeV1'),'GUEST TAKE')

    def test_real_cabinet_and_old_reward_callbacks_pause_during_switch_and_lock(self):
        page=self.world();self.join_world(page)
        packet=self.enter_pitch(page)
        page.frames[-1].evaluate('parent.postMessage({...fixtureBridge,type:"result",runId:"world-live-round",result:{mode:"classic",score:10,correct:10,misses:0,streak:10,won:true,perfect:true}},"*")')
        page.wait_for_function('CodaArcadeQA.progression().xp>0&&CodaArcadeQA.notes().balance>150')
        before=page.evaluate('({wallet:CodaArcadeQA.notes(),xp:CodaArcadeQA.progression().xp})')
        next_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(next_card)
        page.evaluate('pass=>{window.fixtureHoldLookup=true;window.fixtureSwitch=CodaClassroomSession.join(pass);}',next_card['pass'])
        page.wait_for_function('window.fixtureLookupHeld&&CodaClassroomSession.getState().loading')
        self.assertFalse(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        expect(page.locator('#gameoverlay')).to_be_hidden()
        rejected=page.evaluate('fixturePianoReward("piano-lesson:twinkle",24)')
        self.assertFalse(rejected['ok'])
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),before['wallet']['balance'])
        page.evaluate('packet=>dispatchEvent(new MessageEvent("message",{data:{...packet,type:"result",runId:"late-switch",result:{mode:"classic",score:10,correct:10,misses:0,streak:10,won:true,perfect:true}},source:document.querySelector("#gameiframe").contentWindow,origin:"https://cwoodmusic.github.io"}))',packet)
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),before['xp'])
        with page.expect_navigation(wait_until='load'):
            page.evaluate('fixtureReleaseLookup()')
        self.ready(page,next_card)
        # Another tab takes the native workspace. The old realm remains loaded
        # behind its lock so old room callbacks can be tested after revocation.
        third_card=self.call(self.admin,'createProfile',self.class_id);self.assert_ok(third_card)
        other=self.device(page.context)
        self.assert_ok(self.call(other,'join',third_card['pass']))
        page.wait_for_function('CodaClassroomSession.getState().locked')
        self.assertFalse(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(page.evaluate('fixturePianoReward("piano-lesson:mary",24).ok'))
        self.assertEqual(other.evaluate('CodaClassroomProfileData.capture(localStorage).data.wallet.balance'),150)
        self.assertEqual(other.evaluate('CodaClassroomProfileData.capture(localStorage).data.progression.xp'),0)

    def teacher_entry(self,page):
        page.goto(self.url.rsplit('/',1)[0]+'/index.html')
        page.locator('#titleTeacher').click()
        self.ready(page)
        return page

    def test_main_site_teacher_first_save_and_title_return_keep_progress_and_developer_access(self):
        page=self.world()
        page.evaluate('''()=>{
          const data=CodaClassroomProfileData.capture(localStorage).data;
          data.progression.events=[{id:'game:world-fixture',xp:480}];data.progression.xp=480;
          data.wallet.balance=370;data.wallet.earned=370;data.wallet.rewards=['game:world-fixture'];
          CodaClassroomProfileData.apply(localStorage,data);
          const avatar=JSON.parse(localStorage.musicArcadeV1);
          Object.assign(avatar,{name:'Mr Wood',shirt:'#7252b5',headwear:'beanie'});
          localStorage.musicArcadeV1=JSON.stringify(avatar);
        }''')
        self.teacher_entry(page)
        page.locator('#classpassAdminSignIn').click()
        expect(page.locator('#classpassPersonalSave')).to_be_enabled()
        self.assertIsNone(fixture.database('classroomV1/teacherPlayers/'+self.teacher_uid))
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),480)
        page.locator('#classpassPersonalSave').click()
        expect(page.locator('#panelBody')).to_contain_text('Mr Wood')
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassConfirm').click()
        self.ready(page,{'profileId':self.teacher_uid})
        navigations=len(self.world_navigations)
        page.wait_for_timeout(1800)
        self.assertEqual(len(self.world_navigations),navigations,'Personal resume must not reload repeatedly')
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),370)
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),480)
        self.assertFalse(page.evaluate('CodaArcadeQA.classroomSession().student'))
        page.locator('#panelClose').click() if page.locator('#panel').is_visible() else None
        page.evaluate('CodaDeveloperConsole.open()')
        self.assertTrue(page.evaluate('CodaDeveloperConsole.getState().open'))
        page.keyboard.press('F2')
        self.teacher_entry(page)
        self.ready(page,{'profileId':self.teacher_uid})
        expect(page.locator('#classpassAdminSignIn')).to_have_count(0)
        expect(page.locator('#classpassPersonalOpen')).to_have_text('Your player is open')
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),370)
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),480)
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignOut').click()
        page.wait_for_url('**/index.html')
        expect(page.locator('#titleGuest')).to_be_visible()
        self.assertIsNone(page.evaluate('sessionStorage.getItem("codaClassroomAdminTabV1")'))
        page.locator('#titleGuest').click()
        self.ready(page)
        page.wait_for_function('!CodaClassroomSession.getState().admin.signedIn&&!CodaClassroomSession.getState().profile')
        self.assertTrue(page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),370)
        self.assertEqual(self.failed_assets,[])

    def test_main_site_other_device_sign_in_opens_the_saved_teacher_player(self):
        self.admin.evaluate('fixtureProgress(830,420)')
        self.admin.evaluate('localStorage.musicArcadeV1=JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),name:"Mr Wood",shirt:"#146f85",headwear:"beanie"})')
        self.assert_ok(self.call(self.admin,'savePersonalPlayer'))
        page=self.teacher_entry(self.world())
        with page.expect_navigation(wait_until='load'):
            page.locator('#classpassAdminSignIn').click()
        self.ready(page,{'profileId':self.teacher_uid})
        self.assertEqual(page.evaluate('CodaArcadeQA.progression().xp'),830)
        self.assertEqual(page.evaluate('CodaArcadeQA.notes().balance'),570)
        self.assertEqual(page.evaluate('CodaArcadeQA.classroomSession().alias'),'Mr Wood')
        self.assertEqual(page.evaluate('CodaArcadeQA.characters().player.appearance.shirt'),'#146f85')
        self.assertFalse(page.evaluate('CodaArcadeQA.classroomSession().student'))
        self.assertIsNone(fixture.database('classroomV1/sessions'))
        self.assertEqual(self.failed_assets,[])


if __name__=='__main__':
    unittest.main(verbosity=2)
