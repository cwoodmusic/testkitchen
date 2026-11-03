"""Use the visible Settings pages while preserving their real controls."""
from world_navigation_helpers import advance_world, open_settings


def settings_page(page, name):
    open_settings(page)
    menu = page.locator('#worldMenu')
    if menu.get_attribute('data-settings-page') == name:
        return
    if menu.get_attribute('data-settings-page') != 'home':
        menu.locator('[data-settings-action="home"]').click()
    if name != 'home':
        menu.locator('[data-settings-action="' + name + '"]').click()
    advance_world(page, 32)
