"""Inspect real Web Audio scheduling for repeating DJ selections and cleanup."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
from world_navigation_helpers import open_destination

_spec = importlib.util.spec_from_file_location('jukebox_loop_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)


class JukeboxLoopTests(_world.WorldBrowserCase):
    def setUp(self):
        super().setUp()
        self.page.evaluate('''()=>{
          const Audio=window.AudioContext||window.webkitAudioContext;
          window.jukeboxAudioProbe={contexts:[],starts:[],cancels:[]};
          const nativeTime=Object.getOwnPropertyDescriptor(BaseAudioContext.prototype,'currentTime').get;
          Object.defineProperty(Audio.prototype,'currentTime',{configurable:true,get(){return Number.isFinite(window.__jukeboxVirtualTime)?window.__jukeboxVirtualTime:nativeTime.call(this);}});
          const create=Audio.prototype.createOscillator;
          Audio.prototype.createOscillator=function(...args){
            const probe=window.jukeboxAudioProbe;
            let context=probe.contexts.indexOf(this);
            if(context<0){context=probe.contexts.length;probe.contexts.push(this);}
            const oscillator=create.apply(this,args),start=oscillator.start,stop=oscillator.stop;
            oscillator.start=function(when,...rest){probe.starts.push({context,when,frequency:this.frequency.value,type:this.type});return start.call(this,when,...rest);};
            oscillator.stop=function(...times){if(!times.length)probe.cancels.push(context);return stop.apply(this,times);};
            return oscillator;
          };
          const buffers=new WeakMap();let nextBuffer=0;
          const createBuffer=Audio.prototype.createBufferSource;
          Audio.prototype.createBufferSource=function(...args){
            const node=createBuffer.apply(this,args),start=node.start,stop=node.stop,probe=window.jukeboxAudioProbe;
            let context=probe.contexts.indexOf(this);if(context<0){context=probe.contexts.length;probe.contexts.push(this);}
            node.start=function(when,...rest){if(node.buffer&&!buffers.has(node.buffer))buffers.set(node.buffer,++nextBuffer);probe.starts.push({context,when,frequency:null,type:'buffer',buffer:node.buffer?buffers.get(node.buffer):0});return start.call(this,when,...rest);};
            node.stop=function(...times){if(!times.length)probe.cancels.push(context);return stop.apply(this,times);};return node;
          };
        }''')
        open_destination(self.page, 'dj')

    def state(self):
        return self.page.evaluate('CodaArcadeQA.jukebox()')

    def probe(self):
        return self.page.evaluate('''()=>({starts:jukeboxAudioProbe.starts,cancels:jukeboxAudioProbe.cancels,
          contexts:jukeboxAudioProbe.contexts.map(context=>({state:context.state,time:context.currentTime}))})''')

    def import_song(self, name='Loop fixture', pitch=60):
        song={'bpm':240,'bars':1,'meter':'4/4','root':0,'scale':'chromatic',
              'tracks':[{'id':1,'name':'Loop voice','sound':1,'volume':.3,'mute':False,
                         'notes':[{'p':pitch,'t':0,'d':4},{'p':pitch+7,'t':8,'d':4}]}],
              'drums':[{'sound':0,'volume':.2,'mute':False,'notes':[]} for _ in range(3)]}
        self.page.locator('#djSongImport').set_input_files({'name':name+'.json','mimeType':'application/json','buffer':json.dumps(song).encode()})
        button=self.page.get_by_role('button',name='Play '+name,exact=True)
        button.wait_for()
        return button

    def test_music_queues_matching_cycles_on_exact_audio_boundaries(self):
        self.import_song().click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().cyclesScheduled>=2')
        state=self.state();probe=self.probe()
        self.assertTrue(state['playing']);self.assertTrue(state['looping'])
        self.assertEqual(state['title'],'Loop fixture');self.assertAlmostEqual(state['duration'],1)
        self.assertEqual(len(probe['contexts']),1,'A repeat must reuse the running audio context')
        starts=probe['starts'];self.assertGreaterEqual(len(starts),4)
        for first,second in zip(starts[:2],starts[2:4]):
            self.assertAlmostEqual(second['when']-first['when'],state['duration'],delta=1e-8)
            self.assertEqual(second['frequency'],first['frequency'])
        self.assertIn('Looping',self.page.locator('.panelMsg').inner_text())
        self.assertEqual(self.page.locator('#musicBtn').get_attribute('aria-pressed'),'true')
        self.page.locator('#jukeboxStop').click()

    def test_escape_keeps_music_playing_and_header_stop_prevents_restart(self):
        self.import_song().click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().looping')
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#panel').is_hidden())
        self.assertTrue(self.state()['playing'],'Leaving the DJ dialogue must keep its selection playing')
        self.page.locator('#musicBtn').click()
        self.page.wait_for_function('!CodaArcadeQA.jukebox().playing')
        self.assertEqual(self.page.locator('#musicBtn').get_attribute('aria-pressed'),'false')
        stopped=self.probe();self.assertEqual(stopped['contexts'][0]['state'],'closed')
        self.assertGreater(len(stopped['cancels']),0,'Queued future voices must be canceled')
        self.page.wait_for_timeout(1200)
        self.assertEqual(self.probe()['starts'],stopped['starts'],'A stopped scheduler must not restart at the loop boundary')
        self.assertFalse(self.state()['playing'])

    def test_replacing_song_closes_previous_context_and_dj_stop_cancels_new_loop(self):
        self.import_song('First loop',60).click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().title==="First loop"&&CodaArcadeQA.jukebox().cyclesScheduled>=2')
        original=self.probe()['starts'][:]
        self.import_song('Second loop',62).click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().title==="Second loop"&&CodaArcadeQA.jukebox().cyclesScheduled>=2')
        replaced=self.probe()
        self.assertEqual(len(replaced['contexts']),2)
        self.assertEqual(replaced['contexts'][0]['state'],'closed')
        self.assertEqual(replaced['contexts'][1]['state'],'running')
        self.assertIn(0,replaced['cancels'])
        self.assertNotEqual(replaced['starts'][-1]['frequency'],original[-1]['frequency'])
        self.page.locator('#jukeboxStop').click()
        self.page.wait_for_function('!CodaArcadeQA.jukebox().playing')
        stopped=self.probe()
        self.assertTrue(all(context['state']=='closed' for context in stopped['contexts']))
        self.assertIn(1,stopped['cancels'])
        self.page.wait_for_timeout(1200)
        self.assertEqual(self.probe()['starts'],stopped['starts'])


    def test_sixteen_bar_house_track_uses_a_small_horizon_and_an_exact_repeating_boundary(self):
        self.page.evaluate('__jukeboxVirtualTime=0')
        self.page.locator('[data-jukebox-track="neon-afterhours"]').click()
        self.page.wait_for_function('CodaArcadeQA.jukebox().cyclesScheduled===1')
        state=self.state();first=self.probe()['starts'][:]
        self.assertEqual(state['horizonSeconds'],2)
        self.assertGreater(state['duration'],30)
        self.assertGreater(state['activeVoices'],0);self.assertLess(state['activeVoices'],128)
        self.assertLess(len(first),128,'Sixteen bars must not be queued as hundreds of native voices at once')
        self.assertTrue(all(0<=voice['when']<=2.000001 for voice in first))
        loop_start=min(voice['when'] for voice in first)
        self.page.evaluate('time=>__jukeboxVirtualTime=time',loop_start+state['duration']-.01)
        self.page.wait_for_function('CodaArcadeQA.jukebox().cyclesScheduled>=2')
        later=self.probe()['starts'][len(first):]
        boundary=loop_start+state['duration']
        repeated=[voice for voice in later if boundary-1e-8<=voice['when']<boundary+1.8]
        initial=[voice for voice in first if voice['when']<loop_start+1.8]
        self.assertEqual(len(repeated),len(initial),'The next phrase must have the same complete opening voices')
        for a,b in zip(initial,repeated):
            self.assertAlmostEqual(b['when']-a['when'],state['duration'],delta=1e-8)
            self.assertEqual(b['frequency'],a['frequency']);self.assertEqual(b['type'],a['type'])
            if a['type']=='buffer':self.assertEqual(b['buffer'],a['buffer'],'Repeated drums use the same decoded noise buffer')
        self.page.locator('#jukeboxStop').click()
        stopped=self.probe();self.assertFalse(self.state()['playing']);self.assertEqual(stopped['contexts'][0]['state'],'closed')
        self.assertGreater(len(stopped['cancels']),0)
        self.page.evaluate('__jukeboxVirtualTime+=500');self.page.wait_for_timeout(250)
        self.assertEqual(self.probe()['starts'],stopped['starts'],'A stopped long-song scheduler cannot resurrect queued cycles')


if __name__ == '__main__':
    unittest.main(verbosity=2)
