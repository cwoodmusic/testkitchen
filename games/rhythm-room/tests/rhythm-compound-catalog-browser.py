"""Compound-meter controls and actual font bounds, using the real app and samples."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('compound_fixture',Path(__file__).with_name('rhythm-meters-browser.py'))
fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)

class CompoundCatalogTests(unittest.TestCase):
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

    def selected(self):
        return self.page.locator('#choices input:checked').evaluate_all('nodes=>nodes.map(node=>node.id)')

    def test_compound_choices_replace_the_simple_catalog_and_remember_each_meter(self):
        self.choose('4/4',['whole','quarter-rest'])
        simple=self.selected()
        fixture.RhythmMetersTests.choose_meter(self,'6/8')
        self.assertEqual(self.page.locator('#choose-quarter').count(),0)
        self.assertEqual(self.page.locator('#choices input').count(),18)
        self.assertEqual(set(self.selected()),{'choose-compound-dotted-quarter','choose-compound-eighth-quarter','choose-compound-quarter-eighth','choose-compound-three-eighths'})
        rest_names=self.page.locator('#choices fieldset').last.locator('label span').all_text_contents()
        self.assertEqual(rest_names,['Dotted half rest','Dotted quarter rest','Quarter rest','Eighth rest'])
        self.page.locator('#all').click()
        self.assertEqual(len(self.selected()),18)
        self.assertFalse(self.page.locator('#play').is_disabled())
        self.page.locator('#none').click()
        self.assertEqual(self.selected(),[])
        self.assertTrue(self.page.locator('#play').is_disabled())
        self.page.locator('#choose-compound-quarter-eighth').check()
        compound=self.selected()
        fixture.RhythmMetersTests.choose_meter(self,'2/2')
        self.page.locator('#none').click();self.page.locator('#choose-half').check()
        cut=self.selected()
        fixture.RhythmMetersTests.choose_meter(self,'4/4')
        self.assertEqual(self.selected(),simple)
        fixture.RhythmMetersTests.choose_meter(self,'6/8')
        self.assertEqual(self.selected(),compound)
        fixture.RhythmMetersTests.choose_meter(self,'2/2')
        self.assertEqual(self.selected(),cut)

    def test_compound_figures_fill_real_pulses_and_produce_the_requested_counts(self):
        self.choose('6/8',['compound-quarter-eighth'])
        self.assertEqual(self.count_tokens(),['1','li','2','li'])
        self.assertEqual(self.page.evaluate('events.slice(0,4).map(n=>n.duration)'),[1,.5,1,.5])
        self.choose('6/8',['compound-three-eighths'])
        self.assertEqual(self.count_tokens(),['1','la','li','2','la','li'])
        self.assertEqual(self.page.evaluate('notationBeams(events).map(g=>g.length)'),[3,3,3,3])
        self.choose('6/8',['compound-six-sixteenths'])
        self.assertEqual(self.page.evaluate('notationBeams(events).map(g=>g.length)'),[6,6,6,6])
        self.page.locator('#all').click()
        for trial in range(12):
            self.page.locator('#generate').click()
            shapes=self.page.evaluate('''()=>{let beat=0;return phrase.map(block=>{
              const value={start:beat,length:block.notes.reduce((sum,n)=>sum+Math.abs(n),0)};beat+=value.length;return value;});}''')
            self.assertEqual(sum(block['length'] for block in shapes),6)
            self.assertTrue(all(block['start']%1.5==0 for block in shapes))
            self.assertTrue(all(block['length'] in [1.5,3] for block in shapes))

    def test_stacked_numerals_do_not_touch_and_remain_readable_on_a_phone(self):
        for meter in ['4/4','2/2','6/8']:
            self.choose(meter)
            self.page.evaluate("document.fonts.load('64px Bravura')")
            boxes=self.page.locator('#staff [data-time-signature]').evaluate_all('''nodes=>nodes.map(node=>{
              const box=node.getBBox();return {text:node.dataset.glyph,x:box.x,y:box.y,width:box.width,height:box.height};})''')
            self.assertEqual(len(boxes),2)
            self.assertLess(boxes[0]['y']+boxes[0]['height'],boxes[1]['y'],meter+' numerals must have a visible gap')
            self.assertGreaterEqual(boxes[0]['y'],0)
            self.assertLessEqual(boxes[1]['y']+boxes[1]['height'],230)
            self.assertGreater(boxes[0]['height'],20)
        self.choose('6/8',['compound-quarter-eighth'])
        self.page.locator('.staff').scroll_into_view_if_needed()
        self.page.screenshot(path='/tmp/rhythm-six-eight-signature-desktop.png')
        self.page.set_viewport_size({'width':390,'height':844})
        self.page.locator('.staff').scroll_into_view_if_needed()
        self.assertTrue(self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        bounds=self.page.locator('#staff [data-time-signature]').evaluate_all('nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,width:node.getBoundingClientRect().width}))')
        self.assertTrue(all(box['height']>=22 and box['width']>=16 for box in bounds))
        self.page.screenshot(path='/tmp/rhythm-six-eight-signature-phone.png')

if __name__=='__main__':unittest.main(verbosity=2)
