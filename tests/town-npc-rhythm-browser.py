"""NPC requests use three note symbols and migrate saved rests without losing cards."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright
import json

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/fairy-forgiving/npc'
OUT.mkdir(parents=True,exist_ok=True)
VALUES=['quarter','eighth-pair','sixteenth-group']
NAMES={'quarter':'Quarter note','eighth-pair':'Two eighth notes','sixteenth-group':'Four sixteenth notes'}
SEED={'version':1,'stars':7,'netWins':2,'fish':{'copper-sprat':{'count':2,'best':14.5}},'yellowNotes':{**{value:4 for value in VALUES},'quarter-rest':4},'npcRhythmWins':{'mozart':2}}
MIGRATED={value:8 if value=='quarter' else 4 for value in VALUES}

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
        saved=lambda:page.evaluate('JSON.parse(localStorage.getItem("codaTownAdventuresV1:guest"))')
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
        page.wait_for_selector('.yellow-note-inventory',state='visible')
        assert page.evaluate('townBuilder.urban.activities.state.yellowNotes.counts')==MIGRATED
        assert page.evaluate('townBuilder.urban.activities.state.yellowNotes.total')==sum(SEED['yellowNotes'].values()),'Each old rest must become exactly one quarter note'
        assert page.locator('.yellow-note-inventory .yellow-note-count').count()==3
        assert page.locator('.yellow-note-inventory [aria-label="Quarter note: 8"]').count()==1
        assert page.locator('.yellow-note-inventory [aria-label*="rest" i]').count()==0
        page.screenshot(path=str(OUT/'migrated-three-note-inventory.png'))
        stored_before=saved()
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
        assert all(value in VALUES for value in target),target
        assert initial['inventory']==MIGRATED
        assert page.locator('.npc-rhythm-dialog .rhythm-note-tray button').count()==3
        assert page.get_by_role('button',name='Add Quarter rest',exact=True).count()==0
        assert page.evaluate('townBuilder.urban.activities.state.rhythmCatch.phase')=='idle'
        wrong=list(target)
        wrong[0]=next(value for value in VALUES if value!=target[0])
        for value in wrong:
            page.get_by_role('button',name='Add '+NAMES[value],exact=True).click()
        page.get_by_role('button',name='Check my rhythm',exact=True).click()
        assert state()['phase']=='arrange'
        assert saved()==stored_before,'An incorrect answer cannot spend or rewrite stored progress'
        assert state()['inventory']==MIGRATED
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
        expected=dict(MIGRATED)
        for value in target:
            expected[value]-=1
        assert saved()['yellowNotes']==expected
        wins={**SEED['npcRhythmWins'],actor_id:SEED['npcRhythmWins'].get(actor_id,0)+1}
        assert saved()['stars']==SEED['stars']+1 and saved()['npcRhythmWins']==wins
        assert saved()['netWins']==SEED['netWins'],'An NPC request must not count as a blue vendor win'
        assert saved()['fish']==SEED['fish'],'Converting old rest cards must preserve fishing records'
        assert 'quarter-rest' not in saved()['yellowNotes']
        page.screenshot(path=str(OUT/'npc-rhythm-win.png'))
        page.get_by_role('button',name='Back to town',exact=True).click()
        assert page.evaluate('townBuilder.project')==fixture,'NPC requests must not edit a saved map'
        page.reload()
        page.wait_for_function('!!window.townBuilder')
        assert saved()['yellowNotes']==expected and saved()['stars']==SEED['stars']+1
        assert saved()['npcRhythmWins']==wins and saved()['netWins']==SEED['netWins']
        assert saved()['fish']==SEED['fish']
        assert 'quarter-rest' not in saved()['yellowNotes'],'Reload must not restore rests or convert them twice'
        assert page.evaluate('townBuilder.urban.activities.state.yellowNotes.counts')==expected
        assert not errors,errors
        print(json.dumps({'heardOnly':True,'actor':actor_id,'allowedSymbols':VALUES,'restsConvertedToQuarters':4,'spentCards':4,'townStarsAdded':1,'yellowCounts':expected,'persistent':True,'priorStarsFishAndWinsPreserved':True,'blueVendorUntouched':True,'mapUnchanged':True,'errors':errors}))
        browser.close()
finally:
    server.shutdown()
