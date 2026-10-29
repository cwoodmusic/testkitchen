"""Actual-world checks for mnemonic direction, four-beat construction, and meter text.

All classroom entry, answers, quizzes, Undo/Check, and rewards use the shipped UI.
Saved lesson positions only prepare focused examples; no live services are used.
"""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
from classroom_quiz_helpers import answer_quiz
spec=importlib.util.spec_from_file_location('classroom_corrections_helpers',Path(__file__).with_name('kids-learning-browser.py'))
kids=importlib.util.module_from_spec(spec);spec.loader.exec_module(kids)

class ClassroomCorrectionsTests(kids._world.WorldBrowserCase):
 setUp=kids.KidsLearningTests.setUp
 state=kids.KidsLearningTests.state
 room=kids.KidsLearningTests.room
 dismiss=kids.KidsLearningTests.dismiss
 talk_to_haydn=kids.KidsLearningTests.talk_to_haydn
 open_lesson=kids.KidsLearningTests.open_lesson

 def open_at(self,lesson,step):
  self.page.evaluate('''({lesson,step})=>localStorage.setItem('codaClassroomLessonsV1',JSON.stringify({version:1,lessons:{[lesson]:{step,completed:false,completedAt:0}}}))''',{'lesson':lesson,'step':step})
  self.open_lesson(lesson);self.assertEqual(self.state()['active']['step'],step)

 def assert_no_horizontal_overflow(self):
  for selector in ['#musicClassroom','.classroom-books','.classroom-tutorial','.lesson-content']:
   item=self.page.locator(selector)
   self.assertLessEqual(item.evaluate('node=>node.scrollWidth'),item.evaluate('node=>node.clientWidth')+2,selector)

 def mnemonic_flow(self):
  examples=[('note-naming',7,'FACE'),('note-naming',8,'Every Good Boy Does Fine'),('bass-clef',1,'Great Big Dreams For America'),('bass-clef',5,'All Cows Eat Grass'),('grand-staff',0,'Every Good Boy Does Fine'),('grand-staff',1,'Great Big Dreams For America'),('grand-staff',2,'FACE'),('grand-staff',3,'All Cows Eat Grass')]
  for lesson,step,saying in examples:
   self.open_at(lesson,step);lesson_ui=self.page.locator('.classroom-tutorial')
   look=lesson_ui.inner_text()
   # Grand-staff opening cards introduce the two staffs before reminding
   # learners of each line mnemonic through the optional Hint button.
   if lesson!='grand-staff' or step>=2:
    self.assertIn(saying,look);self.assertRegex(look.lower(),r'bottom\s*(?:-|–|to)\s*(?:to\s*)?top')
   self.assertEqual(self.page.locator('[data-note-answer]:visible').count(),0)
   self.page.locator('[data-lesson-try]').click()
   self.assertRegex(lesson_ui.inner_text().lower(),r'bottom\s*(?:-|–|to)\s*(?:to\s*)?top')
   direction=self.page.locator('.lesson-read-direction');self.assertTrue(direction.is_visible())
   self.assertEqual(self.page.locator('[data-note-answer]:visible').count(),7)
   self.assert_no_horizontal_overflow()
   if self.page.viewport_size['height']<=500:
    next_box=self.page.locator('[data-tutorial-next]').bounding_box()
    if next_box['y']+next_box['height']>self.page.viewport_size['height']+1:self.page.screenshot(path='/tmp/classroom51-'+lesson+'-'+str(step)+'-landscape-overflow.png')
    self.assertLessEqual(next_box['y']+next_box['height'],self.page.viewport_size['height']+1,(lesson,step,'Keep Next in view beside landscape notation'))
   if lesson=='grand-staff' and step<2:
    self.page.locator('[data-note-hint]').click();hint=self.page.locator('.tutorial-feedback').inner_text();self.assertIn(saying,hint);self.assertRegex(hint.lower(),r'bottom\s*(?:-|–|to)\s*(?:to\s*)?top')
   if lesson=='bass-clef' and step==5:self.page.screenshot(path='/tmp/classroom51-mnemonic-'+str(self.page.viewport_size['width'])+'.png')
   # A wrong guess preserves both the practice stage and its directional cue.
   answer=self.page.evaluate('({lesson,step})=>CodaClassroomTutorials.NOTE_LESSONS[lesson][step].answer',{'lesson':lesson,'step':step})
   wrong=next(x for x in 'ABCDEFG' if x!=answer)
   self.page.locator('[data-note-answer="'+wrong+'"]').click();self.assertFalse(self.state()['active']['answered']);self.assertTrue(direction.is_visible())

 def test_all_four_memory_sayings_explain_bottom_to_top_in_look_and_try(self):self.mnemonic_flow()
 def test_all_four_memory_sayings_explain_bottom_to_top_in_look_and_try_phone(self):
  self.mnemonic_flow();self.page.set_viewport_size({'width':844,'height':390});self.mnemonic_flow()

 def assert_palette(self):
  for units in [16,8,4,2,1]:
   button=self.page.locator('[data-add-value="'+str(units)+'"]');self.assertTrue(button.is_visible(),str(units));self.assertEqual(button.locator('xpath=ancestor::details').count(),0)
   self.assertGreaterEqual(button.bounding_box()['height'],48)
  self.assertEqual(self.page.get_by_text('More choices',exact=True).count(),0)

 def fill(self,values):
  for units in values:self.page.locator('[data-add-value="'+str(units)+'"]').click()
  self.assertEqual(self.state()['active']['bar'],values)

 def rhythm_flow(self):
  before=self.page.evaluate('CodaArcadeQA.progression().xp')
  recipes=[[4,4,4,4],[8,8],[16],[4,2,2,8],[1]*16]
  for values in recipes:
   self.open_at('rhythm-tree',3);self.page.locator('[data-lesson-try]').click();self.assert_palette()
   self.assertTrue(self.page.locator('[data-check-rhythm]').is_disabled())
   # Undo must remove a real note, including a whole note, before rebuilding.
   first=values[0];self.page.locator('[data-add-value="'+str(first)+'"]').click()
   self.assertEqual(self.state()['active']['bar'],[first]);self.page.locator('[data-rhythm-undo]').click();self.assertEqual(self.state()['active']['bar'],[])
   self.fill(values);self.assert_palette();self.assert_no_horizontal_overflow()
   pattern=self.page.locator('.lesson-pattern');bounds=pattern.bounding_box()
   for note in pattern.locator('.lesson-pattern-note').all():
    box=note.bounding_box();self.assertGreaterEqual(box['x'],bounds['x']-1);self.assertLessEqual(box['x']+box['width'],bounds['x']+bounds['width']+1)
    glyph=note.locator('svg').bounding_box();self.assertGreaterEqual(glyph['width'],32);self.assertGreaterEqual(glyph['height'],40);self.assertGreaterEqual(glyph['x'],box['x']-1);self.assertLessEqual(glyph['x']+glyph['width'],box['x']+box['width']+1)
   self.assertFalse(self.state()['active']['answered']);self.assertFalse(self.page.locator('[data-check-rhythm]').is_disabled())
   self.page.locator('[data-check-rhythm]').click();self.assertTrue(self.state()['active']['answered'],values)
   self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before,'Checking practice cannot grant the quiz reward')
   if len(values)==16:self.page.screenshot(path='/tmp/classroom51-sixteenths-'+str(self.page.viewport_size['width'])+'.png')
  self.page.locator('[data-tutorial-next]').click();self.assertEqual(self.state()['active']['phase'],'quiz')
  answer_quiz(self.page,'rhythm-tree');self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before+50)
  # Replaying the same completed lesson, including a second perfect quiz,
  # cannot manufacture a second completion reward.
  self.dismiss();self.page.locator('[data-tutorial-replay]').click()
  for _ in range(4):self.page.locator('[data-tree-split]').click()
  self.page.locator('[data-tutorial-next]').click()
  for _ in range(2):
   self.page.locator('[data-lesson-try]').click();self.page.locator('[data-rhythm-answer="2"]').click();self.page.locator('[data-tutorial-next]').click()
  self.page.locator('[data-lesson-try]').click();self.fill([8,8]);self.page.locator('[data-check-rhythm]').click();self.page.locator('[data-tutorial-next]').click();answer_quiz(self.page,'rhythm-tree')
  self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before+50)
  self.dismiss();self.load();self.open_lesson('rhythm-tree');self.assertTrue(self.state()['active']['complete']);self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'),before+50)

 def test_any_valid_four_beat_bar_works_with_visible_choices_undo_and_one_reward(self):self.rhythm_flow()
 def test_any_valid_four_beat_bar_fits_the_phone_and_reward_stays_once_phone(self):self.rhythm_flow()

 def meter_flow(self,sizes):
  for size in sizes:
   self.page.set_viewport_size(size)
   for step,meter in [(0,'4/4'),(3,'6/8'),(4,'6/8'),(7,'2/2')]:
    self.open_at('time-signatures',step)
    self.assertEqual(self.page.locator('.signature-symbol').get_attribute('aria-label'),'Cut time sign: two-two' if meter=='2/2' else meter+' time signature')
    for stage in ['look','try']:
     if stage=='try':self.page.locator('[data-signature-try]').click()
     self.assert_no_horizontal_overflow()
     labels=self.page.locator('.signature-pulse').evaluate_all('''nodes=>nodes.map(node=>{const box=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node);const text=range.getBoundingClientRect();return {label:node.textContent,box:{left:box.left,right:box.right,top:box.top,bottom:box.bottom},text:{left:text.left,right:text.right,top:text.top,bottom:text.bottom},font:parseFloat(getComputedStyle(node).fontSize)};})''')
     # Build practice replaces the count picture with filled-note slots.
     if stage=='look' or step!=7:self.assertGreater(len(labels),0)
     for label in labels:
      self.assertGreaterEqual(label['text']['left'],label['box']['left']+1,(size,meter,stage,label));self.assertLessEqual(label['text']['right'],label['box']['right']-1,(size,meter,stage,label))
      self.assertGreaterEqual(label['text']['top'],label['box']['top'],(size,meter,stage,label));self.assertLessEqual(label['text']['bottom'],label['box']['bottom'],(size,meter,stage,label));self.assertGreaterEqual(label['font'],20)
    if step==3:self.page.screenshot(path='/tmp/classroom51-meter-'+str(size['width'])+'x'+str(size['height'])+'.png')

 def test_meter_count_labels_fit_each_box_on_desktop(self):self.meter_flow([{'width':1440,'height':1000}])
 def test_meter_count_labels_fit_narrow_phone_and_landscape_phone(self):self.meter_flow([{'width':320,'height':740},{'width':390,'height':844},{'width':844,'height':390}])

if __name__=='__main__':unittest.main(verbosity=2)
