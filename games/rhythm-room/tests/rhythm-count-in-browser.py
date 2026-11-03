"""Actual pointer/Space input on the native-audio Rhythm Room timeline.

Only the AudioContext time getter is controlled; native sample decoding, audio
nodes, scheduling, animation frames, DOM input and app grading remain real.
External services are blocked and no Firebase data is written.
"""
import mimetypes
from contextlib import contextmanager
from pathlib import Path
import sys
import unittest
from urllib.parse import unquote, urlparse
from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
URL = 'https://cwoodmusic.github.io/testkitchen/games/rhythm-room/'
AUDIO_PROBE = r'''(()=>{
 window.__audioTestTime=0;window.__audioProbe={buffers:[],oscillators:[],decoded:[]};
 const P=AudioContext.prototype;
 Object.defineProperty(P,'currentTime',{configurable:true,get(){return window.__audioTestTime}});
 const decode=P.decodeAudioData;
 P.decodeAudioData=function(...args){return Promise.resolve(decode.apply(this,args)).then(buffer=>{
   __audioProbe.decoded.push({length:buffer.length,duration:buffer.duration,channels:buffer.numberOfChannels});return buffer;});};
 const create=P.createBufferSource;
 P.createBufferSource=function(...args){const node=create.apply(this,args),start=node.start;
  node.start=function(time,...rest){__audioProbe.buffers.push({time,length:node.buffer?.length||0,duration:node.buffer?.duration||0});return start.call(this,time,...rest)};return node;};
 const oscillator=P.createOscillator;
 P.createOscillator=function(...args){const node=oscillator.apply(this,args),start=node.start,set=node.frequency.setValueAtTime;
  node.frequency.setValueAtTime=function(value,...rest){node.__frequency=value;return set.call(this,value,...rest)};
  node.start=function(time,...rest){__audioProbe.oscillators.push({time,frequency:node.__frequency??node.frequency.value,type:node.type});return start.call(this,time,...rest)};return node;};
})()'''

class RhythmCountInTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.playwright.stop()
 def setUp(self):
  self.context=self.browser.new_context(viewport={'width':1400,'height':1050});self.context.route('https://**/*',lambda route:route.abort());self.context.route('https://cwoodmusic.github.io/testkitchen/games/rhythm-room/**',self.route)
  self.context.add_init_script(AUDIO_PROBE);self.page=self.context.new_page();self.page.set_default_timeout(10000);self.errors=[];self.missing=[]
  self.page.on('pageerror',lambda error:self.errors.append(str(error)));self.page.on('response',lambda response:self.missing.append(response.url) if response.status>=400 and response.url.startswith(URL) else None)
  self.page.goto(URL,wait_until='domcontentloaded');self.page.wait_for_function('window.RhythmRoomTiming&&document.querySelector("#choose-tap")')
  self.page.evaluate('''()=>{window.__reports=[];const report=CodaBridge.report;CodaBridge.report=function(id,result){__reports.push({id,result});return report.call(this,id,result)}}''')
 def route(self,route):
  path=unquote(urlparse(route.request.url).path).removeprefix('/testkitchen/games/rhythm-room/');file=(ROOT/(path or 'index.html')).resolve()
  if not file.is_relative_to(ROOT) or not file.is_file():return route.fulfill(status=404,body='Missing local resource')
  route.fulfill(path=str(file),content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream')
 def tearDown(self):
  try:self.page.evaluate('if(typeof stop==="function")stop()')
  finally:self.context.close()
  self.assertEqual(self.errors,[]);self.assertEqual(self.missing,[])
 def state(self):return self.page.evaluate('''()=>({running,loading,practiceMode,origin,count:$('count').checked,spb:60/+$('tempo').value,phase:$('tap-pad').dataset.phase||null,disabled:$('tap-pad').disabled,round:tapRound?{index:tapRound.index,start:tapRound.start,targets:tapRound.targets,matched:[...tapRound.matched],extras:tapRound.extras,taps:tapRound.taps}:null,history:practiceHistory,reports:__reports})''')
 @contextmanager
 def settings(self):
  dialog=self.page.locator('#practice-settings');opened=not dialog.is_visible()
  if opened:self.page.locator('#practice-settings-button').click()
  try:yield dialog
  finally:
   if opened and dialog.is_visible():self.page.locator('#practice-settings-close').click()
 def configure(self,**values):
  with RhythmCountInTests.settings(self):
   for name,value in values.items():
    control=self.page.locator('#'+name)
    if isinstance(value,bool):control.set_checked(value)
    else:control.select_option(str(value))
 def select(self,mode='tap',count=True,rest=False):
  self.page.locator('#choose-'+('tap' if mode=='tap' else 'follow')).click()
  RhythmCountInTests.configure(self,count=count)
  for node in self.page.locator('#choices input[type=checkbox]').all():node.set_checked(node.get_attribute('id') in (['choose-quarter','choose-quarter-rest'] if rest else ['choose-quarter']))
  if rest:
   self.page.evaluate('''()=>{let i=0;Math.random=()=>i++===0?.999:0}''');self.page.locator('#generate').click()
 def start(self):
  self.page.locator('#play').click();self.page.wait_for_function('running&&!loading&&ctx&&snareBuffer')
 def at(self,beat,paint=True):
  self.page.evaluate('beat=>{__audioTestTime=origin+(($('+'"count"'+').checked?4:0)+beat)*(60/+$('+'"tempo"'+').value)}',beat)
  if paint:self.page.wait_for_timeout(40)
 def seconds(self,time,paint=True):
  self.page.evaluate('time=>__audioTestTime=time',time)
  if paint:self.page.wait_for_timeout(40)
 def pointer(self):self.page.locator('#tap-pad').click()
 def space(self):self.page.locator('#tap-pad').focus();self.page.keyboard.press('Space')

 def test_recorded_snare_is_the_default_and_play_along_keeps_its_sixteen_beat_loop(self):
  self.assertEqual(self.page.locator('#sound').input_value(),'sample');self.assertEqual(self.page.locator('#repeatSound').input_value(),'sample')
  self.select('follow',False);self.start();self.at(0)
  self.assertTrue(self.page.evaluate('__audioProbe.decoded.some(buffer=>buffer.length>1000&&buffer.duration>.1)'))
  self.assertTrue(self.page.evaluate('__audioProbe.buffers.some(buffer=>buffer.length>1000)'))
  self.at(8);self.assertIn('Your turn',self.page.locator('#status').inner_text());self.assertTrue(self.page.locator('#tap-panel').is_hidden())
  self.at(16);self.assertEqual(self.page.evaluate('shownRound'),1);self.assertEqual(self.state()['history'],[]);self.assertEqual(self.state()['reports'],[])
  self.page.locator('#home-button').click();self.select('tap');self.assertEqual(self.page.locator('#repeatSound').input_value(),'off')
  self.page.locator('#home-button').click();self.select('follow');self.assertEqual(self.page.locator('#repeatSound').input_value(),'sample')

 def test_every_tap_turn_gets_four_count_beats_and_warmups_never_enter_the_score(self):
  self.select(count=False);self.start();self.at(7.99)
  self.assertEqual(self.state()['phase'],'listen')
  for beat,number in [(8,1),(9,2),(10,3),(11,4)]:
   self.at(beat);self.page.wait_for_function("document.querySelector('#tap-pad').dataset.phase==='count-in'")
   self.assertFalse(self.state()['disabled']);self.assertIn(str(number),self.page.locator('#status').inner_text())
   self.at(beat+.05);before=self.page.evaluate('__audioProbe.buffers.length');self.pointer();self.space();self.assertEqual(self.page.evaluate('__audioProbe.buffers.length'),before+2,'Warm-up pointer and Space both use the recorded snare');r=self.state()['round'];self.assertEqual(r['taps'],[]);self.assertEqual(r['matched'],[]);self.assertEqual(r['extras'],0)
  self.assertEqual(self.state()['history'],[]);self.assertEqual(self.state()['reports'],[])
  self.at(12);self.assertEqual(self.state()['phase'],'play')
  self.at(20);self.assertEqual(len(self.state()['history']),1)
  self.at(28);self.assertEqual(self.state()['phase'],'count-in');self.assertEqual(self.state()['round']['index'],1);self.assertIn('1',self.page.locator('#status').inner_text())
  self.at(31);self.assertIn('4',self.page.locator('#status').inner_text());self.at(32);self.assertEqual(self.state()['phase'],'play')
  clicks=self.page.evaluate('__audioProbe.oscillators.filter(item=>[850,1200].includes(item.frequency))')
  self.assertGreaterEqual(len(clicks),6)
  first=self.state()
  for number in range(4):
   expected=first['origin']+(8+number)*first['spb']
   self.assertEqual(sum(abs(click['time']-expected)<1e-8 for click in clicks),1,'Each preparation beat gets exactly one native metronome click')

 def test_early_first_tap_is_credited_once_and_a_boundary_repeat_cannot_penalize_it(self):
  self.select();self.start();self.at(11)
  r=self.state()['round'];self.seconds(r['start']-.15);self.pointer()
  self.assertEqual(self.state()['round']['matched'],[0]);self.assertEqual(self.page.locator('#tap-feedback').get_attribute('data-timing'),'good')
  self.seconds(r['start']);self.space();self.assertEqual(self.state()['round']['matched'],[0]);self.assertEqual(self.state()['round']['extras'],0)
  for target in r['targets'][1:]:self.seconds(r['start']+target);self.space()
  self.at(20);self.page.wait_for_function('practiceHistory.length===1')
  result=self.state()['history'][0];self.assertEqual(result['hits'],8);self.assertEqual(result['missed'],0);self.assertEqual(result['extra'],0);self.assertEqual(result['early'],0);self.assertEqual(result['late'],0)
  self.assertEqual(len(self.state()['reports']),1);self.assertTrue(self.state()['reports'][0]['result']['perfect'])
  self.page.wait_for_timeout(100);self.assertEqual(len(self.state()['reports']),1)

 def test_input_uses_the_live_clock_before_animation_frames_and_never_credits_an_opening_rest(self):
  self.select(count=False);self.start();self.at(7.99)
  self.assertFalse(self.state()['disabled'],'A still-listening paint must not disable an immediately upcoming count-in tap')
  self.at(8.01,paint=False);self.pointer();self.assertEqual(self.state()['round']['extras'],0)
  self.at(11.99);r=self.state()['round'];self.seconds(r['start'],paint=False);self.pointer();self.assertEqual(self.state()['round']['matched'],[0])
  self.page.locator('#home-button').click();self.select(count=False,rest=True);self.start();self.at(11)
  r=self.state()['round'];self.assertGreater(r['targets'][0],0)
  self.seconds(r['start']-.1);self.space();self.assertEqual(self.state()['round']['matched'],[]);self.assertEqual(self.state()['round']['extras'],0)
  self.seconds(r['start']+.05);self.pointer();self.assertEqual(self.state()['round']['matched'],[]);self.assertEqual(self.state()['round']['extras'],1)

 def test_stop_home_and_hidden_page_cancel_the_preparation_turn_without_a_result(self):
  for action in ['stop','home','hidden']:
   with self.subTest(action=action):
    if self.page.locator('#home').is_visible():self.select()
    self.start();self.at(10);before=self.state();self.space()
    if action=='stop':self.page.locator('#stop').click()
    elif action=='home':self.page.locator('#home-button').click()
    else:self.page.evaluate("()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));}")
    self.page.wait_for_function('!running&&!loading&&ctx===null')
    self.page.evaluate('__audioTestTime+=100');self.page.wait_for_timeout(100)
    self.assertTrue(self.state()['disabled']);self.assertIsNone(self.state()['round']);self.assertEqual(self.state()['history'],before['history']);self.assertEqual(self.state()['reports'],before['reports'])
    if action=='hidden':self.page.evaluate("()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));}")

 def test_home_during_native_sample_loading_cannot_restart_a_cancelled_session(self):
  self.select(count=False)
  self.page.evaluate('''()=>{const decode=AudioContext.prototype.decodeAudioData;AudioContext.prototype.decodeAudioData=function(...args){return decode.apply(this,args).then(buffer=>new Promise(resolve=>{window.__finishSampleLoad=()=>resolve(buffer)}));}}''')
  self.page.locator('#play').click();self.page.wait_for_function('loading&&typeof __finishSampleLoad==="function"')
  self.page.locator('#home-button').click();self.assertFalse(self.state()['running']);self.assertFalse(self.state()['loading'])
  self.page.evaluate('__finishSampleLoad()');self.page.wait_for_timeout(80)
  self.assertFalse(self.state()['running']);self.assertFalse(self.state()['loading']);self.assertIsNone(self.state()['round']);self.assertEqual(self.state()['history'],[]);self.assertEqual(self.state()['reports'],[])
  self.assertTrue(self.page.locator('#home').is_visible())

 def test_phone_count_in_keeps_the_real_tap_surface_large_and_visible(self):
  self.page.set_viewport_size({'width':390,'height':844});self.select(count=False);self.start();self.at(9)
  self.page.locator('#tap-pad').scroll_into_view_if_needed();box=self.page.locator('#tap-pad').bounding_box()
  self.assertGreaterEqual(box['width'],250);self.assertGreaterEqual(box['height'],100);self.assertLessEqual(box['y']+box['height'],844)
  self.pointer();self.assertEqual(self.state()['round']['extras'],0)
  self.page.screenshot(path='/tmp/rhythm48-count-in-phone.png')

if __name__=='__main__':unittest.main(verbosity=2)
