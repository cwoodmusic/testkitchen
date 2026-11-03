"""Visible celebrations in assembled games without interrupting their input.

Cabinet fixtures send authenticated results and expose the same ordered grading
hooks as the real games. Song Machine remains the production game. Browser
profiles are disposable and all requests outside this checkout are blocked.
"""
import importlib.util
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True
from world_navigation_helpers import open_cabinet, talk_to_musician

_spec = importlib.util.spec_from_file_location(
    'game_reward_world', Path(__file__).with_name('learning-world-browser.py'))
_world = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_world)

BRIDGE = '''let token='';
window.CodaBridge={report(id,result){parent.postMessage({coda:1,type:'result',game:document.documentElement.dataset.codaGame,token,runId:id,result},location.origin);}};
addEventListener('message',event=>{if(event.origin===location.origin&&event.source===parent&&event.data?.type==='init')token=event.data.token;});
parent.postMessage({coda:1,type:'ready',game:document.documentElement.dataset.codaGame},location.origin);'''

RHYTHM = '''<!doctype html><html data-coda-game="rhythm"><meta charset="utf-8">
<style>body{margin:0;padding:40px;background:#142331;color:#f0fff7;font:20px system-ui}button{margin:12px 12px 12px 0;padding:15px;font:inherit}#count{font-size:36px}</style>
<h1>Rhythm Room · ordered grading fixture</h1><p>The world receives each verified hit while this round stays open.</p>
<button id="startRound">Start a 100-note round</button><button id="matchTwenty">Match the next 20 notes</button><p id="count">0 matched</p>
<script>''' + BRIDGE + '''
let current=null;
function createTapRound(){return {targets:Array.from({length:100},(_,i)=>i),taps:[],matched:new Set(),extras:0};}
function gradeTap(round){const target=round.matched.size;if(target>=round.targets.length)return {warmup:true};const result={hit:true,error:0};round.taps.push({target,hit:true,error:0});round.matched.add(target);return result;}
function finishTapRound(){}
startRound.onclick=()=>{current=createTapRound();count.textContent='0 matched';};
matchTwenty.onclick=()=>{if(!current)return;for(let i=0;i<20;i++)gradeTap(current);count.textContent=current.matched.size+' matched';};
</script></html>'''

PITCH = '''<!doctype html><html data-coda-game="pitch"><meta charset="utf-8">
<h1>Pitch Race · completed-run bridge fixture</h1>
<button id="reachCriteria">Read 12 notes while the run continues</button>
<button id="finishHistoryRun">Finish the run</button><p id="runState">Run in progress</p>
<script>''' + BRIDGE + '''
reachCriteria.onclick=()=>{runState.textContent='12 correct; run still in progress';};
finishHistoryRun.onclick=()=>CodaBridge.report('reward-history-run',{mode:'classic',score:120,correct:12,misses:0,streak:12,won:true,perfect:true});
</script></html>'''

TRIAD = '''<!doctype html><html data-coda-game="triad"><meta charset="utf-8">
<h1>Music Triad · completed-match bridge fixture</h1><button id="finishMatch">Finish a winning match</button>
<script>''' + BRIDGE + '''
finishMatch.onclick=()=>CodaBridge.report('reward-triad-run',{mode:'computer',score:9,captures:4,won:true,comeback:false});
</script></html>'''


