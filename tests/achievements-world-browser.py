"""Hall of Fame shows the current player's real earned and locked achievements."""
import importlib.util
from pathlib import Path
import unittest
from playwright.sync_api import expect
from world_navigation_helpers import open_destination

_spec=importlib.util.spec_from_file_location('achievement_world_fixture',Path(__file__).with_name('learning-world-browser.py'))
_world=importlib.util.module_from_spec(_spec);_spec.loader.exec_module(_world)


class AchievementsWorldTests(_world.WorldBrowserCase):
    def open_achievements(self):
        open_destination(self.page,'fame')
        expect(self.page.get_by_role('tab',name='Records',exact=True)).to_have_attribute('aria-selected','true')
        self.page.get_by_role('tab',name='Achievements',exact=True).click()
        self.assertEqual(self.page.evaluate('CodaArcadeQA.hallOfFame().activeTab'),'achievements')

    def journals(self):
        return self.page.evaluate('''()=>Object.fromEntries(['codaPlayerProgressV1','codaNotesWalletV1',
          'codaRhythmFishingV1','codaPianoProgressV1','codaClassroomLessonsV1','codaClassroomQuizzesV1',
          'codaHaydnFinalExamV1'].map(key=>[key,localStorage.getItem(key)]))''')

    def test_all_includes_locked_requirements_and_filters_never_award_rewards(self):
        self.open_achievements();before=self.journals()
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),49)
        self.assertEqual(self.page.locator('[data-achievement-id][data-earned="false"]').count(),49)
        categories=self.page.locator('#fame-achievement-category')
        self.assertEqual(categories.locator('option').count(),9,'Eight achievement categories plus Every topic')
        expect(categories.locator('option[value="dance"]')).to_have_text('DJ Line Dance')
        locked=self.page.locator('[data-achievement-id="triad-hard-advanced-win"]')
        expect(locked).to_contain_text('Locked');expect(locked).to_contain_text('Hard')
        categories.select_option('dance')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),6)
        self.assertEqual(self.page.locator('[data-achievement-id][data-earned="false"]').count(),6)
        for achievement,requirement,reward in [
            ('dance-first-finish','eight-bar','First Steps DJ track'),
            ('dance-twenty-streak','twenty steps in a row','Shutter shades'),
            ('dance-hard-groove','Hard DJ line dance with at least 80% accuracy','Midnight Headliner DJ track'),
            ('dance-perfect-set','no wrong or extra arrows','Roller skates'),
            ('dance-hard-perfect','Hard DJ line dance with no wrong or extra arrows','Boombox')]:
            card=self.page.locator('[data-achievement-id="'+achievement+'"]')
            expect(card).to_contain_text('Locked');expect(card).to_contain_text(requirement)
            expect(card).to_contain_text('Unlock: '+reward)
        expect(self.page.locator('[data-achievement-id="dance-normal-groove"]')).to_contain_text('Normal DJ line dance with at least 80% accuracy')
        self.assertEqual(self.journals(),before,'Browsing locked DJ goals and unlocks cannot award XP or Notes')
        self.page.locator('#fame-achievement-category').select_option('fishing')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),9)
        self.page.locator('#fame-achievement-status').select_option('earned')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),0)
        self.page.locator('#fame-achievement-status').select_option('locked')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),9)
        self.page.locator('#fame-achievement-category').select_option('classroom')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),10)
        self.page.get_by_role('tab',name='Records',exact=True).click()
        for name in ['Pitch Race','Music Triad','Rhythm Room']:
            expect(self.page.locator('.hall-of-fame')).to_contain_text(name)
        self.page.get_by_role('tab',name='Achievements',exact=True).click()
        self.assertEqual(self.journals(),before,'Viewing, filtering and switching tabs cannot award XP, Notes or achievements')

    def test_old_earned_journal_and_real_progress_survive_reload_and_do_not_cross_players(self):
        result=self.page.evaluate('''()=>{
          const D=CodaClassroomProfileData,data=D.blank();
          data.progression.events=[{id:'achievement:triad-first-win',xp:50},
            ...Array.from({length:12},(_,i)=>({id:'game:achievement-window-fixture-'+i,xp:1}))];
          data.progression.xp=62;data.avatar.jumps=4;
          return D.apply(localStorage,data);
        }''');self.assertTrue(result['ok'])
        self.page.reload(wait_until='domcontentloaded');self.page.wait_for_function('CodaDeveloperConsole?.ready()')
        self.open_achievements()
        self.assertEqual(self.page.locator('[data-achievement-id][data-earned="true"]').count(),1)
        expect(self.page.locator('[data-achievement-id="triad-first-win"]')).to_have_attribute('data-earned','true')
        jump=self.page.locator('[data-achievement-id="starclip"] progress')
        expect(jump).to_have_attribute('value','4');expect(jump).to_have_attribute('max','10')
        self.page.locator('#fame-achievement-category').select_option('triad')
        self.page.locator('#fame-achievement-status').select_option('earned')
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),1)
        self.page.keyboard.press('Escape');expect(self.page.locator('#panel')).to_be_hidden()
        result=self.page.evaluate('CodaClassroomProfileData.apply(localStorage,CodaClassroomProfileData.blank())')
        self.assertTrue(result['ok']);self.page.reload(wait_until='domcontentloaded')
        self.page.wait_for_function('CodaDeveloperConsole?.ready()');self.open_achievements()
        self.assertEqual(self.page.locator('[data-achievement-id][data-earned="true"]').count(),0)
        self.assertEqual(self.page.locator('[data-achievement-id]').count(),49)

    def test_mobile_tabs_and_filters_fit_and_escape_returns_to_the_arcade(self):
        self.page.set_viewport_size({'width':390,'height':844});self.open_achievements()
        for selector in ['#fame-tab-records','#fame-tab-achievements','#fame-achievement-status','#fame-achievement-category']:
            bounds=self.page.locator(selector).bounding_box()
            self.assertGreaterEqual(bounds['width'],44);self.assertGreaterEqual(bounds['height'],44)
        self.assertTrue(self.page.locator('#panel').evaluate('panel=>panel.scrollWidth<=panel.clientWidth+1'))
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.locator('#fame-tab-achievements').focus();self.page.keyboard.press('ArrowLeft')
        expect(self.page.locator('#fame-tab-records')).to_be_focused()
        expect(self.page.locator('#fame-tab-records')).to_have_attribute('aria-selected','true')
        self.page.keyboard.press('ArrowRight');expect(self.page.locator('#fame-tab-achievements')).to_be_focused()
        self.page.keyboard.press('Escape');expect(self.page.locator('#panel')).to_be_hidden()
        expect(self.page.locator('#view')).to_be_focused()


if __name__=='__main__':unittest.main(verbosity=2)
