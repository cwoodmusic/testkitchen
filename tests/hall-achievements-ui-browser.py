"""The Hall's achievement view displays progress without awarding or saving it."""
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
FIXTURE = '''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}body{margin:0;padding:10px;background:#10101e;color:#e9def9;font:16px system-ui}button,select{font:inherit}#panel{width:min(570px,100%);padding:18px;border:2px solid #c69be9;border-radius:12px;background:#231c3b;margin:auto}.muted{color:#c1b4d7}button,select{background:#392f58;color:white;border:1px solid #ba8fdf;border-radius:6px;padding:9px 12px}</style>
<link rel="stylesheet" href="/hall-of-fame.css"><main id="panel"><h1 id="panelTitle">Hall fixture</h1><div id="panelBody"></div></main>
<script src="/hall-of-fame.js"></script><script>
window.writes=0;window.fetches=0;window.achievementReads=0;
window.achievementState={categories:[{id:'pitch',label:'Pitch Race'},{id:'fishing',label:'Fishing'}],earned:1,total:4,items:[
 {id:'pitch-first',category:'pitch',title:'First Notes',description:'Finish a Pitch Race run.',earned:true,rewards:['50 XP']},
 {id:'pitch-ten',category:'pitch',title:'Read Ten',description:'Read 10 notes correctly.',earned:false,progress:3,target:10,progressLabel:'3 / 10 notes',rewards:['50 XP','A music pin']},
 {id:'fish-rare',category:'fishing',title:'Rare Catch',description:'Catch a rare fish.',earned:false,rewards:['50 XP']},
 {id:'fish-goal',category:'fishing',title:'Steady Angler',description:'Catch 10 fish.',earned:false,progress:10,target:10,progressLabel:'10 / 10 fish',pending:true,rewards:['50 XP']}
]};
window.hall=CodaHallOfFame.create({panelBody,openPanel:title=>{panelTitle.textContent=title;panelBody.replaceChildren();},
 storage:{getItem(){return null;},setItem(){writes++;}},
 config:new URL(location.href).searchParams.has('public')?{mode:'public'}:{mode:'classroom',classroom:{privacy:true}},
 getAvatar:()=>({name:'Guest'}),getNotes:()=>({rewards:[]}),
 getAchievements:()=>{achievementReads++;return JSON.parse(JSON.stringify(achievementState));},
 fetch:()=>{fetches++;return new Promise(resolve=>window.resolveFetch=()=>resolve({ok:true,text:async()=>JSON.stringify({one:{initials:'COD',score:123,streak:12,level:0}})}));}
});
window.ready=true;
</script>'''


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args): pass

    def do_GET(self):
        if urlsplit(self.path).path == '/hall-fixture':
            body = FIXTURE.encode()
            self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
        else:
            super().do_GET()


