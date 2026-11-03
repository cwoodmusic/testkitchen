"""Verified parent profiles skip the multiplayer initials picker.

Run: python3 games/pitch-race/tests/profile-name-browser.py
The actual bundled cabinet uses the existing in-memory room SDK. Synthetic
parent sessions never contact a live account, profile, or Firebase database.
"""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location('profile_bundled_prefix',
    Path(__file__).with_name('bundled-prefix-browser.py'))
_bundle = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bundle)

ALLOWED_PLAYER_KEYS = {'uid', 'initials', 'ready', 'score', 'streak', 'bestStreak',
    'miss', 'level', 'notes', 'round', 'finished'}
BANNED_INITIALS = {'ASS', 'FUK', 'FUC', 'FCK', 'FUX', 'SHT', 'SHI', 'SUK', 'SUC',
    'CUM', 'SEX', 'XXX', 'PNS', 'DIC', 'DIK', 'DCK', 'CNT', 'COK', 'COC', 'TIT',
    'TTS', 'NIG', 'NGR', 'NGA', 'KKK', 'KYS', 'WTF', 'STF', 'FAG', 'FGT', 'DYK',
    'JIZ', 'JZZ', 'PUS', 'PSS', 'PIS', 'GAY'}


def student(alias='Blue Fox 14', profile_id='student_fixture_0001'):
    return {'enabled': True, 'configured': True, 'ready': True, 'loading': False,
        'locked': False, 'waitingTakeover': False, 'readOnly': False,
        'profile': {'classId': 'class_fixture_0001', 'profileId': profile_id,
            'alias': alias},
        'admin': {'signedIn': False, 'authorized': False}}


def teacher():
    state = student('Ms. Music', 'teacher_fixture_0001')
    state['profile'].update({'kind': 'teacher', 'classId': 'teacher_personal'})
    state['admin'] = {'signedIn': True, 'authorized': True, 'uid': 'teacher_fixture_0001'}
    return state


