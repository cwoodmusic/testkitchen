"""A clear room introduction waits for the reader before the party enters.

The real JRPG controls, save reloads and developer playtests verify the new
reading phase while preserving physical performances and custom prose.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/grade5-story-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('grade5_objects',ROOT/'tests/quiet-bell-object-dialogues-browser.py')
objects=importlib.util.module_from_spec(spec);spec.loader.exec_module(objects)
depot,cs,ui,paths,tracks=objects.depot,objects.cs,objects.ui,objects.paths,objects.tracks
tick,press,state=depot.tick,depot.press,depot.state
OLD_PIP='My courier keeps turning toward the dark route. Something is listening back, isn’t it? Please do not let the letter bite.'
CUSTOM_NARRATION='This is my custom room introduction. My students will find a blue cup beside the door and ask Iris about it.'
CUSTOM_LINE='This custom reply belongs to my class and must stay exactly as I wrote it.'


def positions(value):return[{k:a[k] for k in ['id','x','y','facing']} for a in value['actors']]


def narration(page):
    value=state(page);assert value and value['phase']=='narration',value
    assert page.locator('#cutscene-speaker').inner_text()=='Narrator'
    assert page.locator('#cutscene-panel').get_attribute('data-phase')=='narration'
    assert value['currentTile']==0 and value['elapsed']==0 and value['entry']['currentTile']==0,value
    assert all(not a['moving'] for a in value['actors']),value
    assert page.locator('#room-map').evaluate('n=>n.style.overflow')=='hidden'
    assert page.locator('.room-entry-fade').is_hidden()
    assert page.locator('.cutscene-advance-hint').count()==0
    return value


def assert_safe_floor(page):
    result=page.evaluate('''async()=>{const{isWalkable}=await import(new URL('room.mjs',document.baseURI));
      const scene=quietBell.scene;return{player:isWalkable(scene.geometry,quietBell.walker),
        actors:scene.actors.map(a=>({id:a.id,y:a.feet.y,inside:a.feet.y<=scene.geometry.height}))};}''')
    assert result['player'] and all(a['inside'] for a in result['actors']),result
    assert not state(page) and page.locator('#cutscene-panel').is_hidden()


def reveal_and_enter(page):
    before=narration(page)
    if not before['textComplete']:
        press(page,'#cutscene-next');revealed=narration(page)
        assert revealed['textComplete'] and positions(revealed)==positions(before)
    assert page.locator('#cutscene-next').inner_text()=='Enter room ›'
    if page.viewport_size['width']>=500:page.keyboard.press('Enter')
    else:press(page,'#cutscene-next')
    entered=state(page)
    assert entered and entered['phase']=='entry' and entered['entry']['currentTile']<1,entered
    assert positions(entered)==positions(before),'Acknowledging the text must begin at the same doorway pose.'
    return entered


def narration_flow(browser,url,expected,width=1024,reduced=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'dark',skip_cutscenes=False,
        reduced_motion='reduce' if reduced else 'no-preference')
    page.clock.pause_at(page.evaluate('Date.now()/1000')+.1)
    base=paths.validate_release(page,expected);first=narration(page)
    baseline=cs.normal_storage(page);resources=ui.resources(ui.state(page));walker=ui.walker(page)
    height=page.evaluate('quietBell.scene.geometry.height')
    assert all(a['y']>height for a in first['actors'] if a['id'] in ['mira','nell','iris','pip']),first
    image=page.locator('.mg-art').bounding_box();assert image and image['width']>0 and image['height']>0
    page.keyboard.down('ArrowRight');tick(page,300);page.keyboard.up('ArrowRight')
    current=narration(page);assert positions(current)==positions(first) and ui.walker(page)==walker
    assert current['narration']['elapsed']>first['narration']['elapsed']
    page.evaluate('window.dispatchEvent(new Event("blur"))');paused=narration(page);tick(page,600)
    assert state(page)==paused
    page.evaluate('window.dispatchEvent(new Event("focus"))');tick(page,100);assert narration(page)['narration']['elapsed']>paused['narration']['elapsed']
    depot.visibility(page,True);paused=narration(page);tick(page,500);assert state(page)==paused
    depot.visibility(page,False);tick(page,100)
    value=narration(page);assert not value['textComplete'],value
    getattr(page.locator('#cutscene-panel'),'tap' if width<500 else 'click')(position={'x':24,'y':24})
    complete=narration(page);assert complete['textComplete']
    cs.assert_panel_layout(page);page.screenshot(path=str(OUT/f'narrator-{width}-{reduced}.png'))
    assert cs.normal_storage(page)==baseline and ui.resources(ui.state(page))==resources
    if reduced:
        page.keyboard.press('Escape');tick(page,40);assert_safe_floor(page)
    else:
        entered=reveal_and_enter(page);tick(page,250);moving=state(page)
        assert moving['phase']=='entry' and moving['entry']['currentTile']>entered['entry']['currentTile']
        assert any(a['moving'] for a in moving['actors'])
        cs.wait_for_story(page);assert state(page)['phase']=='story'
        press(page,'#cutscene-skip');tick(page,40);assert_safe_floor(page)
    # Escape skips a fresh preface safely and does not open another game panel.
    press(page,'#menu');press(page,'#replay-cutscene');narration(page)
    page.keyboard.press('Escape');tick(page,40);assert_safe_floor(page)
    assert page.locator('#menu-dialog').is_hidden() and ui.resources(ui.state(page))==resources
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'width':width,'reducedMotion':reduced,'narratorBeforeEntry':True,'partyOutsideAndClocksParked':True,
        'realRevealThenEnter':not reduced,'blurAndHiddenPause':True,'skipEscapeSafe':True,'noHintText':True,'resourcesPreserved':True}


def saved_project_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light');page.clock.pause_at(page.evaluate('Date.now()/1000')+.1)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page)
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    current_pip=next(c['text'] for c in project['content']['depot']['cutscene'] if c.get('speaker')=='pip' and c.get('kind')=='dialogue')
    assert current_pip!=OLD_PIP
    custom=next(c for c in project['content']['garden-porch']['cutscene'] if c.get('speaker')=='iris' and c.get('kind')=='dialogue');custom['text']=CUSTOM_LINE
    page.keyboard.press('F2');tracks.import_project(page,project,'grade5-saved-custom-project')
    press(page,'[data-dev-room="garden-porch"]');press(page,'[data-dev-tab="rooms"]')
    page.locator('#developer-room-narration').fill(CUSTOM_NARRATION);page.locator('#developer-room-narration').press('Tab')
    press(page,'#developer-apply')
    page.locator('#developer-console').wait_for(state='hidden');narration(page);press(page,'#cutscene-skip');tick(page,40)
    page.evaluate('''old=>{for(const key of ['codaQuietBellDeveloperProjectV1','codaQuietBellDeveloperAppliedProjectV1']){
      const p=JSON.parse(localStorage.getItem(key));delete p.content.depot.narration;
      p.content.depot.cutscene.find(c=>c.kind==='dialogue'&&c.speaker==='pip').text=old;
      localStorage.setItem(key,JSON.stringify(p));}}''',OLD_PIP)
    page.reload();page.wait_for_function('!!window.quietBell?.state');ui.skip_intro(page);ui.skip_cutscene(page)
    restored=page.evaluate('quietBell.project');assert restored['content']['garden-porch']['narration']==CUSTOM_NARRATION
    assert any(c.get('text')==CUSTOM_LINE for c in restored['content']['garden-porch']['cutscene'])
    assert next(c['text'] for c in restored['content']['depot']['cutscene'] if c.get('speaker')=='pip' and c.get('kind')=='dialogue')==current_pip
    assert restored['content']['depot']['narration'].strip()
    assert cs.normal_storage(page)==normal
    page.clock.pause_at(page.evaluate('Date.now()/1000')+.1)
    press(page,'#menu');press(page,'#replay-cutscene');narration(page);reveal_and_enter(page);cs.wait_for_story(page)
    depot.to_line(page,'depot-arrival-2');assert state(page)['beat']['text']==current_pip
    press(page,'#cutscene-skip');tick(page,40)
    page.keyboard.press('F2');press(page,'[data-dev-room="garden-porch"]');press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
    page.locator('#developer-console').wait_for(state='hidden');custom_view=narration(page);assert custom_view['narration']['text']==CUSTOM_NARRATION
    press(page,'#cutscene-skip');tick(page,40);press(page,'#developer-end');tick(page,40)
    assert cs.normal_storage(page)==normal
    # An inspection uses its immediate party exchange, without a new doorway preface.
    entry=objects.observation(page.evaluate('quietBell.project'),'depot','returned-letter')
    objects.click_inspection(page,entry['id']);value=state(page)
    assert value['context']=='inspection' and value['phase']=='story' and not value.get('narration')
    objects.assert_exchange(page,entry,True);objects.close_lore(page)
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'customNarrationAndDialoguePreserved':True,'oldStockPipUpdatedInSavedPlaytest':True,
        'missingStockNarrationAdded':True,'customPrefaceActuallyDisplayed':True,'objectDiscussionHasNoPreface':True,'normalSaveBytesPreserved':True}


def fork_and_endings_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'dark');page.clock.pause_at(page.evaluate('Date.now()/1000')+.1)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page);narrations=[];resolutions=[]
    identifiers=['garden-fork','ending-home','ending-school','ending-public','ending-secret-quiet','ending-secret-birds']
    for identifier in identifiers:
        page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible')
        press(page,f'[data-dev-room="{identifier}"]');press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
        page.locator('#developer-console').wait_for(state='hidden');value=narration(page)
        text=value['narration']['text'];assert len(text.split())>=8 and len(text)<=600,text
        narrations.append(text);press(page,'#cutscene-skip');tick(page,40);assert_safe_floor(page)
        if identifier=='garden-fork':
            project=page.evaluate('quietBell.project');doors=[d for d in project['doors'].values() if d['from']==identifier]
            assert len(doors)>=2 and all(project['content'][identifier]['doorCopy'].get(d['id']) or project['content'][identifier]['doorCopy'].get(d.get('canonicalId')) for d in doors)
        else:
            press(page,'#ending');copy=page.locator('#outcome-copy').inner_text().strip()
            assert 'bell' in copy.lower() and any(word in copy.lower() for word in ['answer','reply','bird']),copy
            assert len(copy.split())>=30 and '...' not in copy,copy
            assert page.locator('#outcome-title').inner_text().strip()
            resolutions.append(copy);page.screenshot(path=str(OUT/f'{identifier}.png'));press(page,'#outcome-close')
    assert len(set(narrations))==6 and len(set(resolutions))==5
    press(page,'#developer-end');tick(page,40);assert cs.normal_storage(page)==normal
    depot.safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'forkDirectionsAuthored':True,'allFiveEndingResolutionsAccessible':True,
        'distinctCompleteBellResolutions':True,'normalAndSecretEndings':True,'normalSaveBytesPreserved':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)));Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url,'narration':[narration_flow(runner,url,args.expect_release),narration_flow(runner,url,args.expect_release,390),
                narration_flow(runner,url,args.expect_release,320,True)],'savedProject':saved_project_flow(runner,url,args.expect_release),
                'storyContent':fork_and_endings_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
