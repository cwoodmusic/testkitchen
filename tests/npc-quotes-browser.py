"""Real conversation engine and UI keep quotation sources attached on desktop and phone."""
from pathlib import Path
import json
import unittest
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]

class QuotationBrowserTests(unittest.TestCase):
 def test_plain_quote_and_single_advice_choice_on_desktop_and_phone(self):
  with sync_playwright() as pw:
   browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
   for width,height in [(1200,900),(390,844)]:
    context=browser.new_context(viewport={'width':width,'height':height},offline=True);page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.set_content('''<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{font:16px system-ui}#dialog{max-width:600px;max-height:90vh;overflow:auto}button{min-height:44px;margin:4px}.musician-choices{display:grid}small{display:block}</style><button id="accountBtn">Guest</button><canvas id="room" tabindex="0"></canvas><div id="dialog"><strong id="who"></strong><p id="words"></p><button id="close">Close</button></div>''')
    for file in ['npc-quotes.js','npc-behavior.js','musician-ui.js']:page.add_script_tag(content=(ROOT/file).read_text())
    page.evaluate('''()=>{
     window.person={id:'bach',x:100,y:100,userPlaced:true};window.brain=createCodaNPCBehavior({npcs:[person],inside:()=>true,route:()=>[],getGames:()=>[],getPlayer:()=>({x:0,y:0})});
     window.historyOpened=false;window.ui=createCodaMusicianUI({npcs:[person],canvas:document.querySelector('#room'),getBrain:()=>brain,clearInput(){},openHistory:id=>historyOpened=id,historyState:()=>({hasNewFact:true}),openMissions(){throw Error('Legacy missions should not open from chat')},getMission:()=>({status:'active'}),openTrivia(){throw Error('Legacy trivia should not open from chat')}});ui.talk(person);
    }''')
    self.assertEqual(page.locator('#words').inner_text(),page.evaluate("CodaMusicianQuotes.line('bach')"))
    self.assertEqual(page.locator('.musician-choices button').all_text_contents(),['Advice','! New history fact'])
    self.assertEqual(page.locator('#dialog small').count(),0)
    self.assertFalse(page.locator('.musician-description').is_visible())
    page.get_by_role('button',name='Advice',exact=True).click()
    self.assertIn('Counterpoint is like two friends',page.locator('#words').inner_text())
    entry=json.loads((ROOT/'published-world-project.json').read_text())['dialogue']['bach']
    page.evaluate('''entry=>{ui.closeConversation();window.brain=createCodaNPCBehavior({npcs:[person],inside:()=>true,route:()=>[],getGames:()=>[],getPlayer:()=>({x:0,y:0}),getDialogue:()=>entry});ui.talk(person);}''',entry)
    self.assertEqual(page.locator('#words').inner_text(),entry['greetings'][0]);self.assertEqual(page.locator('.musician-choices button').count(),2)
    page.get_by_role('button',name='Advice',exact=True).click();self.assertEqual(page.locator('#words').inner_text(),entry['choices'][0]['reply'])
    page.get_by_role('button',name='! New history fact',exact=True).click();self.assertEqual(page.evaluate('historyOpened'),'bach')
    self.assertLessEqual(page.evaluate('document.documentElement.scrollWidth'),width)
    self.assertEqual(errors,[]);context.close()
   browser.close()

if __name__=='__main__':unittest.main(verbosity=2)
