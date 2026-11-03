"""Printable cards use unique, private-code-free PDF titles and clean up."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec=importlib.util.spec_from_file_location('student_card_print_base',Path(__file__).with_name('classroom-profile-ui-browser.py'))
base=importlib.util.module_from_spec(spec);spec.loader.exec_module(base)


class StudentCardPrintTests(base.ClassroomProfileUITests):
 def setUp(self):
  super().setUp()
  self.page.evaluate('''()=>{
   document.title='Original arcade title';window.__printTitles=[];window.__printOutcome='success';
   window.__nextPrintId='profile_A';const originalReceipt=__receipt;
   window.__receipt=()=>({...originalReceipt(__nextPrintId),alias:'Blue Fox 14'});
   window.print=()=>{__printTitles.push(document.title);
    if(__printOutcome==='throw')throw Error('Synthetic unavailable printer');
    if(__printOutcome!=='hold')queueMicrotask(()=>dispatchEvent(new Event('afterprint')));
   };
  }''')

 def make_card(self, profile_id):
  self.page.evaluate('id=>__nextPrintId=id', profile_id)
  self.page.locator('#classpassCreateProfile').click();self.idle()
  self.assertTrue(self.page.locator('#classpassPrint').is_visible())

 def assert_restored(self):
  self.assertEqual(self.page.title(), 'Original arcade title')
  self.assertEqual(self.page.locator('.classroom-print-sheet').count(), 0)
  self.assertFalse(self.page.evaluate('document.documentElement.classList.contains("coda-classroom-printing")'))

 def test_same_alias_cards_with_distinct_long_ids_have_distinct_safe_pdf_filenames(self):
  self.admin();ids=['profile_'+'a'*55+'A','profile_'+'a'*55+'B']
  for profile_id in ids:
   self.make_card(profile_id)
   private_pass=self.page.locator('.classpass-pass').inner_text()
   self.page.locator('#classpassPrint').click();self.assert_restored()
   title=self.page.evaluate('__printTitles.at(-1)')
   self.assertEqual(title, 'Coda-Card-Blue-Fox-14-'+profile_id)
   self.assertNotIn(private_pass, title);self.assertNotIn('PRIVATE-PASS', title)
   self.assertNotIn('https', title);self.assertNotIn('classroom-pass', title)
   self.page.locator('#classpassHide').click()
  self.assertEqual(len(set(self.page.evaluate('__printTitles'))), 2)

 def test_print_cancel_and_print_error_restore_title_and_remove_print_only_dom(self):
  self.admin();self.make_card('profile_cancel_1234')
  self.page.evaluate("__printOutcome='cancel'");self.page.locator('#classpassPrint').click();self.assert_restored()
  self.page.evaluate("__printOutcome='throw'");self.page.locator('#classpassPrint').click();self.assert_restored()
  self.assertIn('Printing could not open', self.page.locator('#classpassStatus').inner_text())
  self.assertTrue(self.page.locator('#classpassCopy').is_enabled())

 def test_closing_card_during_an_unfinished_print_restores_original_title(self):
  self.admin();self.make_card('profile_closed_1234')
  self.page.evaluate("__printOutcome='hold'");self.page.locator('#classpassPrint').click()
  self.assertEqual(self.page.title(), 'Coda-Card-Blue-Fox-14-profile_closed_1234')
  self.page.locator('#classpassHide').click();self.assert_restored()


if __name__ == '__main__':
 suite=unittest.TestSuite(StudentCardPrintTests(name) for name in StudentCardPrintTests.__dict__ if name.startswith('test_'))
 result=unittest.TextTestRunner(verbosity=2).run(suite);sys.exit(not result.wasSuccessful())
