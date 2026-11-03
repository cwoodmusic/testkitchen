"""Friendship dialogue retains quests without redundant game travel buttons."""
from pathlib import Path
import re
import unittest
from playwright.sync_api import sync_playwright

class DialogueTests(unittest.TestCase):
    def test_active_quest_has_progress_without_go_to_button(self):
        with sync_playwright() as driver:
            browser=driver.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            try:
                page=browser.new_page()
                page.set_content('<!doctype html><html><body></body></html>')
                for source in ['music-history-data.js','music-history-quiz-data.js','music-history-content.js','music-history-progress.js','music-history.js']:
                    page.add_script_tag(path=str(Path(__file__).resolve().parent.parent/source))
                page.evaluate("""()=>{const values=new Map();window.historyUI=CodaMusicHistory.create({storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},canTalk:()=>true,canUse:()=>true,canVisitScholar:()=>true});historyUI.discover('bach')}""")
                page.get_by_role('button',name='Accept friendship quest',exact=True).click()
                self.assertIn('Quest in progress',page.locator('.music-history').inner_text())
                self.assertEqual(page.get_by_role('button',name=re.compile(r'^Go to ')).count(),0)
                page.get_by_role('button',name='Close',exact=True).click()
                page.evaluate("historyUI.discover('bach')")
                self.assertIn('Quest in progress',page.locator('.music-history').inner_text())
            finally:
                browser.close()

if __name__=='__main__':unittest.main()