class GameRewardNotificationTests(_world.WorldBrowserCase):
    def route_checkout(self, route):
        fixture = {'/rhythmroom/': RHYTHM, '/Pitch-Race/': PITCH,
                   '/musictriad/': TRIAD, '/coda-arcade/games/rhythm-room/': RHYTHM,
                   '/coda-arcade/games/pitch-race/': PITCH,
                   '/coda-arcade/games/music-triad/': TRIAD}.get(urlparse(route.request.url).path)
        if fixture:
            return route.fulfill(status=200, content_type='text/html', body=fixture)
        return super().route_checkout(route)

    def setUp(self):
        super().setUp()
        self.page.emulate_media(reduced_motion='reduce')

    def notices(self):
        return self.page.evaluate('CodaArcadeQA.rewardNotifications()')

    def seed_missions(self, ids):
        self.page.evaluate('''ids=>{
          const manager=CodaMusicianMissions.create({storage:localStorage});
          for(const id of ids){const result=manager.accept(id);if(!result.ok)throw Error(result.error);}
          manager.dispose();
        }''', ids)
        self.load()

    def show_notice(self, *, kind=None, item_id=None):
        for _ in range(20):
            item = self.notices()['current']
            if item and (kind is None or item['kind'] == kind) and (
                    item_id is None or item['id'] == item_id):
                return item
            self.assertIsNotNone(item, 'Expected notification was not queued')
            # Programmatic dismissal retains the keyboard focus in the game.
            self.page.get_by_role('button', name='Dismiss notification', exact=True).evaluate('button=>button.click()')
        self.fail('Notification queue did not contain the expected item')

    def dismiss_all(self):
        for _ in range(25):
            if self.notices()['current'] is None:
                return
            self.page.get_by_role('button', name='Dismiss notification', exact=True).evaluate('button=>button.click()')
        self.fail('Notification queue did not empty')

    def assert_notice_over_game(self):
        self.assertTrue(self.page.evaluate('CodaArcadeQA.menu().gameOpen'))
        self.assertEqual(self.page.evaluate('document.activeElement.id'), 'gameiframe',
                         'Showing a notification must not take keyboard focus out of the game')
        host = self.page.locator('.reward-notifications')
        self.assertTrue(host.is_visible())
        self.assertTrue(host.evaluate('element=>element.matches(":popover-open")'),
                        'Supported browsers should display notifications in the top layer')
        self.page.wait_for_function('''()=>{
          const card=document.querySelector('.reward-toast');
          return card&&Number(getComputedStyle(card).opacity)===1;
        }''')
        metrics = host.evaluate('''element=>{
          const card=element.querySelector('.reward-toast'),r=card.getBoundingClientRect();
          // Temporarily include the click-through surface in hit testing to
          // verify it paints above the full-size iframe, then restore it.
          const pointer=element.style.pointerEvents;element.style.pointerEvents='auto';
          const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
          const above=!!top&&element.contains(top);element.style.pointerEvents=pointer;
          return {above,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};
        }''')
        self.assertTrue(metrics['above'], metrics)
        self.assertGreaterEqual(metrics['left'], 0, metrics)
        self.assertGreaterEqual(metrics['top'], 0, metrics)
        self.assertLessEqual(metrics['right'], metrics['width'] + 1, metrics)
        self.assertLessEqual(metrics['bottom'], metrics['height'] + 1, metrics)

    def capture(self, name):
        out = Path('/workspace/.onboarding/game-notifications')
        out.mkdir(parents=True, exist_ok=True)
        self.page.screenshot(path=str(out / name))

    def test_live_rhythm_hits_show_quest_achievement_and_level_without_leaving_game(self):
        self.seed_missions(['joplin-rhythm-streak'])
        open_cabinet(self.page, 2)
        self.page.wait_for_function('CodaArcadeQA.missions().connection?.connected')
        game = self.page.frame_locator('#gameiframe')
        game.locator('#startRound').click()
        game.locator('#matchTwenty').click()
        self.page.wait_for_function('CodaArcadeQA.missions().missions.find(m=>m.id==="joplin-rhythm-streak").status==="complete"')
        notice = self.show_notice(item_id='mission-complete:joplin-rhythm-streak')
        self.assertIn('Scott Joplin', notice['message'])
        self.assertIn('90 Notes', notice['message'])
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'), 150,
                         'Meeting a mission goal does not collect its reward remotely')
        self.assert_notice_over_game()
        self.capture('quest-during-game.png')
        for _ in range(4):
            game.locator('#matchTwenty').click()
        self.page.wait_for_function('CodaArcadeQA.progression().xp===250')
        self.show_notice(kind='level')
        self.assert_notice_over_game()
        self.show_notice(item_id='achievement:rhythm-hundred-streak')
        self.assert_notice_over_game()
        self.capture('achievement-during-game.png')
        self.dismiss_all()
        before = self.page.evaluate('localStorage.getItem(CodaPlayerProgression.KEY)')
        game.locator('#startRound').click()
        game.locator('#matchTwenty').click()
        self.assertEqual(self.page.evaluate('localStorage.getItem(CodaPlayerProgression.KEY)'), before)
        self.assertIsNone(self.notices()['current'], 'An already earned achievement must not replay')
        self.assertEqual(self.notices()['seen'].count('mission-complete:joplin-rhythm-streak'), 1)

    def test_real_song_machine_level_up_is_visible_while_the_composer_keeps_playing(self):
        self.page.evaluate("CodaPlayerProgression.create().awardXP('integration:reward-start',50,'Earlier practice')")
        self.load()
        self.assertIsNone(self.notices()['current'])
        open_cabinet(self.page, 3)
        composer = self.page.frame_locator('#gameiframe')
        composer.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="72"][data-step="16"]').click()
        composer.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="74"][data-step="20"]').click()
        composer.locator('#simplePlay').click()
        self.page.wait_for_function('CodaArcadeQA.progression().xp===85')
        notice = self.show_notice(kind='level')
        self.assertIn('Crystal Harp', notice['message'])
        self.assert_notice_over_game()
        self.capture('level-during-game.png')
        self.dismiss_all()
        composer.locator('#simpleStop').click()
        composer.locator('#simplePlay').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().xp'), 85)
        self.assertIsNone(self.notices()['current'])
        composer.locator('#simpleStop').click()

    def test_saved_friendship_goal_notifies_to_learn_a_fact_and_replayed_result_is_silent(self):
        # This case checks the saved quest/notification pipeline, independently
        # of the timed six-visitor rotation exercised by the visitor suites.
        self.context.add_init_script('''(()=>{
          let create;
          Object.defineProperty(window,'createCodaNPCBehavior',{configurable:true,
            get:()=>create,set:factory=>{create=options=>factory({...options,rotation:false});}});
        })()''')
        self.load()
        visitor = self.page.evaluate('CodaArcadeQA.characters().npcs.find(p=>p.id==="bach")')
        if visitor['hidden']:
            self.assertTrue(self.page.evaluate('CodaArcadeQA.findMusician("bach")'))
        self.place(1180, 620)
        self.page.wait_for_function('''()=>{
          const person=CodaArcadeQA.characters().npcs.find(p=>p.id==='bach'),exit=CodaArcadeQA.arcadeExit();
          return person&&!person.hidden&&Math.hypot(person.x-exit.x,person.y-exit.y)>exit.radius+35;
        }''', timeout=30000)
        talk_to_musician(self.page, 'bach')
        self.page.locator('[data-history-owner-prompt="bach"]').click()
        journal = self.page.locator('.music-history')
        journal.get_by_role('button', name='Accept friendship quest', exact=True).click()
        journal.get_by_role('button', name='Close', exact=True).click()
        self.dismiss_all()
        open_cabinet(self.page, 0)
        game = self.page.frame_locator('#gameiframe')
        game.locator('#reachCriteria').click()
        self.assertFalse(self.page.evaluate('CodaArcadeQA.history().people.find(p=>p.id==="bach").hasNewFact'),
                         'This quest requires a completed run, not partial live statistics')
        game.locator('#finishHistoryRun').click()
        self.page.wait_for_function('CodaArcadeQA.history().people.find(p=>p.id==="bach").hasNewFact')
        notice = self.show_notice(item_id='friendship-quest:bach-01')
        self.assertIn('Bach', notice['message'])
        self.assertIn('history fact', notice['message'])
        self.assertNotIn('collect 0 Notes', notice['message'])
        self.assert_notice_over_game()
        before = self.page.evaluate('''()=>({history:localStorage.getItem(CodaMusicHistory.KEY),xp:CodaArcadeQA.progression().xp,notes:CodaArcadeQA.notes().balance})''')
        game.locator('#finishHistoryRun').click()
        self.assertEqual(self.page.evaluate('''()=>({history:localStorage.getItem(CodaMusicHistory.KEY),xp:CodaArcadeQA.progression().xp,notes:CodaArcadeQA.notes().balance})'''), before)
        self.assertEqual(self.notices()['seen'].count('friendship-quest:bach-01'), 1)

    def test_a_match_queues_both_completed_missions_without_auto_collecting_or_exiting(self):
        self.seed_missions(['bach-triad-win', 'mozart-triad-capture'])
        open_cabinet(self.page, 1)
        self.page.frame_locator('#gameiframe').locator('#finishMatch').click()
        self.page.wait_for_function('CodaArcadeQA.missions().missions.filter(m=>["bach-triad-win","mozart-triad-capture"].includes(m.id)).every(m=>m.status==="complete")')
        for item_id in ['mission-complete:bach-triad-win', 'mission-complete:mozart-triad-capture']:
            self.show_notice(item_id=item_id)
            self.assert_notice_over_game()
        self.assertFalse(any(value.startswith('npc-mission:') for value in self.page.evaluate('CodaArcadeQA.notes().rewards')))
        self.assertTrue(self.page.evaluate('CodaArcadeQA.menu().gameOpen'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
