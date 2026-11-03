"""Counts follow the actual written rhythm under its noteheads, on the audio clock."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('written_count_fixture',Path(__file__).with_name('rhythm-meters-browser.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)

class WrittenCountsTests(unittest.TestCase):
    setUpClass=classmethod(fixture.RhythmMetersTests.setUpClass.__func__)
    tearDownClass=classmethod(fixture.RhythmMetersTests.tearDownClass.__func__)
    setUp=fixture.RhythmMetersTests.setUp
    tearDown=fixture.RhythmMetersTests.tearDown
    route=fixture.RhythmMetersTests.route
    choose=fixture.RhythmMetersTests.choose
    start=fixture.RhythmMetersTests.start
    at=fixture.RhythmMetersTests.at
    state=fixture.RhythmMetersTests.state
    count_tokens=fixture.RhythmMetersTests.count_tokens
    active_count=fixture.RhythmMetersTests.active_count

    def install(self,values,meter='4/4'):
        self.choose(meter)
        self.page.evaluate('''values=>{phrase=[{id:'written-example-a',notes:values},
          {id:'written-example-b',notes:values}];draw();}''',values)

    def assert_alignment(self):
        values=self.page.evaluate('''()=>[...document.querySelectorAll('#rhythm-counts text')].map(node=>{
          const token=countTokens[Number(node.dataset.countIndex)],note=events[token.noteIndex],box=node.getBBox();
          return {x:Number(node.getAttribute('x')),expected:token.held?staffX(token.beat):note.x,
            left:box.x,right:box.x+box.width,beat:token.beat};})''')
        for value in values:self.assertAlmostEqual(value['x'],value['expected'],places=6)
        for left,right in zip(values,values[1:]):
            self.assertLess(left['right'],right['left'], 'Adjacent count syllables must not overlap')

    def test_requested_mixed_rhythm_replaces_old_beat_row_with_exact_onset_counts(self):
        values=[.5,.25,.25,.5,.5,.25,.25,.25,.25,.5,.5]
        self.install(values)
        self.assertEqual(self.count_tokens(),['1','&','a','2','&','3','e','&','a','4','&'])
        self.assertEqual(self.page.locator('#rhythm-counting').count(),0)
        self.assertEqual(self.page.locator('#staff .beatbox').count(),0)
        self.assertEqual(self.page.locator('#rhythm-counts text').count(),len(values)*2)
        self.assertEqual(self.page.locator('#counting option').all_text_contents(),['Rhythm counts','Off'])
        self.page.evaluate("document.fonts.ready")
        self.assert_alignment()
        self.start()
        for beat,expected in [(.01,'1'),(.51,'&'),(.76,'a'),(1.01,'2'),(2.26,'e'),(2.76,'a'),(3.51,'&')]:
            self.at(beat);self.assertEqual(self.active_count(),[expected])
            old=self.active_count();self.page.wait_for_timeout(90);self.assertEqual(self.active_count(),old)
        self.at(8.1)
        self.assertEqual(self.active_count(),[], 'The preparation countdown does not play the staff counts')
        self.page.set_viewport_size({'width':1440,'height':1000})
        self.page.locator('.staff').scroll_into_view_if_needed()
        self.at(2.26)
        self.page.screenshot(path='/tmp/rhythm-written-counts-desktop.png')

    def test_long_notes_show_only_each_main_beat_during_the_hold(self):
        for values,labels,beat_points in [
          ([2,1,1],['1','2','3','4'],[(1.1,'2')]),
          ([4],['1','2','3','4'],[(1.1,'2'),(2.1,'3'),(3.1,'4')]),
          ([3,1],['1','2','3','4'],[(1.1,'2'),(2.1,'3')]),
          ([1.5,.5,2],['1','2','&','3','4'],[(1.1,'2'),(1.6,'&'),(3.1,'4')]),
        ]:
            with self.subTest(values=values):
                self.install(values);self.assertEqual(self.count_tokens(),labels);self.assert_alignment();self.start()
                for beat,label in beat_points:self.at(beat);self.assertEqual(self.active_count(),[label])
                self.page.locator('#stop').click()

    def test_compound_and_cut_time_keep_their_big_beat_syllables(self):
        for meter,values,labels in [
          ('6/8',[.5]*6,['1','la','li','2','la','li']),
          ('6/8',[1,.5,1,.5],['1','li','2','li']),
          ('6/8',[3],['1','2']),
          ('2/2',[4],['1','2']),
          ('2/2',[2,2],['1','2']),
          ('2/2',[1,1,1,1],['1','&','2','&']),
        ]:
            with self.subTest(meter=meter,values=values):
                self.install(values,meter);self.assertEqual(self.count_tokens(),labels);self.assert_alignment()

    def test_rest_counts_are_parenthesized_silent_and_gray_under_the_rest(self):
        self.install([1,-1,.5,.5,1])
        self.assertEqual(self.count_tokens(),['1','(2)','3','&','4'])
        self.assert_alignment();self.start();self.at(13.2)
        self.assertEqual(self.active_count(),['(2)'])
        node=self.page.locator('#rhythm-counts text.active')
        self.assertEqual(node.get_attribute('data-rest'),'true')
        self.assertNotEqual(node.evaluate('n=>getComputedStyle(n).fill'),self.page.locator('#count0').evaluate('n=>getComputedStyle(n).fill'))
        self.assertEqual(self.state()['round']['targets'],[0,1.5,1.875,2.25,3,4.5,4.875,5.25])
        self.assertEqual(self.state()['round']['extras'],0)
        self.page.locator('#stop').click();self.install([-4]);self.assertEqual(self.count_tokens(),['(1)','(2)','(3)','(4)'])

    def test_phone_staff_scroll_keeps_counts_aligned_and_off_does_not_change_input(self):
        self.page.set_viewport_size({'width':390,'height':844})
        self.install([.5,.25,.25,.5,.5,.25,.25,.25,.25,.5,.5])
        self.page.locator('.staff').scroll_into_view_if_needed()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.assertTrue(self.page.locator('.staff').evaluate('node=>node.scrollWidth>node.clientWidth'))
        self.assert_alignment();self.start();self.at(.76)
        self.page.screenshot(path='/tmp/rhythm-written-counts-phone.png')
        before=self.state()
        fixture.RhythmMetersTests.configure(self,counting='off')
        self.assertTrue(self.state()['running']);self.assertEqual(self.state()['origin'],before['origin'])
        self.assertTrue(self.page.locator('#rhythm-counts').is_hidden())
        self.page.locator('.staff').evaluate('node=>node.scrollLeft=node.scrollWidth')
        self.assertTrue(self.page.locator('#n21').is_visible())
        fixture.RhythmMetersTests.configure(self,counting='on');self.at(4.01)
        self.assertEqual(self.active_count(),['1'])
        self.assertEqual(self.state()['reports'],[])

if __name__=='__main__':unittest.main(verbosity=2)
