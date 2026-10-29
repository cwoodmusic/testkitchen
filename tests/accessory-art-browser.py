"""Audit actual accessory/shoe pixels and write labeled four-facing art sheets.

Run normally for regression checks and /tmp/music49-*-after.png sheets. To
inspect an earlier source snapshot without asserting unfinished artwork:
  python3 tests/accessory-art-browser.py --capture-only --phase before \
      --source /tmp/music49-accessories-before-renderer.js

This isolated renderer fixture uses one disposable Chromium browser, requires
no game saves or external services, and leaves production source untouched.
"""
import argparse
import base64
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OPTIONS = None

FIXTURE = r'''<!doctype html><meta charset="utf-8"><title>Accessory artwork audit</title>
<link rel="icon" href="data:,">
<script src="/fixture-renderer.js"></script><script>
window.renderer = createCodaCharacterRenderer();
window.runArtAudit = async () => {
  await renderer.ready;
  const directions = ['down', 'right', 'up', 'left'];
  const base = {form:'human',pet:'none',hairstyle:'bald',outfit:'pants',skin:'#e5ad75',
    hair:'#171424',shirt:'#999ca6',lowerColor:'#626875',headwear:'none',
    eyewear:'none',accessory:'none',shoes:'sneakers',emote:'wave'};
  const canvas = (w,h) => Object.assign(document.createElement('canvas'),{width:w,height:h});
  const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
    .map(n=>n.toString(16).padStart(2,'0')).join('');
  const pixels = c => c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  function eyePixels(c,facing) {
    // Small neighborhoods around the visible eyes, not the hairstyle/head
    // silhouette. These fixed avatar-space samples include adjacent skin so
    // a carried pole or star cannot replace an eye or its immediate outline.
    const boxes={down:[[33,43,5,6],[43,43,5,6]],right:[[44,43,5,6]],left:[[31,43,5,6]]};
    return (boxes[facing]||[]).flatMap(([x,y,w,h])=>Array.from(c.getContext('2d').getImageData(x,y,w,h).data));
  }
  function bounds(c) {
    const p = pixels(c); let left=c.width,top=c.height,right=-1,bottom=-1,count=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]) {
      left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;
    }
    return {left,top,right,bottom,count};
  }
  function largeFrame(profile,motion) {
    const c=canvas(256,256);
    renderer.drawPlayer(c.getContext('2d'),profile,{x:128,y:160,scale:1,...motion},.45);
    return c;
  }
  const assets={accessories:[],shoes:[]},overflow=[];
  for(const [group,key]of [['accessories','accessory'],['shoes','shoes']]) {
    for(const item of renderer.catalog[group]) {
      const profile={...base,[key]:item.id},entry={...item,frames:{}};
      for(const facing of directions) {
        const frame=renderer.renderPixelFrame('player',profile,{facing},.45,{base:true});
        const large=largeFrame(profile,{facing}),box=bounds(large);
        const shoe=canvas(48,24);
        shoe.getContext('2d').drawImage(frame,16,68,48,24,0,0,48,24);
        // The soft gameplay shadow has subpixel edge antialiasing; it is not
        // footwear artwork and must not satisfy or break a direction check.
        const shoeContext=shoe.getContext('2d'),shoePixels=shoeContext.getImageData(0,0,48,24);
        for(let i=0;i<shoePixels.data.length;i+=4)if(shoePixels.data[i+3]<250)shoePixels.data.fill(0,i,i+4);
        shoeContext.putImageData(shoePixels,0,0);
        const mirroredShoe=canvas(48,24),mirror=mirroredShoe.getContext('2d');
        mirror.translate(48,0);mirror.scale(-1,1);mirror.drawImage(shoe,0,0);
        entry.frames[facing]={signature:await digest(pixels(frame)),shoeSignature:await digest(pixels(shoe)),
          mirroredShoeSignature:await digest(pixels(mirroredShoe)),eyes:eyePixels(frame,facing),bounds:box};
        for(const [pose,motion]of [['idle',{facing}],['walk-left',{facing,walking:true,phase:Math.PI/2}],
            ['walk-right',{facing,walking:true,phase:Math.PI*1.5}]]) {
          const actual=pose==='idle'?box:bounds(largeFrame(profile,motion));
          // A renderer pixel frame has its foot origin at (40,80): in the
          // large fixture its authored rectangle is x=88..167, y=80..175.
          if(actual.left<88||actual.right>167||actual.top<80||actual.bottom>175)
            overflow.push({group,id:item.id,facing,pose,bounds:actual});
        }
      }
      assets[group].push(entry);
    }
  }
  function sheet(group,items,page,total) {
    const labelWidth=244,cellWidth=160,rowHeight=200,header=62;
    const c=canvas(labelWidth+cellWidth*4,header+items.length*rowHeight+18),g=c.getContext('2d');
    g.fillStyle='#e7edf2';g.fillRect(0,0,c.width,c.height);
    g.fillStyle='#172334';g.font='bold 19px sans-serif';
    g.fillText((group==='accessories'?'Accessories':'Shoes')+' · '+page+'/'+total+' · 2× pixels',16,24);
    g.font='bold 15px sans-serif';directions.forEach((direction,i)=>g.fillText(direction.toUpperCase(),labelWidth+i*cellWidth+45,49));
    for(let row=0;row<items.length;row++) {
      const item=items[row],top=header+row*rowHeight;
      g.fillStyle=row%2?'#dce5ec':'#edf2f6';g.fillRect(0,top,c.width,rowHeight);
      g.fillStyle='#18283d';g.font='bold 16px sans-serif';
      const words=item.label.split(' ');let line='',lineNo=0;
      for(const word of words) {
        if(g.measureText(line+word).width>labelWidth-30&&line) {g.fillText(line,16,top+75+lineNo++*21);line='';}
        line+=word+' ';
      }
      g.fillText(line,16,top+75+lineNo*21);g.font='13px monospace';g.fillStyle='#536277';
      g.fillText(item.id,16,top+112+lineNo*21);
      for(let col=0;col<directions.length;col++) {
        const profile={...base,[group==='accessories'?'accessory':'shoes']:item.id};
        const frame=renderer.renderPixelFrame('player',profile,{facing:directions[col]},.45,{base:true});
        g.imageSmoothingEnabled=false;g.drawImage(frame,labelWidth+col*cellWidth,top+4,160,192);
      }
    }
    return c.toDataURL('image/png');
  }
  const sheets=[];
  for(let i=0;i<assets.accessories.length;i+=18)sheets.push({name:'accessories',page:i/18+1,
    png:sheet('accessories',assets.accessories.slice(i,i+18),i/18+1,Math.ceil(assets.accessories.length/18))});
  sheets.push({name:'shoes',png:sheet('shoes',assets.shoes,1,1)});
  return {assets,overflow,sheets};
};
</script>'''


