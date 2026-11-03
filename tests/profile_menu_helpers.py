"""Open the focused Profile page through its visible menu choices."""


def show_profile_page(page, destination):
    profile = page.locator('.player-profile')
    profile.wait_for(state='visible')
    current = profile.get_attribute('data-profile-page')
    if current == destination:
        return
    if current != 'home':
        profile.locator('[data-profile-action="home"]').click()
    if destination != 'home':
        profile.locator('[data-profile-action="' + destination + '"]').click()
