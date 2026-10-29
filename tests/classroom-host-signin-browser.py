"""Production sign-in availability and visible setup reasons on exact origins.

Requests are fulfilled from this checkout. No Firebase SDK, Google popup,
account, or deployed database is used by these checks.
"""
from pathlib import Path
import sys
import unittest
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ['account-config.js', 'arcade-host.js', 'classroom-profile-data.js',
           'classroom-service.js', 'classroom-ui.js']
FIXTURE = ('<!doctype html><meta charset="utf-8">' +
           ''.join('<script src="/' + name + '"></script>' for name in SCRIPTS) +
           '<body><div id="profiles"></div><script>'
           'window.fixtureService=CodaClassroom.create({window});'
           'window.fixtureUI=CodaClassroomUI.create({host:document.querySelector("#profiles"),service:fixtureService});'
           'fixtureUI.open("admin");</script></body>')


class ClassroomHostSigninTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(service_workers='block')
        self.unexpected, self.errors = [], []
        self.context.route('**/*', self.route)
        self.page = self.context.new_page()
        self.page.on('pageerror', lambda error: self.errors.append(str(error)))

    def route(self, route):
        path = urlparse(route.request.url).path
        if path == '/signin-fixture.html':
            return route.fulfill(content_type='text/html', body=FIXTURE)
        if path.lstrip('/') in SCRIPTS:
            return route.fulfill(content_type='text/javascript', path=str(ROOT / path.lstrip('/')))
        if path == '/favicon.ico':
            return route.fulfill(status=204)
        self.unexpected.append(route.request.url)
        route.abort()

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [])
        self.assertEqual(self.unexpected, [], 'No authentication or database requests are needed to enable the button')

    def open(self, origin):
        self.page.goto(origin + '/signin-fixture.html', wait_until='load')
        self.page.wait_for_selector('#classpassAdminSignIn')
        return self.page.evaluate('fixtureService.getState()')

    def assert_enabled(self):
        state = self.page.evaluate('fixtureService.getState()')
        self.assertTrue(state['configured'])
        self.assertEqual(state['configurationReason'], '')
        self.assertFalse(state['loading'])
        self.assertFalse(state['ready'], 'Firebase has not been loaded before sign-in')
        self.assertFalse(self.page.locator('#classpassAdminSignIn').is_disabled())
        self.assertEqual(self.page.locator('.classpass-notice').count(), 0)

    def test_correct_domains_enable_signin_after_storage_is_cleared_and_page_reloaded(self):
        for origin in ['https://www.coda-arcade.com', 'https://coda-arcade.com']:
            with self.subTest(origin=origin):
                self.open(origin)
                self.assert_enabled()
                self.page.evaluate('localStorage.setItem("test-old-player","synthetic");sessionStorage.setItem("test-old-tab","synthetic");localStorage.clear();sessionStorage.clear()')
                self.page.reload(wait_until='load')
                self.assert_enabled()

    def test_old_domain_spellings_keep_their_own_signin_available(self):
        for origin in ['https://www.coda-aracde.com', 'https://coda-aracde.com']:
            with self.subTest(origin=origin):
                self.open(origin)
                self.assert_enabled()
                self.assertEqual(self.page.url, origin + '/signin-fixture.html', 'No automatic domain migration')

    def test_unsupported_address_shows_the_reason_and_a_secure_site_link(self):
        state = self.open('https://www.coda-arcade.com.evil.test')
        self.assertFalse(state['configured'])
        self.assertEqual(state['configurationReason'], 'unsupported-host')
        self.assertTrue(self.page.locator('#classpassAdminSignIn').is_disabled())
        notice = self.page.locator('.classpass-notice')
        self.assertTrue(notice.is_visible())
        self.assertIn('Google sign-in is not available at this website address', notice.inner_text())
        self.assertNotIn('Class passes are not ready', notice.inner_text())
        self.assertEqual(self.page.locator('#classpassSigninSite').get_attribute('href'), 'https://www.coda-arcade.com')
        self.assertEqual(self.page.url, 'https://www.coda-arcade.com.evil.test/signin-fixture.html')

    def test_insecure_connection_explains_https_without_redirecting(self):
        state = self.open('http://www.coda-arcade.com')
        self.assertFalse(self.page.evaluate('isSecureContext'))
        self.assertFalse(state['configured'])
        self.assertEqual(state['configurationReason'], 'secure-crypto-unavailable')
        self.assertTrue(self.page.locator('#classpassAdminSignIn').is_disabled())
        self.assertIn('HTTPS', self.page.locator('.classpass-notice').inner_text())
        self.assertEqual(self.page.locator('#classpassSigninSite').get_attribute('href'), 'https://www.coda-arcade.com')
        self.assertEqual(self.page.url, 'http://www.coda-arcade.com/signin-fixture.html')

    def test_missing_configuration_explains_teacher_setup(self):
        self.context.route('**/account-config.js', lambda route: route.fulfill(
            content_type='text/javascript', body='window.ARCADE_ACCOUNTS_CONFIG={mode:"classroom",classroom:{enabled:true}};'))
        state = self.open('https://www.coda-arcade.com')
        self.assertEqual(state['configurationReason'], 'not-configured')
        self.assertTrue(self.page.locator('#classpassAdminSignIn').is_disabled())
        self.assertIn('Google sign-in is not ready here yet', self.page.locator('.classpass-notice').inner_text())
        self.assertEqual(self.page.locator('#classpassSigninSite').count(), 0)

    def test_student_setup_message_stays_about_their_class_pass(self):
        self.open('https://unconfigured.example')
        self.page.locator('#classpassTab-student').click()
        self.assertIn('Class passes are not ready here yet', self.page.locator('.classpass-notice').first.inner_text())
        self.assertEqual(self.page.locator('#classpassSigninSite').count(), 0)


if __name__ == '__main__':
    unittest.main(verbosity=2)
