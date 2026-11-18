"""Paid route choices can end a run while discovered knowledge survives Restart.

Every pickup, paid gate, clue and restart uses the published controls. Geometry,
inventory and journey hooks are read-only; no developer inventory is used.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import math
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/replay-risk-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('risk_npc',ROOT/'tests/quiet-bell-npc-dialogue-browser.py')
npc=importlib.util.module_from_spec(spec);spec.loader.exec_module(npc)
ui,cs,paths=npc.ui,npc.cs,npc.paths


def ids(entries):return {entry if isinstance(entry,str) else entry['id'] for entry in entries}
def journal(page):return page.evaluate('quietBell.journey')
def durable(page):
    value=ui.state(page)
    return {key:value[key] for key in ['roomId','phase','inventory','actions','claimedSources','sourceReceipts']}
def total(page):return sum(ui.state(page)['inventory'].values())


class RiskUI:
    def __init__(self,page):
        self.page=page;self.touch=page.viewport_size['width']<500
        self.project=page.evaluate('quietBell.project')

    def advance(self,ms=50):self.page.clock.run_for(ms)

    def close(self):
        ui.skip_cutscene(self.page)
        self.advance()
        for dialog,button in [('#outcome','#outcome-close'),('#conversation-dialog','#conversation-close'),
                              ('#notes-dialog','#notes-close'),('#menu-dialog','#menu-close'),
                              ('#help-dialog','#help-close'),('#lore-dialog','#lore-close')]:
            if self.page.locator(dialog).is_visible():self.page.locator(button).click();self.advance()

    def point(self,button):
        return button.evaluate('''e=>{const r=e.getBoundingClientRect();
          for(const fy of [.7,.5,.9,.25,.1])for(const fx of [.5,.25,.75,.1,.9]){
            const x=r.x+r.width*fx,y=r.y+r.height*fy;
            if(x>8&&x<innerWidth-8&&y>8&&y<innerHeight-8&&document.elementFromPoint(x,y)?.closest('button')===e)return{x,y};
          }return null;}''')

    def reveal_target(self,button,identifier):
        for _ in range(180):
            point=self.point(button)
            if point:return point
            plan=self.page.evaluate('''async id=>{const{findPath}=await import(new URL('room.mjs',document.baseURI));
              const room=quietBell.scene.geometry,target=room.targets.find(t=>t.id===id);
              return{at:quietBell.walker,path:findPath(room,quietBell.walker,target.approach),speed:room.speed,target};}''',identifier)
            assert plan['path'],(identifier,plan)
            at=plan['at'];destination=next((point for point in plan['path'] if math.hypot(point['x']-at['x'],point['y']-at['y'])>5),plan['path'][-1])
            axis='x' if abs(destination['x']-at['x'])>=abs(destination['y']-at['y']) else 'y'
            delta=destination[axis]-at[axis]
            key=('ArrowRight' if delta>0 else 'ArrowLeft') if axis=='x' else ('ArrowDown' if delta>0 else 'ArrowUp')
            self.page.locator('#walk-floor').focus();self.page.keyboard.down(key)
            self.advance(abs(delta)/plan['speed']*1000+8);self.page.keyboard.up(key);self.advance(25)
            assert math.hypot(ui.walker(self.page)['x']-at['x'],ui.walker(self.page)['y']-at['y'])>.1,(identifier,plan)
        raise AssertionError(('Could not reveal target',identifier,ui.walker(self.page)))

    def press(self,selector):
        button=self.page.locator(selector)
        target=button.evaluate('e=>e.dataset.person??e.dataset.door??e.dataset.chest??e.dataset.inspect??e.dataset.return??null')
        if target:
            self.close();point=self.reveal_target(button,target)
            if self.touch:self.page.touchscreen.tap(point['x'],point['y'])
            else:self.page.mouse.click(point['x'],point['y'])
            ui.settle_walk(self.page);self.advance()
            if button.get_attribute('data-inspect'):ui.finish_inspection_discussion(self.page);self.advance()
        else:
            getattr(button,'tap' if self.touch else 'click')();self.advance()

    def door(self,identifier):
        return self.project['doors'].get(identifier) or next(door for door in self.project['doors'].values() if door['canonicalId']==identifier)

    def select(self,identifier):
        door=self.door(identifier);self.press(f'[data-door="{door["id"]}"]')
        assert ui.state(self.page)['selectedDoor']==door['id']
        return door

    def draft(self,recipe):
        while ui.state(self.page)['phrase']:self.press('[data-remove="0"]')
        for kind in recipe:self.press(ui.tile(kind))

    def pay(self,identifier):
        door=self.select(identifier);before=durable(self.page);self.draft(door['recipe'])
        assert self.page.locator('#commit').is_enabled(),(identifier,ui.state(self.page))
        self.press('#commit');ui.skip_cutscene(self.page);self.advance()
        value=ui.state(self.page);assert value['roomId']==door['to'],(identifier,value)
        expected=dict(before['inventory'])
        for kind in door['recipe']:expected[kind]-=1
        assert value['inventory']==expected and len(value['actions'])==len(before['actions'])+1
        assert not value['canRevisit'],'A committed paid door has no gameplay refund.'
        return value

    def gift(self,person):
        self.press(f'[data-person="{person}"]');self.press('#take-parcel')

    def start_notes(self):
        assert ui.state(self.page)['inventory']==ui.EMPTY
        assert ui.state(self.page)['runStatus']=='active' and ui.state(self.page)['failure'] is None
        self.gift('nell');self.press('[data-chest="depot-chest"]')
        assert ui.state(self.page)['inventory']==ui.INITIAL

    def failure(self,reason):
        ui.skip_cutscene(self.page);self.advance()
        value=ui.state(self.page)
        assert value['phase']=='room' and value['runStatus']=='failed' and value['failure']['reason']==reason,value
        assert not value['canAttempt'] and not value['canCommit'] and not value['canRevisit']
        self.page.locator('#outcome').wait_for(state='visible')
        assert 'start' in self.page.locator('#revisit').inner_text().lower()
        close=self.page.locator('#outcome-close')
        assert 'look around' in (close.get_attribute('aria-label') or close.inner_text()).lower()
        return value

    def restart(self):
        self.close();self.press('#menu');self.press('#restart');ui.skip_intro(self.page);ui.skip_cutscene(self.page);self.advance()
        value=ui.state(self.page)
        assert value['roomId']=='depot' and value['runStatus']=='active' and value['inventory']==ui.EMPTY
        assert value['claimedSources']==[] and value['actions']==[] and value['phrase']==[]


def open_run(browser,url,expected,width=1024):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark')
    base=paths.validate_release(page,expected)
    assert ui.state(page)['replayRisk'] is True
    return context,page,RiskUI(page),base,errors,writes,external


def canal_flow(browser,url,expected):
    context,page,game,base,errors,writes,external=open_run(browser,url,expected)
    game.start_notes();game.pay('canal');game.press('[data-chest="canal-chest"]')
    game.pay('canal-porch-forward');game.pay('canal-dead')
    assert ui.state(page)['roomId']=='dead-echo' and ui.state(page)['runStatus']=='active'
    game.press('[data-inspect="dead-echo-memory"]');game.close()
    door=game.select('echo-return-gate');before=durable(page)
    game.draft(list(reversed(door['recipe'])));assert page.locator('#commit').is_enabled()
    game.press('#commit');assert durable(page)==before,'A wrong rhythm never spends notes.'
    game.draft(door['recipe']);assert sum(ui.state(page)['availableInventory'].values())==0
    assert ui.state(page)['runStatus']=='active','Drafted notes still belong to the bag.'
    game.press('#undo');assert durable(page)==before,'Draft Undo is free.'
    game.pay('echo-return-gate');failed=game.failure('out-of-notes')
    assert failed['roomId']=='canal-final' and total(page)==0 and not failed['isTerminal']
    learned=journal(page);assert {'lesson-paid-doors','lesson-canal-final'}<=ids(learned['hints'])
    assert 'ending-public' not in ids(learned['nodes']) and not learned['outcomes']
    page.screenshot(path=str(OUT/'canal-no-notes.png'))
    game.close();stable=durable(page)
    game.press('[data-person="nell"]');game.press('[data-topic="route"]')
    assert page.locator('#demo').is_enabled();game.press('#demo');assert durable(page)==stable
    game.select('canal-ending');assert page.locator('#door-demo').is_enabled() and page.locator('#commit').is_disabled()
    game.press('#door-demo');page.keyboard.press('Backspace');game.advance();assert durable(page)==stable
    game.close();game.press('[data-return="return-previous"]')
    assert page.locator('#menu-dialog').is_visible() and ui.unavailable(page,'#revisit-room')
    assert durable(page)==stable,'The south threshold reviews the journal without refunding notes.'
    game.close();position=ui.walker(page);page.reload();page.wait_for_function('!!window.quietBell?.state')
    ui.skip_intro(page);ui.skip_cutscene(page);game.advance();paths.validate_release(page,expected)
    assert durable(page)==stable and ui.state(page)['runStatus']=='failed'
    assert math.hypot(ui.walker(page)['x']-position['x'],ui.walker(page)['y']-position['y'])<1
    game.failure('out-of-notes');game.restart()
    after=journal(page)
    for key in ['nodes','edges','hints','outcomes']:assert ids(after[key])>=ids(learned[key]),key
    assert 'lesson-canal-final' in ids(after['hints'])
    game.start_notes();game.pay('canal');game.press('[data-chest="canal-chest"]')
    game.pay('canal-porch-forward');game.pay('canal-normal');finished=game.pay('canal-ending')
    assert finished['roomId']=='ending-public' and finished['runStatus']=='completed' and finished['failure'] is None
    assert total(page)==0 and 'ending-public' in ids(journal(page)['outcomes'])
    assert ids(journal(page)['hints'])>=ids(learned['hints'])
    npc.safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'ordinaryZeroNoteFailureBeforeEnding':True,'wrongAnswerAndDraftUndoFree':True,
        'noCommittedRefund':True,'failedRoomCluesRemainUsable':True,'failedReloadPreserved':True,
        'restartKeepsKnowledgeButClearsNotes':True,'correctReplayWinsAtZero':True}


def garden_hidden_flow(browser,url,expected):
    context,page,game,base,errors,writes,external=open_run(browser,url,expected)
    game.start_notes();game.pay('garden');game.gift('iris');game.pay('garden-porch-dead')
    game.pay('bramble-return-gate');game.pay('garden-secret-branch')
    value=ui.state(page);assert value['roomId']=='garden-alcove' and total(page)==0
    assert value['runStatus']=='active' and value['failure'] is None,'An unclaimed hidden cache can still rescue an empty bag.'
    assert page.locator('#outcome').is_hidden()
    source=next(entry for entry in game.project['content']['garden-alcove']['inspections'] if entry.get('sourceId')=='garden-hidden-notes')
    game.press(f'[data-inspect="{source["id"]}"]')
    assert total(page)==0 and ui.state(page)['runStatus']=='active'
    game.press('#lore-search');assert total(page)==4 and 'garden-hidden-notes' in ui.state(page)['claimedSources']
    game.pay('garden-hidden-exit');failed=game.failure('out-of-notes')
    assert failed['roomId']=='garden-secret-final' and total(page)==0
    learned=journal(page);assert 'lesson-garden-secret-final' in ids(learned['hints'])
    assert 'ending-secret-quiet' not in ids(learned['nodes'])
    page.screenshot(path=str(OUT/'garden-no-final-key.png'));game.restart()
    assert 'lore-'+source['id'] in ids(journal(page)['hints'])
    assert 'garden-hidden-notes' not in ui.state(page)['claimedSources']
    npc.safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'emptyBagBeforeHiddenSearchStaysActive':True,'explicitSearchStillRequired':True,
        'detourSpendsFutureKey':True,'secretKnowledgeSurvivesRestart':True}


def missing_types_phone(browser,url,expected):
    context,page,game,base,errors,writes,external=open_run(browser,url,expected,390)
    game.start_notes();game.pay('garden')
    assert 'iris-gift' not in ui.state(page)['claimedSources'] and ui.state(page)['runStatus']=='active'
    game.pay('garden-porch-dead');failed=game.failure('missing-note-types')
    assert failed['roomId']=='dead-brambles' and total(page)>0
    assert 'lesson-dead-brambles' in ids(journal(page)['hints'])
    ui.layout(page,True);page.screenshot(path=str(OUT/'phone-missing-types.png'))
    game.close();stable=durable(page);game.select('bramble-return-gate')
    assert page.locator('#door-demo').is_enabled() and page.locator('#commit').is_disabled()
    game.press('#door-demo');assert durable(page)==stable
    game.restart();assert 'lesson-dead-brambles' in ids(journal(page)['hints'])
    npc.safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'missingTypesCanEndRunWithNotesLeft':True,'skippedGiftLessonSaved':True,
        'phoneFailureAndLearningControlsFit':True,'hearingUnaffordableLockStaysAvailable':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    parser.add_argument('--case',choices=['all','canal','gardenHidden','missingTypesPhone'],default='all')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url}
            for label,flow in [('canal',canal_flow),('gardenHidden',garden_hidden_flow),('missingTypesPhone',missing_types_phone)]:
                if args.case in ['all',label]:result[label]=flow(runner,url,args.expect_release)
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        suffix='' if args.case=='all' else '-'+args.case
        (OUT/(name+suffix+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
