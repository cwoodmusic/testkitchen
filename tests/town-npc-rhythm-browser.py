"""Actual town conversation rebuilds a heard rhythm using saved yellow inventory."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/rhythm-timed/npc'
OUT.mkdir(parents=True,exist_ok=True)
VALUES=['quarter','eighth-pair','sixteenth-group','quarter-rest']
NAMES={'quarter':'Quarter note','eighth-pair':'Two eighth notes','sixteenth-group':'Four sixteenth notes','quarter-rest':'Quarter rest'}
SEED={'version':1,'stars':0,'netWins':0,'fish':{},'yellowNotes':{value:4 for value in VALUES},'npcRhythmWins':{}}

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*_):
        pass
    def copyfile(self,source,output):
        try:
            super().copyfile(source,output)
        except (BrokenPipeError,ConnectionResetError):
            pass

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1550,'height':1080})
        context.add_init_script('''if(!localStorage.getItem('codaTownAdventuresV1:guest'))localStorage.setItem('codaTownAdventuresV1:guest',%s);'''%json.dumps(json.dumps(SEED)))
        page=context.new_page()
        page.set_default_timeout(60000)
        errors=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.goto(f'http://127.0.0.1:{server.server_port}/town/builder/')
        page.wait_for_function('!!window.townBuilder')
        page.locator('#file').set_input_files(str(ROOT/'town/maps/coda-town-plaza-boardwalk.json'))
        page.wait_for_function('townBuilder.project.objects.length===137')
        if not page.evaluate('townBuilder.npcsVisible'):
            page.locator('#npcToggle').click()
        page.wait_for_timeout(700)
        # Seed only a safe player spawn and existing collected-card fixture.
        # The request is reached through the live resident's E conversation.
        fixture=page.evaluate('''()=>{
            const d=structuredClone(townBuilder.project);
            const actor=townBuilder.ambient.actors.find(a=>a.id==='bach'&&!a.hidden);
            if(!actor)throw Error('Bach must be visiting the street');
            d.spawn={x:actor.x+35,y:actor.y+30};return d;
        }''')
        page.locator('#file').set_input_files({'name':'npc-rhythm-fixture.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()})
        page.wait_for_timeout(400)
        page.locator('#walk').click()
        page.locator('#map').focus()
        page.keyboard.press('e')
        page.get_by_role('button',name='Hear rhythm request',exact=True).click()
        page.wait_for_selector('#npcRhythmCount')
        page.wait_for_timeout(700)
        assert page.locator('.npc-rhythm-dialog svg').count()==0,'The heard answer must not be shown'
        page.screenshot(path=str(OUT/'listen-by-ear.png'))
        state=lambda:page.evaluate('townBuilder.urban.activities.state.npcRhythmRequest')
        page.wait_for_function('townBuilder.urban.activities.state.npcRhythmRequest.phase==="arrange"',timeout=20000)
        initial=state()
        target=initial['target']
        actor_id=initial['actorId']
        assert len(target)==4
        assert initial['inventory']==SEED['yellowNotes']
        assert page.evaluate('townBuilder.urban.activities.state.rhythmCatch.phase')=='idle'
        for value in reversed(target):
            page.get_by_role('button',name='Add '+NAMES[value],exact=True).click()
        page.get_by_role('button',name='Check my rhythm',exact=True).click()
        assert state()['phase']=='arrange'
        saved=lambda:page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))')
        assert saved()['yellowNotes']==SEED['yellowNotes']
        assert saved()['stars']==0 and saved()['npcRhythmWins']=={}
        for _ in target:
            page.locator('.npc-rhythm-dialog').get_by_role('button',name='Undo',exact=True).click()
        page.get_by_role('button',name='Catch yellow notes',exact=True).click()
        page.wait_for_function('townBuilder.urban.activities.state.npcRhythmRequest.phase==="idle"')
        page.keyboard.press('e')
        page.get_by_role('button',name='Hear rhythm request',exact=True).click()
        page.wait_for_function('townBuilder.urban.activities.state.npcRhythmRequest.phase==="arrange"',timeout=20000)
        assert state()['actorId']==actor_id and state()['target']==target
        for value in target:
            page.get_by_role('button',name='Add '+NAMES[value],exact=True).click()
        page.screenshot(path=str(OUT/'written-from-inventory.png'))
        page.get_by_role('button',name='Check my rhythm',exact=True).click()
        page.wait_for_function('townBuilder.urban.activities.state.npcRhythmRequest.phase==="won"')
        expected=dict(SEED['yellowNotes'])
        for value in target:
            expected[value]-=1
        assert saved()['yellowNotes']==expected
        assert saved()['stars']==1 and saved()['npcRhythmWins']=={actor_id:1}
        assert saved()['netWins']==0,'An NPC request must not count as a blue vendor win'
        page.screenshot(path=str(OUT/'npc-rhythm-win.png'))
        page.get_by_role('button',name='Back to town',exact=True).click()
        assert page.evaluate('townBuilder.project')==fixture,'NPC requests must not edit a saved map'
        page.reload()
        page.wait_for_function('!!window.townBuilder')
        assert saved()['yellowNotes']==expected and saved()['stars']==1
        assert saved()['npcRhythmWins']=={actor_id:1}
        assert not errors,errors
        print(json.dumps({'heardOnly':True,'actor':actor_id,'spentCards':4,'townStars':1,'yellowCounts':expected,'persistent':True,'blueVendorUntouched':True,'mapUnchanged':True,'errors':errors}))
        browser.close()
finally:
    server.shutdown()
