"""Progress-gated house tracks through the real DJ NPC and local saved journals."""
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode=True
from world_navigation_helpers import open_destination
_spec=importlib.util.spec_from_file_location('dj_unlock_world',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)

class DJUnlockTests(_world.WorldBrowserCase):
 def dj(self):
  open_destination(self.page,'dj');self.page.wait_for_selector('[data-house-track="lanternwake-shanty"]')
 def state(self):return self.page.evaluate('CodaArcadeQA.jukebox()')
 def button(self,id):return self.page.locator('[data-jukebox-track="'+id+'"]')
 def row(self,id):return self.page.locator('[data-house-track="'+id+'"]')
 def totals(self):return self.page.evaluate('({notes:CodaArcadeQA.notes().balance,xp:CodaArcadeQA.progression().xp,level:CodaArcadeQA.progression().level,avatar:localStorage.getItem("musicArcadeV1")})')
 def save_catches(self,count,valid=True):
  self.page.evaluate('''({count,valid})=>{
   const fish=CodaRhythmFishing.fishFor('silver-minnow');
   const catches=Array.from({length:count},(_,index)=>{
    const id='fixture-dj-catch-'+index,result={id,fishId:fish.id,rarity:fish.rarity,outcome:valid?'caught':'escaped',caught:valid,reason:null,hits:16,misses:0,extras:0,perfect:true,notes:fish.notes,xp:fish.xp,meter:'4/4',timeSignature:'4/4'};
    return {id,fishId:fish.id,size:8,at:Date.now()+index,meter:'4/4',perfect:true,caught:valid,rewarded:true,result};
   });localStorage.setItem('codaRhythmFishingV1',JSON.stringify({version:1,catches}));
  }''',{'count':count,'valid':valid})
  self.load()
 def test_new_player_sees_three_free_tracks_and_four_clear_locked_requirements(self):
  before=self.totals();self.dj()
  self.assertEqual(self.page.locator('[data-house-track]').count(),7)
  for id in ['neon-afterhours','velvet-lounge','mirrorball-bounce']:
   self.assertFalse(self.button(id).is_disabled());self.assertNotIn('jukebox-track-locked',self.row(id).get_attribute('class'))
  for id,requirement in [('lanternwake-shanty','Catch 5 fish'),('starlight-waltz','level 4'),('first-steps','Earn First Steps'),('midnight-headliner','Earn DJ Coda’s Headliner')]:
   self.assertTrue(self.button(id).is_disabled());self.assertIn('🔒',self.row(id).inner_text());self.assertIn(requirement,self.row(id).locator('[data-dj-requirement]').inner_text())
   self.assertIn('jukebox-track-locked',self.row(id).get_attribute('class'))
   muted=self.row(id).locator('strong').evaluate("node=>getComputedStyle(node).color.match(/[0-9]+/g).slice(0,3).map(Number)");free=self.row('neon-afterhours').locator('strong').evaluate("node=>getComputedStyle(node).color.match(/[0-9]+/g).slice(0,3).map(Number)")
   self.assertLessEqual(max(muted)-min(muted),30,'Locked song titles are visibly greyed');self.assertLess(sum(muted),sum(free),'Locked information is visually muted below the playable collection')
  self.button('neon-afterhours').click();self.page.wait_for_function('CodaArcadeQA.jukebox().playing')
  current=self.state()['title']
  self.button('lanternwake-shanty').evaluate('button=>button.disabled=false');self.button('lanternwake-shanty').click()
  self.assertEqual(self.state()['title'],current,'The playback guard must preserve the current song when a locked click is attempted')
  self.assertIn('Catch 5 fish',self.page.locator('.panelMsg').inner_text())
  self.assertEqual(self.totals(),before,'Browsing and trying a locked track grants and spends nothing')
  self.page.screenshot(path='/tmp/dj49-locked-collection.png');self.page.locator('#jukeboxStop').click()

 def test_five_verified_fish_unlock_the_shanty_and_persist_without_payment_or_extra_rewards(self):
  self.save_catches(4);self.dj();self.assertTrue(self.button('lanternwake-shanty').is_disabled())
  self.save_catches(5);before=self.totals();self.dj()
  self.assertFalse(self.button('lanternwake-shanty').is_disabled());self.assertTrue(self.button('starlight-waltz').is_disabled())
  self.assertEqual(self.row('lanternwake-shanty').locator('[data-dj-requirement]').inner_text(),'')
  self.button('lanternwake-shanty').click();self.page.wait_for_function('CodaArcadeQA.jukebox().title==="Lanternwake Shanty"&&CodaArcadeQA.jukebox().playing')
  self.assertEqual(self.state()['source'],'house');self.assertEqual(self.state()['bpm'],96)
  self.assertEqual(self.totals(),before,'Unlocking or playing the song must not award XP, spend Notes, or change the avatar')
  self.page.screenshot(path='/tmp/dj49-unlocked-shanty.png');self.page.locator('#jukeboxStop').click()
  self.load();self.dj();self.assertFalse(self.button('lanternwake-shanty').is_disabled());self.assertEqual(self.totals(),before)

 def test_unverified_journal_rows_do_not_unlock_but_saved_musician_level_four_unlocks_the_waltz(self):
  self.save_catches(5,valid=False);self.dj();self.assertTrue(self.button('lanternwake-shanty').is_disabled(),'A journal-shaped list of escaped fish is not five verified catches')
  self.page.evaluate('''()=>localStorage.setItem('codaPlayerProgressV1',JSON.stringify({version:1,xp:320,events:[{id:'quest:dj-level-fixture',xp:320,reason:'Saved musician progress'}]}))''')
  self.load();before=self.totals();self.assertEqual(before['level'],4);self.dj()
  self.assertTrue(self.button('lanternwake-shanty').is_disabled());self.assertFalse(self.button('starlight-waltz').is_disabled())
  self.button('starlight-waltz').click();self.page.wait_for_function('CodaArcadeQA.jukebox().title==="Starlight Waltz"&&CodaArcadeQA.jukebox().playing')
  self.assertEqual(self.state()['bpm'],78);self.assertEqual(self.totals(),before)
  self.page.screenshot(path='/tmp/dj49-unlocked-waltz.png');self.page.locator('#jukeboxStop').click()
  self.load();self.dj();self.assertFalse(self.button('starlight-waltz').is_disabled());self.assertEqual(self.totals(),before)

 def test_saved_dance_achievements_unlock_their_tracks_and_persist_without_spending_or_reawarding(self):
  def save(achievements):
   self.page.evaluate('''achievements=>{
    const events=achievements.map(([id,xp])=>({id:'achievement:'+id,xp,reason:'Saved dance achievement'}));
    localStorage.setItem('codaPlayerProgressV1',JSON.stringify({version:1,xp:events.reduce((sum,event)=>sum+event.xp,0),events}));
   }''',achievements)
   self.load()
  save([['dance-perfect-set',150]])
  self.dj()
  for id in ['first-steps','midnight-headliner']:self.assertTrue(self.button(id).is_disabled(),'An unrelated dance achievement cannot unlock this track')
  save([['dance-first-finish',50]])
  before=self.totals();self.dj()
  self.assertFalse(self.button('first-steps').is_disabled());self.assertTrue(self.button('midnight-headliner').is_disabled())
  self.assertEqual(self.row('first-steps').locator('[data-dj-requirement]').inner_text(),'')
  self.button('first-steps').click();self.page.wait_for_function('CodaArcadeQA.jukebox().title==="First Steps"&&CodaArcadeQA.jukebox().playing')
  self.assertEqual(self.state()['bpm'],88);self.assertEqual(self.totals(),before)
  self.page.locator('#jukeboxStop').click();self.load();self.dj()
  self.assertFalse(self.button('first-steps').is_disabled());self.assertTrue(self.button('midnight-headliner').is_disabled());self.assertEqual(self.totals(),before)
  save([['dance-first-finish',50],['dance-hard-groove',150]])
  before=self.totals();self.dj()
  for id in ['first-steps','midnight-headliner']:self.assertFalse(self.button(id).is_disabled())
  self.button('midnight-headliner').click();self.page.wait_for_function('CodaArcadeQA.jukebox().title==="Midnight Headliner"&&CodaArcadeQA.jukebox().playing')
  self.assertEqual(self.state()['bpm'],100);self.assertEqual(self.totals(),before,'Playing an earned song spends no Notes, awards no XP, and leaves gear unchanged')
  self.page.locator('#jukeboxStop').click();self.load();self.dj()
  self.assertFalse(self.button('midnight-headliner').is_disabled());self.assertEqual(self.totals(),before)

if __name__=='__main__':unittest.main(verbosity=2)
