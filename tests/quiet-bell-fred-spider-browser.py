"""Fred is an optional, reachable attic discovery with no puzzle rewards."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import importlib.util
import json
import time

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/fred-spider-browser';OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('fred_objects',ROOT/'tests/quiet-bell-object-dialogues-browser.py')
objects=importlib.util.module_from_spec(spec);spec.loader.exec_module(objects)
depot,cs,ui,paths=objects.depot,objects.cs,objects.ui,objects.paths
tick,press=depot.tick,depot.press
IDENTIFIER='workshop-alcove-fred'


def discovery(browser,url,expected,name):
    context,page,errors,writes,external=ui.open_page(browser,url,1024,'dark')
    page.clock.pause_at(page.evaluate('Date.now()/1000')+.1)
    base=paths.validate_release(page,expected);normal=cs.normal_storage(page)
    assert page.locator('.mg-fred-spider').count()==0,'Fred is not an overlay in other rooms.'
    assert not any('fred' in entry['id'] for entry in page.evaluate('quietBell.journey.hints'))
    page.keyboard.press('F2');press(page,'[data-dev-room="workshop-alcove"]')
    press(page,'[data-dev-tab="playtest"]');press(page,'#developer-start-playtest')
    page.locator('#developer-console').wait_for(state='hidden');ui.skip_cutscene(page)
    sprite=page.locator('.mg-fred-spider');assert sprite.count()==1
    assert sprite.get_attribute('aria-hidden')=='true'
    assert sprite.evaluate('n=>n.offsetWidth')==28 and sprite.evaluate('n=>n.offsetHeight')==24
    assert page.locator(f'[data-inspect="{IDENTIFIER}"]').is_visible()
    assert not any('fred' in entry['id'] for entry in page.evaluate('quietBell.journey.hints'))
    project=page.evaluate('quietBell.project');entry=objects.observation(project,'workshop-alcove',IDENTIFIER)
    before=objects.resources(page);chart=page.evaluate('quietBell.journey')
    page.screenshot(path=str(OUT/f'{name}-attic.png'))
    box=sprite.bounding_box();clip={'x':max(0,box['x']-60),'y':max(0,box['y']-40),'width':140,'height':100}
    page.screenshot(path=str(OUT/f'{name}-fred-closeup.png'),clip=clip)
    distance=objects.click_inspection(page,IDENTIFIER)
    page.screenshot(path=str(OUT/f'{name}-discussion.png'))
    objects.assert_exchange(page,entry)
    assert page.locator('#lore-title').inner_text()=='Fred the wolf spider'
    assert page.locator('#lore-search').is_hidden()
    assert objects.resources(page)==before
    discovered=page.evaluate('quietBell.journey')
    assert any(e['id']=='lore-'+IDENTIFIER for e in discovered['hints'])
    for field in ['nodes','edges','outcomes','achievements']:assert discovered[field]==chart[field],field
    assert objects.saved(page,True)['roomObjectDialogues']['seen'][IDENTIFIER].startswith('object-v1-')
    objects.close_lore(page);objects.click_inspection(page,IDENTIFIER,False)
    assert page.locator('#lore-discussion').is_visible()
    objects.close_lore(page);press(page,'#menu')
    section=page.locator('#journey-hints-section')
    if not section.evaluate('e=>e.open'):press(page,'#journey-hints-section > summary')
    assert 'Fred the wolf spider' in page.locator('#journey-hints').inner_text()
    page.screenshot(path=str(OUT/f'{name}-journal.png'));press(page,'#menu-close')
    assert cs.normal_storage(page)==normal
    press(page,'#developer-end');tick(page,50)
    assert page.locator('.mg-fred-spider').count()==0
    assert cs.normal_storage(page)==normal
    depot.safe(page,errors,writes,external);context.close()
    return {'releaseBase':base,'smallPixelSpiderOnlyInAttic':True,'actualApproachDistance':distance,
        'allFourEditableLines':True,'onceThenReplay':True,'normalJournalDiscovery':True,
        'noChartPathsOrRewards':True,'resourcesPreserved':True,'normalSaveBytesUnchanged':True}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',action='store_true');parser.add_argument('--url');parser.add_argument('--expect-release')
    args=parser.parse_args();server=None;started=time.monotonic()
    name='public' if args.url else 'source' if args.source else 'launcher'
    if args.url:url=args.url
    else:
        server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)))
        Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if args.source else '')
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            runner=cs.PublicBrowser(browser) if args.url else browser
            result={'passed':True,'entry':url,'discovery':discovery(runner,url,args.expect_release,name)}
            browser.close()
        result['seconds']=round(time.monotonic()-started,1)
        (OUT/f'{name}-results.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2),flush=True)
    finally:
        if server:server.shutdown()


if __name__=='__main__':main()
