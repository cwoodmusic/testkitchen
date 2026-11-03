"""The unchanged bundled game reports a real tap round through a nested iframe."""
import importlib.util
import json
import mimetypes
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse

sys.dont_write_bytecode = True
ROOT=Path(__file__).resolve().parents[1]
PREFIX='/testkitchen/games/rhythm-room/'
ORIGIN='https://cwoodmusic.github.io'
PARENT=ORIGIN+'/testkitchen/rhythm-bundle-test.html'
spec=importlib.util.spec_from_file_location('bundled_rhythm_audio',Path(__file__).with_name('rhythm-count-in-browser.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)

HTML='''<!doctype html><meta charset="utf-8"><title>Local Rhythm bundle fixture</title>
<script>
window.ARCADE_ACCOUNTS_CONFIG={mode:'classroom',classroom:{enabled:true,privacy:true}};
window.__nativeStorage=localStorage;__nativeStorage.setItem('rhythm-room-practice-v1','PRIVATE OTHER PLAYER');
const values=new Map();window.__scopedStorage={__codaClassroomScoped:true,get length(){return values.size},
key:index=>[...values.keys()][index]??null,getItem:key=>values.get(String(key))??null,
setItem:(key,value)=>values.set(String(key),String(value)),removeItem:key=>values.delete(String(key))};
Object.defineProperty(window,'localStorage',{configurable:true,get:()=>__scopedStorage});
window.__bridgeResults=[];window.__bridgeReady=false;
addEventListener('message',event=>{
 const frame=document.querySelector('#cabinet'),message=event.data;
 if(event.origin!==location.origin||event.source!==frame?.contentWindow||message?.coda!==1||message.game!=='rhythm')return;
 if(message.type==='ready'){__bridgeReady=true;frame.contentWindow.postMessage({coda:1,type:'init',game:'rhythm',token:'local-bundle-session'},location.origin);}
 if(message.type==='result'&&message.token==='local-bundle-session')__bridgeResults.push(message);
});
</script><iframe id="cabinet" title="Rhythm Room" style="width:1400px;height:1100px;border:0" src="games/rhythm-room/?classroom=1"></iframe>'''


class RhythmBundleBridgeTests(unittest.TestCase):
 setUpClass=classmethod(fixture.RhythmCountInTests.setUpClass.__func__)
 tearDownClass=classmethod(fixture.RhythmCountInTests.tearDownClass.__func__)

 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1450,'height':1150})
  self.external=[];self.missing=[];self.responses=[];self.errors=[]
  self.context.route('https://**/*',lambda route:(self.external.append(route.request.url),route.abort()))
  self.context.route(ORIGIN+'/**',self.route)
  self.context.add_init_script(fixture.AUDIO_PROBE)
  self.page=self.context.new_page();self.page.set_default_timeout(10000)
  self.page.on('pageerror',lambda error:self.errors.append(str(error)))
  self.page.on('response',lambda response:self.responses.append(response.url) if response.status==200 else self.missing.append(response.url) if response.status>=400 else None)
  self.page.goto(PARENT,wait_until='domcontentloaded')
  self.page.wait_for_function('__bridgeReady')
  self.child=next(frame for frame in self.page.frames if frame.parent_frame is not None)
  self.child.wait_for_function('window.RhythmRoomTiming&&document.querySelector("#choose-tap")')

 def route(self,route):
  path=unquote(urlparse(route.request.url).path)
  if route.request.url==PARENT:return route.fulfill(status=200,content_type='text/html',body=HTML)
  if path.endswith('/favicon.ico'):return route.fulfill(status=204)
  if not path.startswith(PREFIX):return route.fulfill(status=404,body='Unexpected local test URL')
  file=(ROOT/(path.removeprefix(PREFIX) or 'index.html')).resolve()
  if not file.is_relative_to(ROOT) or not file.is_file():return route.fulfill(status=404,body='Missing bundle resource')
  route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')

 def tearDown(self):
  self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.external,[]);self.assertEqual(self.missing,[])

 def seconds(self,time):
  self.child.evaluate('value=>__audioTestTime=value',time);self.page.wait_for_timeout(40)

 def test_real_nested_tap_result_keeps_same_origin_scoped_saves_and_local_assets(self):
  self.assertTrue(self.child.evaluate('CodaGamePrivacy.enabled&&localStorage===parent.localStorage&&localStorage.__codaClassroomScoped===true'))
  self.assertTrue(self.child.evaluate("async()=>{await document.fonts.load('64px Bravura');return document.fonts.check('64px Bravura')}"))
  self.child.locator('#choose-tap').click()
  self.child.locator('#practice-settings-button').click();self.child.locator('#count').uncheck();self.child.locator('#practice-settings-close').click()
  for node in self.child.locator('#choices input[type=checkbox]').all():node.set_checked(node.get_attribute('id')=='choose-quarter')
  self.child.locator('#play').click();self.child.wait_for_function('running&&!loading&&ctx&&snareBuffer')
  start=self.child.evaluate('origin+11.8*secondsPerQuarter()');self.seconds(start)
  round_data=self.child.evaluate('({start:tapRound.start,targets:tapRound.targets,spb:tapRound.spb})')
  for target in round_data['targets']:
   self.seconds(round_data['start']+target);self.child.locator('#tap-pad').focus();self.page.keyboard.press('Space')
  self.seconds(self.child.evaluate('origin+20.04*secondsPerQuarter()'))
  self.page.wait_for_function('__bridgeResults.length===1')
  result=self.page.evaluate('__bridgeResults[0]')
  self.assertEqual(result['token'],'local-bundle-session');self.assertEqual(result['game'],'rhythm')
  self.assertEqual(result['result']['mode'],'tap');self.assertTrue(result['result']['perfect'])
  self.assertEqual(result['result']['hits'],result['result']['total']);self.assertEqual(result['result']['extra'],0)
  self.assertEqual(self.child.evaluate('practiceHistory.length'),1)
  self.assertEqual(self.page.evaluate("__nativeStorage.getItem('rhythm-room-practice-v1')"),'PRIVATE OTHER PLAYER')
  self.assertEqual(self.child.evaluate("JSON.parse(localStorage.getItem('rhythm-room-practice-v1')).length"),1)
  self.assertTrue(any(url.startswith(ORIGIN+PREFIX) and url.endswith('/Bravura.woff') for url in self.responses))
  self.assertTrue(any(url.startswith(ORIGIN+PREFIX) and url.endswith('/snare.wav') for url in self.responses))
  self.assertTrue(self.child.evaluate('__audioProbe.decoded.some(buffer=>buffer.length>1000)'))
  self.child.locator('#stop').click();self.page.wait_for_timeout(30)
  self.assertEqual(self.page.evaluate('__bridgeResults.length'),1)


if __name__=='__main__':unittest.main(verbosity=2)
