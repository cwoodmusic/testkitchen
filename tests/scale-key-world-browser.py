"""Scale memory rewards and key lessons in the assembled, profile-aware arcade.

All input uses the real room controls in disposable guest browser contexts.
External accounts and services are blocked by the shared world fixture.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('scale_key_world_fixture',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)
from world_navigation_helpers import enter_room
from classroom_quiz_helpers import answer_quiz

KEY_ANSWERS=[0,0,0,0,0,1,2,0]


class ScaleKeyWorldTests(_world.WorldBrowserCase):
    def walk_piano_floor(self,x,y):
        self.page.locator('#pianoRoomCanvas').focus()
        for axis,target,negative,positive in [('x',x,'a','d'),('y',y,'w','s')]:
            for _ in range(25):
                state=self.page.evaluate('CodaArcadeQA.piano()')
                distance=target-state['player'][axis]
                if abs(distance)<3:break
                key=positive if distance>0 else negative
                self.page.keyboard.down(key)
                self.page.clock.run_for(max(16,min(300,round(abs(distance)/220*1000))))
                self.page.keyboard.up(key)
            position=self.page.evaluate('CodaArcadeQA.piano().player')
            self.assertAlmostEqual(position[axis],target,delta=7,
                                   msg='Published piano collision blocks the walk to '+str((x,y))+': '+str(position))
        self.page.clock.run_for(32)

    def stand_on_piano_key(self,midi):
        key=next(key for key in self.page.evaluate('CodaArcadeQA.piano().floorKeys') if key['midi']==midi)
        points=key['polygon']
        if key['black']:
            x=sum(p[0] for p in points)/len(points);y=sum(p[1] for p in points)/len(points)
        else:
            x=(points[2][0]+points[3][0])/2;y=max(p[1] for p in points)-9
        self.walk_piano_floor(x,y)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().floorNote'),midi)

    def piano_menu(self,view):
        if self.page.locator('#pianoDialogueBackdrop').is_visible():
            self.page.locator('#pianoDialogueClose').click()
        if not self.page.evaluate('CodaArcadeQA.piano().menuOpen'):
            self.page.locator('#pianoMenuButton').click()
        self.page.locator('[data-piano-view="'+view+'"]').click()

    def play_pitches(self,pitches):
        self.piano_menu('keyboard')
        self.page.evaluate('''pitches=>{for(const midi of pitches){
          const key=document.querySelector('.piano-key[data-midi="'+midi+'"]');
          if(!key)throw Error('The challenge pitch has no playable key: '+midi);
          key.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
          key.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));
        }}''',pitches)

    def start_scale(self,identifier):
        self.piano_menu('games')
        self.page.locator('#pianoScale').select_option(identifier)
        self.page.locator('#pianoStartScale').click()
        self.page.locator('[data-piano-dialogue-action="play"]').click()
        return self.page.evaluate('CodaArcadeQA.piano().lessonPitches')

    def start_memory(self):
        self.piano_menu('games')
        self.page.locator('#pianoMemoryStart').click()
        self.page.locator('[data-piano-dialogue-action="play"]').click()

    def capture_valid(self):
        captured=self.page.evaluate('CodaClassroomProfileData.capture(localStorage)')
        self.assertTrue(captured['ok'],captured)
        return captured['data']

    def test_guided_and_memory_scale_rewards_save_once_with_real_parent_experience(self):
        enter_room(self.page,'piano')
        self.assertEqual(self.page.locator('#pianoScale option').count(),24)
        pitches=self.start_scale('c-major')
        self.assertEqual(len(pitches),15)
        self.assertEqual(pitches[7]-pitches[0],12)
        self.assertEqual(pitches[8:],list(reversed(pitches[:7])))
        self.play_pitches(pitches[:8])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.piano().challengeRun.finished'))
        self.play_pitches(pitches[8:])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),185)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),100)
        self.assertGreater(self.page.evaluate('CodaArcadeQA.piano().voiceCount'),0)
        self.start_memory()
        self.assertTrue(self.page.evaluate('CodaArcadeQA.piano().wallStaff.answerHidden'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().wallStaff.notes'),[])
        self.assertFalse(self.page.evaluate('CodaArcadeQA.piano().keyHighlight.visible'))
        self.play_pitches(pitches[:2])
        self.play_pitches([pitches[0]+1])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().lessonStep'),0)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().challengeRun.mistakes'),1)
        self.play_pitches(pitches)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),245)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),200)
        captured=self.capture_valid()
        self.assertIn('piano-scale:c-major',captured['piano']['completed'])
        self.assertIn('piano-scale-memory:c-major',captured['piano']['completed'])
        self.assertIn('quest:piano-scale-memory:c-major',[event['id'] for event in captured['progression']['events']])
        self.load();enter_room(self.page,'piano')
        self.start_scale('c-major');self.start_memory();self.play_pitches(pitches)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),245)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),200)
        self.capture_valid()

    def test_published_collision_and_layers_allow_every_key_and_the_entire_high_b_scale(self):
        enter_room(self.page,'piano')
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        project=self.page.evaluate('CodaArcadeQA.roomProject("piano")')
        self.assertEqual(len(project['collision']),243,'Exercise the actual shared piano collision edits')
        self.assertEqual(len(project['strokes']),108,'Exercise the actual shared piano foreground edits')
        self.page.clock.install();self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        self.page.clock.run_for(64)
        pitches=self.start_scale('b-major')
        self.assertEqual(pitches,[71,73,75,76,78,80,82,83,82,80,78,76,75,73,71])
        self.page.clock.run_for(32)
        for index,midi in enumerate(pitches):
            self.stand_on_piano_key(midi)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().scaleStep'),index,
                             'Walking onto a challenge key must not submit its note')
            self.page.keyboard.press('e');self.page.clock.run_for(32)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.piano().scaleStep'),index+1)
            if index==7:
                self.assertNotIn('piano-scale:b-major',self.page.evaluate('CodaArcadeQA.piano().completed'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),185)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),100)
        self.assertGreater(self.page.evaluate('CodaArcadeQA.piano().voiceCount'),0)
        self.capture_valid()
        self.piano_menu('games');self.page.locator('#pianoFreePlay').click()
        self.page.clock.run_for(32)
        for midi in range(60,84):self.stand_on_piano_key(midi)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.roomProject("piano")'),project,
                         'Walking and piano input must preserve all published collision and layer edits')

    def open_key_lesson_at_haydn(self):
        enter_room(self.page,'classroom')
        point=self.page.locator('#classroomCanvas').evaluate('''canvas=>{
          const box=canvas.getBoundingClientRect(),camera=CodaArcadeQA.classroom().camera;
          return {x:box.x+(500-camera.x)*camera.zoom/1000*box.width,
            y:box.y+(390-camera.y)*camera.zoom/600*box.height};
        }''')
        self.page.mouse.click(point['x'],point['y'])
        self.page.wait_for_function('CodaArcadeQA.classroom().player.y<420')
        self.page.locator('#classroomCanvas').focus();self.page.keyboard.press('e')
        self.page.locator('[data-start-lesson="major-minor-keys"]').click()

    def complete_key_steps(self):
        for index,answer in enumerate(KEY_ANSWERS):
            self.assertEqual(self.page.evaluate('CodaArcadeQA.classroom().tutorials.active.step'),index)
            self.page.locator('[data-lesson-try]').click()
            self.page.locator('[data-key-answer="'+str(answer)+'"]').click()
            self.page.locator('[data-tutorial-next]').click()

    def test_major_minor_classroom_quiz_updates_profile_and_private_save_once(self):
        self.open_key_lesson_at_haydn()
        self.complete_key_steps()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),0)
        answer_quiz(self.page,'major-minor-keys')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),150)
        state=self.page.evaluate('CodaArcadeQA.classroom().tutorials')
        self.assertEqual(state['total'],6)
        self.assertIn('major-minor-keys',state['completed'])
        saved=self.capture_valid()
        self.assertTrue(saved['lessons']['lessons']['major-minor-keys']['completed'])
        self.assertEqual(saved['quizzes']['quizzes']['major-minor-keys']['answers'],[0,1,2,0,1])
        self.page.locator('[data-tutorial-replay]').click()
        self.complete_key_steps();answer_quiz(self.page,'major-minor-keys')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.load();self.page.locator('#levelBtn').click()
        self.assertEqual(self.page.locator('.profile-lessons p').count(),6)
        self.assertIn('Major & minor keys',self.page.locator('.profile-lessons').inner_text())
        self.assertEqual(self.page.locator('.profile-lesson-done').count(),1)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),50)
        self.capture_valid()

    def test_public_origin_title_guest_entry_still_starts_the_connected_arcade(self):
        self.page.goto(_world.WORLD.replace('world-preview.html','index.html'),wait_until='domcontentloaded')
        self.page.locator('#titleGuest').click()
        self.page.wait_for_function('window.CodaDeveloperConsole?.ready()&&window.CodaArcadeQA?.notes()')
        self.assertFalse(self.page.evaluate('CodaArcadeQA.classroomSession().student'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),1)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.tutorials().total'),6)


if __name__=='__main__':unittest.main(verbosity=2)
