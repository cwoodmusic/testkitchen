"""The composer has one output bus for playback and cell auditions.

Uses real Web Audio nodes, their actual routing, and an analyser on the master
bus. Test browsers are disposable and never contact a cloud service.
"""
import importlib.util
from pathlib import Path
import unittest

_spec=importlib.util.spec_from_file_location('master_song_fixture',Path(__file__).with_name('song-simple-browser.py'))
_fixture=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_fixture)

PROBE='''(()=>{
 const ids=new WeakMap(),nodes=[],edges=[];let analyser=null;
 const id=node=>{if(!ids.has(node)){ids.set(node,nodes.length);nodes.push(node);}return ids.get(node);};
 const connect=AudioNode.prototype.connect;
 AudioNode.prototype.connect=function(target,...args){edges.push([id(this),id(target)]);return connect.call(this,target,...args);};
 window.masterProbe={
  graph(){const destination=nodes.findIndex(node=>node instanceof AudioDestinationNode),direct=edges.filter(edge=>edge[1]===destination),master=direct[0]?.[0];
   const sources=nodes.map((node,index)=>node instanceof OscillatorNode||node instanceof AudioBufferSourceNode?index:-1).filter(index=>index>=0);
   const reaches=(start,target,skip=null)=>{const todo=[start],seen=new Set();while(todo.length){const next=todo.pop();if(next===target)return true;if(next===skip||seen.has(next))continue;seen.add(next);for(const [from,to]of edges)if(from===next)todo.push(to);}return false;};
   return {direct:direct.length,masterGain:nodes[master]?.gain?.value,sources:sources.length,kinds:[...new Set(sources.map(index=>nodes[index].constructor.name))],allUseMaster:sources.every(source=>reaches(source,master)),bypass:sources.some(source=>reaches(source,destination,master))};
  },
  rms(){if(!analyser){const edge=edges.find(([,to])=>nodes[to] instanceof AudioDestinationNode);if(!edge)return null;const master=nodes[edge[0]];analyser=master.context.createAnalyser();analyser.fftSize=2048;master.connect(analyser);}
   const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);return Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);}
 };
})();'''


