"""Real answer clicks shared by classroom completion fixtures."""
QUIZ_ANSWERS = {
    'note-naming': (0, 1, 2, 0, 1),
    'rhythm-tree': (1, 0, 2, 1, 0),
    'time-signatures': (2, 1, 0, 2, 1),
    'bass-clef': (0, 1, 2, 0, 1),
    'grand-staff': (0, 1, 2, 0, 2),
    'major-minor-keys': (0, 1, 2, 0, 1),
    'dynamics': (0, 1, 2, 0, 1),
    'tempo': (1, 0, 2, 1, 0),
}


def current_quiz(page):
    return page.evaluate('''()=>window.CodaArcadeQA?.tutorials?.()?.active?.quiz
      ||window.roomUI?.getState?.()?.tutorials?.active?.quiz
      ||window.lesson?.getState?.()?.quiz||window.pathUI?.getState?.()?.quiz||null''')


def quiz_answer(page, lesson, fallback_index=0):
    state=current_quiz(page)
    return state['question']['correct'] if state and state.get('question') else QUIZ_ANSWERS[lesson][fallback_index]


def answer_quiz(page, lesson, wrong=(), finish=True):
    """Answer a fresh five-question quiz; callers still assert rewards/state."""
    from exam_study_helpers import finish_exam_study
    finish_exam_study(page, lesson)
    for index in range(5):
        correct=quiz_answer(page,lesson,index)
        choice = (correct + 1) % 3 if index in wrong else correct
        page.locator('[data-quiz-answer="' + str(choice) + '"]').click()
        page.locator('[data-quiz-next]').click()
    if finish:
        page.locator('[data-quiz-finish]').click()