class FixtureHandler(SimpleHTTPRequestHandler):
    renderer_source = b''

    def log_message(self, *_args):
        pass

    def do_GET(self):
        path = self.path.split('?')[0]
        if path == '/accessory-art-fixture.html':
            content, kind = FIXTURE.encode(), 'text/html; charset=utf-8'
        elif path == '/fixture-renderer.js':
            content, kind = self.renderer_source, 'text/javascript; charset=utf-8'
        else:
            return super().do_GET()
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)


class AccessoryArtTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        FixtureHandler.renderer_source = OPTIONS.source.read_bytes()
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0),
            functools.partial(FixtureHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.addClassCleanup(cls.server.server_close)
        cls.addClassCleanup(cls.server.shutdown)
        cls.playwright = sync_playwright().start()
        cls.addClassCleanup(cls.playwright.stop)
        cls.browser = cls.playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        cls.addClassCleanup(cls.browser.close)
        cls.context = cls.browser.new_context()
        cls.addClassCleanup(cls.context.close)
        cls.page = cls.context.new_page()
        cls.errors, cls.failures = [], []
        cls.page.on('pageerror', lambda error: cls.errors.append(str(error)))
        cls.page.on('response', lambda response: cls.failures.append(response.url) if response.status >= 400 else None)
        cls.page.goto(f'http://127.0.0.1:{cls.server.server_port}/accessory-art-fixture.html', wait_until='load')
        cls.audit = cls.page.evaluate('runArtAudit()')
        OPTIONS.output.mkdir(parents=True, exist_ok=True)
        for sheet in cls.audit.pop('sheets'):
            suffix = '-'+str(sheet['page']) if 'page' in sheet else ''
            target = OPTIONS.output / f'{OPTIONS.tag}-{sheet["name"]}-{OPTIONS.phase}{suffix}.png'
            target.write_bytes(base64.b64decode(sheet['png'].split(',', 1)[1]))
        report = OPTIONS.output / f'{OPTIONS.tag}-art-{OPTIONS.phase}.json'
        report.write_text(json.dumps(cls.audit, indent=2)+'\n')
        baseline = cls.audit['assets']['accessories'][0]['frames']['down']['signature']
        missing = [item['id'] for item in cls.audit['assets']['accessories']
                   if item['id'] != 'none' and item['frames']['down']['signature'] == baseline]
        print(json.dumps({'report': str(report), 'front_missing': missing, 'frame_overflow': cls.audit['overflow']}, indent=2))

    def test_no_browser_or_local_asset_errors(self):
        self.assertEqual(self.errors, [])
        self.assertEqual(self.failures, [])

    def test_every_accessory_has_visible_distinct_front_art(self):
        if OPTIONS.capture_only:
            self.skipTest('Contact-sheet capture of unfinished source')
        signatures = {}
        for item in self.audit['assets']['accessories']:
            signature = item['frames']['down']['signature']
            self.assertNotIn(signature, signatures,
                f'{item["id"]} has the same front pixels as {signatures.get(signature)}')
            signatures[signature] = item['id']

    def test_every_shoe_has_distinct_front_art_and_directional_details(self):
        if OPTIONS.capture_only:
            self.skipTest('Contact-sheet capture of unfinished source')
        signatures = {}
        for item in self.audit['assets']['shoes']:
            with self.subTest(shoes=item['id']):
                frames = item['frames']
                signature = frames['down']['signature']
                self.assertNotIn(signature, signatures,
                    f'{item["id"]} has the same front pixels as {signatures.get(signature)}')
                signatures[signature] = item['id']
                self.assertNotEqual(frames['down']['shoeSignature'], frames['up']['shoeSignature'],
                    'Front/toe and back/heel artwork must differ below the knees')
                self.assertNotEqual(frames['down']['shoeSignature'], frames['right']['shoeSignature'],
                    'Side shoes must follow the sideways foot position')
                self.assertEqual(frames['right']['mirroredShoeSignature'], frames['left']['shoeSignature'],
                    'Left shoes must mirror the right-facing pose without changing their foot anchor')

    def test_authored_art_fits_pixel_editor_frame_in_all_facings_and_walk_extremes(self):
        if OPTIONS.capture_only:
            self.skipTest('Contact-sheet capture of unfinished source')
        self.assertEqual(self.audit['overflow'], [], 'Authored pixels extend outside the 80×96 editor frame')

    def test_tall_carried_props_leave_front_and_side_eyes_unobstructed(self):
        if OPTIONS.capture_only:
            self.skipTest('Contact-sheet capture of unfinished source')
        accessories = {item['id']: item for item in self.audit['assets']['accessories']}
        for prop in ('wand', 'balloon', 'umbrella', 'violin'):
            for facing in ('down', 'right', 'left'):
                with self.subTest(accessory=prop, facing=facing):
                    expected = accessories['none']['frames'][facing]['eyes']
                    actual = accessories[prop]['frames'][facing]['eyes']
                    self.assertTrue(expected)
                    self.assertTrue(all(alpha == 255 for alpha in expected[3::4]),
                        'The plain-avatar eye neighborhoods must sample opaque face pixels')
                    self.assertEqual(actual, expected,
                        'A carried shaft, star, or instrument covers an eye or its adjacent skin')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=ROOT/'character-renderer.js')
    parser.add_argument('--phase', default='after')
    parser.add_argument('--tag', default='music49')
    parser.add_argument('--output', type=Path, default=Path('/tmp'))
    parser.add_argument('--capture-only', action='store_true')
    OPTIONS, remaining = parser.parse_known_args()
    unittest.main(argv=[__file__, *remaining], verbosity=2)
