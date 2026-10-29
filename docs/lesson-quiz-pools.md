# Randomized lesson quizzes

Each standard end-of-lesson quiz still asks five questions and passes with four
correct answers. Every attempt chooses one question for each of five taught
goals, then shuffles the question order and visible choices. The eight main
lessons and Accidentals & key signatures each have three distinct questions per
goal: fifteen possible questions per lesson. The basics quizzes use the three
checks attached to each selected teaching card as their corresponding pools.
Edited lessons retain their own question content; they do not silently borrow
unrelated built-in questions.

**Try again** chooses a fresh set, including at least one different pooled
question when a goal has alternatives. Merely rendering or reopening a quiz
does not change the current questions. Feedback records the first answer;
reading a correction cannot turn an earlier mistake into a scored hit.

An unfinished random attempt resumes its exact questions, display order,
answers and feedback on this browser. These details live in the scoped local
`codaClassroomQuizAttemptsV1` key. They are excluded from cloud profile data,
cleared between players, restored with local guest backups, and isolated by
content revision and quiz type. They do not award XP by themselves.

The existing private grade format stays compatible. Its five positions are
assessment goals. Each variant in a goal has a real answer list arranged with
the same canonical correct-choice index as that goal's original question.
Visible answer order is shuffled independently, and clicks map back to the
actual selected question's canonical choice index. On completion, the actual
selected indices save in goal order. No answers are fabricated from a score.
Incomplete shuffled answers remain local because the old grade array cannot
represent gaps in goal order. Previous passing evidence remains available
while a fresh attempt is in progress.

Historical records without local attempt details reopen their known original
questions, or show their completed grade. They are never displayed as though
they answered an unrelated new pool question. A new retry uses the current
pool. The existing lesson completion and achievement journal still award each
lesson's XP only once. No Firebase schema or deployed rules change is needed.
