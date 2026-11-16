"""Real map clicks must change the dialogue inspector without moving Mira.

This specifically covers successive characters in one room: selecting the
already-default Nell is not evidence that pointer selection works.
"""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import importlib.util
import json
import math
import sys

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'work/developer-selection'
OUT.mkdir(parents=True,exist_ok=True)
spec=importlib.util.spec_from_file_location('quiet_bell_ui',ROOT/'tests/rhythm-blocks-browser.py')
ui=importlib.util.module_from_spec(spec);spec.loader.exec_module(ui)
SIZES=[(1024,768),(390,844),(320,568)]


def tick(page):
    page.wait_for_timeout(100)


def normal_storage(page):
    return page.evaluate('(keys)=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)]))',
                         [ui.SAVE_KEY,'codaQuietBellJourneyV1',*ui.PROTECTED])


def person_name(page):
    return page.locator('#developer-person-name').input_value()


def pointer(page,selector,touch):
    node=page.locator(selector)
    if node.get_attribute('data-door'):
        # The low edge is clear of neighboring prop labels on a narrow map.
        bounds=node.bounding_box();x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']*.85
        if touch:page.touchscreen.tap(x,y)
        else:page.mouse.click(x,y)
    elif touch: node.tap()
    else: node.click()
    tick(page)


def select_person(page,identifier,touch):
    pointer(page,f'#room-map [data-person="{identifier}"]',touch)
    expected=identifier.capitalize()
    actual=person_name(page)
    if actual!=expected:
        proof={'expected':expected,'actual':actual,'events':page.evaluate('window.__selectionEvents'),
               'walker':ui.walker(page),'release':page.evaluate('document.baseURI')}
        (OUT/'failure.json').write_text(json.dumps(proof,indent=2)+'\n')
        page.screenshot(path=str(OUT/'failure.png'))
    assert actual==expected,(identifier,actual)
    assert page.locator('[data-dev-tab="dialogue"]').get_attribute('aria-selected')=='true'
    heading=page.locator('#developer-body .dc-card h3').first.inner_text()
    assert heading.startswith(expected+' · '),(identifier,heading)


def frozen(page,position):
    now=ui.walker(page)
    assert math.hypot(now['x']-position['x'],now['y']-position['y'])<1,(position,now)


def one_context(browser,url,width,height):
    context,page,errors,writes,external=ui.open_page(browser,url,width,'light',virtual_walk=False,height=height)
    touch=width<500
    page.keyboard.press('F2');page.locator('#developer-console').wait_for(state='visible');tick(page)
    page.evaluate('''()=>{
      window.__selectionEvents=[];
      for(const type of ['pointerdown','pointerup','click'])document.addEventListener(type,e=>{
        if(!document.getElementById('room-map').contains(e.target))return;
        __selectionEvents.push({type,target:e.target.id||e.target.tagName,person:e.target.closest('[data-person]')?.dataset.person??null,pointerType:e.pointerType??null});
      },true);
    }''')
    baseline=normal_storage(page);position=ui.walker(page)
    # Actual successive map inputs, with no intervening room/tab selection.
    for who in ['nell','iris','pip','nell','pip','iris','nell']:
        select_person(page,who,touch);frozen(page,position)
    # Blurring a text field into another actual-map object must preserve both edits
    # and selection even though updating the draft can refresh the map DOM.
    nell_text='Nell remembers the warm letter.'
    page.locator('#developer-intro').fill(nell_text)
    select_person(page,'iris',touch)
    assert page.locator('#developer-intro').input_value()!=nell_text
    iris_text='Iris listens to the roots.'
    page.locator('#developer-intro').fill(iris_text)
    select_person(page,'pip',touch)
    assert page.locator('#developer-intro').input_value() not in [nell_text,iris_text]
    select_person(page,'nell',touch)
    assert page.locator('#developer-intro').input_value()==nell_text
    select_person(page,'iris',touch)
    assert page.locator('#developer-intro').input_value()==iris_text
    select_person(page,'nell',touch)
    reply_text='Nell says the post bell is quiet.'
    page.locator('#developer-reply-text').fill(reply_text)
    select_person(page,'iris',touch)
    assert page.locator('#developer-reply-text').input_value()!=reply_text
    select_person(page,'nell',touch)
    assert page.locator('#developer-reply-text').input_value()==reply_text
    # An explicit map selection replaces text-search results with that inspector.
    if not touch:
        page.locator('#developer-search').fill('Nell');tick(page)
        assert page.locator('.dc-search-result').count()>0
        select_person(page,'iris',touch)
        assert page.locator('#developer-search').input_value()==''
    # Selection also survives entering the other object inspectors.
    pointer(page,'#room-map [data-door="garden"]',touch)
    assert page.locator('[data-dev-tab="puzzles"]').get_attribute('aria-selected')=='true'
    select_person(page,'pip',touch)
    pointer(page,'#room-map [data-chest="depot-chest"]',touch)
    assert page.locator('[data-dev-tab="notes"]').get_attribute('aria-selected')=='true'
    select_person(page,'iris',touch)
    # Keyboard activation uses the same map objects and must switch too.
    for who in ['pip','nell','iris']:
        page.locator(f'#room-map [data-person="{who}"]').focus()
        page.keyboard.press('Enter');tick(page)
        assert person_name(page)==who.capitalize()
        frozen(page,position)
    if not touch:
        # The selection repair must retain real drags and their undoable geometry.
        actor=page.locator('#room-map [data-actor="nell"]')
        before_left=actor.evaluate('e=>parseFloat(e.style.left)')
        bounds=page.locator('#room-map [data-person="nell"]').bounding_box()
        x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']/2
        page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+32,y,steps=8);page.mouse.up()
        page.wait_for_timeout(250)
        assert actor.evaluate('e=>parseFloat(e.style.left)')>before_left+3
        frozen(page,position)
        select_person(page,'nell',touch)
        tools=page.locator('#developer-console details.dc-tools')
        if not tools.evaluate('e=>e.open'):tools.locator('summary').click()
        page.locator('#developer-undo').click();tick(page)
        assert abs(actor.evaluate('e=>parseFloat(e.style.left)')-before_left)<.01
        if tools.evaluate('e=>e.open'):tools.locator('summary').click()
    assert normal_storage(page)==baseline,'Authoring selection must not write ordinary progress.'
    assert not errors and not writes and not external,(errors,writes,external)
    page.screenshot(path=str(OUT/f'selection-{width}.png'))
    result={'width':width,'height':height,'touch':touch,'sameRoomSuccessiveSelection':True,
            'editedDraftPreserved':True,'objectInspectorRoundtrip':True,'keyboardSelection':True,
            'miraFrozen':True,'ordinaryProgressUnchanged':True,'release':page.evaluate('document.baseURI')}
    context.close();return result


def main():
    server=ThreadingHTTPServer(('127.0.0.1',0),partial(ui.Quiet,directory=str(ROOT)))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with ui.sync_playwright() as p:
            browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            url=f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/'+('game.html' if '--source' in sys.argv else '')
            results=[one_context(browser,url,*size) for size in SIZES]
            browser.close()
        proof={'passed':True,'contexts':results}
        (OUT/'browser-results.json').write_text(json.dumps(proof,indent=2)+'\n')
        print(json.dumps(proof,indent=2))
    finally: server.shutdown()


if __name__=='__main__': main()
