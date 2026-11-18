"""NPC conversations share the blue pixel frame, manual typewriter and voices.

All dialogue, authoring, gifts and rhythm demonstrations use the actual controls.
Native AudioContext calls are observed without replacing playback or game state.
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
OUT=ROOT/'work/npc-dialogue-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('npc_audio',ROOT/'tests/quiet-bell-narration-audio-browser.py')
audio=importlib.util.module_from_spec(spec);spec.loader.exec_module(audio)
ui,cs,paths,grade,party=audio.ui,audio.cs,audio.paths,audio.grade,audio.party
tracks=grade.tracks


def conversation(page):return page.evaluate('quietBell.conversation')
def press(page,selector):ui.press(page,selector,touch=page.viewport_size['width']<500)
def source_text(page):return page.locator('#dialogue .jrpg-sr-line').text_content()
def starts(page):return party.audio_starts(page)
def resource_state(page):return ui.resources(ui.state(page))


def read_person(page,person):
    before=ui.walker(page)
    press(page,f'#room-map [data-person="{person}"]')
    page.locator('#conversation-dialog').wait_for(state='visible')
    value=conversation(page);assert value and value['speaker']==person,value
    assert page.locator('#dialogue .jrpg-glyph-row').first.text_content().startswith(person.upper()+': ')
    assert not ui.walker(page)['moving']
    return before,value


def frame_style(page,person):
    result=page.evaluate('''person=>{const panel=document.getElementById('conversation-dialog'),line=document.getElementById('dialogue');
      const s=getComputedStyle(panel),l=getComputedStyle(line),r=panel.getBoundingClientRect();
      const rect=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom};};
      return{gradient:s.backgroundImage,border:s.borderTopColor,font:l.fontFamily,size:parseFloat(l.fontSize),
        panel:rect(panel),width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,
        mira:rect(document.getElementById('player-sprite')),speaker:rect(document.querySelector('[data-actor="'+person+'"]')),
        buttons:[...panel.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>({label:e.textContent,...rect(e)}))};}''',person)
    assert 'gradient' in result['gradient'] and 'QuietBellBlock' in result['font'],result
    assert result['border']=='rgb(229, 231, 243)',result
    assert result['size']>=(20 if result['width']>760 else 18 if result['width']>360 else 16),result
    p=result['panel'];assert p['x']>=-1 and p['y']>=-1 and p['x']+p['width']<=result['width']+1 and p['bottom']<=result['height']+1,result
    assert result['docWidth']<=result['width']+1 and result['docHeight']<=result['height']+1,result
    for actor in ['mira','speaker']:
        assert result[actor]['y']>=-1 and result[actor]['bottom']<=p['y']+1,(actor,result)
    if result['width']<500:assert all(b['height']>=43.5 for b in result['buttons']),result
    return result


def reveal(page):
    if not conversation(page)['complete']:
        if page.evaluate('Array.isArray(window.__partyAudioEvents)'):party.silent_control_click(page,'#conversation-next')
        else:press(page,'#conversation-next')
    assert conversation(page)['complete']
    assert page.locator('#conversation-next').inner_text()=='Done ›'


def safe(page,errors,writes,external):
    ui.protected_storage(page);paths.no_errors(errors,writes,external)


def desktop_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(audio.AudioBrowser(browser),url,1024,'dark',virtual_walk=False)
    base=paths.validate_release(page,expected);resources=resource_state(page)
    before,initial=read_person(page,'nell');assert not initial['complete']
    saved=cs.normal_storage(page);position=ui.walker(page);count=len(starts(page))
    page.wait_for_timeout(350);typed=conversation(page)
    assert initial['visibleCharacters']<typed['visibleCharacters']<typed['totalCharacters'],(initial,typed)
    assert len(starts(page))>count and all(e['type']=='triangle' and abs(e['frequency']/220-1)<.06 for e in starts(page)[count:])
    assert resource_state(page)==resources and ui.walker(page)==position and cs.normal_storage(page)==saved
    frame_style(page,'nell')
    page.evaluate('window.dispatchEvent(new Event("blur"))');paused=conversation(page);count=len(starts(page));page.wait_for_timeout(200)
    assert conversation(page)==paused and len(starts(page))==count
    page.evaluate('window.dispatchEvent(new Event("focus"))');page.wait_for_timeout(150)
    assert conversation(page)['elapsed']>paused['elapsed']
    # Source glyph rows stay laid out throughout reveal and are never HTML.
    page.evaluate('window.__npcRows=[...document.querySelectorAll("#dialogue .jrpg-glyph-row")]')
    party.silent_control_click(page,'#dialogue');assert conversation(page)['complete']
    assert page.evaluate('__npcRows.every((row,i)=>row===document.querySelectorAll("#dialogue .jrpg-glyph-row")[i])')
    count=len(starts(page));page.wait_for_timeout(180);assert len(starts(page))==count
    page.screenshot(path=str(OUT/'desktop-nell.png'))
    # The next acknowledgement closes; it does not spend a note or resume a hidden timer.
    page.locator('#conversation-next').focus();page.keyboard.press('Enter');page.wait_for_timeout(80)
    assert page.locator('#conversation-dialog').is_hidden() and not conversation(page)
    count=len(starts(page));page.wait_for_timeout(150);assert len(starts(page))==count
    assert resource_state(page)==resources
    read_person(page,'nell');press(page,'[data-topic="route"]');route=conversation(page)
    assert not route['complete'] and source_text(page).endswith(page.evaluate('quietBell.project.content.depot.people.find(p=>p.id==="nell").route'))
    page.wait_for_timeout(150);assert conversation(page)['elapsed']>route['elapsed']
    reveal(page);count=len(starts(page));press(page,'#demo');page.wait_for_timeout(200)
    assert len(starts(page))>count and resource_state(page)==resources,'The existing rhythm demonstration still plays without paying a lock.'
    press(page,'[data-topic="inventory"]');assert not conversation(page)['complete']
    press(page,'#take-parcel');assert page.locator('#conversation-dialog').is_hidden() and ui.state(page)['inventory']==ui.PARCEL
    read_person(page,'nell');assert page.locator('#take-parcel').is_disabled()
    for person in ['iris','pip']:
        read_person(page,person);frame_style(page,person);assert source_text(page).startswith(person.capitalize()+': ')
        page.keyboard.press('Escape');page.wait_for_timeout(60);assert not conversation(page)
    assert ui.state(page)['inventory']==ui.PARCEL
    press(page,'#menu');press(page,'#sound');assert page.locator('#sound').get_attribute('aria-pressed')=='false';press(page,'#menu-close')
    read_person(page,'nell');count=len(starts(page));page.wait_for_timeout(250);assert len(starts(page))==count
    reveal(page);press(page,'#conversation-next');assert not conversation(page)
    disconnected={event['id'] for event in party.audio_events(page) if event['kind']=='disconnect'}
    assert all(event['id'] in disconnected for event in starts(page))
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'realWalkToTalk':True,'bluePixelFrame':True,'naturalTypingAndCharacterVoice':True,
        'clickRevealThenKeyboardClose':True,'topicsRestartOnce':True,'giftClaimedExactlyOnce':True,'rhythmDemoPreserved':True,
        'threeSpeakersCorrect':True,'blurMuteCloseQuiet':True,'textRowsRetained':True,'typingPreservesSavesAndResources':True}


def phone_flow(browser,url,expected,width=390,reduced=False):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'light',virtual_walk=False,reduced_motion='reduce' if reduced else 'no-preference')
    base=paths.validate_release(page,expected);resources=resource_state(page)
    read_person(page,'nell');initial=conversation(page);page.wait_for_timeout(150);assert conversation(page)['visibleCharacters']>initial['visibleCharacters']
    style=frame_style(page,'nell');press(page,'#conversation-next');assert conversation(page)['complete']
    page.screenshot(path=str(OUT/f'phone-{width}.png'));press(page,'#conversation-next');assert not conversation(page)
    assert resource_state(page)==resources
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'width':width,'reducedMotion':reduced,'typewriter':True,'touchRevealAndClose':True,
        'pixelFontSize':style['size'],'speakerAndMiraAboveBox':True,'screenFits':True,'resourcesPreserved':True}


def custom_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'light',virtual_walk=False)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page)
    project=page.evaluate('JSON.parse(JSON.stringify(quietBell.project))')
    intro='My class wrote this introduction. <img src=x onerror="window.__npcPayload=1">\nA second line stays literal.'
    long='Custom <b>literal</b> reply.\n'+'We keep every word and musical clue. '*24
    nell=next(p for p in project['content']['depot']['people'] if p['id']=='nell');nell['intro']=intro
    nell['replies']=[{'id':'custom-route','label':'Ask my question','text':long,'demo':['quarter','quarter','half']},{'id':'empty','label':'A quiet reply','text':''}]
    iris=next(p for p in project['content']['depot']['people'] if p['id']=='iris');iris['intro']='Iris has no reply choices.';iris['replies']=[]
    page.keyboard.press('F2');tracks.import_project(page,project,'npc-custom-conversations');press(page,'#developer-apply')
    page.locator('#developer-console').wait_for(state='hidden');ui.skip_cutscene(page)
    resources=resource_state(page);read_person(page,'nell');assert source_text(page)=='Nell: '+intro
    assert page.locator('.mg-questions [data-topic]').count()==2 and page.locator('#dialogue img,#dialogue b').count()==0
    assert page.evaluate('window.__npcPayload') is None
    press(page,'[data-topic="custom-route"]');assert source_text(page)=='Nell: '+long
    total=conversation(page)['totalCharacters'];assert total==len(long)
    reveal(page);assert page.locator('#dialogue').evaluate('e=>e.scrollTop>0')
    page.screenshot(path=str(OUT/'custom-long.png'));assert source_text(page)=='Nell: '+long
    # A demo keeps this selected answer and its fully revealed words intact.
    before=conversation(page);press(page,'#demo');page.wait_for_timeout(120)
    assert conversation(page)['id']==before['id'] and conversation(page)['complete']
    press(page,'[data-topic="empty"]');assert conversation(page)['complete'] and conversation(page)['totalCharacters']==0
    press(page,'#conversation-next');read_person(page,'iris');assert page.locator('.mg-questions [data-topic]').count()==0
    assert source_text(page)=='Iris: Iris has no reply choices.'
    reveal(page);press(page,'#conversation-next')
    assert resource_state(page)==resources and cs.normal_storage(page)==normal
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'authoredIntroRepliesAndEmptyLists':True,'literalHTMLAndNewlines':True,'longTextUntruncatedScrollable':True,
        'demoDoesNotRestartReply':True,'normalSaveBytesPreserved':True,'resourcesPreserved':True}


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
            result={'passed':True,'entry':url,'desktop':desktop_flow(runner,url,args.expect_release),
                'phone':phone_flow(runner,url,args.expect_release),'smallReduced':phone_flow(runner,url,args.expect_release,320,True),
                'custom':custom_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
