"""Choose classroom activities through the visible student menus."""
from world_navigation_helpers import advance_world


def classroom_home(page):
    menu = page.locator('[data-classroom-menu="lessons"]')
    if menu.is_visible():
        return
    home = page.locator('[data-classroom-menu="home"]')
    if home.is_visible():
        home.click()
        return
    back = page.locator('#classroomAllLessons')
    if back.is_visible():
        back.click()
        return
    if page.locator('#classroomCanvas').is_visible():
        page.locator('#classroomCanvas').focus()
        page.keyboard.down('w')
        advance_world(page, 850)
        page.keyboard.up('w')
        page.keyboard.press('e')
        advance_world(page)
    menu.wait_for(state='visible')


def classroom_lessons(page, all_lessons=False):
    classroom_home(page)
    page.locator('[data-classroom-menu="lessons"]').click()
    if all_lessons:
        page.locator('[data-classroom-menu="all"]').click()


def choose_classroom_lesson(page, lesson):
    classroom_lessons(page, all_lessons=lesson not in (
        'note-naming', 'rhythm-tree', 'time-signatures'))
    page.locator('[data-classroom-lesson="' + lesson + '"]').click()


def choose_classroom_exam(page):
    classroom_lessons(page, all_lessons=True)
    page.locator('[data-classroom-menu="exam"]').click()
