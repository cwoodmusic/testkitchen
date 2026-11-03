"""Navigate the visible Notes Shop menus without changing purchase behavior."""


def browse_shop(page, category='all'):
    shop = page.locator('.notes-shop')
    shop.wait_for(state='visible')
    view = shop.get_attribute('data-shop-view')
    if view in ('items', 'wallet'):
        shop.locator('.kids-menu-back').click()
        view = shop.get_attribute('data-shop-view')
    if view == 'home':
        shop.locator('[data-shop-page="categories"]').click()
    shop.locator('[data-shop-category="' + category + '"]').click()


def close_shop(page):
    # Escape moves up through items, categories, and then the shop home.
    for _ in range(3):
        if not page.locator('.notes-shop').is_visible():
            break
        page.keyboard.press('Escape')