class HallAchievementUITests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start()
        cls.playwright=sync_playwright().start()
        cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()

    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1280,'height':1000})
        self.context.route('https://**/*',lambda route:route.abort())
        self.page=self.context.new_page();self.errors=[];self.failures=[]
        self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.page.on('response',lambda response:self.failures.append(response.url) if response.status>=400 and not response.url.endswith('favicon.ico') else None)
        self.base=f'http://127.0.0.1:{self.server.server_port}/hall-fixture'

    def tearDown(self):
        self.context.close();self.assertEqual(self.errors,[]);self.assertEqual(self.failures,[])

    def load(self,public=False,tab='achievements'):
        self.page.goto(self.base+('?public=1' if public else ''),wait_until='domcontentloaded')
        self.page.wait_for_function('window.ready')
        self.page.evaluate('tab=>hall.open(tab)',tab)

    def card(self,identifier):return self.page.locator(f'[data-achievement-id="{identifier}"]')

    def test_all_includes_locked_requirements_rewards_progress_and_filters_without_writes(self):
        self.load()
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),4)
        self.assertEqual(self.card('pitch-first').get_attribute('data-earned'),'true')
        locked=self.card('pitch-ten')
        self.assertEqual(locked.get_attribute('data-earned'),'false')
        self.assertIn('Read 10 notes correctly.',locked.inner_text())
        self.assertIn('3 / 10 notes',locked.inner_text())
        self.assertIn('A music pin',locked.inner_text())
        self.assertIn('Locked',locked.inner_text())
        self.page.locator('#fame-achievement-status').select_option('earned')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),1)
        self.assertTrue(self.card('pitch-first').is_visible())
        self.page.locator('#fame-achievement-category').select_option('fishing')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),0)
        self.assertRegex(self.page.locator('.hall-of-fame').inner_text(),r'(?i)no .*achievement')
        self.page.locator('#fame-achievement-status').select_option('locked')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),2)
        self.assertEqual(self.page.evaluate('writes'),0)
        self.assertEqual(self.page.evaluate('fetches'),0)
        self.page.evaluate("hall.open('achievements')")
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),4,'A fresh visit begins with every achievement, including locked ones')

    def test_async_record_refresh_preserves_achievement_filters_focus_and_current_player(self):
        self.load(public=True)
        self.assertEqual(self.page.evaluate('fetches'),0,'Achievements do not need a public leaderboard request')
        self.page.locator('#fame-tab-records').click()
        self.assertEqual(self.page.evaluate('fetches'),1)
        self.page.locator('#fame-tab-achievements').click()
        self.page.locator('#fame-achievement-status').select_option('locked')
        self.page.locator('#fame-achievement-category').select_option('pitch')
        self.page.locator('#fame-achievement-category').focus()
        self.page.evaluate('resolveFetch()')
        self.page.wait_for_function('hall.snapshot().publicState==="ready"')
        self.assertEqual(self.page.locator('#fame-tab-achievements').get_attribute('aria-selected'),'true')
        self.assertEqual(self.page.locator('#fame-achievement-status').input_value(),'locked')
        self.assertEqual(self.page.locator('#fame-achievement-category').input_value(),'pitch')
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'fame-achievement-category')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),1)
        self.page.evaluate('''()=>{
          achievementState.earned=0;achievementState.items.forEach(item=>item.earned=false);
          hall.refresh();
        }''')
        self.page.locator('#fame-achievement-status').select_option('earned')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),0,'Another player must not inherit a cached earned badge')
        self.assertEqual(self.page.evaluate('writes'),0)

    def test_keyboard_tabs_and_phone_landscape_controls_fit(self):
        self.load(tab='records')
        self.page.locator('#fame-tab-records').focus();self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.page.locator('#fame-tab-achievements').get_attribute('aria-selected'),'true')
        self.assertEqual(self.page.evaluate('document.activeElement.id'),'fame-tab-achievements')
        self.page.keyboard.press('Home')
        self.assertEqual(self.page.locator('#fame-tab-records').get_attribute('aria-selected'),'true')
        self.page.keyboard.press('End')
        self.assertEqual(self.page.locator('#fame-tab-achievements').get_attribute('aria-selected'),'true')
        for width,height in [(390,844),(844,390)]:
            self.page.set_viewport_size({'width':width,'height':height})
            self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),width)
            for selector in ['#fame-tab-records','#fame-tab-achievements','#fame-achievement-status','#fame-achievement-category']:
                bounds=self.page.locator(selector).bounding_box()
                self.assertGreaterEqual(bounds['width'],44,selector);self.assertGreaterEqual(bounds['height'],44,selector)
            for selector in ['#fame-achievement-status','#fame-achievement-category']:
                label=self.page.locator(selector).evaluate('''select=>{
                  const style=getComputedStyle(select),context=document.createElement('canvas').getContext('2d');
                  context.font=[style.fontStyle,style.fontWeight,style.fontSize,style.fontFamily].join(' ');
                  const text=select.selectedOptions[0].textContent;
                  return {text,available:select.clientWidth,
                    required:context.measureText(text).width+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+20};
                }''')
                self.assertLessEqual(label['required'],label['available'],
                    f'The selected label must fit beside its native arrow: {label}')
        self.assertEqual(self.page.evaluate('fetches'),0)
        self.assertEqual(self.page.evaluate('writes'),0)


if __name__=='__main__':unittest.main(verbosity=2)
