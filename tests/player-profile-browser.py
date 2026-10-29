"""The student profile reads real avatar/XP stores and stays useful on phones."""
import functools
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
import unittest
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Handler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
    def do_GET(self):
        if self.path!='/profile-fixture':return super().do_GET()
        html='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/player-profile.css">
<style>body{margin:0;background:#101526;color:#eee;font:15px system-ui}button{color:#fff;background:#413253;border:1px solid #aaa;padding:9px;border-radius:6px}#panel{width:min(540px,calc(100vw - 16px));box-sizing:border-box;margin:8px auto;padding:12px;border:1px solid #7d678e;background:#211c36;max-height:calc(100dvh - 16px);overflow:auto}#panel[hidden]{display:none}</style>
<button id="openProfile">Open profile</button><section id="panel" hidden role="dialog" aria-labelledby="panelTitle"><h1 id="panelTitle"></h1><button id="closeProfile">Close profile</button><div id="panelBody"></div></section>
<script src="/character-renderer.js"></script><script src="/player-progression.js"></script><script src="/notes-shop.js"></script><script src="/musician-missions.js"></script><script src="/player-profile.js"></script><script>
window.fixtureMissions=CodaMusicianMissions.DEFINITIONS.map(m=>({...m,status:m.id==='ellington-rhythm-streak'?'active':'available',progress:m.id==='ellington-rhythm-streak'?12:0}));
window.fixtureTutorials={version:1,lessons:[{id:'note-naming',title:'Note naming',step:4,total:4,completed:true},{id:'rhythm-tree',title:'The rhythm tree',step:1,total:5,completed:false}],completed:['note-naming']};
window.calls=[];window.progression=CodaPlayerProgression.create();window.wallet=CodaNotesShop.createWallet();
if(!localStorage.musicArcadeV1)localStorage.musicArcadeV1=JSON.stringify({name:'Melody',hairstyle:'bald',shirt:'#999ca6',lowerColor:'#626875',headwear:'none'});
window.profile=createCodaPlayerProfile({panelBody,renderer:createCodaCharacterRenderer(),openPanel:title=>{panel.hidden=false;panelTitle.textContent=title;panelBody.replaceChildren();},getAvatar:()=>JSON.parse(localStorage.musicArcadeV1),getClassroomAlias:()=>window.fixtureClassroomAlias||null,getProgression:()=>progression.refresh(),getNotes:()=>wallet.snapshot(),getMissions:()=>({missions:fixtureMissions}),getTutorials:()=>fixtureTutorials,openWardrobe:()=>calls.push('wardrobe'),openMission:id=>calls.push('mission:'+id),openGame:id=>calls.push('game:'+id),openLevels:()=>calls.push('levels'),openMusicians:()=>calls.push('musicians'),openClassroom:()=>calls.push('classroom'),openClassroomProfile:()=>calls.push('classroom-profile')});
openProfile.onclick=()=>profile.open();closeProfile.onclick=()=>panel.hidden=true;
</script>'''
        self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.end_headers();self.wfile.write(html.encode())

class PlayerProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.playwright=sync_playwright().start();cls.browser=cls.playwright.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    @classmethod
    def tearDownClass(cls):
        cls.browser.close();cls.playwright.stop();cls.server.shutdown();cls.server.server_close()
    def setUp(self):
        self.context=self.browser.new_context(viewport={'width':1100,'height':950});self.page=self.context.new_page();self.errors=[];self.page.on('pageerror',lambda error:self.errors.append(str(error)))
        self.url=f'http://127.0.0.1:{self.server.server_port}/profile-fixture';self.page.goto(self.url);self.page.locator('#openProfile').click()
    def tearDown(self):
        self.page.evaluate('profile.dispose()');self.context.close();self.assertEqual(self.errors,[])
    def test_saved_avatar_exact_xp_next_prizes_and_live_progress(self):
        self.assertEqual(self.page.locator('.profile-identity h2').inner_text(),'Melody')
        self.assertEqual(self.page.locator('.profile-xp-to-go').inner_text(),'80 XP to go!')
        self.assertEqual(self.page.locator('.profile-prize strong').all_inner_texts(),['Pocket watch chain','Crystal Harp'])
        pixels=self.page.locator('.profile-portrait-frame>canvas').evaluate('(canvas)=>Array.from(canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data).filter((value,index)=>index%4===3&&value>0).length')
        self.assertGreater(pixels,1500)
        self.page.evaluate("progression.awardXP('quest:profile-test',130,'A musical mission')")
        self.assertEqual(self.page.locator('.profile-level').inner_text(),'Level 2')
        self.assertEqual(self.page.locator('.profile-xp-to-go').inner_text(),'50 XP to go!')
        self.assertEqual(self.page.locator('.profile-prize strong').all_inner_texts(),['Artist beret','Neon Marimba','4 new quests at Level 3'])
        self.assertIn('Note naming · Finished',self.page.locator('.profile-lessons').inner_text())
        self.assertIn('1 / 5 steps',self.page.locator('.profile-lessons').inner_text())
        self.assertIn('XP means experience points',self.page.locator('.profile-experience .profile-help').inner_text())
        self.page.get_by_role('button',name='Practice in the classroom',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'classroom')
        self.page.locator('#closeProfile').click();self.page.reload();self.page.locator('#openProfile').click()
        self.assertEqual(self.page.locator('.profile-level').inner_text(),'Level 2')
    def test_classroom_entry_uses_the_generated_alias_without_changing_saved_progress(self):
        before=self.page.evaluate('({avatar:localStorage.musicArcadeV1,progress:localStorage.codaPlayerProgressV1})')
        self.page.evaluate('fixtureClassroomAlias="Amber Conductor 1234";profile.refresh()')
        self.assertEqual(self.page.locator('.profile-identity h2').inner_text(),'Amber Conductor 1234')
        self.assertEqual(self.page.evaluate('profile.getState().avatar.name'),'Amber Conductor 1234')
        self.assertNotIn('Melody',self.page.locator('.player-profile').inner_text())
        self.page.get_by_role('button',name='Classroom profile',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'classroom-profile')
        self.assertEqual(self.page.evaluate('({avatar:localStorage.musicArcadeV1,progress:localStorage.codaPlayerProgressV1})'),before)
        self.page.evaluate('fixtureClassroomAlias=null;profile.refresh()');self.assertEqual(self.page.locator('.profile-identity h2').inner_text(),'Melody')
    def test_real_mission_fields_actions_and_pending_reward_states(self):
        card=self.page.locator('[data-mission-id="ellington-rhythm-streak"]')
        self.assertIn('50 notes in a row',card.inner_text());self.assertIn('12 / 50',card.inner_text());self.assertIn('160 Notes',card.inner_text())
        card.get_by_role('button',name='Open In the Pocket mission',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'mission:ellington-rhythm-streak')
        card.get_by_role('button',name='Play Rhythm Room for In the Pocket',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'game:rhythm')
        self.page.evaluate("fixtureMissions.find(m=>m.person==='ellington').status='complete';profile.refresh()")
        self.assertIn('Return to Ellington to collect 160 Notes',card.inner_text())
        self.page.evaluate("fixtureMissions.find(m=>m.person==='ellington').status='rewarded';profile.refresh()")
        self.assertIn('No missions yet',self.page.locator('.profile-empty').inner_text());self.assertEqual(self.page.locator('.profile-completed summary').inner_text(),'1 finished mission')
        self.page.get_by_role('button',name='Meet the musicians',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'musicians')

    def test_later_levels_preview_real_notes_and_vibe_rewards(self):
        for next_level,vibe in [(20,'Glowstick Vibe'),(30,'Spooky Vibe')]:
            self.page.evaluate('''level=>{
              const target=CodaPlayerProgression.THRESHOLDS[level-2],current=progression.refresh().xp;
              for(let n=0,left=target-current;left>0;n++){
                const amount=Math.min(1000,left);progression.awardXP('quest:profile-tier-'+level+'-'+n,amount,'Music practice');left-=amount;
              }
              profile.refresh();
            }''',next_level)
            self.assertEqual(self.page.locator('.profile-level').inner_text(),'Level '+str(next_level-1))
            notes=self.page.locator('[data-prize-kind="notes"]');self.assertEqual(notes.count(),1)
            self.assertIn('Notes to spend in the shop',notes.inner_text())
            self.assertEqual(self.page.locator('[data-prize-kind="vibe"] strong').inner_text(),vibe)
            before=self.page.evaluate('localStorage.codaPlayerProgressV1');self.page.locator('[data-prize-kind="vibe"]').scroll_into_view_if_needed()
            self.assertEqual(self.page.evaluate('localStorage.codaPlayerProgressV1'),before,'Viewing a future prize must not grant it')

    def test_upcoming_quests_preview_only_next_tier_and_next_level_prize(self):
        self.page.evaluate('''()=>{
          fixtureMissions=[
           ...Array.from({length:6},(_,n)=>({id:'tier-three-'+n,person:'miles',title:'Lake quest '+n,game:n%2?'piano':'fishing',goal:'Practice a new music skill.',minLevel:3,status:'locked',unlocked:false,target:2,progress:0,reward:60+n})),
           {id:'tier-five',person:'miles',title:'Later five',game:'triad',goal:'Keep learning.',minLevel:5,status:'locked',unlocked:false,target:1,progress:0,reward:150}
          ];profile.refresh();
        }''')
        preview=self.page.locator('.profile-upcoming-preview')
        self.assertFalse(preview.evaluate('node=>node.open'))
        self.assertIn('6 new quests open at Level 3',self.page.locator('.profile-upcoming-missions').inner_text())
        self.assertEqual(preview.locator('.profile-mission').count(),4)
        self.assertEqual(preview.locator('button,progress').count(),0,'Locked quests do not offer game access or progress controls')
        self.assertEqual(preview.locator('[data-mission-id="tier-five"]').count(),0,'Only the nearest future tier is previewed')
        preview.locator('summary').click();self.assertIn('Unlocks at Level 3',preview.inner_text());self.assertIn('60 Notes',preview.inner_text());self.assertIn('Plus 2 more quests',preview.inner_text())
        self.page.evaluate("progression.awardXP('quest:tier-prize',80,'Practice');profile.refresh()")
        self.assertEqual(self.page.locator('[data-prize-kind="quest"] strong').inner_text(),'6 new quests at Level 3')
        self.assertIn('New challenges from the musicians',self.page.locator('[data-prize-kind="quest"]').inner_text())
        before=self.page.evaluate('localStorage.codaPlayerProgressV1');self.page.set_viewport_size({'width':390,'height':844})
        self.assertLessEqual(self.page.locator('.player-profile').evaluate('e=>e.scrollWidth'),390)
        self.page.locator('.profile-upcoming-preview summary').click();self.assertEqual(self.page.evaluate('localStorage.codaPlayerProgressV1'),before)

    def test_distinct_quests_from_one_musician_keep_their_ids_and_level_locks(self):
        self.page.evaluate('''()=>{
          fixtureMissions=[
           {id:'miles-easy',person:'miles',title:'Easy win',game:'triad',goal:'Win a round.',status:'active',unlocked:true,target:1,progress:0,reward:50},
           {id:'miles-fishing',person:'miles',title:'Rare fish',game:'fishing',goal:'Catch two fish.',minLevel:5,status:'active',unlocked:false,target:2,progress:1,reward:120},
           {id:'miles-piano',person:'miles',title:'Memory tune',game:'piano',goal:'Play from memory.',minLevel:3,status:'complete',unlocked:false,target:1,progress:1,reward:150},
           {id:'miles-collected',person:'miles',title:'Earlier win',game:'triad',goal:'Win a round.',status:'rewarded',target:1,progress:1,reward:75}
          ];profile.refresh();
        }''')
        easy=self.page.locator('[data-mission-id="miles-easy"]');easy.get_by_role('button',name='Open Easy win mission',exact=True).click()
        self.assertEqual(self.page.evaluate('calls.at(-1)'),'mission:miles-easy')
        easy.get_by_role('button',name='Play Music Triad for Easy win',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'game:triad')
        fishing=self.page.locator('[data-mission-id="miles-fishing"]');self.assertIn('Level 5',fishing.inner_text());self.assertEqual(fishing.get_by_role('button',name='Play Rhythm Fishing for Rare fish',exact=True).count(),0)
        fishing.get_by_role('button',name='Open Rare fish mission',exact=True).click();self.assertEqual(self.page.evaluate('calls.at(-1)'),'mission:miles-fishing')
        piano=self.page.locator('[data-mission-id="miles-piano"]');self.assertEqual(piano.get_by_role('button',name='Collect mission reward',exact=True).count(),0)
        self.assertIn('Level 3',piano.inner_text());self.assertEqual(piano.locator('progress').count(),0)
        self.assertEqual(self.page.locator('.profile-completed [data-mission-id="miles-collected"]').count(),1)

    def test_portrait_landscape_and_tall_equipment_fit_without_losing_mobile_targets(self):
        for size in [{'width':390,'height':844},{'width':844,'height':390}]:
            self.page.set_viewport_size(size)
            metric=self.page.locator('.player-profile').evaluate('(element)=>({width:element.scrollWidth,viewport:innerWidth,buttons:Array.from(element.querySelectorAll("button")).map(b=>({height:b.getBoundingClientRect().height,width:b.getBoundingClientRect().width}))})')
            self.assertLessEqual(metric['width'],metric['viewport']);self.assertTrue(all(button['height']>=44 and button['width']>=44 for button in metric['buttons']),metric)
        self.page.evaluate("localStorage.musicArcadeV1=JSON.stringify({...JSON.parse(localStorage.musicArcadeV1),headwear:'wizard',accessory:'balloon'});profile.refresh()")
        top=self.page.locator('.profile-portrait-frame>canvas').evaluate('(c)=>Array.from(c.getContext("2d").getImageData(0,0,c.width,1).data).some((value,index)=>index%4===3&&value>0)')
        self.assertFalse(top,'Tall equipment must fit in the character portrait')
    def test_max_level_does_not_promise_another_prize_or_change_saved_progress(self):
        self.page.evaluate("for(let n=0;n<Math.ceil(CodaPlayerProgression.THRESHOLDS.at(-1)/1000);n++)progression.awardXP('quest:max-'+n,1000,'Practice');profile.refresh()")
        self.assertEqual(self.page.locator('.profile-level').inner_text(),'Level '+str(self.page.evaluate('CodaPlayerProgression.THRESHOLDS.length')))
        self.assertIn('every current level prize',self.page.locator('.profile-xp-to-go').inner_text())
        self.assertEqual(self.page.locator('.profile-prize').count(),0)
        before=self.page.evaluate('localStorage.codaPlayerProgressV1');self.page.get_by_role('button',name='View character from right',exact=True).click();self.page.get_by_role('button',name='Change your look',exact=True).click()
        self.assertEqual(self.page.evaluate('localStorage.codaPlayerProgressV1'),before);self.assertEqual(self.page.evaluate('calls.at(-1)'),'wardrobe')

if __name__=='__main__':unittest.main(verbosity=2)