class SongMasterVolumeTests(unittest.TestCase):
    setUpClass=classmethod(_fixture.SongSimpleTests.setUpClass.__func__)
    tearDownClass=classmethod(_fixture.SongSimpleTests.tearDownClass.__func__)
    tearDown=_fixture.SongSimpleTests.tearDown
    load=_fixture.SongSimpleTests.load
    song=_fixture.SongSimpleTests.song

    def setUp(self):
        _fixture.SongSimpleTests.setUp(self)
        self.context.add_init_script(PROBE)
        self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('window.songMachineBridge?.getMasterVolume')

    def set_volume(self,value):
        self.page.locator('#songMasterVolume').evaluate('''(input,value)=>{
          input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));
        }''',value)

    def test_master_is_shared_persisted_and_outside_composition_and_undo(self):
        self.assertEqual(self.page.evaluate('songMachineBridge.getMasterVolume()'),100)
        self.assertEqual(self.page.locator('#songMasterVolumeValue').inner_text(),'100%')
        original=self.song();self.set_volume(37)
        self.assertEqual(self.song(),original,'A volume preference cannot rewrite the song')
        self.assertEqual(self.page.locator('#songMasterVolumeValue').inner_text(),'37%')
        self.page.evaluate('songMachineBridge.setEditorMode("advanced")')
        self.assertTrue(self.page.locator('#songMasterVolume').is_visible())
        self.assertEqual(self.page.locator('#songMasterVolume').input_value(),'37')
        self.page.locator('#add').click();self.page.locator('#undo').click()
        self.assertEqual(self.page.evaluate('songMachineBridge.getMasterVolume()'),37)
        self.assertEqual(self.song(),original)
        self.page.evaluate('songMachineBridge.setEditorMode("simple")')
        self.assertEqual(self.page.locator('#songMasterVolume').count(),1)
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('window.songMachineBridge')
        self.assertEqual(self.page.evaluate('songMachineBridge.getMasterVolume()'),37)
        self.assertEqual(self.song(),original)
        self.assertNotIn('masterVolume',self.song())
        self.page.locator('#songMasterVolume').focus();self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.evaluate('songMachineBridge.getMasterVolume()'),38)

    def test_every_synth_bonus_voice_and_drum_uses_one_bus_and_live_zero_is_silent(self):
        self.page.evaluate('''()=>{
          const song=songMachineBridge.get();song.bpm=80;
          song.tracks=[{...song.tracks[0],sound:0,notes:[{p:60,t:0,d:16}]},
            {...song.tracks[1],sound:17,notes:[{p:64,t:0,d:16}]}];
          song.drums.forEach(track=>track.notes=[{t:0,d:4}]);songMachineBridge.load(song);
        }''')
        self.page.locator('#simplePlay').click();self.page.wait_for_timeout(120)
        graph=self.page.evaluate('masterProbe.graph()')
        self.assertEqual(graph['direct'],1,graph)
        self.assertTrue(graph['allUseMaster'],graph);self.assertFalse(graph['bypass'],graph)
        self.assertGreaterEqual(graph['sources'],5,graph)
        self.assertIn('OscillatorNode',graph['kinds']);self.assertIn('AudioBufferSourceNode',graph['kinds'])
        self.page.evaluate('masterProbe.rms()');self.page.wait_for_timeout(100)
        self.assertGreater(self.page.evaluate('masterProbe.rms()'),.001)
        self.set_volume(0);self.page.wait_for_timeout(130)
        self.assertEqual(self.page.evaluate('songMachineBridge.audioState().masterGain'),0)
        self.assertEqual(self.page.evaluate('masterProbe.rms()'),0)
        self.assertIn('Playing',self.page.locator('#simpleStatus').inner_text())
        self.set_volume(45);self.page.wait_for_timeout(100)
        self.assertAlmostEqual(self.page.evaluate('masterProbe.graph().masterGain'),.45,places=5)
        self.assertGreater(self.page.evaluate('masterProbe.rms()'),.001)
        self.page.locator('#simpleStop').click()

    def test_cell_auditions_share_the_bus_and_phone_slider_is_large_without_overflow(self):
        self.set_volume(0)
        for track,pitch,step in [('1',72,16),('d0',0,16),('d1',0,16),('d2',0,16)]:
            self.page.locator(f'#simpleSongGrid .cell[data-track="{track}"][data-pitch="{pitch}"][data-step="{step}"]').click()
        self.page.wait_for_timeout(80)
        graph=self.page.evaluate('masterProbe.graph()')
        self.assertEqual(graph['direct'],1,graph);self.assertTrue(graph['allUseMaster'],graph);self.assertFalse(graph['bypass'],graph)
        self.assertGreaterEqual(graph['sources'],4,graph)
        self.page.evaluate('masterProbe.rms()');self.page.wait_for_timeout(70)
        self.assertEqual(self.page.evaluate('masterProbe.rms()'),0)
        self.set_volume(100)
        self.page.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="74"][data-step="20"]').click()
        self.page.wait_for_timeout(70)
        self.assertGreater(self.page.evaluate('masterProbe.rms()'),.001)
        for width,height in [(390,844),(844,390)]:
            self.page.set_viewport_size({'width':width,'height':height})
            metric=self.page.locator('#songMasterVolume').evaluate('''input=>({height:input.getBoundingClientRect().height,width:input.getBoundingClientRect().width,
              overflow:document.documentElement.scrollWidth>innerWidth})''')
            self.assertGreaterEqual(metric['height'],44,metric);self.assertGreaterEqual(metric['width'],100,metric);self.assertFalse(metric['overflow'],metric)

if __name__=='__main__':unittest.main(verbosity=2)
