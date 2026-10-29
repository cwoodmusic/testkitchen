"""Real song pitches and written rhythms stay independent of piano input timing."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('piano_song_scale_support', Path(__file__).with_name('piano-scales-browser.py'))
_scale = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_scale)

FRERE = [60,62,64,60,60,62,64,60,64,65,67,64,65,67,
         67,69,67,65,64,60,67,69,67,65,64,60,60,55,60,60,55,60]

RHYTHM_PROBE = r"""(()=>{
 window.__pianoRhythmInk=[];window.__pianoSongTones=[];
 const audio=(window.AudioContext||window.webkitAudioContext)?.prototype;
 if(audio){const create=audio.createOscillator;audio.createOscillator=function(...args){const node=create.apply(this,args),start=node.start;node.start=function(...times){__pianoSongTones.push(node.frequency.value);return start.apply(this,times)};return node;};}

 const p=CanvasRenderingContext2D.prototype,fill=p.fillRect;
 p.fillRect=function(x,y,width,height){
   if(['pianoRoomCanvas','pianoWallStaff'].includes(this.canvas.id)&&this.fillStyle==='#dce8f7'&&width>8&&height>0&&height<6){
     __pianoRhythmInk.push({canvas:this.canvas.id,x,y,width,height,color:this.fillStyle});
     if(__pianoRhythmInk.length>200)__pianoRhythmInk.shift();
   }
   return fill.call(this,x,y,width,height);
 };
})()"""


class PianoSongNotationTests(_scale._world.WorldBrowserCase):
    state = _scale.PianoScaleTests.state
    totals = _scale.PianoScaleTests.totals
    dismiss_notifications = _scale.PianoScaleTests.dismiss_notifications
    menu = _scale.PianoScaleTests.menu
    close_panels = _scale.PianoScaleTests.close_panels
    walk = _scale.PianoScaleTests.walk
    floor_key = _scale.PianoScaleTests.floor_key
    start_scale = _scale.PianoScaleTests.start_scale
    play_keyboard = _scale.PianoScaleTests.play_keyboard
    play_floor = _scale.PianoScaleTests.play_floor

    def setUp(self):
        _scale.PianoScaleTests.setUp(self)
        self.page.evaluate(RHYTHM_PROBE)

    def start_song(self, identifier):
        self.menu('games')
        self.page.locator('#pianoLesson').select_option(identifier)
        self.page.locator('[data-piano-dialogue-action="play"]').click()
        self.page.clock.run_for(48)
        self.assertEqual(self.state()['lesson'], identifier)
        self.assertEqual(self.state()['challengeMode'], 'melody')
        return self.state()

    def glyphs(self):
        return {ord(char) for item in self.page.evaluate('__pianoPaint.glyphs') for char in item['text']}

    def test_frere_jacques_uses_all_32_concert_pitches_and_reachable_low_ending_on_the_floor(self):
        before = self.totals()
        initial = self.start_song('frere-jacques')
        self.assertEqual(initial['lessonPitches'], FRERE)
        self.assertEqual(initial['octave'], 3)
        self.assertEqual(initial['melodyRegister'], {'baseMidi':48,'lowest':55,'highest':69,'first':60})
        self.assertEqual(min(key['midi'] for key in initial['floorKeys']), 48)
        self.assertTrue(set(FRERE).issubset({key['midi'] for key in initial['floorKeys']}))
        self.floor_key(59)
        self.assertEqual(self.state()['lessonStep'], 0, 'Walking across keys never answers a pitch challenge')
        self.page.keyboard.press('e');self.page.clock.run_for(16)
        self.assertEqual(self.state()['lessonStep'], 0, 'The wrong concert pitch does not advance')
        for index, midi in enumerate(FRERE):
            self.assertEqual(self.state()['keyHighlight']['midi'], midi)
            if index == 8:
                score = self.state()['wallStaff']
                self.assertTrue(any(event['beats']==2 and not event['rest'] for event in score['events']))
                self.assertTrue({0xe1d3,0xe1d4}&self.glyphs(), 'The written held G is engraved as a half note')
            if index == 14:
                score = self.state()['wallStaff']
                beamed = [event for event in score['events'] if event.get('beamed')]
                self.assertEqual(len(beamed), 4)
                self.assertEqual(len({event['beamGroup'] for event in beamed}), 2)
                self.assertTrue(self.page.evaluate('__pianoRhythmInk.length>0'), 'Paired eighths have actual connecting beams')
            self.floor_key(midi)
            self.assertEqual(self.state()['lessonStep'], index)
            self.page.keyboard.press('e');self.page.clock.run_for(16)
            self.assertEqual(self.state()['lessonStep'], index+1,
                             'Only the next pitch matters; no long-note hold or rhythmic timing is required')
            if index == 27:
                self.assertEqual(self.state()['lastWallNote'],55, 'The closing bell drops below the opening C')
                self.page.screenshot(path='/tmp/music48-piano-frere-low-g.png')
        complete = self.state()
        self.assertIn('piano-lesson:frere-jacques', complete['completed'])
        self.assertTrue(complete['dialogueOpen'])
        self.assertEqual(self.totals(), {'notes':before['notes']+35,'xp':before['xp']+100})

    def test_written_rests_dots_and_barlines_do_not_add_timed_or_rest_input(self):
        self.start_song('jingle-bells')
        first = self.state()['wallStaff']
        self.assertEqual(first['meter'],'4/4')
        self.assertTrue(any(event['rest'] and event['beats']==1 for event in first['events']))
        self.assertIn(0xe4e5, self.glyphs(), 'Written quarter rests use the actual Bravura rest glyph')
        barlines = [stroke for stroke in self.page.evaluate('__pianoPaint.strokes')
                    if stroke['color']=='#a4bec7' and len(stroke['path'])==4]
        self.assertTrue(barlines, 'Bar dividers are painted on the wall score')
        for index in range(4):
            self.play_keyboard(64)
            self.assertEqual(self.state()['lessonStep'], index+1,
                             'The next E can be played immediately after the written rest')
        self.assertEqual(self.state()['wallStaff']['bar'],1)
        self.assertEqual(self.state()['lessonStep'],4)
        self.start_song('london-bridge')
        score = self.state()['wallStaff']
        self.assertEqual(score['events'][0]['beats'],1.5)
        self.assertEqual(score['events'][0]['dots'],1)
        self.assertIn(0xe1e7,self.glyphs(), 'A dotted quarter has an actual augmentation dot')
        self.assertTrue(any(event['beats']==.5 and not event['rest'] for event in score['events']))
        for index,midi in enumerate([67,69,67,65]):
            self.play_keyboard(midi);self.assertEqual(self.state()['lessonStep'],index+1)
        self.assertEqual(self.state()['wallStaff']['bar'],1)
        self.close_panels();self.page.screenshot(path='/tmp/music48-piano-song-rhythm.png')

    def test_memory_score_hides_future_notes_and_scales_restore_their_own_register(self):
        self.start_song('hot-cross-buns')
        for midi in [64,62,60,64,62,60,60,60,60,60,62,62,62,62,64,62,60]:self.play_keyboard(midi)
        self.dismiss_notifications()
        self.page.locator('[data-piano-dialogue-action="memory"]').click()
        self.page.locator('[data-piano-dialogue-action="play"]').click();self.page.clock.run_for(32)
        score = self.state()['wallStaff']
        self.assertTrue(score['answerHidden']);self.assertEqual(score['events'],[])
        self.assertFalse(self.state()['keyHighlight']['visible'])
        self.play_keyboard(64)
        score = self.state()['wallStaff']
        self.assertEqual([note['midi'] for note in score['notes']], [64])
        self.assertFalse(any(note['midi']==62 for note in score['notes']), 'The next melody answer remains hidden')
        self.play_keyboard(65);self.assertEqual(self.state()['lessonStep'],0)
        self.start_song('frere-jacques');self.assertEqual(self.state()['octave'],3)
        self.start_scale('c-major')
        state = self.state();self.assertEqual(state['octave'],4)
        self.assertEqual(state['lessonPitches'],[60,62,64,65,67,69,71,72,71,69,67,65,64,62,60])
        self.assertEqual(state['keyHighlight']['midi'],60)
        self.play_keyboard(60);self.assertEqual(self.state()['scaleStep'],1)

    def test_score_engraving_visuals_include_connected_eighths_quiet_rests_and_low_G_sound(self):
        self.page.wait_for_function('CodaMusicNotation.isReady()')
        self.start_song('frere-jacques')
        for midi in FRERE[:14]:self.play_keyboard(midi)
        self.close_panels()
        score=self.state()['wallStaff'];self.assertEqual(score['bar'],4)
        self.assertEqual(sum(bool(event.get('beamed')) for event in score['events']),4)
        self.assertTrue(self.page.evaluate('__pianoRhythmInk.length>0'))
        self.page.screenshot(path='/tmp/piano-score-frere-beams.png')
        for midi in FRERE[14:28]:self.play_keyboard(midi)
        self.close_panels()
        self.assertEqual(self.state()['lastWallNote'],55)
        self.assertTrue(self.page.evaluate('__pianoSongTones.some(f=>Math.abs(f-195.99771799)<.01)'),
                        'The closing G actually sounds in the octave below the opening C')
        self.page.screenshot(path='/tmp/piano-score-frere-low-g.png')
        self.start_song('jingle-bells')
        self.page.screenshot(path='/tmp/piano-score-jingle-quarter-rest.png')
        self.start_song('row-your-boat')
        for midi in [60,60,60,62,64,64,62,64,65]:self.play_keyboard(midi)
        self.close_panels()
        score=self.state()['wallStaff'];self.assertEqual(score['meter'],'6/8');self.assertEqual(score['bar'],3)
        self.assertTrue(any(event['rest'] and event['dots']==1 for event in score['events']))
        self.page.screenshot(path='/tmp/piano-score-row-dotted-rest.png')
        metrics=self.page.evaluate('''()=>{
          const c=document.createElement('canvas').getContext('2d');c.font='36px CodaBravura';
          return Object.fromEntries([['four',0xe084],['restQuarter',0xe4e5],['restHalf',0xe4e4]].map(([name,code])=>{
            const m=c.measureText(String.fromCodePoint(code));return [name,{ascent:m.actualBoundingBoxAscent,descent:m.actualBoundingBoxDescent}];
          }));
        }''')
        print('\nBravura score glyph bounds:',metrics)

    def test_mobile_fullscreen_keeps_real_song_floor_keys_and_play_note_available_phone(self):
        self.start_song('frere-jacques')
        self.page.evaluate('''()=>{
          const host=document.querySelector('#pianoroom');
          Object.defineProperty(host,'requestFullscreen',{configurable:true,value:undefined});
          Object.defineProperty(host,'webkitRequestFullscreen',{configurable:true,value:undefined});
        }''')
        self.page.locator('#pianoFullscreen').click();self.page.clock.run_for(48)
        self.assertEqual(self.state()['fullscreen']['mode'],'viewport')
        self.assertTrue(self.page.evaluate('document.querySelector("#pianoroom").contains(document.querySelector(".coda-touch-controls"))'))
        self.floor_key(60)
        play = self.page.locator('.coda-touch-interact')
        self.assertTrue(play.is_visible());self.assertGreaterEqual(play.bounding_box()['height'],64)
        self.assertEqual(self.state()['lessonStep'],0)
        play.tap();self.page.clock.run_for(32)
        self.assertEqual(self.state()['lessonStep'],1)
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(96)
            self.assertLessEqual(self.page.locator('#pianoroom').evaluate('host=>host.scrollWidth'),size['width']+1)
            self.assertTrue(self.state()['wallStaff']['visible'])
            self.page.screenshot(path='/tmp/music48-piano-song-'+str(size['width'])+'.png')
        self.page.locator('#pianoFullscreen').click();self.page.clock.run_for(32)
        self.assertFalse(self.state()['fullscreen']['active'])
        self.assertFalse(self.page.evaluate('document.querySelector("#pianoroom").contains(document.querySelector(".coda-touch-controls"))'))
        self.assertEqual(self.state()['lessonStep'],1)


if __name__=='__main__':unittest.main(verbosity=2)
