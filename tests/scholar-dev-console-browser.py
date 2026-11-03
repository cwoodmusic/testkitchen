"""History-console mounting preserves focus and stays outside world-project data."""
import importlib.util
from pathlib import Path
import unittest

_spec=importlib.util.spec_from_file_location('history_console_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)

PROBE='''(() => {
 const probe=window.__historyConsoleProbe={ready:true,mounts:0,disposes:0,controller:null};
 const view={renderDeveloper(host){
  probe.mounts++;
  const label=document.createElement('label');label.textContent='Preview collection';
  const input=document.createElement('input');input.id='historyConsoleProbeInput';input.setAttribute('aria-label','Preview collection');input.value='Bach';label.append(input);host.append(label);
  const button=document.createElement('button');button.type='button';button.textContent='Preview action';button.onclick=()=>probe.activated=(probe.activated||0)+1;host.append(button);
  return {dispose(){probe.disposes++;}};
 }};
 let factory,wrapped;
 Object.defineProperty(window,'createCodaDeveloperConsole',{configurable:true,get(){return wrapped;},set(value){
  factory=value;wrapped=api=>{const console=factory({...api,historyProgress:()=>probe.ready?view:null});probe.controller=console;return console;};
 }});
})();'''

class ScholarDeveloperConsoleTests(_world.WorldBrowserCase):
    def load(self):
        if not getattr(self,'probe_installed',False):
            self.context.add_init_script(PROBE);self.probe_installed=True
        super().load()

    def open_history(self):
        self.page.keyboard.press('F2')
        self.page.locator('#devTab-history').click()
        self.page.locator('#historyConsoleProbeInput').wait_for()

    def test_refresh_keeps_control_focus_and_history_never_enters_project_exports(self):
        before=self.page.evaluate('CodaDeveloperConsole.getProject()')
        self.open_history()
        field=self.page.get_by_label('Preview collection');field.fill('Edited collection');field.focus()
        self.page.evaluate('()=>{for(let n=0;n<30;n++)__historyConsoleProbe.controller.refresh();}')
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.mounts'),1)
        self.assertEqual(field.input_value(),'Edited collection')
        self.assertTrue(field.evaluate('el=>el===document.activeElement'))
        self.page.locator('#dev-history').get_by_role('button',name='Preview action',exact=True).focus()
        self.page.keyboard.press('Enter')
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.activated'),1)
        self.assertEqual(self.page.evaluate('CodaDeveloperConsole.getProject()'),before)
        self.page.locator('#devTab-project').click()
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.disposes'),1)
        self.page.locator('#devTab-history').click()
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.mounts'),2)
        self.page.locator('#devHistoryRefresh').click()
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.mounts'),3)
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.disposes'),2)

    def test_a_late_history_controller_recovers_without_reopening_console(self):
        self.page.evaluate('__historyConsoleProbe.ready=false')
        self.page.keyboard.press('F2');self.page.locator('#devTab-history').click()
        self.assertIn('loading',self.page.locator('#devHistoryContent').inner_text())
        self.page.evaluate('__historyConsoleProbe.ready=true;__historyConsoleProbe.controller.refresh()')
        self.page.get_by_label('Preview collection').wait_for()
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.mounts'),1)
        self.page.keyboard.press('F2')
        self.assertEqual(self.page.evaluate('__historyConsoleProbe.disposes'),1)

if __name__=='__main__':unittest.main(verbosity=2)
