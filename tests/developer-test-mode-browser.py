"""Unlock previews are playable and leave the real tab's private stores intact."""
import importlib.util
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse
from world_navigation_helpers import open_destination, open_cabinet

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('testmode_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)
WORLD=_world.WORLD
NATIVE_PROBE='''()=>{
 const snapshot=store=>Object.fromEntries(Array.from({length:store.length},(_,n)=>{const key=store.key(n);return [key,store.getItem(key)];}));
 return {local:snapshot(__nativeLocal),session:snapshot(__nativeSession),name:__nativeName};
}'''
BEFORE_BOOT='''(()=>{
 window.__nativeLocal=localStorage;window.__nativeSession=sessionStorage;window.__nativeName=window.name;
 const snapshot=store=>Object.fromEntries(Array.from({length:store.length},(_,n)=>{const key=store.key(n);return [key,store.getItem(key)];}));
 window.__beforeBoot={local:snapshot(localStorage),session:snapshot(sessionStorage),name:window.name};
})();'''
PREPARE='''<!doctype html><meta charset="utf-8"><script src="classroom-profile-data.js"></script><script src="classroom-storage.js"></script><p>Prepare a disposable browser-owned profile.</p>'''


class DeveloperTestModeBrowserTests(_world.WorldBrowserCase):
    def route_checkout(self,route):
        if urlparse(route.request.url).path=='/coda-arcade/testmode-prepare.html':
            return route.fulfill(status=200,content_type='text/html',body=PREPARE)
        return super().route_checkout(route)

    def setUp(self):
        super().setUp()
        self.context.add_init_script(BEFORE_BOOT)

    def wait_test_mode(self):
        self.page.wait_for_function('window.CodaArcadeQA?.testMode()?.seeded&&window.CodaDeveloperConsole?.ready()')
        self.page.locator('[data-developer-test-banner]').wait_for()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),50)
        self.assertTrue(self.page.evaluate('CodaArcadeQA.classroomSession().canPlay'))
        self.assertFalse(self.page.evaluate('CodaArcadeQA.classroomSession().student'))

    def assert_native(self,before):
        self.assertEqual(self.page.evaluate(NATIVE_PROBE),before)

    def test_real_console_opens_playable_all_unlocks_and_exit_restores_guest_without_writes(self):
        before=self.page.evaluate('''()=>{
          localStorage.setItem('test-native-sentinel','real guest');
          sessionStorage.setItem('test-native-session','real session');
          const snapshot=store=>Object.fromEntries(Array.from({length:store.length},(_,n)=>{const key=store.key(n);return [key,store.getItem(key)];}));
          return {local:snapshot(localStorage),session:snapshot(sessionStorage),name:window.name};
        }''')
        self.page.locator('#worldDeveloperBtn').click()
        self.page.locator('#devTestUnlocks').click()
        self.wait_test_mode()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.testMode().source'),'guest')
        self.assertIn('Real progress will not change',self.page.locator('[data-developer-test-banner]').inner_text())
        self.assert_native(before)
        self.assertTrue(self.page.evaluate('CodaClassroomProfileData.capture(localStorage).ok'))
        self.assertGreaterEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),1000000)
        self.assertTrue(self.page.evaluate('CodaNotesShop.stockForCatalog(createCodaCharacterRenderer().catalog).every(item=>CodaArcadeQA.notes().owned.includes(item.id))'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().unlockedSounds.length'),self.page.evaluate('CodaPlayerProgression.SOUNDS.length'))
        for vibe in ['glowstick','spooky','aurora','festival']:
            self.assertTrue(self.page.evaluate('id=>CodaArcadeQA.setVibe(id)',vibe))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'festival')
        open_destination(self.page,'boutique')
        for category in ['Hats','Glasses','Accessories','Shoes','Emotes','Transformations','Pets']:
            self.page.get_by_role('button',name='Browse '+category,exact=True).click()
            self.assertEqual(self.page.locator('.boutique-item:disabled').count(),0,category+' should be fully unlocked')
        self.page.locator('#panelClose').click()
        open_destination(self.page,'shop')
        self.assertGreater(self.page.locator('.notes-shop-card button').filter(has_text='Wear this').count(),20)
        self.page.locator('#panelClose').click()
        open_destination(self.page,'dj')
        self.assertEqual(self.page.locator('[data-house-track] button:disabled').count(),0,'Every built-in DJ track, including the sea shanty, is unlocked')
        self.page.locator('#panelClose').click()
        open_cabinet(self.page,3)
        composer=self.page.frame_locator('#gameiframe')
        composer.locator('#simpleSongGrid').wait_for()
        song_frame=self.page.locator('#gameiframe').element_handle().content_frame()
        self.assertTrue(song_frame.evaluate('window.localStorage===parent.localStorage'))
        self.assertEqual(song_frame.evaluate('songMachineBridge.progression().level'),50)
        starting_xp=song_frame.evaluate('songMachineBridge.progression().xp')
        composer.locator('#simpleSoundPicker').click()
        self.assertEqual(composer.locator('#simpleSoundList [data-sound-option]').count(),18)
        self.assertEqual(composer.locator('#simpleSoundList [data-locked="true"]').count(),0)
        composer.locator('#simpleSoundList [data-sound-option="17"]').click()
        self.assertEqual(song_frame.evaluate('songMachineBridge.get().tracks[0].sound'),17)
        composer.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="72"][data-step="16"]').click()
        composer.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="74"][data-step="20"]').click()
        composer.locator('#simplePlay').click()
        song_frame.wait_for_function('xp=>songMachineBridge.progression().xp>xp',arg=starting_xp)
        self.assert_native(before)
        composer.locator('#simpleStop').click();self.page.locator('#returnworld').click()
        self.page.evaluate('''()=>{
          localStorage.setItem('musicArcadeV1',JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),name:'Sandbox outfit'}));
          localStorage.setItem('codaWorldProjectV1','temporary map edits');
          sessionStorage.setItem('test-native-session','temporary session');
          let blocked=false;try{indexedDB.open('test-mode-must-not-touch-native-db');}catch(error){blocked=error.name==='SecurityError';}
          if(!blocked)throw Error('Native IndexedDB was not blocked');
          if(ARCADE_ACCOUNTS_CONFIG.enabled||ARCADE_ACCOUNTS_CONFIG.firebase)throw Error('Account configuration was not disabled');
        }''')
        self.assert_native(before)
        self.page.locator('[data-developer-test-exit]').click()
        self.page.wait_for_url(lambda url:'dev-test' not in str(url))
        self.page.wait_for_function('window.CodaArcadeQA?.notes()&&window.CodaDeveloperConsole?.ready()')
        self.assertEqual(self.page.evaluate('__beforeBoot'),before)
        self.assertFalse(self.page.evaluate('CodaDeveloperTestMode.isEnabled()'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),1)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertNotEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.name'),'Sandbox outfit')
        self.assertEqual(self.page.locator('[data-developer-test-banner]').count(),0)

    def test_owned_player_clones_only_owned_state_and_preserves_real_identity_on_exit(self):
        self.page.goto(WORLD.replace('world-preview.html','testmode-prepare.html'))
        before=self.page.evaluate('''()=>{
          const scope=CodaClassroomStorage.create({window,keys:CodaClassroomProfileData.SCOPED_KEYS});
          scope.claim({classId:'teacher_personal',profileId:'teacher_owner_123'});
          CodaClassroomProfileData.apply(localStorage,CodaClassroomProfileData.blank());
          localStorage.musicArcadeV1=JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),name:'Own player',shirt:'#116699'});
          localStorage['firebase:authUser:secret']='private auth';sessionStorage['firebase:session:secret']='private session';
          localStorage.codaArcadeVibeV1=JSON.stringify({version:1,selected:'spooky'});
          const snapshot=store=>Object.fromEntries(Array.from({length:store.length},(_,n)=>{const key=store.key(n);return [key,store.getItem(key)];}));
          return {local:snapshot(localStorage),session:snapshot(sessionStorage),name:window.name};
        }''')
        self.page.goto(WORLD+'?dev-test=1');self.wait_test_mode()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.testMode().source'),'own-player')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.name'),'Own player')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.shirt'),'#116699')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'spooky')
        self.assertIsNone(self.page.evaluate('localStorage["firebase:authUser:secret"]'))
        self.assertIsNone(self.page.evaluate('sessionStorage["firebase:session:secret"]'))
        self.assert_native(before)
        # A document reload snapshots the browser's underlying window.name
        # before pagehide can repair it. The sandbox name must stay virtual.
        for _ in range(2):
            self.page.reload(wait_until='domcontentloaded');self.wait_test_mode()
            self.assertEqual(self.page.evaluate('CodaArcadeQA.testMode().source'),'own-player')
            self.assertEqual(self.page.evaluate('__beforeBoot.name'),before['name'])
            self.assert_native(before)
        self.page.locator('[data-developer-test-exit]').click()
        self.page.wait_for_url(lambda url:'dev-test' not in str(url));self.page.wait_for_function('window.__beforeBoot&&window.CodaArcadeQA')
        self.assertEqual(self.page.evaluate('__beforeBoot'),before)

    def test_blocked_other_tab_never_imports_its_cached_player_or_composition(self):
        self.page.goto(WORLD.replace('world-preview.html','testmode-prepare.html'))
        before=self.page.evaluate('''()=>{
          const scope=CodaClassroomStorage.create({window,keys:CodaClassroomProfileData.SCOPED_KEYS});
          scope.claim({classId:'teacher_personal',profileId:'teacher_owner_123'});
          CodaClassroomProfileData.apply(localStorage,CodaClassroomProfileData.blank());
          localStorage.musicArcadeV1=JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),name:'Other student'});
          localStorage.codaDJLibraryV1='Private composition';window.name='A different tab';
          const snapshot=store=>Object.fromEntries(Array.from({length:store.length},(_,n)=>{const key=store.key(n);return [key,store.getItem(key)];}));
          return {local:snapshot(localStorage),session:snapshot(sessionStorage),name:window.name};
        }''')
        self.page.goto(WORLD+'?dev-test=1');self.wait_test_mode()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.testMode().source'),'blank')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.characters().player.appearance.name'),'Test player')
        self.assertIsNone(self.page.evaluate('localStorage.codaDJLibraryV1'))
        self.assert_native(before)


if __name__=='__main__':unittest.main(verbosity=2)
