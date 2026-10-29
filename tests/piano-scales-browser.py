"""Real Chopin scale games, floor-key input, wall notation, and mobile feedback."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('piano_scales_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)
from world_navigation_helpers import enter_room

D_MAJOR = [62, 64, 66, 67, 69, 71, 73, 74, 73, 71, 69, 67, 66, 64, 62]
A_MINOR = [69, 71, 72, 74, 76, 77, 79, 81, 79, 77, 76, 74, 72, 71, 69]
C_MAJOR = [60, 62, 64, 65, 67, 69, 71, 72]

PAINT_PROBE = r"""(()=>{
 window.__pianoPaint={texts:[],strokes:[],glyphs:[]};
 const p=CanvasRenderingContext2D.prototype,paths=new WeakMap();
 const clear=p.clearRect,begin=p.beginPath,move=p.moveTo,line=p.lineTo,stroke=p.stroke,text=p.fillText;
 p.clearRect=function(...args){if(this.canvas.id==='pianoRoomCanvas'){__pianoPaint.texts=[];__pianoPaint.strokes=[];}return clear.apply(this,args)};
 p.beginPath=function(...args){paths.set(this,[]);return begin.apply(this,args)};
 p.moveTo=function(x,y){paths.get(this)?.push(['M',x,y]);return move.call(this,x,y)};
 p.lineTo=function(x,y){paths.get(this)?.push(['L',x,y]);return line.call(this,x,y)};
 p.stroke=function(...args){if(this.canvas.id==='pianoRoomCanvas')__pianoPaint.strokes.push({path:paths.get(this)||[],width:this.lineWidth,color:this.strokeStyle,alpha:this.globalAlpha});return stroke.apply(this,args)};
 p.fillText=function(value,x,y,...rest){
  const item={text:String(value),x,y,font:this.font,color:this.fillStyle,alpha:this.globalAlpha};
  if(this.canvas.id==='pianoRoomCanvas')__pianoPaint.texts.push(item);
  if(this.font.includes('CodaBravura')){__pianoPaint.glyphs.push(item);if(__pianoPaint.glyphs.length>1000)__pianoPaint.glyphs.splice(0,200);}
  return text.call(this,value,x,y,...rest);
 };
})()"""


class PianoScaleTests(_world.WorldBrowserCase):
    def setUp(self):
        phone = self._testMethodName.endswith('_phone')
        self.context = self.browser.new_context(viewport={'width':390,'height':844} if phone else {'width':1440,'height':1000}, is_mobile=phone, has_touch=phone)
        self.context.route('https://**/*', lambda route:route.abort())
        self.context.route('https://cwoodmusic.github.io/**', self.route_checkout)
        self.context.add_init_script("localStorage.setItem('codaArcadeFXV1','off')")
        self.context.add_init_script(PAINT_PROBE)
        self.page = self.context.new_page();self.page.set_default_timeout(10000)
        self.errors = [];self.failures = []
        self.page.on('pageerror', lambda error:self.errors.append(str(error)))
        self.page.on('response', lambda response:self.failures.append(response.url)
          if response.status>=400 and '/coda-arcade/' in response.url and not response.url.endswith('favicon.ico') else None)
        self.load();self.page.clock.install();self.page.clock.pause_at(self.page.evaluate('Date.now()/1000')+5)
        enter_room(self.page, 'piano')
        self.page.wait_for_function('CodaArcadeQA.piano().background.ready')
        self.page.clock.run_for(64)

    def state(self):return self.page.evaluate('CodaArcadeQA.piano()')
    def totals(self):return self.page.evaluate('({notes:CodaArcadeQA.notes().balance,xp:CodaArcadeQA.progression().xp})')

    def dismiss_notifications(self):
        for _ in range(12):
            self.page.clock.run_for(260)
            close=self.page.get_by_role('button',name='Dismiss notification',exact=True)
            if not close.is_visible():return
            close.click()
        self.fail('Reward notifications should dismiss without opening profile')

    def menu(self, view='games'):
        self.dismiss_notifications()
        if self.state()['dialogueOpen']:self.page.locator('#pianoDialogueClose').click()
        if not self.state()['menuOpen']:self.page.locator('#pianoMenuButton').click()
        self.page.locator('[data-piano-view="'+view+'"]').click();self.page.clock.run_for(32)

    def close_panels(self):
        if self.state()['dialogueOpen']:self.page.locator('#pianoDialogueClose').click()
        if self.state()['menuOpen']:self.page.locator('#pianoMenuClose').click()
        self.page.clock.run_for(32)

    def walk(self,x,y):
        self.page.locator('#pianoRoomCanvas').focus()
        for axis,target,negative,positive in [('x',x,'a','d'),('y',y,'w','s')]:
            for _ in range(25):
                distance=target-self.state()['player'][axis]
                if abs(distance)<3:break
                key=positive if distance>0 else negative
                self.page.keyboard.down(key)
                self.page.clock.run_for(max(16,min(300,round(abs(distance)/220*1000))))
                self.page.keyboard.up(key)
            self.assertAlmostEqual(self.state()['player'][axis],target,delta=7)
        self.page.clock.run_for(32)

    def floor_key(self,midi):
        key=next(key for key in self.state()['floorKeys'] if key['midi']==midi)
        points=key['polygon']
        if key['black']:
            x=sum(p[0] for p in points)/len(points);y=sum(p[1] for p in points)/len(points)
        else:
            x=(points[2][0]+points[3][0])/2;y=max(p[1] for p in points)-9
        self.walk(x,y)
        self.assertEqual(self.state()['floorNote'],midi)
        return key

    def start_scale(self,identifier,via_chopin=False):
        if via_chopin:
            self.close_panels();self.walk(780,306);self.page.keyboard.press('e')
        else:
            self.menu();self.page.locator('#pianoTalkChopin').click()
        self.page.locator('[data-piano-dialogue-action="scales"]').click()
        self.page.locator('[data-piano-scale="'+identifier+'"]').click()
        self.page.locator('[data-piano-dialogue-action="play"]').click()
        self.page.clock.run_for(64)
        state=self.state();self.assertEqual(state['challengeMode'],'scale');self.assertEqual(state['scale'],identifier)
        self.assertFalse(state['dialogueOpen']);self.assertFalse(state['menuOpen'])
        return state

    def play_keyboard(self,midi):
        self.menu('keyboard')
        self.page.locator('.piano-key[data-midi="'+str(midi)+'"]').click()
        self.page.clock.run_for(32)

    def play_floor(self,midi):
        self.floor_key(midi)
        self.page.keyboard.press('e');self.page.clock.run_for(32)
        return self.state()

    def test_major_scale_needs_deliberate_floor_E_and_chopin_reacts_to_mistakes_and_success(self):
        before=self.totals();self.start_scale('d-major',via_chopin=True)
        self.floor_key(60)
        self.assertEqual(self.state()['scaleStep'],0,'Walking over a key does not answer a challenge')
        self.page.keyboard.press('e');self.page.clock.run_for(32)
        wrong=self.state();self.assertEqual(wrong['scaleStep'],0)
        self.assertTrue(wrong['chopinReaction']['active']);self.assertEqual(wrong['chopinReaction']['facing'],'down')
        self.assertTrue(wrong['chopinReaction']['text'])
        self.assertNotRegex(wrong['chopinReaction']['text'].lower(),r'\b(stupid|bad|dumb)\b')
        self.assertEqual(self.totals(),before)
        for index,midi in enumerate(D_MAJOR):
            self.floor_key(midi);self.assertEqual(self.state()['scaleStep'],index)
            self.page.keyboard.press('e');self.page.clock.run_for(32)
            self.assertEqual(self.state()['scaleStep'],index+1)
            if index==2:
                reaction=self.state()['chopinReaction']
                self.assertTrue(reaction['active']);self.assertNotEqual(reaction['emote'],wrong['chopinReaction']['emote'])
        complete=self.state();self.assertTrue(complete['dialogueOpen'])
        self.assertTrue(complete['chopinReaction']['active']);self.assertEqual(complete['chopinReaction']['facing'],'down')
        self.assertNotEqual(complete['chopinReaction']['emote'],wrong['chopinReaction']['emote'])
        self.assertIn('piano-scale:d-major',complete['completed'])
        self.assertEqual(self.totals(),{'notes':before['notes']+35,'xp':before['xp']+100})

    def test_natural_minor_uses_correct_pitch_sequence_and_rewards_only_once_after_reload(self):
        before=self.totals();self.start_scale('a-minor')
        for index,midi in enumerate(A_MINOR):
            self.play_keyboard(midi);self.assertEqual(self.state()['scaleStep'],index+1)
        earned=self.totals();self.assertEqual(earned,{'notes':before['notes']+35,'xp':before['xp']+100})
        self.start_scale('a-minor')
        for midi in A_MINOR:self.play_keyboard(midi)
        self.assertEqual(self.totals(),earned)
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('CodaArcadeQA?.piano')
        enter_room(self.page,'piano');self.page.clock.run_for(64)
        self.start_scale('a-minor')
        for midi in A_MINOR:self.play_keyboard(midi)
        self.assertEqual(self.totals(),earned)

    def test_scale_wall_staff_uses_music_glyphs_and_the_highlight_has_a_bright_outline(self):
        self.page.emulate_media(reduced_motion='reduce')
        self.start_scale('d-major')
        state=self.state();self.assertTrue(state['wallStaff']['visible'])
        self.assertEqual(state['keyHighlight']['midi'],62)
        glyphs=self.page.evaluate('__pianoPaint.glyphs')
        codes={ord(char) for item in glyphs for char in item['text']}
        self.assertIn(0xe050,codes,'The wall uses the actual treble-clef music glyph')
        self.assertTrue({0xe1d5,0xe1d6,0xe0a4}&codes,'The wall draws musical noteheads with Bravura')
        self.assertIn(0xe262,codes,'D major needs sharp notation for F and C')
        self.assertTrue(all('CodaBravura' in item['font'] for item in glyphs))
        self.assertTrue(any(item['width']>=3 and item['alpha']>=.8 for item in self.page.evaluate('__pianoPaint.strokes')),
          'The next floor key needs a strong outline, including with reduced motion')
        self.assertNotRegex(self.page.locator('#pianoroom').inner_text(),r'\b[A-G][0-8]\b')
        self.play_keyboard(61);self.close_panels()
        reaction=self.state()['chopinReaction'];self.assertTrue(reaction['active'])
        self.assertEqual(reaction['facing'],'down')
        self.assertIn(reaction['text'],[item['text'] for item in self.page.evaluate('__pianoPaint.texts')],
          'Chopin feedback remains visibly painted with reduced motion')
        self.page.screenshot(path='/tmp/piano47-scale-staff-desktop.png')

    def test_wall_score_covers_melody_memory_and_interval_without_revealing_memory_answers(self):
        self.menu();self.page.locator('#pianoLesson').select_option('hot-cross-buns')
        self.page.locator('[data-piano-dialogue-action="play"]').click();self.page.clock.run_for(32)
        self.assertEqual(self.state()['challengeMode'],'melody');self.assertTrue(self.state()['wallStaff']['visible'])
        for offset in [4,2,0,4,2,0,0,0,0,0,2,2,2,2,4,2,0]:self.play_keyboard(60+offset)
        self.page.locator('[data-piano-dialogue-action="memory"]').click()
        self.page.locator('[data-piano-dialogue-action="play"]').click();self.page.clock.run_for(32)
        self.assertEqual(self.state()['melodyMode'],'memory');self.assertTrue(self.state()['wallStaff']['visible'])
        self.assertEqual(self.state()['wallStaff']['notes'],[],'A memory score starts blank instead of giving away the melody')
        self.assertFalse(self.state()['keyHighlight']['visible'])
        self.play_keyboard(64)
        self.assertEqual(self.state()['lessonStep'],1)
        self.assertEqual(len(self.state()['wallStaff']['notes']),1,'Only the already-played melody note appears from memory')
        self.play_keyboard(65);self.assertEqual(self.state()['lessonStep'],0)
        self.menu();self.page.locator('#pianoInterval').select_option('up-7')
        self.page.locator('#pianoStartInterval').click()
        self.page.locator('[data-piano-dialogue-action="play"]').click();self.page.clock.run_for(32)
        self.assertEqual(self.state()['challengeMode'],'interval');self.assertTrue(self.state()['wallStaff']['visible'])
        self.play_keyboard(60);self.play_keyboard(67)
        self.assertEqual(self.state()['intervalStep'],2)
        self.menu();self.page.locator('#pianoFreePlay').click();self.page.clock.run_for(32)
        self.assertEqual(self.state()['challengeMode'],'free');self.assertFalse(self.state()['wallStaff']['visible'])
        self.floor_key(60)
        self.assertEqual(self.state()['lastWallNote'],60,'Outside games, walking onto a key still plays it')
        self.assertIn(60,self.state()['held'])

    def test_c_minor_keeps_flat_spellings_and_staff_positions_for_black_keys(self):
        self.start_scale('c-minor')
        score=self.state()['wallStaff'];self.assertTrue(score['visible'])
        e_flat=next(note for note in score['notes'] if note['midi']==63)
        self.assertEqual(e_flat['label'],'E♭');self.assertEqual(e_flat['position'],0)
        self.assertEqual(e_flat['accidental'],'flat')
        codes={ord(char) for item in self.page.evaluate('__pianoPaint.glyphs') for char in item['text']}
        self.assertIn(0xe260,codes)
        self.menu('keyboard')
        self.assertIn('E♭',self.page.locator('.piano-key[data-midi="63"]').get_attribute('aria-label'))
        self.assertIn('B♭',self.page.locator('.piano-key[data-midi="70"]').get_attribute('aria-label'))
        for index,midi in enumerate([60,62,63,65,67,68,70,72,70,68,67,65,63,62,60]):
            self.play_keyboard(midi);self.assertEqual(self.state()['scaleStep'],index+1)
        self.assertIn('piano-scale:c-minor',self.state()['completed'])

    def test_staff_and_clear_highlight_remain_visible_in_mobile_portrait_and_landscape_phone(self):
        self.start_scale('c-major')
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size);self.page.clock.run_for(96)
            self.assertLessEqual(self.page.locator('#pianoroom').evaluate('h=>h.scrollWidth'),size['width']+1)
            score=self.state()['wallStaff'];self.assertTrue(score['visible'])
            self.assertEqual(score['notes'][0]['midi'],60)
            self.assertEqual(score['notes'][0]['position'],-2)
            self.assertEqual(score['notes'][0]['ledgerLines'],[-2],'Middle C needs its short ledger line')
            self.assertEqual(self.state()['keyHighlight']['midi'],60)
            self.assertFalse(self.state()['menuOpen']);self.assertFalse(self.state()['dialogueOpen'])
            self.floor_key(60)
            mirror=self.page.locator('#pianoWallStaff');self.assertTrue(mirror.is_visible())
            box=mirror.bounding_box();viewport=self.page.locator('.piano-room-canvas-viewport').bounding_box()
            self.assertGreaterEqual(box['x'],viewport['x']);self.assertGreaterEqual(box['y'],viewport['y'])
            self.assertLessEqual(box['x']+box['width'],viewport['x']+viewport['width'])
            self.assertLessEqual(box['y']+box['height'],viewport['y']+viewport['height'])
            self.assertGreaterEqual(box['height'],60)
            self.assertEqual(mirror.evaluate('e=>getComputedStyle(e).pointerEvents'),'none')
            self.page.screenshot(path='/tmp/piano47-scale-staff-'+str(size['width'])+'.png')
        self.page.locator('.coda-touch-interact').tap();self.page.clock.run_for(32)
        self.assertEqual(self.state()['scaleStep'],1,'The large mobile Play note action answers the current floor key')


if __name__=='__main__':unittest.main(verbosity=2)
