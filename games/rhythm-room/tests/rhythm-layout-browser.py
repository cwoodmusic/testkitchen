"""Verify the compact rhythm workspace through real dialogs, input, and audio.

Native Web Audio nodes, bundled instruments, notation, scoring, and browser
controls remain active. Only the existing audio-clock fixture controls time;
connection/automation probes observe the real audio graph without replacing it.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    'rhythm_layout_audio_fixture', Path(__file__).with_name('rhythm-count-in-browser.py'))
fixture = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fixture)

AUDIO_GRAPH_PROBE = r'''(()=>{
 const ids=new WeakMap(),owners=new WeakMap();let serial=0;
 const id=node=>{if(!ids.has(node))ids.set(node,++serial);return ids.get(node);};
 window.__audioGraph={edges:[],nodes:[],automation:[]};
 const connect=AudioNode.prototype.connect;
 AudioNode.prototype.connect=function(target,...rest){
   __audioGraph.edges.push([id(this),id(target)]);
   for(const node of [this,target])if(node instanceof AudioNode&&!__audioGraph.nodes.includes(node))__audioGraph.nodes.push(node);
   return connect.call(this,target,...rest);
 };
 const gain=AudioContext.prototype.createGain;
 AudioContext.prototype.createGain=function(...args){const node=gain.apply(this,args);owners.set(node.gain,id(node));return node;};
 for(const method of ['setValueAtTime','linearRampToValueAtTime']){
   const original=AudioParam.prototype[method];
   AudioParam.prototype[method]=function(value,time,...rest){
     if(owners.has(this))__audioGraph.automation.push({owner:owners.get(this),method,value,time});
     return original.call(this,value,time,...rest);
   };
 }
 window.__audioRouteReport=()=>{
   if(!ctx||!volumeGain)return {active:false};
   const master=id(volumeGain),destination=id(ctx.destination),edges=__audioGraph.edges;
   const voices=__audioGraph.nodes.filter(node=>node.context===ctx&&(node instanceof OscillatorNode||node instanceof AudioBufferSourceNode));
   function reaches(start,target,skip=-1){const seen=new Set(),queue=[start];while(queue.length){const at=queue.shift();if(at===skip||seen.has(at))continue;if(at===target)return true;seen.add(at);for(const edge of edges)if(edge[0]===at)queue.push(edge[1]);}return false;}
   return {active:true,master,destination,voices:voices.length,
     buffers:voices.filter(node=>node instanceof AudioBufferSourceNode).length,
     oscillators:voices.filter(node=>node instanceof OscillatorNode).length,
     allThroughMaster:voices.every(node=>reaches(id(node),master)&&!reaches(id(node),destination,master)),
     onlyMasterAtDestination:edges.filter(edge=>edge[1]===destination).every(edge=>edge[0]===master),
     masterAutomation:__audioGraph.automation.filter(item=>item.owner===master),
     controllerUsesMaster:masterVolume.getGainNode()===volumeGain};
 };
})()'''


class RhythmLayoutTests(unittest.TestCase):
    setUpClass = classmethod(fixture.RhythmCountInTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.RhythmCountInTests.tearDownClass.__func__)
    tearDown = fixture.RhythmCountInTests.tearDown
    route = fixture.RhythmCountInTests.route
    seconds = fixture.RhythmCountInTests.seconds
    pointer = fixture.RhythmCountInTests.pointer
    space = fixture.RhythmCountInTests.space

    def setUp(self):
        fixture.RhythmCountInTests.setUp(self)
        self.page.wait_for_function('window.RhythmRoomVolume&&document.querySelector("#practice-settings-button")')
        self.page.evaluate(AUDIO_GRAPH_PROBE)

    def configure(self, **values):
        fixture.RhythmCountInTests.configure(self, **values)

    def mode(self, mode='tap'):
        self.page.locator('#choose-' + ('tap' if mode == 'tap' else 'follow')).click()
        self.configure(count=False)

    def meter(self, value):
        self.page.locator('#time-signature-control').click()
        self.page.locator('#meter-menu').wait_for(state='visible')
        self.page.locator('[data-meter-choice="' + value + '"]').click()
        self.assertTrue(self.page.locator('#meter-menu').is_hidden())
        self.assertEqual(self.page.locator('#meter').input_value(), value)

    def select_blocks(self, ids):
        advanced = self.page.locator('#compound-advanced')
        if advanced.count() and not advanced.get_attribute('open'):
            advanced.locator('summary').click()
        self.page.locator('#none').click()
        for id in ids:
            self.page.locator('#choose-' + id).check()

    def install(self, values, meter='4/4', repeat=True):
        self.meter(meter)
        self.page.evaluate('''({values,repeat})=>{
          phrase=[{id:'layout-example',notes:values}];
          if(repeat)phrase.push({id:'layout-example-repeat',notes:values});draw();
        }''', {'values': values, 'repeat': repeat})

    def labels(self, first_bar=True):
        return self.page.evaluate('''first=>[...document.querySelectorAll('#rhythm-counts [data-count-index]')]
          .filter(node=>!first||Number(node.dataset.countBeat)<currentMeter().measureBeats)
          .map(node=>node.textContent)''', first_bar)

    def start(self):
        self.page.locator('#play').click()
        self.page.wait_for_function('running&&!loading&&ctx&&volumeGain')

    def at(self, beat):
        self.page.evaluate('beat=>__audioTestTime=origin+(initialCountBeats()+beat)*secondsPerQuarter()', beat)
        self.page.wait_for_timeout(45)

    def controls(self):
        return self.page.evaluate('''()=>({running,origin,round:tapRound?{
          index:tapRound.index,start:tapRound.start,targets:tapRound.targets,matched:[...tapRound.matched],extras:tapRound.extras}:null,
          reports:__reports,history:practiceHistory,streak:Number(document.querySelector('#note-streak').textContent)})''')

    def assert_aligned(self):
        self.page.evaluate("document.fonts.load('64px Bravura')")
        labels = self.page.locator('#rhythm-counts [data-count-index]').evaluate_all('''nodes=>nodes.map(node=>{
          const token=countTokens[Number(node.dataset.countIndex)],box=node.getBBox();
          return {x:Number(node.getAttribute('x')),expected:token.held?staffX(token.beat):events[token.noteIndex].x,
            y:Number(node.getAttribute('y')),left:box.x,right:box.x+box.width,bottom:box.y+box.height};})''')
        for label in labels:
            self.assertAlmostEqual(label['x'], label['expected'], places=5)
            self.assertGreater(label['y'], 150, 'Counts are below the written noteheads and stems')
            self.assertLessEqual(label['bottom'], 230, 'Count letters remain inside the staff viewBox')
        for left, right in zip(labels, labels[1:]):
            self.assertLess(left['right'], right['left'], 'Adjacent syllables retain a visible gap')

    def test_requested_counts_sit_under_their_actual_notes_and_long_holds_only_show_main_beats(self):
        self.mode()
        for values, meter, labels, repeat in [
            ([.5,.25,.25,.5,.5,.25,.25,.25,.25,.5,.5], '4/4', ['1','&','a','2','&','3','e','&','a','4','&'], True),
            ([4], '4/4', ['1','2','3','4'], True),
            ([2], '4/4', ['1','2'], False),
            ([1,.5,1,.5], '6/8', ['1','li','2','li'], True),
            ([.5]*6, '6/8', ['1','la','li','2','la','li'], True),
            ([4], '2/2', ['1','2'], True),
        ]:
            with self.subTest(values=values, meter=meter):
                self.install(values, meter, repeat)
                self.assertEqual(self.labels(), labels)
                self.assert_aligned()
        self.assertEqual(self.page.locator('#rhythm-counting,#counting-pulses,#staff .beatbox').count(), 0,
                         'There is one under-staff count row and no second floating count grid')

    def test_signature_click_keyboard_escape_and_phone_touch_use_the_real_meter_popup(self):
        self.mode()
        self.page.locator('#time-signature-control').focus()
        self.page.keyboard.press('Enter')
        self.assertTrue(self.page.locator('#meter-menu').is_visible())
        self.assertEqual(self.page.locator('[data-meter-choice]').count(), 3)
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#meter-menu').is_hidden())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'time-signature-control')
        self.meter('6/8')
        self.page.evaluate("document.fonts.load('64px Bravura')")
        geometry = self.page.locator('#staff [data-time-signature]').evaluate_all('''nodes=>nodes.map(node=>{
          const box=node.getBBox();return {x:box.x,y:box.y,w:box.width,h:box.height};})''')
        self.assertEqual(len(geometry), 2)
        self.assertGreaterEqual(geometry[0]['x'], 0)
        self.assertGreaterEqual(geometry[0]['y'], 0)
        self.assertLess(geometry[0]['y'] + geometry[0]['h'], geometry[1]['y'])
        self.assertLessEqual(geometry[1]['y'] + geometry[1]['h'], 230)
        for box in geometry:
            self.assertGreater(box['w'], 16)
            self.assertGreater(box['h'], 22)
        self.page.set_viewport_size({'width': 390, 'height': 844})
        self.page.locator('.staff').scroll_into_view_if_needed()
        box = self.page.locator('#time-signature-control').bounding_box()
        self.assertGreaterEqual(box['width'], 44)
        self.assertGreaterEqual(box['height'], 44)
        x, y = box['x'] + box['width']/2, box['y'] + box['height']/2
        cdp = self.context.new_cdp_session(self.page)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y, 'id': 1, 'radiusX': 4, 'radiusY': 4, 'force': 1}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        cdp.detach()
        self.assertTrue(self.page.locator('#meter-menu').is_visible())
        self.page.locator('[data-meter-choice="2/2"]').click()
        self.assertEqual(self.page.locator('#meter').input_value(), '2/2')
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))

    def test_only_tempo_volume_and_settings_stay_at_the_top_and_tempo_words_follow_the_slider(self):
        self.mode()
        toolbar = self.page.locator('.practice-toolbar')
        self.assertEqual(toolbar.locator('input,button,select').evaluate_all(
            'nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.id)'),
            ['tempo','volume','practice-settings-button'])
        self.assertTrue(self.page.locator('#mode-label').is_hidden())
        self.assertTrue(self.page.locator('#meter').is_hidden())
        for name in ['sound','repeatSound','metro','count','counting','tap-audio']:
            self.assertTrue(self.page.locator('#' + name).is_hidden(), name + ' lives behind Settings')
        self.page.locator('#practice-settings-button').click()
        self.assertTrue(self.page.locator('#practice-settings').is_visible())
        for name in ['sound','repeatSound','metro','count','counting','tap-audio']:
            self.assertEqual(self.page.locator('#' + name).evaluate('node=>node.closest("dialog")?.id'), 'practice-settings')
            self.assertTrue(self.page.locator('#' + name).is_visible())
        self.page.keyboard.press('Escape')
        self.assertTrue(self.page.locator('#practice-settings').is_hidden())
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'practice-settings-button')
        slider = self.page.locator('#tempo')
        slider.focus()
        self.page.keyboard.press('Home')
        current = 40
        for bpm, word in [(40,'Largo'),(65,'Adagio'),(80,'Andante'),(110,'Moderato'),(130,'Allegro'),(160,'Presto')]:
            for _ in range((bpm-current)//5):
                self.page.keyboard.press('ArrowRight')
            current = bpm
            self.assertEqual(slider.input_value(), str(bpm))
            self.assertIn(word, self.page.locator('#bpm').inner_text())
            self.assertIn(str(bpm), self.page.locator('#bpm').inner_text())
            self.assertIn('approx', slider.get_attribute('aria-valuetext').lower())
        for size in [{'width':1440,'height':1000}, {'width':390,'height':844}]:
            self.page.set_viewport_size(size)
            self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            self.assertLessEqual(toolbar.bounding_box()['height'], 250)
        self.install([1,.5,1,.5], '6/8')
        self.page.locator('.staff').scroll_into_view_if_needed()
        self.page.screenshot(path='/tmp/rhythm-new-phone.png')
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.page.locator('.practice-toolbar').scroll_into_view_if_needed()
        self.page.screenshot(path='/tmp/rhythm-new-desktop.png')

    def test_six_eight_has_five_basic_nine_even_sixteenth_figures_and_four_rest_types(self):
        self.mode()
        self.meter('6/8')
        self.assertEqual(self.page.locator('#choices input[type=checkbox]').count(), 18)
        self.assertEqual(self.page.locator('#choices .compound-rhythm-family').count(), 3)
        self.assertEqual(self.page.locator('#choices fieldset').first.locator('input').count(), 5)
        self.assertEqual(self.page.locator('#compound-advanced input').count(), 9)
        self.assertEqual(self.page.locator('#choices fieldset').last.locator('label span').all_text_contents(),
                         ['Dotted half rest','Dotted quarter rest','Quarter rest','Eighth rest'])
        self.assertEqual(self.page.locator('#choose-sixteenth,#choose-sixteenths,#choose-eighth,#choose-whole').count(), 0)
        catalog = self.page.evaluate('RhythmRoomMeter.COMPOUND_BLOCKS')
        self.assertEqual({tuple(block['notes']) for block in catalog if block['group']=='basic'},
                         {(3,), (1.5,), (.5,1), (1,.5), (.5,.5,.5)})
        advanced = [block for block in catalog if block['group']=='advanced']
        self.assertEqual(len(advanced), 9)
        for block in advanced:
            self.assertEqual(sum(block['notes']), 1.5)
            self.assertTrue(all(value > 0 for value in block['notes']))
            run = 0
            for note in block['notes'] + [1]:
                if note == .25:
                    run += 1
                else:
                    self.assertEqual(run % 2, 0, block['id'] + ' uses paired sixteenths')
                    run = 0
        for block in catalog:
            for variant in block.get('variants', [block['notes']]):
                self.assertNotIn(-.25, variant, 'No sixteenth rests are introduced in 6/8')
        self.page.locator('#all').click()
        for _ in range(12):
            self.page.locator('#generate').click()
            generated = self.page.evaluate('''()=>{
              let at=0;return phrase.map(block=>{const value={at,notes:block.notes};at+=block.notes.reduce((sum,note)=>sum+Math.abs(note),0);return value;});
            }''')
            self.assertEqual(sum(sum(abs(note) for note in block['notes']) for block in generated), 6)
            self.assertTrue(all(block['at'] % 1.5 == 0 for block in generated))
            self.assertFalse(any(note == -.25 for block in generated for note in block['notes']))

    def test_recorded_and_synthetic_voices_metronome_and_tap_monitor_all_use_the_live_master_gain(self):
        self.mode('follow')
        self.configure(sound='piano',repeatSound='organ',metro=True)
        self.start()
        self.at(0)
        self.at(8)
        report = self.page.evaluate('__audioRouteReport()')
        self.assertGreaterEqual(report['buffers'], 2)
        self.assertGreater(report['oscillators'], 0)
        self.assertTrue(report['allThroughMaster'])
        self.assertTrue(report['onlyMasterAtDestination'])
        self.assertTrue(report['controllerUsesMaster'])
        self.page.locator('#stop').click()
        self.page.locator('#home-button').click()
        self.mode()
        for sound in ['sample','wood','drum','tone']:
            with self.subTest(sound=sound):
                self.configure(sound=sound)
                self.start()
                self.at(0)
                self.at(8.1)
                self.pointer()
                report = self.page.evaluate('__audioRouteReport()')
                self.assertGreater(report['voices'], 0)
                self.assertTrue(report['allThroughMaster'])
                self.assertTrue(report['onlyMasterAtDestination'])
                self.page.locator('#stop').click()

    def test_live_volume_and_counts_off_preserve_the_round_streak_and_timing_and_mute_persists(self):
        self.mode()
        self.select_blocks(['quarter'])
        self.assertIsNone(self.page.evaluate('localStorage.getItem(RhythmRoomVolume.KEY)'))
        self.start()
        self.at(12)
        self.space()
        before = self.controls()
        master = self.page.evaluate('__audioRouteReport().master')
        self.assertEqual(before['streak'], 1)
        self.page.locator('#volume').focus()
        self.page.keyboard.press('Home')
        after = self.controls()
        self.assertEqual(after, before, 'A live volume adjustment cannot restart or grade the round')
        self.assertEqual(self.page.evaluate('masterVolume.getValue()'), 0)
        self.assertEqual(self.page.evaluate('__audioRouteReport().master'), master)
        automation = self.page.evaluate('__audioRouteReport().masterAutomation.at(-1)')
        self.assertEqual(automation['method'], 'linearRampToValueAtTime')
        self.assertEqual(automation['value'], 0)
        self.assertAlmostEqual(automation['time'], self.page.evaluate('ctx.currentTime') + .025, places=6)
        self.configure(counting='off')
        self.assertEqual(self.controls(), before)
        self.assertTrue(self.page.locator('#rhythm-counts').is_hidden())
        self.at(13)
        self.space()
        self.assertEqual(self.controls()['streak'], 2, 'Muted taps still use the same timing/grading')
        self.assertTrue(self.page.evaluate('__audioRouteReport().allThroughMaster'))
        self.assertIn('0', self.page.locator('#volume-label').inner_text())
        self.assertEqual(self.controls()['reports'], [])
        self.page.locator('#stop').click()
        self.page.reload(wait_until='domcontentloaded')
        self.page.locator('#choose-tap').click()
        self.assertEqual(self.page.locator('#volume').input_value(), '0')
        self.assertEqual(self.page.evaluate('masterVolume.getValue()'), 0)
        self.start()
        self.assertEqual(self.page.evaluate('volumeGain.gain.value'), 0)
        self.page.locator('#stop').click()


if __name__ == '__main__':
    unittest.main(verbosity=2)
