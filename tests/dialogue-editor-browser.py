"""The production dialogue editor saves data and changes real NPC conversation."""
import importlib.util
import json
from pathlib import Path
from world_navigation_helpers import talk_to_musician
import sys
import unittest

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('learning_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class DialogueEditorTests(_world.WorldBrowserCase):
    def editor(self,person='bach'):
        self.page.evaluate('CodaDeveloperConsole.open("dialogue")')
        self.page.locator('#devDialoguePerson').select_option(person)

    def project(self):
        return self.page.evaluate('CodaDeveloperConsole.getProject()')

    def apply_greeting(self,text='Welcome, music explorers!'):
        self.editor()
        self.page.get_by_label('Greeting 1',exact=True).fill(text)
        self.page.get_by_role('button',name='Remove greeting 2',exact=True).click()
        self.page.locator('#devDialogueApply').click()

    def test_draft_preview_typing_custom_choices_apply_and_actual_conversation(self):
        original=self.project();self.editor()
        position=self.page.evaluate('CodaArcadeQA.position()')
        greeting=self.page.get_by_label('Greeting 1',exact=True)
        greeting.fill('wasd q e — welcome to our music class!')
        greeting.press('Space');greeting.press('ArrowLeft')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.position()'),position,'Typing dialogue must not move the avatar')
        self.assertNotIn('dialogue',self.project(),'Draft text is previewed before it is applied')
        self.page.get_by_role('button',name='Remove greeting 2',exact=True).click()
        greeting.fill('Welcome, music explorers!')
        self.page.get_by_label('About this musician',exact=True).fill('Our friendly music guide.')
        self.page.get_by_role('button',name='Add conversation choice',exact=True).click()
        self.page.get_by_label('Button label 5',exact=True).fill('What makes timbre special?')
        literal='<img src=x onerror="window.dialogueAttack=true"> A flute and trumpet have different tone colors.'
        self.page.get_by_label('Reply 5',exact=True).fill(literal)
        self.page.get_by_role('button',name='Move choice 5 up',exact=True).click()
        preview=self.page.locator('.dialogue-preview')
        preview.get_by_role('button',name='What makes timbre special?',exact=True).click()
        self.assertEqual(preview.locator('.dialogue-preview-line').inner_text(),literal)
        self.assertEqual(preview.locator('img').count(),0)
        self.page.locator('#devDialogueApply').click()
        changed=self.project()
        self.assertEqual(changed['dialogue']['bach']['greetings'],['Welcome, music explorers!'])
        self.assertEqual(changed['dialogue']['bach']['choices'][3]['id'],'custom-1')
        for key in ['assets','collision','strokes']:self.assertEqual(changed[key],original[key])
        self.page.locator('#devUndo').click();self.assertNotIn('dialogue',self.project())
        self.page.locator('#devRedo').click();self.assertEqual(self.project(),changed)
        self.page.locator('#view').focus();self.page.keyboard.press('F2')
        talk_to_musician(self.page,'bach')
        self.assertEqual(self.page.locator('#words').inner_text(),'Welcome, music explorers!')
        self.assertEqual(self.page.locator('.musician-description').inner_text(),'Our friendly music guide.')
        self.page.locator('#dialog').get_by_role('button',name='What makes timbre special?',exact=True).click()
        self.assertEqual(self.page.locator('#words').inner_text(),literal)
        self.assertEqual(self.page.locator('#dialog img').count(),0)
        self.assertIsNone(self.page.evaluate('window.dialogueAttack'))

    def test_save_reload_export_import_reset_and_old_projects_preserve_layout(self):
        original=self.project();self.apply_greeting();edited=self.project()
        self.page.evaluate('CodaDeveloperConsole.open("project")')
        self.page.locator('#devSave').click()
        self.page.wait_for_function('/saved/i.test(document.querySelector("#devStatus").textContent)')
        self.load();self.assertEqual(self.project(),edited)
        self.editor()
        self.assertEqual(self.page.get_by_label('Greeting 1',exact=True).input_value(),'Welcome, music explorers!')
        self.page.evaluate('CodaDeveloperConsole.open("project")')
        with self.page.expect_download() as download:self.page.locator('#devExport').click()
        self.assertEqual(json.loads(Path(download.value.path()).read_text()),edited)
        self.editor();self.page.locator('#devDialogueReset').click()
        self.assertEqual(self.project(),original)
        self.page.locator('#devUndo').click();self.assertEqual(self.project(),edited)
        self.page.evaluate('CodaDeveloperConsole.open("project")')
        self.page.once('dialog',lambda dialog:dialog.accept())
        self.page.locator('#devImportFile').set_input_files({'name':'old-world.json','mimeType':'application/json','buffer':json.dumps(original).encode()})
        self.page.wait_for_function('!CodaDeveloperConsole.getProject().dialogue')
        self.assertEqual(self.project(),original,'An old V1 world still imports and restores default dialogue')
        self.page.locator('#devUndo').click();self.assertEqual(self.project(),edited)
        invalid=json.loads(json.dumps(edited));invalid['dialogue']['bach']['greetings']=['x'*501]
        self.page.locator('#devImportFile').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':json.dumps(invalid).encode()})
        self.page.wait_for_function('/Import failed/.test(document.querySelector("#devStatus").textContent)')
        self.assertEqual(self.project(),edited,'Invalid dialogue must not replace a valid world project')

    def test_phone_editor_labels_targets_and_unsaved_drafts_stay_usable(self):
        self.page.set_viewport_size({'width':390,'height':844});self.editor()
        self.page.get_by_label('Greeting 1',exact=True).fill('Bach draft stays here.')
        self.page.locator('#devDialoguePerson').select_option('miles')
        self.page.get_by_label('Greeting 1',exact=True).fill('Miles has space for a new idea.')
        self.page.locator('#devDialogueApply').click()
        self.page.locator('#devDialoguePerson').select_option('bach')
        self.assertEqual(self.page.get_by_label('Greeting 1',exact=True).input_value(),'Bach draft stays here.')
        self.assertNotIn('bach',self.project()['dialogue'],'Only the selected musician is applied')
        geometry=self.page.locator('#dev-dialogue').evaluate('''host=>({width:host.scrollWidth,buttons:[...host.querySelectorAll('button')].map(button=>({width:button.getBoundingClientRect().width,height:button.getBoundingClientRect().height})),fields:[...host.querySelectorAll('input,textarea,select')].map(field=>getComputedStyle(field).fontSize)})''')
        self.assertLessEqual(geometry['width'],390)
        self.assertTrue(all(button['width']>=44 and button['height']>=44 for button in geometry['buttons']),geometry)
        self.assertTrue(all(float(size.removesuffix('px'))>=16 for size in geometry['fields']))
        self.page.locator('#dev-dialogue').screenshot(path='/tmp/coda-dialogue-editor30-phone.png')


if __name__=='__main__':unittest.main(verbosity=2)
