"""Narrator typing uses a gentle local voice without advancing the room entry.

The observer delegates real native AudioContext calls. Trusted UI gestures,
Settings, lifecycle events and native animation frames drive every check.
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
OUT=ROOT/'work/narration-audio-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('narration_grade5',ROOT/'tests/quiet-bell-grade5-story-browser.py')
grade=importlib.util.module_from_spec(spec);spec.loader.exec_module(grade)
depot,cs,ui,paths=grade.depot,grade.cs,grade.ui,grade.paths
party=depot.manual.party


class AudioBrowser:
    def __init__(self,browser,muted=False):self.browser,self.muted=browser,muted
    def new_context(self,**options):
        context=self.browser.new_context(**options);context.add_init_script(party.AUDIO_OBSERVER)
        if self.muted:context.add_init_script('localStorage.setItem("codaRhythmBlocksSoundV1","off")')
        return context


def starts(page):return party.audio_starts(page)
def events(page):return party.audio_events(page)
def current(page):return cs.cutscene(page)
def press(page,selector):depot.press(page,selector)


def assert_narrator_sounds(values):
    assert values,values
    assert all(event['type']=='sine' and abs(event['frequency']/300-1)<.05 for event in values),values
    assert all(-.05<event['when']-event['now']<.02 for event in values),values
    assert not any(abs(event['frequency']-frequency)<.01 for event in values for frequency in [145,205]),values


def reading(page):
    value=current(page);assert value and value['phase']=='narration',value
    assert value['currentTile']==0 and value['entry']['currentTile']==0 and all(not a['moving'] for a in value['actors']),value
    return value


def take(page):return page.evaluate('({scene:quietBell.cutscene,now:performance.now()})')


def sample_typing(page,ms,rate):
    before=take(page);count=len(starts(page));page.wait_for_timeout(ms);after=take(page)
    reading(page);sounds=starts(page)[count:];assert len(sounds)>=2,sounds;assert_narrator_sounds(sounds)
    delta=after['scene']['dialogueElapsed']-before['scene']['dialogueElapsed'];elapsed=after['now']-before['now']
    assert abs(delta/elapsed-rate)<.35,(delta,elapsed,rate)
    assert after['scene']['visibleCharacters']>before['scene']['visibleCharacters'],(before,after)
    return len(sounds)


def replay(page):
    if current(page):press(page,'#cutscene-skip')
    press(page,'#menu');press(page,'#replay-cutscene');return reading(page)


def safe(page,errors,writes,external):
    ui.protected_storage(page);paths.no_errors(errors,writes,external)


def desktop_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(AudioBrowser(browser),url,1024,'dark',virtual_walk=False,
        skip_cutscenes=False,skip_intro=False)
    base=paths.validate_release(page,expected);resources=cs.conserved(page)
    assert not events(page),'Narration must not create an audio context before a real gesture.'
    ui.skip_intro(page);reading(page)
    page.wait_for_function('window.__partyAudioEvents.some(e=>e.kind==="start")',polling='raf')
    contexts=[event for event in events(page) if event['kind']=='context'];assert contexts and all(e['gesture'] for e in contexts),contexts
    saved=cs.normal_storage(page);initial=reading(page);slow=sample_typing(page,400,1)
    assert grade.positions(reading(page))==grade.positions(initial)
    # Blur and page hiding stop both active voices and future typing cues.
    page.evaluate('window.dispatchEvent(new Event("blur"))');paused=reading(page);count=len(starts(page));page.wait_for_timeout(250)
    assert current(page)==paused and len(starts(page))==count
    page.evaluate('window.dispatchEvent(new Event("focus"))');resumed=sample_typing(page,250,1)
    depot.visibility(page,True);paused=reading(page);count=len(starts(page));page.wait_for_timeout(200)
    assert current(page)==paused and len(starts(page))==count
    depot.visibility(page,False);page.wait_for_timeout(80)
    party.silent_control_click(page,'#cutscene-speed');assert reading(page)['playbackRate']==2
    fast=sample_typing(page,350,2)
    assert_narrator_sounds(starts(page))
    # Natural completion cannot keep emitting or replay a backlog of letters.
    page.wait_for_function('quietBell.cutscene.phase==="narration"&&quietBell.cutscene.textComplete',polling='raf')
    count=len(starts(page));page.wait_for_timeout(250);assert len(starts(page))==count
    assert cs.normal_storage(page)==saved and cs.conserved(page)==resources
    press(page,'#cutscene-skip');count=len(starts(page));page.wait_for_timeout(180)
    assert not current(page) and len(starts(page))==count
    # Revealing the remaining text uses no oscillator during the real click.
    replay(page);sample_typing(page,250,2)
    party.silent_control_click(page,'#cutscene-next');assert reading(page)['textComplete']
    count=len(starts(page));page.wait_for_timeout(200);assert len(starts(page))==count
    press(page,'#cutscene-skip');page.wait_for_timeout(80)
    # Settings is reached through exploration; a muted replay still types normally.
    press(page,'#menu');press(page,'#sound');assert page.locator('#sound').get_attribute('aria-pressed')=='false'
    press(page,'#replay-cutscene');before=reading(page);count=len(starts(page));page.wait_for_timeout(350)
    assert len(starts(page))==count and reading(page)['visibleCharacters']>before['visibleCharacters']
    press(page,'#cutscene-skip');press(page,'#menu');press(page,'#sound')
    assert page.locator('#sound').get_attribute('aria-pressed')=='true'
    press(page,'#replay-cutscene');reading(page);unmuted=sample_typing(page,350,2)
    # Entry remains silent; ordinary character voices resume afterward.
    party.silent_control_click(page,'#cutscene-next');assert reading(page)['textComplete']
    party.silent_control_click(page,'#cutscene-next');assert current(page)['phase']=='entry'
    count=len(starts(page));page.wait_for_timeout(180);assert current(page)['phase']=='entry' and len(starts(page))==count
    cs.wait_for_story(page);count=len(starts(page));page.wait_for_timeout(350)
    story_sounds=starts(page)[count:]
    assert any(abs(e['frequency']/220-1)<.06 for e in story_sounds),story_sounds
    press(page,'#cutscene-skip');count=len(starts(page));page.wait_for_timeout(180)
    assert not current(page) and len(starts(page))==count
    disconnected={event['id'] for event in events(page) if event['kind']=='disconnect'}
    assert all(event['id'] in disconnected for event in starts(page))
    assert cs.conserved(page)==resources
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'trustedLazyUnlock':True,'oneTimesBloops':slow,'twoTimesBloops':fast,'resumedBloops':resumed,
        'unmutedBloops':unmuted,'physicalClocksParked':True,'narrator300HzSineOnly':True,'noPrefaceKnock':True,
        'pauseHiddenCompleteRevealSkipQuiet':True,'settingsMuteAndResume':True,'entrySilentStoryVoicePreserved':True,
        'allVoicesDisconnected':True,'typingDoesNotWriteSavesOrResources':True}


def muted_phone_flow(browser,url,expected):
    context,page,errors,writes,external=ui.open_page(AudioBrowser(browser,True),url,390,'light',virtual_walk=False,
        skip_cutscenes=False,skip_intro=False)
    base=paths.validate_release(page,expected);resources=cs.conserved(page)
    assert not events(page);ui.skip_intro(page);before=reading(page);page.wait_for_timeout(300)
    assert not events(page) and reading(page)['visibleCharacters']>before['visibleCharacters']
    press(page,'#cutscene-speed');assert reading(page)['playbackRate']==2
    page.wait_for_timeout(200);assert not events(page)
    press(page,'#cutscene-skip');press(page,'#menu');press(page,'#sound')
    assert page.locator('#sound').get_attribute('aria-pressed')=='true'
    press(page,'#replay-cutscene');reading(page);count=sample_typing(page,400,2)
    assert all(e['gesture'] for e in events(page) if e['kind']=='context')
    press(page,'#cutscene-skip');old=len(starts(page));page.wait_for_timeout(180);assert len(starts(page))==old
    assert cs.conserved(page)==resources
    safe(page,errors,writes,external);context.close()
    return{'releaseBase':base,'width':390,'savedSoundOffCreatesNoContext':True,'touchSoundOnUnlocksNarrator':True,
        'twoTimesBloops':count,'skipQuiet':True,'resourcesPreserved':True}


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
            result={'passed':True,'entry':url,'desktop':desktop_flow(runner,url,args.expect_release),'phone':muted_phone_flow(runner,url,args.expect_release)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1);name='public' if args.url else 'source' if args.source else 'launcher'
        (OUT/(name+'-results.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
