"""Actual editor zoom/pan controls preserve furniture, storage and the town camera."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse, json
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--url')
parser.add_argument('--screenshots', type=Path, default=Path('/tmp/coda-room-editor-view'))
args = parser.parse_args()
args.screenshots.mkdir(parents=True, exist_ok=True)

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
steps = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width': 1440, 'height': 1000}, has_touch=True)
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        try:
            page.goto(args.url or f'http://127.0.0.1:{server.server_port}/town/builder/?kit=urban')
            page.wait_for_function('!!window.townBuilder?.roomEditor')
            page.locator('#roomEditor').click()
            page.wait_for_function('townBuilder.roomEditor.active&&!!townBuilder.roomEditor.model')
            page.evaluate('''async()=>{
              const app=new URL(document.querySelector('script[type=module]').src);
              const {furnitureFacingBounds}=await import(new URL('../world/furniture-facing.mjs'+app.search,app));
              window.__viewSnapshot=()=>{const e=townBuilder.roomEditor;return{record:e.model.record(),revision:e.model.revision,raw:localStorage.getItem('codaRoomLayoutsV1:builder'),town:JSON.stringify(townBuilder.project),cam:{...townBuilder.cam},view:e.view,held:e.held};};
              window.__viewSofa=()=>{const e=townBuilder.roomEditor,i=e.model.scene.items.find(i=>i.asset.endsWith('-sofa')),b=furnitureFacingBounds(townBuilder.catalog.get(i.asset),i),v=e.view,r=document.getElementById('map').getBoundingClientRect();return{id:i.id,x:r.left+r.width/2+(b.x+b.w/2-v.x)*v.zoom,y:r.top+r.height/2+(b.y+b.h*.4-v.y)*v.zoom};};
            }''')
            def snap():
                return page.evaluate('__viewSnapshot()')
            def unchanged():
                current = snap()
                for field in ['record', 'revision', 'raw', 'town', 'cam']:
                    assert current[field] == initial[field], field
                return current
            def drag(start, dx, dy, button='left'):
                page.mouse.move(start['x'], start['y'])
                page.mouse.down(button=button)
                page.mouse.move(start['x'] + dx, start['y'] + dy, steps=5)
                page.mouse.up(button=button)

            initial = snap()
            assert page.locator('.room-editor-arrange').get_attribute('aria-pressed') == 'true'
            page.get_by_role('button', name='Zoom in', exact=True).click()
            zoomed = unchanged()
            assert abs(zoomed['view']['zoom'] - initial['view']['zoom'] * 1.25) < 1e-10
            assert zoomed['view']['x'] == initial['view']['x'] and zoomed['view']['y'] == initial['view']['y']
            assert page.locator('.room-editor-zoom-value').inner_text() == f"{int(zoomed['view']['zoom'] * 100 + .5)}%"
            page.get_by_role('button', name='Zoom out', exact=True).click()
            assert abs(unchanged()['view']['zoom'] - initial['view']['zoom']) < 1e-10
            steps.append('Visible zoom buttons and percent; room data unchanged')

            page.get_by_role('button', name='Pan view', exact=True).click()
            assert page.locator('.room-editor-pan').get_attribute('aria-pressed') == 'true'
            start = page.evaluate('__viewSofa()')
            before = snap()['view']
            drag(start, 100, 50)
            after = unchanged()
            assert not after['held']
            assert abs(after['view']['x'] - (before['x'] - 100 / before['zoom'])) < 1e-8
            assert abs(after['view']['y'] - (before['y'] - 50 / before['zoom'])) < 1e-8
            assert page.locator('#map').get_attribute('data-room-editor-tool') == 'pan'
            steps.append('Primary drag across furniture pans without picking it up')

            # Pointer capture must carry a drag outside the canvas, then release it.
            rect = page.locator('#map').bounding_box()
            page.mouse.move(rect['x'] + 25, rect['y'] + rect['height'] * .6)
            page.mouse.down()
            page.mouse.move(rect['x'] - 20, rect['y'] + rect['height'] * .6, steps=4)
            page.mouse.up()
            released = snap()['view']
            page.mouse.move(rect['x'] + 70, rect['y'] + rect['height'] * .6)
            assert snap()['view'] == released
            assert not unchanged()['held']
            steps.append('Capture keeps off-canvas drag reliable and stops on release')

            page.get_by_role('button', name='Fit room', exact=True).click()
            assert snap()['view'] == initial['view']
            touch_start = page.evaluate('__viewSofa()')
            before_touch = snap()['view']
            cdp = page.context.new_cdp_session(page)
            touch = {'x': round(touch_start['x']), 'y': round(touch_start['y'])}
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [touch]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': touch['x'] + 60, 'y': touch['y'] + 30}]})
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
            after_touch = unchanged()
            assert not after_touch['held']
            assert abs(after_touch['view']['x'] - (before_touch['x'] - 60 / before_touch['zoom'])) < 1e-7
            assert abs(after_touch['view']['y'] - (before_touch['y'] - 30 / before_touch['zoom'])) < 1e-7
            page.get_by_role('button', name='Fit room', exact=True).click()
            steps.append('Actual touch drag pans without picking furniture')
            page.get_by_role('button', name='Arrange', exact=True).click()
            start = page.evaluate('__viewSofa()')
            for shortcut in ['right', 'Space']:
                before = snap()['view']
                if shortcut == 'Space':
                    page.locator('#map').focus()
                    page.keyboard.down('Space')
                drag(start, 40, 20, button='right' if shortcut == 'right' else 'left')
                if shortcut == 'Space':
                    page.keyboard.up('Space')
                assert snap()['view'] != before and not unchanged()['held']
                page.get_by_role('button', name='Fit room', exact=True).click()
            steps.append('Right-drag and Space-drag remain available in Arrange')

            wheel_point = {'x': round(start['x']), 'y': round(start['y'])}
            page.mouse.move(wheel_point['x'], wheel_point['y'])
            anchor = page.evaluate('p=>townBuilder.roomEditor.screenToRoom({clientX:p.x,clientY:p.y})', wheel_point)
            before_wheel = snap()['view']['zoom']
            page.mouse.wheel(0, -120)
            page.wait_for_function('z=>townBuilder.roomEditor.view.zoom!==z', arg=before_wheel)
            after_anchor = page.evaluate('p=>townBuilder.roomEditor.screenToRoom({clientX:p.x,clientY:p.y})', wheel_point)
            assert all(abs(anchor[k] - after_anchor[k]) < 1e-8 for k in ['x', 'y'])
            unchanged()
            page.get_by_role('button', name='Fit room', exact=True).click()
            steps.append('Wheel zoom keeps its cursor anchor')

            start = page.evaluate('__viewSofa()')
            page.mouse.click(start['x'], start['y'])
            assert snap()['held']['originalId'] == start['id']
            page.keyboard.press('ArrowUp')
            assert unchanged()['held']['item']['rotation'] == 180
            held = snap()['held']['item']
            page.get_by_role('button', name='Pan view', exact=True).click()
            drag(start, 50, 20)
            assert unchanged()['held']['item'] == held
            page.keyboard.press('Escape')
            assert not unchanged()['held']
            page.get_by_role('button', name='Arrange', exact=True).click()
            page.get_by_role('button', name='Fit room', exact=True).click()
            steps.append('Arrange pickup/arrow facing still work; pan never moves a held piece')
            page.screenshot(path=str(args.screenshots / 'visible-zoom-pan.png'))
            page.locator('.room-editor-exit').click()
            assert not page.evaluate('townBuilder.roomEditor.active')
            unchanged()
            assert not errors, errors
            (args.screenshots / 'results.json').write_text(json.dumps({'passed': True, 'steps': steps, 'pageErrors': errors}, indent=2))
            print(json.dumps({'passed': True, 'checks': len(steps), 'proof': str(args.screenshots)}), flush=True)
        except Exception:
            page.screenshot(path=str(args.screenshots / 'failure.png'))
            raise
        finally:
            browser.close()
finally:
    server.shutdown()