class ProfileNameTests(_bundle.NestedPitchCase,
        _bundle._multiplayer.ClassroomMultiplayerTests):
    def setUp(self):
        self.profile_state = None
        self.with_service = True
        self.spoof = False
        super().setUp()

    def route_checkout(self, route):
        if urlparse(route.request.url).path == _bundle.HOST_PATH:
            state = json.dumps(self.profile_state).replace('<', '\\u003c')
            service = '''window.CodaClassroomSession={getState:()=>window.__profileState,
subscribe:callback=>{window.__profileListeners.add(callback);return()=>window.__profileListeners.delete(callback);}};''' if self.with_service else ''
            source = _bundle.GAME_PATH + '?classroom=1'
            if self.spoof:
                source += '&profile=spoofed_student&alias=Spoofed%20Name&name=Spoofed'
            body = '''<!doctype html><meta charset="utf-8"><script>
window.ARCADE_ACCOUNTS_CONFIG={mode:'classroom',classroom:{privacy:true,enabled:true}};
window.__profileState=STATE;window.__profileListeners=new Set();
window.__setProfileState=value=>{window.__profileState=value;for(const callback of window.__profileListeners)callback(value);};
SERVICE
if(SPOOF){localStorage.setItem('musicArcadeV1',JSON.stringify({name:'Spoofed Avatar'}));
 localStorage.setItem('codaClassroomActiveV1',JSON.stringify({classId:'spoofed_class',profileId:'spoofed_student',alias:'Spoofed Name'}));
 window.CodaArcadeQA={avatar:()=>({name:'Spoofed Avatar'})};}
</script><iframe id="host" style="width:1400px;height:1000px" src="SOURCE"></iframe>
<iframe id="guest" style="width:1400px;height:1000px" src="SOURCE"></iframe>'''
            body = body.replace('STATE', state).replace('SERVICE', service)
            body = body.replace('SPOOF', str(self.spoof).lower()).replace('SOURCE', source)
            return route.fulfill(content_type='text/html', body=body)
        return super().route_checkout(route)

    def profile_frames(self, state=None, with_service=True, spoof=False):
        self.profile_state, self.with_service, self.spoof = state, with_service, spoof
        return self.frames()

    def set_profile(self, state):
        self.page.evaluate('value=>window.__setProfileState(value)', state)

    def create(self, frame):
        frame.locator('#multiCreate').click()
        frame.wait_for_function('document.querySelector("#multiCode").textContent!=="----"')
        return frame.locator('#multiCode').inner_text()

    def player(self, code, role):
        return self.page.evaluate('value=>window.__roomServer.data.rooms[value.code].players[value.role]',
            {'code': code, 'role': role})

    def assert_legacy_player(self, player):
        self.assertEqual(set(player), ALLOWED_PLAYER_KEYS)
        self.assertRegex(player['initials'], r'^[A-Z]{3}$')
        self.assertNotIn(player['initials'], BANNED_INITIALS)
        self.assertNotIn('alias', player)
        self.assertNotIn('displayName', player)

    def assert_profile_label(self, frame, alias):
        self.assertTrue(frame.locator('#multiNameEntry').is_hidden())
        self.assertTrue(frame.locator('#multiProfileName').is_visible())
        self.assertEqual(frame.locator('#multiProfileName').inner_text(), 'Racing as ' + alias)

    def test_student_and_authorized_teacher_profiles_skip_the_name_picker(self):
        for state in [student(), teacher()]:
            with self.subTest(profile=state['profile']['alias']):
                frame, _ = self.profile_frames(state)
                self.lobby(frame)
                self.assert_profile_label(frame, state['profile']['alias'])
                self.assertFalse(frame.evaluate('Boolean(window.firebase)'))
                self.assertEqual(self.logs(), [])
        self.assertEqual(self.sdk_requests, [])

    def test_guest_without_session_api_keeps_the_initials_picker(self):
        frame, _ = self.profile_frames(with_service=False)
        self.lobby(frame)
        self.assertTrue(frame.locator('#multiNameEntry').is_visible())
        self.assertTrue(frame.locator('#multiProfileName').is_hidden())
        self.assertEqual(frame.locator('#multiInitials button').count(), 6)
        self.assert_legacy_player(self.player(self.create(frame), 'host'))

    def test_query_avatar_and_saved_marker_cannot_spoof_a_signed_in_profile(self):
        frame, _ = self.profile_frames(with_service=False, spoof=True)
        self.lobby(frame)
        self.assertTrue(frame.locator('#multiNameEntry').is_visible())
        self.assertTrue(frame.locator('#multiProfileName').is_hidden())
        self.assertNotIn('Spoofed', frame.locator('#multiLobby').inner_text())
        frame, _ = self.profile_frames(student(), spoof=True)
        self.lobby(frame)
        self.assert_profile_label(frame, 'Blue Fox 14')

    def test_unready_locked_read_only_and_unapproved_teacher_profiles_do_not_hide_picker(self):
        states = []
        for flag in ['enabled', 'configured', 'ready']:
            value = student(); value[flag] = False; states.append((flag, value))
        for flag in ['loading', 'locked', 'waitingTakeover', 'readOnly']:
            value = student(); value[flag] = True; states.append((flag, value))
        for field in ['classId', 'profileId', 'alias']:
            value = student(); value['profile'][field] = ''; states.append((field, value))
        for flag in ['signedIn', 'authorized']:
            value = teacher(); value['admin'][flag] = False; states.append(('teacher ' + flag, value))
        for label, value in states:
            with self.subTest(state=label):
                frame, _ = self.profile_frames(value)
                self.lobby(frame)
                self.assertTrue(frame.locator('#multiNameEntry').is_visible())
                self.assertTrue(frame.locator('#multiProfileName').is_hidden())
                self.assertEqual(self.logs(), [])
        self.assertEqual(self.sdk_requests, [])

    def test_signed_in_create_and_join_keep_the_existing_room_player_schema(self):
        host, guest = self.profile_frames(student())
        self.lobby(host); self.lobby(guest)
        code = self.create(host)
        guest.locator('#multiJoinCode').fill(code)
        guest.locator('#multiJoin').click()
        guest.wait_for_function('!document.querySelector("#multiWaiting").classList.contains("hidden")')
        for role in ['host', 'guest']:
            self.assert_legacy_player(self.player(code, role))
        self.assertEqual(host.locator('#multiHost').inner_text(), 'Blue Fox 14')
        self.assertEqual(guest.locator('#multiGuest').inner_text(), 'Blue Fox 14')
        self.assertEqual(host.locator('#multiGuest').inner_text(), self.player(code, 'guest')['initials'])
        self.assertEqual(guest.locator('#multiHost').inner_text(), self.player(code, 'host')['initials'])
        host.locator('#multiReady').click(); guest.locator('#multiReady').click()
        host.wait_for_function('!document.querySelector("#multiStart").disabled')
        host.locator('#multiStart').click()
        for frame in [host, guest]:
            frame.wait_for_function('__pitchFixture.snapshot().state==="running"')
        self.assert_private()

    def test_banned_and_non_latin_profile_names_generate_usable_automatic_initials(self):
        for alias in ['ASS', 'fûk', '王美玲']:
            with self.subTest(alias=alias):
                frame, _ = self.profile_frames(student(alias))
                self.lobby(frame)
                self.assert_profile_label(frame, alias)
                self.assert_legacy_player(self.player(self.create(frame), 'host'))

    def test_profile_switch_during_create_auth_writes_nothing_and_retry_uses_new_profile(self):
        frame, _ = self.profile_frames(student())
        self.lobby(frame)
        self.page.evaluate('window.__deferAuth=true')
        frame.locator('#multiCreate').click()
        self.page.wait_for_function('typeof window.__releaseAuth==="function"')
        changed = student('Mint Owl 23', 'student_fixture_0002')
        self.set_profile(changed)
        self.page.evaluate('window.__deferAuth=false;window.__releaseAuth()')
        frame.wait_for_function('!document.querySelector("#multiCreate").disabled')
        self.assertFalse(any(entry[0] == 'write' for entry in self.logs()))
        self.assertTrue(frame.locator('#multiEntry').is_visible())
        self.assertTrue(frame.locator('#multiWaiting').is_hidden())
        self.assert_profile_label(frame, changed['profile']['alias'])
        code = self.create(frame)
        self.assertEqual(frame.locator('#multiHost').inner_text(), changed['profile']['alias'])
        self.assert_legacy_player(self.player(code, 'host'))

    def test_profile_loss_during_create_auth_cancels_then_restores_guest_picker(self):
        frame, _ = self.profile_frames(student())
        self.lobby(frame)
        self.page.evaluate('window.__deferAuth=true')
        frame.locator('#multiCreate').click()
        self.page.wait_for_function('typeof window.__releaseAuth==="function"')
        self.set_profile(None)
        self.page.evaluate('window.__deferAuth=false;window.__releaseAuth()')
        frame.wait_for_function('!document.querySelector("#multiCreate").disabled')
        self.assertFalse(any(entry[0] == 'write' for entry in self.logs()))
        frame.locator('#multiHome').click(); self.lobby(frame)
        self.assertTrue(frame.locator('#multiNameEntry').is_visible())
        self.assertTrue(frame.locator('#multiProfileName').is_hidden())
        self.assert_legacy_player(self.player(self.create(frame), 'host'))

    def test_profile_switch_during_join_auth_cannot_claim_a_seat_until_retry(self):
        host, guest = self.profile_frames(student())
        self.lobby(host); self.lobby(guest)
        code = self.create(host)
        writes_before = len([entry for entry in self.logs() if entry[0] == 'write'])
        self.page.evaluate('window.__deferAuth=true')
        guest.locator('#multiJoinCode').fill(code); guest.locator('#multiJoin').click()
        self.page.wait_for_function('typeof window.__releaseAuth==="function"')
        changed = student('Mint Owl 23', 'student_fixture_0002')
        self.set_profile(changed)
        self.page.evaluate('window.__deferAuth=false;window.__releaseAuth()')
        guest.wait_for_function('!document.querySelector("#multiJoin").disabled')
        self.assertEqual(len([entry for entry in self.logs() if entry[0] == 'write']), writes_before)
        self.assertFalse(self.page.evaluate('code=>Boolean(window.__roomServer.data.rooms[code].players.guest)', code))
        self.assert_profile_label(guest, changed['profile']['alias'])
        guest.locator('#multiJoin').click()
        guest.wait_for_function('!document.querySelector("#multiWaiting").classList.contains("hidden")')
        self.assertEqual(guest.locator('#multiGuest').inner_text(), changed['profile']['alias'])
        self.assert_legacy_player(self.player(code, 'guest'))


if __name__ == '__main__':
    unittest.main(verbosity=2)
