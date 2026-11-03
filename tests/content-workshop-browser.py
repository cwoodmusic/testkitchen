"""The delivered file edits and exports without the arcade or any network."""
import json
from pathlib import Path
import unittest
from playwright.sync_api import sync_playwright

EDITOR = Path('/workspace/scratch/coda-content-workshop/coda-content-editor.html')


class ContentWorkshopBrowserTests(unittest.TestCase):
    def test_offline_editor_round_trips_dialogue_questions_rewards_and_new_entries(self):
        with sync_playwright() as pw:
            browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
            context = browser.new_context(accept_downloads=True, offline=True, viewport={'width':1440,'height':1000})
            page = context.new_page()
            page.set_default_timeout(20000)
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            # Managed Chromium blocks file:// navigation by administrator policy.
            # Execute the exact delivered bytes in an offline document instead.
            page.set_content(EDITOR.read_text(), wait_until='load')
            self.assertEqual(page.locator('#nav button').count(), 13)
            page.locator('#entries button').first.click()
            page.get_by_label('Description', exact=True).fill('Offline revised musician description.')
            page.get_by_role('button', name='History quests & rewards', exact=True).click()
            page.get_by_label('PASS SCORE', exact=True).fill('90')
            page.get_by_label('PASS SCORE', exact=True).press('Tab')
            page.get_by_role('button', name='History facts & questions', exact=True).click()
            page.locator('#detail .nested').filter(has_text='Questions ·').get_by_role('button', name='Open collection').click()
            page.get_by_role('button', name='Add entry', exact=True).click()
            page.get_by_label('Prompt', exact=True).fill('Which instrument is featured in this edited question?')
            page.get_by_label('Answer', exact=True).select_option('2')
            page.get_by_role('button', name='Check file', exact=True).click()
            self.assertEqual(page.locator('#dialogTitle').inner_text(), 'Content check passed')
            page.get_by_role('button', name='Close', exact=True).click()
            with page.expect_download() as download_info:
                page.get_by_role('button', name='Export JSON', exact=True).click()
            output = Path('/workspace/scratch/workshop-edited-test.json')
            download_info.value.save_as(str(output))
            data = json.loads(output.read_text())
            self.assertEqual(data['content']['conversations'][0]['entry']['description'], 'Offline revised musician description.')
            self.assertEqual(data['content']['historyProgression']['PASS_SCORE'], 90)
            self.assertEqual(len(data['content']['history']['questions']), 181)
            self.assertEqual(data['content']['history']['questions'][-1]['answer'], 2)
            self.assertEqual(data['content']['history']['questions'][-1]['prompt'], 'Which instrument is featured in this edited question?')
            page.locator('#file').set_input_files(str(output))
            page.wait_for_function("document.querySelector('#status').textContent.startsWith('Opened ')")
            with page.expect_download() as reopened_info:
                page.get_by_role('button', name='Export JSON', exact=True).click()
            reopened = Path('/workspace/scratch/workshop-reopened-test.json')
            reopened_info.value.save_as(str(reopened))
            self.assertEqual(json.loads(reopened.read_text())['content'], data['content'])
            page.screenshot(path='/workspace/scratch/coda-content-workshop-preview.png', full_page=True)
            self.assertEqual(errors, [])
            context.close()
            browser.close()


if __name__ == '__main__':
    unittest.main(verbosity=2)
