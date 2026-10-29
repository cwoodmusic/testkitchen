"""Level rewards, musician quests and atmosphere in the assembled arcade.

Use disposable profiles and route public static requests to this checkout.
Piano quest completion comes from playing the real room's keyboard.
"""
import importlib.util
from pathlib import Path
import sys
import unittest
from world_navigation_helpers import enter_room, open_settings, close_settings, talk_to_musician

sys.dont_write_bytecode=True
_spec=importlib.util.spec_from_file_location('levels_world_browser',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)
MARY=[4,2,0,2,4,4,4,2,2,2,4,7,7,4,2,0,2,4,4,4,4,2,2,4,2,0]


class LevelsQuestsVibesTests(_world.WorldBrowserCase):
    def reach_level(self,level):
        self.page.evaluate('''level=>{
          const progress=CodaPlayerProgression.create(),target=CodaPlayerProgression.THRESHOLDS[level-1];
          let remaining=target-progress.getState().xp,n=0;
          while(remaining>0){const amount=Math.min(1000,remaining);
            if(!progress.awardXP('quest:browser-level-'+level+'-'+n++,amount,'Music practice').ok)throw Error('XP fixture failed');
            remaining-=amount;
          }
        }''',level)
        self.load()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),level)

    def open_missions(self,person):
        talk_to_musician(self.page,person)
        self.page.locator('.musician-choices').get_by_role('button',name='mission',exact=False).click()

    def test_starter_and_harder_quests_unlock_at_their_real_levels(self):
        missions=self.page.evaluate('CodaArcadeQA.missions().missions')
        self.assertEqual(len(missions),29)
        self.assertEqual(sum(m['status']=='available' for m in missions),9)
        legendary=next(m for m in missions if m['id']=='miles-fish-legendary')
        self.assertEqual((legendary['minLevel'],legendary['status'],legendary['unlocked']),(20,'locked',False))
        self.open_missions('bach')
        major=self.page.locator('[data-mission-id="bach-piano-major"]')
        self.assertTrue(major.get_by_role('button',name='Unlocks at Level 5',exact=True).is_disabled())
        self.reach_level(3)
        missions=self.page.evaluate('CodaArcadeQA.missions().missions')
        self.assertEqual(sum(m['status']=='available' for m in missions),13)
        self.assertEqual(next(m for m in missions if m['id']=='nina-piano-melody')['status'],'available')
        self.reach_level(20)
        missions=self.page.evaluate('CodaArcadeQA.missions().missions')
        self.assertTrue(all(m['status']=='available' for m in missions))
        self.assertEqual(next(m for m in missions if m['id']=='miles-fish-legendary')['reward'],850)

    def test_milestone_notes_are_granted_once_and_progress_continues_to_fifty(self):
        for level in [10,20,30,40,50]:
            self.reach_level(level)
            expected=self.page.evaluate('level=>150+CodaPlayerProgression.LEVEL_NOTES.filter(item=>item.level<=level).reduce((sum,item)=>sum+item.amount,0)',level)
            wallet=self.page.evaluate('CodaArcadeQA.notes()')
            self.assertEqual(wallet['balance'],expected)
            ids=[identifier for identifier in wallet['rewards'] if identifier.startswith('level-prize:')]
            self.assertEqual(len(ids),len(set(ids)))
            self.assertIn('level-prize:'+str(level),ids)
            exported=self.page.evaluate('CodaClassroomProfileData.capture(localStorage)')
            self.assertTrue(exported['ok'],exported)
            before=self.page.evaluate('({wallet:localStorage.getItem(CodaNotesShop.KEY),progress:localStorage.codaPlayerProgressV1})')
            self.load()
            self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),expected)
            self.assertEqual(self.page.evaluate('({wallet:localStorage.getItem(CodaNotesShop.KEY),progress:localStorage.codaPlayerProgressV1})'),before)
        self.assertIsNone(self.page.evaluate('CodaArcadeQA.progression().nextLevelXP'))
        self.assertEqual(self.page.evaluate('CodaPlayerProgression.prizesForLevel(50).find(prize=>prize.kind==="notes").amount'),6000)

    def test_vibe_settings_show_locks_stay_open_and_follow_the_current_players_level(self):
        open_settings(self.page)
        glow=self.page.locator('button[data-arcade-vibe="glowstick"]')
        self.assertEqual(glow.get_attribute('aria-disabled'),'true')
        glow.dispatch_event('click')
        self.assertTrue(self.page.locator('.arcade-vibe-controls').is_visible())
        self.assertIn('Level 20',self.page.locator('.arcade-vibe-status').inner_text())
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'classic')
        self.reach_level(20);open_settings(self.page)
        glow.click()
        self.assertTrue(self.page.locator('.arcade-vibe-controls').is_visible(),'Choosing a vibe must leave Settings open')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'glowstick')
        self.assertEqual(self.page.locator('body').get_attribute('data-arcade-vibe'),'glowstick')
        self.page.locator('button[data-arcade-vibe="spooky"]').dispatch_event('click')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'glowstick')
        self.load();self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'glowstick')
        self.page.evaluate('localStorage.removeItem(CodaPlayerProgression.KEY)')
        self.load();self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'classic','A browser preference cannot unlock a vibe for a lower-level player')

    def test_real_piano_completion_advances_the_exact_quest_and_requires_returning_to_nina(self):
        self.reach_level(3);self.open_missions('nina')
        quest=self.page.locator('[data-mission-id="nina-piano-melody"]')
        quest.get_by_role('button',name='Accept mission',exact=True).click()
        self.page.locator('#panelClose').click();self.page.locator('#levelBtn').click()
        profile_quest=self.page.locator('.profile-missions [data-mission-id="nina-piano-melody"]')
        profile_quest.get_by_role('button',name='Open Your First Encore mission',exact=True).click()
        self.assertEqual(self.page.locator('.musician-mission-card[data-selected="true"]').get_attribute('data-mission-id'),'nina-piano-melody')
        enter_room(self.page,'piano')
        self.page.locator('#pianoMenuButton').click();self.page.locator('[data-piano-view="games"]').click()
        self.page.locator('#pianoLesson').select_option('mary');self.page.locator('[data-piano-dialogue-action="play"]').click()
        if not self.page.evaluate('CodaArcadeQA.piano().menuOpen'):self.page.locator('#pianoMenuButton').click()
        self.page.locator('[data-piano-view="keyboard"]').click()
        self.page.evaluate('''offsets=>{for(const offset of offsets){
          const key=document.querySelector('.piano-key[data-midi="'+(60+offset)+'"]');
          key.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
          key.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));
        }}''',MARY)
        self.page.wait_for_function('CodaArcadeQA.missions().missions.find(m=>m.id==="nina-piano-melody").status==="complete"')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.missions().missions.find(m=>m.id==="nina-piano-minor").status'),'locked')
        self.assertNotIn('npc-mission:nina-piano-melody',self.page.evaluate('CodaArcadeQA.notes().rewards'))
        # Close keyboard drawer, then leave the room with the ordinary exit.
        for _ in range(3):
            if not self.page.evaluate('CodaArcadeQA.piano().open'):break
            self.page.keyboard.press('Escape')
        self.page.wait_for_function('!CodaArcadeQA.piano().open')
        self.open_missions('nina')
        self.page.locator('[data-mission-id="nina-piano-melody"]').get_by_role('button',name='Collect reward',exact=True).click()
        self.assertIn('npc-mission:nina-piano-melody',self.page.evaluate('CodaArcadeQA.notes().rewards'))
        self.assertEqual(self.page.evaluate('CodaArcadeQA.missions().missions.find(m=>m.id==="nina-piano-melody").status'),'rewarded')
        exported=self.page.evaluate('CodaClassroomProfileData.capture(localStorage)')
        self.assertTrue(exported['ok'],exported)

    def test_song_machine_level_twenty_pays_notes_and_unlocks_the_live_world_vibe_once(self):
        from world_navigation_helpers import open_cabinet
        self.reach_level(19)
        self.page.evaluate('''()=>{
          const progress=CodaPlayerProgression.create(),amount=CodaPlayerProgression.THRESHOLDS[19]-20-progress.getState().xp;
          if(amount<=0||amount>1000||!progress.awardXP('quest:before-song-milestone',amount,'Earlier practice').ok)throw Error('Invalid milestone fixture');
        }''')
        self.load();before=self.page.evaluate('CodaArcadeQA.notes().balance')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),19)
        open_cabinet(self.page,3)
        song=self.page.frame_locator('#gameiframe')
        song.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="72"][data-step="16"]').click()
        song.locator('#simpleSongGrid .cell[data-track="1"][data-pitch="74"][data-step="20"]').click()
        song.locator('#simplePlay').click()
        self.page.wait_for_function('CodaArcadeQA.progression().level===20')
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),before+1500)
        self.assertFalse(self.page.evaluate('CodaArcadeQA.vibes().options.find(vibe=>vibe.id==="glowstick").locked'))
        song.locator('#simpleStop').click();song.locator('#simplePlay').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),before+1500)
        song.locator('#simpleStop').click();self.page.locator('#returnworld').click()
        open_settings(self.page);self.page.locator('button[data-arcade-vibe="glowstick"]').click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'glowstick')
        self.load();self.assertEqual(self.page.evaluate('CodaArcadeQA.notes().balance'),before+1500)
        self.assertEqual(self.page.evaluate('CodaArcadeQA.progression().level'),20)

    def test_all_unlocked_vibes_render_in_world_and_rooms_without_losing_scene_pixels(self):
        self.reach_level(50)
        self.page.evaluate('CodaArcadeQA.setZoom(.8)');self.page.wait_for_timeout(180)
        for vibe in ['glowstick','spooky','aurora','festival']:
            self.assertTrue(self.page.evaluate('id=>CodaArcadeQA.setVibe(id)',vibe))
            self.page.wait_for_timeout(70)
            metrics=self.page.locator('#view').evaluate('''canvas=>{
              const p=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
              let visible=0,bright=0;for(let i=0;i<p.length;i+=16){if(p[i+3])visible++;if(Math.max(p[i],p[i+1],p[i+2])>90)bright++;}
              return {visible,bright};}''')
            self.assertGreater(metrics['visible'],10000);self.assertGreater(metrics['bright'],300)
            self.page.screenshot(path='/tmp/coda-vibe-'+vibe+'.png')
        for room in ['piano','classroom','fishing']:
            enter_room(self.page,room)
            self.page.wait_for_timeout(80)
            self.assertEqual(self.page.evaluate('CodaArcadeQA.vibes().active'),'festival')
            self.page.screenshot(path='/tmp/coda-vibe-room-'+room+'.png')
            self.page.keyboard.press('Escape')


if __name__=='__main__':unittest.main(verbosity=2)
