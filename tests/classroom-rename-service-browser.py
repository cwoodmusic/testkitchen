"""Class renaming through the real UI, service, SDK, and demo Firebase rules.

Run with node tools/test-classroom-service.cjs --class-rename.
The shared fixture refuses all deployed endpoints and uses disposable data.
"""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location('rename_service_fixture',
    Path(__file__).with_name('classroom-service-browser.py'))
fixture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fixture)


class ClassRenameServiceBrowserTests(unittest.TestCase):
    setUpClass = classmethod(fixture.ClassroomServiceBrowserTests.setUpClass.__func__)
    tearDownClass = classmethod(fixture.ClassroomServiceBrowserTests.tearDownClass.__func__)
    setUp = fixture.ClassroomServiceBrowserTests.setUp
    tearDown = fixture.ClassroomServiceBrowserTests.tearDown
    device = fixture.ClassroomServiceBrowserTests.device
    start = fixture.ClassroomServiceBrowserTests.start
    call = fixture.ClassroomServiceBrowserTests.call
    assert_ok = fixture.ClassroomServiceBrowserTests.assert_ok
    join = fixture.ClassroomServiceBrowserTests.join
    cloud = fixture.ClassroomServiceBrowserTests.cloud

    def test_only_two_labels_change_and_original_card_keeps_saved_student_progress(self):
        student = self.device()
        self.join(student)
        student.evaluate('fixtureProgress(460,280)')
        self.assert_ok(self.call(student, 'flush'))
        before = fixture.database('classroomV1')
        result = self.call(self.admin, 'renameClass', self.class_id, '  Room 14 Music  ')
        self.assertEqual(result, {'ok': True, 'classId': self.class_id, 'label': 'Room 14 Music'})
        expected = copy.deepcopy(before)
        for node in ['classes', 'directory']:
            expected[node][self.class_id]['meta']['label'] = 'Room 14 Music'
        self.assertEqual(fixture.database('classroomV1'), expected)
        self.assertTrue(self.call(student, 'isWritable'))
        self.assertEqual(self.call(student, 'getState')['profile']['profileId'], self.card['profileId'])
        student.evaluate('fixtureProgress(510,300)')
        self.assert_ok(self.call(student, 'flush'))
        self.assert_ok(self.call(student, 'leave'))
        reopened = self.device()
        self.join(reopened, self.card)
        progress = reopened.evaluate('CodaClassroomProfileData.capture(localStorage).data')
        self.assertEqual(progress['progression']['xp'], 510)
        self.assertEqual(progress['wallet']['balance'], 450)
        self.assertEqual(self.call(reopened, 'getState')['profile']['profileId'], self.card['profileId'])

    def test_teacher_form_saves_through_real_service_without_replacing_class_or_roster(self):
        page = self.admin
        page.add_style_tag(path=str(fixture.ROOT/'classroom-ui.css'))
        page.add_script_tag(path=str(fixture.ROOT/'classroom-ui.js'))
        page.evaluate('''()=>{
          const panel=document.createElement('aside');panel.id='renamePanel';
          const body=document.createElement('div');panel.append(body);document.body.append(panel);
          window.renameUI=CodaClassroomUI.create({panelBody:body,service:fixtureService,
            openPanel:()=>{panel.hidden=false;body.replaceChildren();},
            closePanel:()=>{panel.hidden=true;}});renameUI.open('admin');
        }''')
        page.wait_for_function('!renameUI.getState().busy&&document.querySelector("#classpassRenameClass")')
        page.locator('#classpassClass').select_option(self.class_id)
        page.wait_for_function('!renameUI.getState().busy')
        before = fixture.database('classroomV1')
        page.locator('#classpassRenameClass').click()
        self.assertEqual(page.locator('#classpassClassNameInput').input_value(), 'Blue group')
        page.locator('#classpassClassNameInput').fill('Green group')
        page.locator('#classpassClassNameSave').click()
        page.wait_for_function('!renameUI.getState().busy')
        self.assertIn('Class name saved.', page.locator('#classpassStatus').inner_text())
        self.assertEqual(page.locator('#classpassClass').input_value(), self.class_id)
        self.assertEqual(page.locator('#classpassClass option:checked').inner_text(), 'Green group')
        self.assertEqual(page.locator('.classpass-profile-row').count(), 1)
        expected = copy.deepcopy(before)
        for node in ['classes', 'directory']:
            expected[node][self.class_id]['meta']['label'] = 'Green group'
        self.assertEqual(fixture.database('classroomV1'), expected)

    def test_offline_rename_fails_without_queueing_a_later_write(self):
        self.admin.evaluate('''async()=>{
          window.renameDB=fixtureSDK.getDatabase(fixtureSDK.getApps().find(app=>app.name==='coda-classroom-admin'));
          fixtureSDK.goOffline(renameDB);
          await new Promise(resolve=>{let stop;stop=fixtureSDK.onValue(fixtureSDK.ref(renameDB,'.info/connected'),snap=>{
            if(snap.val()===false){queueMicrotask(()=>stop());resolve();}
          });});
        }''')
        before = fixture.database('classroomV1')
        self.assertEqual(self.call(self.admin, 'renameClass', self.class_id, 'Offline name'),
                         {'ok': False, 'code': 'class-rename-failed'})
        self.assertEqual(fixture.database('classroomV1'), before)
        self.admin.evaluate('''async()=>{
          fixtureSDK.goOnline(renameDB);
          await new Promise(resolve=>{let stop;stop=fixtureSDK.onValue(fixtureSDK.ref(renameDB,'.info/connected'),snap=>{
            if(snap.val()===true){queueMicrotask(()=>stop());resolve();}
          });});
        }''')
        self.assertEqual(fixture.database('classroomV1'), before)
        self.assert_ok(self.call(self.admin, 'renameClass', self.class_id, 'Online name'))

    def test_guest_and_student_cannot_rename_and_missing_classes_stay_missing(self):
        student = self.device()
        self.join(student)
        guest = self.device()
        before = fixture.database('classroomV1')
        for page in [student, guest]:
            result = self.call(page, 'renameClass', self.class_id, 'Not allowed')
            self.assertFalse(result['ok'], result)
        self.assertEqual(self.call(self.admin, 'renameClass', 'class_missing_1234', 'Missing class'),
                         {'ok': False, 'code': 'class-not-found'})
        self.assertEqual(fixture.database('classroomV1'), before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
