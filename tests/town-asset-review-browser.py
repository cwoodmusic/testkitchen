"""Review every town asset without changing maps; export exact per-view fixes."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'work/asset-review/browser'
OUT.mkdir(parents=True, exist_ok=True)
KEY = 'codaTownAssetReviewV1'
SENTINELS = {'codaReviewMapSentinel': '{"map":"preserve"}',
             'codaReviewProfileSentinel': '{"notes":17,"fish":["preserve"]}'}


class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def copyfile(self, source, target):
        try:
            super().copyfile(source, target)
        except (BrokenPipeError, ConnectionResetError):
            pass


def wait_ready(page):
    page.wait_for_function('!!window.townAssetReview?.catalog && !!window.townAssetReview?.review')
    page.wait_for_function("!/(loading|opening)/i.test(document.getElementById('previewStatus').textContent)")


def go(page, asset_id, facing='south'):
    page.evaluate('''async ([id,facing]) => {await townAssetReview.goTo(id,facing);}''', [asset_id, facing])
    page.wait_for_function('([id,facing]) => townAssetReview.assetId===id && townAssetReview.facing===facing', arg=[asset_id, facing])
    page.wait_for_function("!/(loading|opening)/i.test(document.getElementById('previewStatus').textContent)")


def pixels(page):
    return page.evaluate('''() => {
      const c=document.getElementById('preview'),p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let ink=0;for(let i=3;i<p.length;i+=4)if(p[i]>20)ink++;
      return {ink,width:c.width,height:c.height,pixels:c.width*c.height};
    }''')


def option_ids(page):
    return page.locator('#assetPicker option').evaluate_all('(options)=>options.map(o=>o.value)')


def note(page, asset_id, facing):
    return page.evaluate('([id,facing])=>townAssetReview.review.get(id,facing)', [asset_id, facing])


def download(page, filename):
    with page.expect_download() as pending:
        page.locator('#downloadReview').click()
    result = pending.value
    assert result.suggested_filename.endswith('.json'), result.suggested_filename
    result.save_as(OUT / filename)
    return json.loads((OUT / filename).read_text())


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
origin = f'http://127.0.0.1:{server.server_port}'
errors = []
reports = []
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = browser.new_context(viewport={'width':1440,'height':1000}, accept_downloads=True)
        context.add_init_script('const reviewSentinels='+json.dumps(SENTINELS)+';for(const [k,v]of Object.entries(reviewSentinels))localStorage.setItem(k,v);'+'''
          window.__reviewWrites=[];window.__reviewDatabases=[];
          const reviewSet=Storage.prototype.setItem,reviewOpen=IDBFactory.prototype.open;
          Storage.prototype.setItem=function(key,value){__reviewWrites.push(key);return reviewSet.call(this,key,value);};
          IDBFactory.prototype.open=function(name,...args){__reviewDatabases.push(name);return reviewOpen.call(this,name,...args);};
        ''')
        page = context.new_page()
        page.set_default_timeout(90000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(origin+'/town/asset-review/')
        wait_ready(page)

        coverage = page.evaluate('''() => {
          const all=[...townAssetReview.catalog.values()];
          return {ids:all.map(a=>a.id),rugs:all.filter(a=>a.roomRug).map(a=>a.id),
            surfaces:all.filter(a=>a.id.startsWith('surface:')).map(a=>a.id),
            directional:all.filter(a=>typeof a.getFacingView==='function'&&!a.wallMounted&&a.layer!=='ground').map(a=>a.id)};
        }''')
        assert len(coverage['ids']) == 1860, len(coverage['ids'])
        assert set(option_ids(page)) == set(coverage['ids']), 'Every catalog item must be reachable, including hidden builder entries'
        assert set(coverage['surfaces']) == {'surface:'+s for s in ['grass','cobble','dirt','water','wood','sand','asphalt','sidewalk','brick']}
        assert coverage['rugs'], 'Room rugs must remain reviewable'
        first, last = coverage['ids'][0], coverage['ids'][-1]
        go(page, first)
        assert pixels(page)['ink'] > 100
        page.locator('#next').click()
        page.wait_for_function('(id)=>townAssetReview.assetId!==id', arg=first)
        page.keyboard.press('ArrowLeft')
        page.wait_for_function('(id)=>townAssetReview.assetId===id', arg=first)
        page.locator('#next').focus()
        page.keyboard.press('ArrowRight')
        page.wait_for_function('(id)=>townAssetReview.assetId!==id', arg=first)
        go(page, last)
        assert pixels(page)['ink'] > 100
        go(page, coverage['rugs'][0])
        assert pixels(page)['ink'] > 100
        page.locator('#markGood').click()
        assert note(page, coverage['rugs'][0], 'south')['status'] == 'ok'

        # A note names its exact asset and facing; navigation must never carry
        # a previous asset's text into a different drawing.
        go(page, first)
        page.locator('#flagReview').click()
        repair = 'Please fix this edge. Keep the original colours. <script>literal note</script>'
        page.locator('#note').fill(repair)
        page.wait_for_function('([id,text])=>townAssetReview.review.get(id,"south").note===text', arg=[first, repair])
        page.keyboard.press('ArrowRight')
        assert page.evaluate('townAssetReview.assetId') == first, 'Typing in the note must not advance the asset'
        assert page.locator('script').filter(has_text='literal note').count() == 0

        side_id = 'collection-showroom-victorian-parlor-sofa'
        assert side_id in coverage['directional']
        go(page, side_id, 'west')
        assert pixels(page)['ink'] > 100
        page.locator('#flagReview').click()
        side_repair = 'The west-facing silhouette needs fixing; keep the south view.'
        page.locator('#note').fill(side_repair)
        assert note(page, side_id, 'west')['note'] == side_repair
        page.locator('#facings [data-facing="east"]').click()
        page.wait_for_function('townAssetReview.facing==="east"')
        wait_ready(page)
        assert page.locator('#note').input_value() == ''
        assert pixels(page)['ink'] > 100
        page.locator('#facings [data-facing="west"]').click()
        page.wait_for_function('townAssetReview.facing==="west"')
        wait_ready(page)
        assert page.locator('#note').input_value() == side_repair
        page.screenshot(path=str(OUT/'flagged-west-facing.png'))

        # The catalog combines procedural sprites, old directional furniture,
        # native collections and shared plush sheets; cover their real loaders.
        for sample in ['furniture-1-180', next((id for id in coverage['directional'] if id.startswith('plush-')), None)]:
            if sample is None or sample not in coverage['ids']:
                continue
            go(page, sample)
            assert page.locator('#previewStatus').get_attribute('data-error') != 'true', sample
            assert pixels(page)['ink'] > 100
            if page.locator('#facings [data-facing="west"]').count():
                go(page, sample, 'west')
                assert page.locator('#previewStatus').get_attribute('data-error') != 'true', sample+' / west'
                assert pixels(page)['ink'] > 100

        owners = page.evaluate('''()=>{
          const unique=new Map();for(const a of townAssetReview.catalog.values())
            if(a.collectionOwner&&a.getFacingDrawSource&&!a.wallMounted&&a.layer!=='ground'&&!unique.has(a.collectionOwner))unique.set(a.collectionOwner,a.id);
          return [...unique.values()].slice(0,7);
        }''')
        if len(owners) == 7:
            page.evaluate('''async ids=>{
              const jobs=[];for(const [i,id]of ids.entries()){
                jobs.push(townAssetReview.goTo(id,i===ids.length-1?'south':i%2?'west':'east'));
                await new Promise(resolve=>setTimeout(resolve,15));
              }await Promise.all(jobs);
            }''', owners)
            wait_ready(page)
            assert page.evaluate('townAssetReview.assetId') == owners[-1]
            assert page.locator('#previewStatus').get_attribute('data-error') != 'true'
            page.locator('#zoom').select_option('2')
            page.locator('#zoom').select_option('fit')
            box = page.locator('#preview').bounding_box()
            page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
            page.mouse.down();page.mouse.move(box['x']+box['width']/2+20,box['y']+box['height']/2+12);page.mouse.up()
            assert pixels(page)['ink'] > 100
            page.set_viewport_size({'width':390,'height':844})
            page.screenshot(path=str(OUT/'mobile-review.png'), full_page=True)
            page.set_viewport_size({'width':1440,'height':1000})

        page.locator('#reviewFilter').select_option('flagged')
        assert set(option_ids(page)) == {first, side_id}, 'Side-facing issues must be found by the flagged filter'
        page.locator('#reviewFilter').select_option('noted')
        assert set(option_ids(page)) == {first, side_id}
        page.locator('#reviewFilter').select_option('all')
        page.locator('#search').fill('sydney-opera-house')
        assert option_ids(page) == ['sydney-opera-house']
        go(page, 'sydney-opera-house')
        assert pixels(page)['ink'] > 1000
        page.locator('#zoom').select_option('1')
        assert pixels(page)['pixels'] <= 8*1024*1024, 'Huge assets must not allocate huge world-sized preview canvases'
        page.locator('#zoom').select_option('fit')
        page.locator('#background').select_option('paper')
        page.locator('#background').select_option('checker')
        page.locator('#search').fill('')
        assert set(option_ids(page)) == set(coverage['ids'])
        group = page.evaluate('(id)=>townAssetReview.catalog.get(id).group', first)
        group_ids = page.evaluate('(group)=>[...townAssetReview.catalog.values()].filter(a=>a.group===group).map(a=>a.id)', group)
        page.locator('#category').select_option(group)
        assert set(option_ids(page)) == set(group_ids)
        page.locator('#category').select_option(page.locator('#category option').first.get_attribute('value'))
        assert set(option_ids(page)) == set(coverage['ids'])

        exported = download(page, 'review.json')
        assert exported['format'] == 'coda-asset-review' and exported['version'] == 1
        assert exported['repository'] == 'cwoodmusic/testkitchen'
        records = {(r['assetId'],r['facing']):r for r in exported['reviews']}
        for key, text in [((first,'south'),repair),((side_id,'west'),side_repair)]:
            record = records[key]
            assert record['status'] == 'flagged' and record['note'] == text
            assert record['name'] and record['group'] and record['width'] > 0 and record['height'] > 0
        assert records[(coverage['rugs'][0],'south')]['status'] == 'ok'
        raw = page.evaluate('(key)=>localStorage.getItem(key)', KEY)
        assert set(page.evaluate('__reviewWrites')) <= {KEY, 'codaTownAssetReviewCursorV1'}
        assert page.evaluate('__reviewDatabases') == [], 'Reviewing artwork must not open the game map database'
        page.reload()
        wait_ready(page)
        assert note(page, first, 'south')['note'] == repair
        assert note(page, side_id, 'west')['note'] == side_repair
        assert page.evaluate('(key)=>localStorage.getItem(key)', KEY) == raw
        go(page, side_id, 'west')
        assert page.locator('#note').input_value() == side_repair
        assert page.evaluate('(sentinels)=>Object.fromEntries(Object.keys(sentinels).map(k=>[k,localStorage.getItem(k)]))', SENTINELS) == SENTINELS

        # Repeat raw ground tiles, but render room floors/walls as one connected
        # actual material field so trim and room outlines cannot manufacture seams.
        finishes = page.evaluate("()=>[...townAssetReview.catalog.values()].filter(a=>a.pack==='interior-materials').map(a=>({id:a.id,kind:a.finishKind,owner:a.owner}))")
        assert len(finishes) == 186
        assert len({a['owner'] for a in finishes}) == 31
        assert sum(a['kind']=='floor' for a in finishes) == 124
        assert sum(a['kind']=='wall' for a in finishes) == 62
        for sample_id, label in [('surface:wood','3×3 tiled sample'),
                                 ('finish:floor:bach-floor','3×3 tiled sample'),
                                 ('finish:floor:showroom-victorian-parlor-kitchen-floor','3×3 tiled sample'),
                                 ('finish:wall:showroom-victorian-parlor-wall','connected wall sample'),
                                 ('finish:wall:showroom-victorian-parlor-wet-wall','connected wall sample'),
                                 ('construction-3','connected wall sample'),
                                 ('music-square-wall','connected wall sample')]:
            go(page, sample_id)
            assert label in page.locator('#previewStatus').inner_text()
            assert pixels(page)['ink'] > 100
            page.locator('#zoom').select_option('2')
            page.locator('#zoom').select_option('fit')
            page.screenshot(path=str(OUT/(sample_id.replace(':','-')+'.png')))
        comparisons = page.evaluate('''async()=>{
          const {prepareAssetPreview}=await import('/town/asset-review/preview.mjs?v=town-library-review-1');
          const {drawShowroomFloor,drawShowroomWallpaper}=await import('/town/world/showroom-materials.mjs?v=town-library-review-1');
          const results=[];
          for(const id of ['finish:floor:bach-floor','finish:floor:showroom-victorian-parlor-kitchen-floor','finish:wall:showroom-victorian-parlor-wall']){
            const a=townAssetReview.catalog.get(id),p=await prepareAssetPreview(a),actual=document.createElement('canvas'),expected=document.createElement('canvas');
            for(const c of [actual,expected]){c.width=Math.ceil(p.width);c.height=Math.ceil(p.height);}
            p.draw(actual.getContext('2d'));
            const c=expected.getContext('2d'),o=a.materialOrigin;c.imageSmoothingEnabled=false;c.translate(-o.x,-o.y);
            const bounds={x:o.x,y:o.y,w:p.width,h:p.height};
            if(a.finishKind==='floor')drawShowroomFloor(c,{...bounds,floorFinish:a.materialFinish});
            else drawShowroomWallpaper(c,{x:28,y:106,wallpaper:a.materialFinish,wallpaperAreas:[bounds]});
            const ap=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data,ep=expected.getContext('2d').getImageData(0,0,expected.width,expected.height).data;
            let mismatch=0;for(let i=0;i<ap.length;i++)if(ap[i]!==ep[i])mismatch++;
            results.push({id,mismatch,width:a.w,height:a.h,sample:p.sample});
          }return results;
        }''')
        assert all(r['mismatch']==0 for r in comparisons), comparisons
        failed_material_requests=[]
        def material_failure_once(route):
            failed_material_requests.append(route.request.url)
            if len(failed_material_requests)==1:
                route.fulfill(status=404,content_type='text/plain',body='Missing material regression')
            else:
                route.continue_()
        page.route('**/assets/home-materials/mozart-floor.webp*',material_failure_once)
        go(page,'finish:floor:mozart-floor')
        assert page.locator('#previewStatus').get_attribute('data-error')=='true'
        assert 'mozart-floor.webp' in page.locator('#previewStatus').inner_text()
        assert page.locator('#retryPreview').is_visible()
        assert len(failed_material_requests)==1
        assert pixels(page)['ink']==0,'Missing native art must not become a Ready flat-color fallback'
        page.locator('#retryPreview').click()
        page.wait_for_function("document.getElementById('previewStatus').textContent.startsWith('Ready')")
        assert page.locator('#previewStatus').get_attribute('data-error')=='false'
        assert page.locator('#retryPreview').is_hidden()
        assert len(failed_material_requests)==2,'Retry must request the failed native texture again'
        assert pixels(page)['ink']>100
        go(page,'finish:floor:mozart-floor')
        assert len(failed_material_requests)==2,'A recovered material stays cached'
        page.unroute('**/assets/home-materials/mozart-floor.webp*',material_failure_once)
        material_id='finish:wall:showroom-victorian-parlor-wall'
        go(page, material_id)
        material_note='Check how the wallpaper and trim connect across the wall run.'
        page.locator('#note').fill(material_note)
        material_export=download(page,'review-materials.json')
        material_record=next(r for r in material_export['reviews'] if r['assetId']==material_id)
        assert material_record['finishId']=='showroom-victorian-parlor-wall'
        assert material_record['owner']=='showroom-victorian-parlor'
        assert material_record['purpose']=='wallpaper finish'
        assert material_record['sample']['columns']==3 and material_record['sample']['rows']==1
        assert material_record['width']*3==material_record['sample']['width']
        assert material_record['width']!=material_record['sample']['width']
        page.reload();wait_ready(page);go(page,material_id)
        assert page.locator('#note').input_value()==material_note
        assert note(page,side_id,'west')['note']==side_repair
        assert page.evaluate('(sentinels)=>Object.fromEntries(Object.keys(sentinels).map(k=>[k,localStorage.getItem(k)]))', SENTINELS)==SENTINELS
        raw=page.evaluate('(key)=>localStorage.getItem(key)',KEY)
        go(page,side_id,'west')

        # A laptop refusing local writes must still preserve the visible edits
        # and let the review file carry them out of the tab.
        page.evaluate('''key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Full','QuotaExceededError');return set.call(this,k,v);};}''', KEY)
        unsaved = side_repair + ' This edit must remain downloadable even if browser saving fails.'
        page.locator('#note').fill(unsaved)
        assert note(page, side_id, 'west')['note'] == unsaved
        assert page.evaluate('townAssetReview.review.saved') is False
        assert 'download' in page.locator('#saveStatus').inner_text().lower()
        fallback = download(page, 'review-unsaved.json')
        assert next(r for r in fallback['reviews'] if r['assetId']==side_id and r['facing']=='west')['note'] == unsaved
        assert page.evaluate('(key)=>localStorage.getItem(key)', KEY) == raw
        assert not errors, errors
        reports.append({'assets':len(coverage['ids']),'rugs':len(coverage['rugs']),'surfaces':len(coverage['surfaces']),
                        'directionalAssets':len(coverage['directional']),'flaggedAsset':first,'sideAsset':side_id,
                        'exportedReviews':len(exported['reviews']),'interiorFinishes':len(finishes),'materialRenderComparisons':comparisons,'materialFailureRetry':len(failed_material_requests)==2,'storageFallback':True})
        (OUT/'results.json').write_text(json.dumps({'passed':True,'reports':reports,'errors':errors},indent=2))
        print('PASS: complete asset coverage, native previews, navigation, per-facing flags/notes, search/filters, reload, actual review JSON download, protected storage and failed-save export.', flush=True)
        context.close()
        browser.close()
finally:
    server.shutdown()
