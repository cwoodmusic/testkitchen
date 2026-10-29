"""Answer the visible taught practice checks without bypassing the real UI."""


def finish_exam_study(page, lesson):
    """Complete the current study sequence, then follow its actual next action."""
    for _ in range(120):
        panel = page.locator('.classroom-exam-study[data-study-lesson="' + lesson + '"]')
        if panel.count() == 0 or not panel.is_visible():
            return
        try_it = panel.locator('[data-study-try]')
        if try_it.count() and try_it.is_visible():
            try_it.click()
        current = page.evaluate('''lesson=>{
          const cards=window.CodaEducationContent?.getStudyCards?.(lesson)
            ||window.CodaExamCurriculum?.forLesson(lesson)||[];
          const heading=document.querySelector('.classroom-exam-study .exam-study-top').textContent;
          const index=Number(heading.match(/Card (\\d+) of/)[1])-1;
          const card=cards[index],checkIndex=Number(document.querySelector('.classroom-exam-study [data-study-check]')?.dataset.studyCheck||0);
          const checks=window.CodaClassroomLearningPathsData?.getChecks?.(lesson,card)
            ||[card,...(card?.checks||[])];
          return checks[checkIndex]?.correct;
        }''', lesson)
        if panel.locator('[data-study-answer]').count():
            panel.locator('[data-study-answer="' + str(current) + '"]').click()
        panel.locator('[data-study-next]').click()
    raise AssertionError('The study cards did not finish within the allowed question count')


def finish_note_reminders(page):
    """Read the staff, clef, line and space screens before a staff question."""
    for _ in range(5):
        advance = page.locator('[data-note-reminder-next]')
        if advance.count() == 0 or not advance.is_visible():
            return
        advance.click()
    raise AssertionError('The clef, line and space reminders did not reach the note example')
