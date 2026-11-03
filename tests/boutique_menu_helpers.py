"""Use the boutique's visible groups without applying or discarding a draft."""

GROUP_PAGES = {
    'Hats': 'extras', 'Glasses': 'extras', 'Accessories': 'extras', 'Emotes': 'extras',
    'Outfits': 'clothes', 'Shoes': 'clothes', 'Hair': 'hair',
    'Transformations': 'pets', 'Pets': 'pets',
}
FIELD_GROUPS = {
    'Hairstyle': 'Hair', 'Hair color': 'Hair', 'Skin color': 'Hair',
    'Outfit': 'Outfits', 'Outfit color': 'Outfits', 'Lower clothing color': 'Outfits',
    'Hats': 'Hats', 'Hat color': 'Hats', 'Glasses': 'Glasses',
    'Glasses color': 'Glasses', 'Accessories': 'Accessories', 'Shoes': 'Shoes',
    'Emote': 'Emotes', 'Transformation': 'Transformations', 'Companion': 'Pets',
}


def boutique_home(page):
    menu = page.locator('.boutique-menu')
    if menu.get_attribute('data-boutique-menu') != 'home':
        page.locator('[data-boutique-back]').click()


def browse_boutique(page, category):
    group = GROUP_PAGES[category]
    menu = page.locator('.boutique-menu')
    if menu.get_attribute('data-boutique-menu') != group:
        boutique_home(page)
        page.locator('[data-boutique-page="' + group + '"]').click()
    page.get_by_role('button', name='Browse ' + category, exact=True).click()


def boutique_field(page, label):
    if label in FIELD_GROUPS:
        browse_boutique(page, FIELD_GROUPS[label])
    else:
        boutique_home(page)
    return page.get_by_label(label, exact=True)


def boutique_presets(page):
    boutique_home(page)
    details = page.locator('.boutique-more-options')
    if not details.evaluate('node=>node.open'):
        details.locator('summary').click()
