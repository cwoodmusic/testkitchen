"""Review every Quiet Bell room without touching any game or authoring save.

All review edits, navigation, import and export use ordinary controls. The only
fixtures are preexisting protected storage entries; app diagnostics are read-only.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlparse
import argparse
import json
import time

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/room-review-browser'
OUT.mkdir(parents=True, exist_ok=True)
REVIEW_KEY = 'codaQuietBellRoomReviewV1'
PROTECTED = {
    'codaQuietBellPageOneV1': '{"version":3,"fixture":"preserve-normal-run"}',
    'codaQuietBellJourneyV1': '{"version":1,"fixture":"preserve-normal-journal"}',
    'codaQuietBellDeveloperProjectV1': '{"schemaVersion":1,"fixture":"preserve-draft"}',
    'codaQuietBellDeveloperAppliedProjectV1': '{"schemaVersion":1,"fixture":"preserve-applied"}',
    'codaQuietBellDeveloperRunV1': '{"version":3,"fixture":"preserve-test-run"}',
    'codaQuietBellDeveloperJourneyV1': '{"version":1,"fixture":"preserve-test-journal"}',
    'codaQuietBellDeveloperActiveV1': 'on',
    'codaRhythmBlocksSoundV1': 'off',
    'codaNotesWalletV1': '{"fixture":"preserve-wallet","notes":23}',
    'musicArcadeV1': '{"fixture":"preserve-profile"}',
}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def state(page):
    return page.evaluate('quietBellRoomReview.state')


def active(page):
    return page.evaluate('quietBellRoomReview.activeRoomId')


def storage(page):
    return page.evaluate('keys=>Object.fromEntries(keys.map(key=>[key,localStorage.getItem(key)]))', list(PROTECTED))


def ready(page, expected=None):
    page.wait_for_function('!!window.quietBellRoomReview?.catalog?.length')
    page.wait_for_function('[...document.querySelectorAll("#review-preview img")].every(image=>image.complete&&image.naturalWidth>0)')
    fit = page.locator('#review-preview').evaluate('''element=>{
      const frame=element.getBoundingClientRect(),image=element.querySelector('.room-background'),
        art=image.getBoundingClientRect(),world=element.firstElementChild.getBoundingClientRect();
      return{frame:{x:frame.x,y:frame.y,width:frame.width,height:frame.height},
        art:{x:art.x,y:art.y,width:art.width,height:art.height},
        world:{x:world.x,y:world.y,width:world.width,height:world.height},
        clientWidth:element.clientWidth,clientHeight:element.clientHeight,
        naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight};
    }''')
    assert fit['naturalWidth'] == 1536 and fit['naturalHeight'] == 1024,fit
    for bounds in [fit['art'],fit['world']]:
        assert abs(bounds['width']-fit['clientWidth'])<=2 and abs(bounds['height']-fit['clientHeight'])<=2,fit
        assert fit['frame']['x']<=bounds['x']<=fit['frame']['x']+2,fit
        assert fit['frame']['y']<=bounds['y']<=fit['frame']['y']+2,fit
        assert bounds['x']+bounds['width']<=fit['frame']['x']+fit['frame']['width']+1,fit
        assert bounds['y']+bounds['height']<=fit['frame']['y']+fit['frame']['height']+1,fit
    if expected:
        assert '/releases/' + expected + '/' in page.evaluate('document.baseURI'), page.evaluate('document.baseURI')
    return page.evaluate('document.baseURI')


def open_page(browser, url, width=1100, expected=None):
    context = browser.new_context(viewport={'width': width, 'height': 820},
                                  is_mobile=width < 500, has_touch=width < 500,
                                  reduced_motion='reduce', accept_downloads=True,
                                  ignore_https_errors=urlparse(url).scheme=='https')
    context.add_init_script('''for(const[key,value]of Object.entries(''' + json.dumps(PROTECTED) + '''))
        if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
      window.__roomReviewWrites=[];
      for(const name of ['setItem','removeItem','clear']){
        const original=Storage.prototype[name];
        Storage.prototype[name]=function(...args){
          if(this===localStorage)window.__roomReviewWrites.push({operation:name,key:args[0]??null});
          return original.apply(this,args);
        };
      }''')
    page = context.new_page()
    page.set_default_timeout(20000)
    errors, requests = [], []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('request', lambda request: requests.append({'url': request.url, 'method': request.method}))
    page.goto(url, wait_until='networkidle')
    base = ready(page, expected)
    assert storage(page) == PROTECTED
    return context, page, errors, requests, base


def safe(page, errors, requests):
    assert not errors, errors
    assert storage(page) == PROTECTED, storage(page)
    writes = page.evaluate('window.__roomReviewWrites')
    assert all(item['operation'] == 'setItem' and item['key'] == REVIEW_KEY for item in writes), writes
    assert not [request for request in requests if request['method'] not in ['GET', 'HEAD']], requests
    origin = urlparse(page.url)
    assert not [request for request in requests if urlparse(request['url']).scheme in ['http', 'https'] and
                (urlparse(request['url']).scheme, urlparse(request['url']).netloc) != (origin.scheme, origin.netloc)], requests
    return {'protectedSavesUnchanged': True, 'onlyReviewStorageWritten': True, 'noExternalWrites': True}


def choose(page, room_id):
    if page.locator('#review-room-picker').get_attribute('open') is None:
        page.locator('#review-room-picker > summary').click()
    page.locator(f'#review-room-list button[data-room-id="{room_id}"]').click()
    page.wait_for_function('id=>quietBellRoomReview.activeRoomId===id', arg=room_id)
    ready(page)


def room_record(document, room_id):
    return next(room for room in document['rooms'] if room['id'] == room_id)


def show_all_sections(page):
    # Click disclosures as the reviewer does, so every source line is readable.
    for summary in page.locator('#review-transcript details:not([open]) > summary').all():
        summary.click()


def assert_layout(page):
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    for selector in ['#review-next', '#review-previous', '#review-room-comment', '#review-reviewed', '#review-export']:
        item = page.locator(selector)
        assert item.is_visible(), selector
        rect = item.bounding_box()
        assert rect['width'] > 0 and rect['x'] >= -1 and rect['x'] + rect['width'] <= page.viewport_size['width'] + 1, (selector, rect)


def full_review(browser, url, expected):
    context, page, errors, requests, base = open_page(browser, url, expected=expected)
    catalog = page.evaluate('quietBellRoomReview.catalog')
    assert len(catalog) == 26 and len({room['id'] for room in catalog}) == 26
    source = page.evaluate('''async()=>{
      const{createDefaultProject,normalizeProject,getPersonReplies}=await import(new URL('developer-project.mjs',document.baseURI));
      const project=normalizeProject(createDefaultProject()),texts={};
      const add=(list,value)=>{if(typeof value==='string'&&value.trim())list.push(value.trim());};
      for(const[id,room]of Object.entries(project.content)){
        const lines=[];add(lines,room.narration);add(lines,room.arrival);
        for(const clip of room.cutscene??[])add(lines,clip.text);
        for(const person of room.people){add(lines,person.intro);for(const reply of getPersonReplies(person))add(lines,reply.text);}
        for(const entry of room.inspections){add(lines,entry.text);for(const clip of entry.dialogue??[])add(lines,clip.text);}
        for(const copy of Object.values(room.doorCopy??{}))for(const key of ['hint','warning','deadCopy','repair'])add(lines,copy[key]);
        for(const key of ['copy','repair'])add(lines,room.outcome?.[key]);
        add(lines,room.failure?.copy);add(lines,room.failure?.lesson);add(lines,room.failure?.lesson?.text);
        texts[id]=[...new Set(lines)];
      }
      return{roomIds:Object.keys(project.scenes),texts};
    }''')
    assert {room['id'] for room in catalog} == set(source['roomIds'])
    for room in catalog:
        combined='\n'.join(item['text'] for section in room['sections'] for item in section['items'])
        for text in source['texts'][room['id']]:
            assert text in combined,(room['id'],'Missing source text',text)

    assert page.locator('#review-room-list button[data-room-id]').count() == 26
    assert active(page) == catalog[0]['id']
    assert page.locator('#review-previous').is_disabled()
    first = catalog[0]['id']
    comment = 'Please make Nell explain the problem sooner. Keep Mira’s shimmy shimmy!'
    page.locator('#review-room-comment').fill(comment)
    page.locator('#review-reviewed').check()
    page.locator('[data-filter="comments"]').click()
    assert page.locator('#review-room-list button[data-room-id]').count()==1
    page.locator('[data-filter="unreviewed"]').click()
    assert page.locator('#review-room-list button[data-room-id]').count()==25
    assert not page.locator('#review-room-list button[data-room-id="depot"]').count()
    page.locator('[data-filter="all"]').click()
    page.locator('#review-search').fill('listening heart')
    assert page.locator('#review-room-list button[data-room-id]').count()==1
    assert page.locator('#review-room-list button[data-room-id="final-heart"]').count()==1
    page.locator('#review-search').fill('')
    assert page.locator('#review-room-list button[data-room-id]').count()==26
    first_item = catalog[0]['sections'][0]['items'][0]
    toggle = page.locator('[data-comment-toggle]').first
    if toggle.count():
        toggle.click()
        page.locator('textarea[data-item-comment]').first.fill('This line needs a clearer clue.')
    coverage = []
    for index, room in enumerate(catalog):
        assert active(page) == room['id']
        assert page.locator('#review-room-title').inner_text() == room['title']
        ready(page); show_all_sections(page)
        for section in room['sections']:
            for item in section['items']:
                # IDs are source paths and can contain punctuation. Matching in
                # a locator filter avoids interpreting those paths as CSS.
                matched = page.locator('article[data-item-id]').evaluate_all(
                    '(elements,id)=>elements.filter(e=>e.dataset.itemId===id).map(e=>e.textContent)', item['id'])
                assert len(matched) == 1 and item['text'] in matched[0], (room['id'], item['id'], matched)
        assert page.locator('article[data-item-id]').count() == sum(len(section['items']) for section in room['sections'])
        coverage.append({'id': room['id'], 'sections': len(room['sections']),
                         'lines': sum(len(section['items']) for section in room['sections'])})
        if index + 1 < len(catalog):
            page.locator('#review-next').click()
    assert page.locator('#review-next').is_disabled()
    choose(page, first)
    assert page.locator('#review-room-comment').input_value() == comment
    assert page.locator('#review-reviewed').is_checked()
    page.screenshot(path=str(OUT / 'desktop-room-review.png'), full_page=True)
    page.reload(); ready(page, expected)
    assert page.locator('#review-room-comment').input_value() == comment
    assert page.locator('#review-reviewed').is_checked()
    with page.expect_download() as downloaded:
        page.locator('#review-export').click()
    download = downloaded.value
    path = OUT / 'coda-quiet-bell-room-review.json'
    download.save_as(path)
    exported = json.loads(path.read_text())
    assert exported['schemaVersion'] == 1 and exported['type'] == 'coda-quiet-bell-room-review'
    record = room_record(exported, first)
    assert record['comment'] == comment and record['reviewed'] is True
    assert exported.get('generatedAt') and len(exported['rooms']) == 26
    assert record.get('sections'), 'Export quotes source dialogue so comments have context.'
    if toggle.count():
        assert any(item['comment'] == 'This line needs a clearer clue.' and item['text']==first_item['text'] for item in record['items'])
    proof = {'releaseBase': base, 'rooms': coverage, 'totalRenderedLines': sum(room['lines'] for room in coverage),
             'commentAndReviewedSurviveReload': True, 'searchAndReviewFiltersWork': True, 'wholeRoomPreviewFits': True, 'actualDownload': download.suggested_filename,
             **safe(page, errors, requests)}
    context.close()
    return proof, exported


def import_review(browser, url, expected, exported):
    context, page, errors, requests, base = open_page(browser, url, expected=expected)
    assert not page.locator('#review-reviewed').is_checked()
    imported = json.loads(json.dumps(exported))
    record = room_record(imported, 'depot')
    record['comment'] = '<img src=x onerror="window.__reviewInjected=1"> Please keep this literal.'
    imported['rooms'].append({'id': 'future-room', 'title': 'Future room', 'reviewed': True,
                              'comment': 'Do not lose this review from another version.', 'items': []})
    fixture = OUT / 'import-review.json'
    fixture.write_text(json.dumps(imported))
    page.locator('#review-import-input').set_input_files(fixture)
    page.wait_for_function('document.querySelector("#review-room-comment").value.startsWith("<img")')
    assert page.locator('#review-reviewed').is_checked()
    assert page.evaluate('window.__reviewInjected??null') is None
    assert not page.locator('img[src="x"]').count()
    before = state(page)
    invalid = OUT / 'invalid-review.json'; invalid.write_text('{"schemaVersion":99,"rooms":[]}')
    old_status = page.locator('#review-status').inner_text()
    page.locator('#review-import-input').set_input_files(invalid)
    page.wait_for_function('prior=>document.querySelector("#review-status").textContent!==prior', arg=old_status)
    assert state(page) == before, 'Rejected input must leave the saved review intact.'
    assert page.locator('#review-room-comment').input_value() == record['comment']
    with page.expect_download() as downloaded:
        page.locator('#review-export').click()
    path = OUT / 'roundtrip-review.json'; downloaded.value.save_as(path)
    roundtrip = json.loads(path.read_text())
    assert room_record(roundtrip, 'future-room')['comment'] == imported['rooms'][-1]['comment']
    assert room_record(roundtrip, 'depot')['comment'] == record['comment']
    proof = {'releaseBase': base, 'freshImportRestoresFlagsAndComments': True,
             'unknownRoomCommentsPreserved': True, 'invalidImportDoesNotClobber': True,
             'importedTextNeverBecomesHtml': True, **safe(page, errors, requests)}
    context.close()
    return proof


def responsive_review(browser, url, expected, width):
    context, page, errors, requests, base = open_page(browser, url, width, expected)
    ready(page); assert_layout(page)
    page.locator('#review-room-comment').fill('Small screen review is editable.')
    page.locator('#review-reviewed').check()
    page.locator('#review-next').click()
    assert active(page) != 'depot'
    page.locator('#review-previous').click()
    assert active(page) == 'depot'
    assert page.locator('#review-room-comment').input_value() == 'Small screen review is editable.'
    # Native controls remain usable by keyboard, including the checklist.
    page.locator('#review-reviewed').focus(); page.keyboard.press('Space')
    assert not page.locator('#review-reviewed').is_checked()
    choose(page, 'ending-complete'); show_all_sections(page); assert_layout(page)
    page.screenshot(path=str(OUT / f'room-review-{width}.png'), full_page=True)
    proof = {'releaseBase': base, 'width': width, 'allControlsInsideViewport': True,
             'roomSwitchesRetainComment': True, 'keyboardCheckboxWorks': True,
             **safe(page, errors, requests)}
    context.close()
    return proof



def settings_link(browser, url, expected):
    parsed = urlparse(url)
    if '/releases/' in parsed.path:
        game_path = parsed.path.split('/releases/')[0] + '/'
    elif '/review/' in parsed.path:
        game_path = parsed.path.split('/review/')[0] + '/'
    else:
        game_path = parsed.path.rsplit('/', 1)[0] + '/game.html'
    game_url = parsed._replace(path=game_path, query='', fragment='').geturl()
    context = browser.new_context(viewport={'width': 1100, 'height': 820}, reduced_motion='reduce',
                                  ignore_https_errors=urlparse(game_url).scheme=='https')
    page = context.new_page(); page.set_default_timeout(20000)
    errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(game_url,wait_until='networkidle')
    page.wait_for_function('!!window.quietBell?.state')
    if page.locator('#story-intro-skip').is_visible():page.locator('#story-intro-skip').click()
    if page.locator('#cutscene-panel').is_visible():page.locator('#cutscene-skip').click()
    page.locator('#menu').click()
    link=page.locator('#room-review')
    assert link.get_attribute('target')=='_blank'
    assert 'noopener' in link.get_attribute('rel').split()
    assert urlparse(link.get_attribute('href') if link.get_attribute('href').startswith('http') else link.evaluate('a=>a.href')).path.endswith('/games/rhythm-blocks/review/')
    before=page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    run=page.evaluate('quietBell.state')
    with page.expect_popup() as opened:link.click()
    review=opened.value;ready(review,expected)
    after=page.evaluate('Object.fromEntries(Object.entries(localStorage))')
    assert {key:value for key,value in after.items() if key!=REVIEW_KEY}=={key:value for key,value in before.items() if key!=REVIEW_KEY}
    assert page.evaluate('quietBell.state')==run
    assert not errors,errors
    context.close()
    return {'settingsOpensSeparateReviewTab':True,'gameRunAndAllStoragePreserved':True}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    parser.add_argument('--entry', default='room-review.html')
    parser.add_argument('--expected-version')
    parser.add_argument('--label', default='source')
    parser.add_argument('--skip-settings-link', action='store_true')
    args = parser.parse_args()
    server = None
    if not args.url:
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Handler, directory=str(ROOT)))
        Thread(target=server.serve_forever, daemon=True).start()
    url = args.url or f'http://127.0.0.1:{server.server_port}/games/rhythm-blocks/{args.entry}'
    started = time.monotonic()
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'], headless=True)
            desktop, exported = full_review(browser, url, args.expected_version)
            result = {'passed': True, 'entry': url, 'desktop': desktop,
                      'import': import_review(browser, url, args.expected_version, exported),
                      'phone': responsive_review(browser, url, args.expected_version, 390),
                      'small': responsive_review(browser, url, args.expected_version, 320)}
            if not args.skip_settings_link:result['settings']=settings_link(browser,url,args.expected_version)
            browser.close()
        result['seconds'] = round(time.monotonic() - started, 1)
        (OUT / (args.label + '-results.json')).write_text(json.dumps(result, indent=2) + '\n')
        print(json.dumps({'passed': True, 'label': args.label, 'seconds': result['seconds'],
                          'rooms': len(result['desktop']['rooms']),
                          'lines': result['desktop']['totalRenderedLines']}, indent=2))
    finally:
        if server:
            server.shutdown(); server.server_close()


if __name__ == '__main__':
    main()
