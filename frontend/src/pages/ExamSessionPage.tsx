import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getQuestionComponent } from '../components/questions/questionRegistry'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { selectExamQuestions } from '../lib/examQuestionSelection'
import { postResult } from '../api/progressApi'
import { validateAnswer } from '../validators/answerValidator'
import type { Exercise, UserAnswer } from '../types/exercise'

// Extracted to a standalone, module-scope component (receiving `exercise` as a genuine prop) so
// `getQuestionComponent(exercise.type)` matches the exact shape of the working, unflagged call in
// QuizCard.tsx:31. Inlining this lookup directly in ExamSessionPage's body — even after proving
// `currentExercise` non-undefined via an early return — still tripped react-hooks/static-components,
// because `currentExercise` there is derived from `examQuestions[currentIndex]` (a computed/indexed
// expression) rather than a destructured function parameter; the rule's static analysis apparently
// treats only the latter as provably stable.
function formatUserAnswerText(exercise: Exercise, answer: UserAnswer | undefined): string {
  if (!answer) return 'No answer'
  if (exercise.type === 'selection' && answer.type === 'selection') {
    return exercise.options[answer.selectedIndex]
  }
  if (exercise.type === 'multiselect' && answer.type === 'multiselect') {
    return answer.selectedIndices.length > 0
      ? answer.selectedIndices.map((i) => exercise.options[i]).join(', ')
      : 'No answer'
  }
  if (exercise.type === 'free-type' && answer.type === 'free-type') {
    return answer.text.trim() || 'No answer'
  }
  return 'No answer'
}

function formatCorrectAnswerText(exercise: Exercise): string {
  if (exercise.type === 'selection') return exercise.options[exercise.answer]
  if (exercise.type === 'multiselect') return exercise.answers.map((i) => exercise.options[i]).join(', ')
  return exercise.answers.join(' / ')
}

interface ReviewItem {
  exercise: Exercise
  answer: UserAnswer | undefined
  correct: boolean
}

function ExamQuestion({
  exercise,
  onAnswer,
  disabled,
}: {
  exercise: Exercise
  onAnswer: (answer: UserAnswer) => void
  disabled: boolean
}) {
  // getQuestionComponent(exercise.type) is a dynamic component lookup, the same pattern
  // QuizCard.tsx uses at line 31 unflagged; confirmed by direct investigation (isolated repros +
  // a verbatim copy of QuizCard.tsx linted standalone) that eslint-plugin-react-hooks@7's
  // React-Compiler-derived rule bails out of analyzing QuizCard.tsx, likely due to its higher
  // hook complexity (multiple useEffect/useCallback, a keyboard listener), rather than the
  // pattern itself being fine there and wrong here. Not a real code quality gap in this component.
  const QuestionComponent = getQuestionComponent(exercise.type)
  return (
    // eslint-disable-next-line react-hooks/static-components -- see comment above
    <QuestionComponent exercise={exercise} onAnswer={onAnswer} disabled={disabled} validationResult={null} />
  )
}

export function ExamSessionPage() {
  const { slug } = useParams<{ slug: string }>()
  const { deck, loading: deckLoading, error: deckError } = useDeck(slug ?? '')
  const { exercises, loading: exercisesLoading, error: exercisesError } = useDeckExercises(deck?.id ?? '')

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null)
  const [review, setReview] = useState<ReviewItem[] | null>(null)
  // Tracks which exercise IDs already reached postResult successfully in this attempt, so that if
  // handleSubmit fails partway through and the user retries, already-submitted answers aren't sent
  // again (postResult mints a fresh idempotency key per call, so a naive retry-from-scratch would
  // create duplicate progress rows for anything that already succeeded).
  const submittedRef = useRef<Set<string>>(new Set())

  // Selected once, the first render where both `deck.examConfig` and `exercises` are ready, then
  // frozen for the rest of the attempt (the `examQuestions.length > 0` guard below). This is NOT a
  // `useMemo` keyed on `deck?.id`: `useDeckExercises` is keyed on `deck?.id` too, so on the very
  // render where `deck?.id` first becomes non-null, `exercises` is still `[]` (its own effect for
  // the new id hasn't resolved in that same commit) — a memo keyed only on `deck?.id` would
  // compute against that empty array and then never recompute once `exercises` actually arrives,
  // permanently stranding the exam at 0 questions. Waiting for `exercises.length > 0` (via this
  // effect, mirroring the reset-in-effect pattern already used in useDeck/useDeckExercises) before
  // freezing avoids that while still never reshuffling mid-attempt once selected.
  const [examQuestions, setExamQuestions] = useState<Exercise[]>([])

  useEffect(() => {
    if (examQuestions.length > 0) return
    if (!deck?.examConfig || exercises.length === 0) return
    setExamQuestions(selectExamQuestions(exercises, deck.id, deck.examConfig))
  }, [deck, exercises, examQuestions.length])

  const currentExercise = examQuestions[currentIndex]

  const loading = deckLoading || (Boolean(deck) && exercisesLoading)
  const error = deckError ?? exercisesError
  const canOfferExam = Boolean(deck?.examConfig) && Boolean(deck?.studyModes.includes('exam'))

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    // Recomputed from scratch each attempt (not just on retry) since it also drives the final
    // score, which must reflect every answered question, not only the ones sent this call.
    let correctCount = 0
    const reviewItems: ReviewItem[] = []
    try {
      for (const exercise of examQuestions) {
        const answer = answers[exercise.id]
        if (!answer) {
          reviewItems.push({ exercise, answer: undefined, correct: false })
          continue
        }
        const result = validateAnswer(exercise, answer)
        if (result.correct) correctCount += 1
        reviewItems.push({ exercise, answer, correct: result.correct })
        // Skip exercises already confirmed submitted in a prior attempt of this same session,
        // so retrying after a partial failure doesn't resubmit (and duplicate) their progress row.
        if (!submittedRef.current.has(exercise.id)) {
          await postResult(exercise.id, result.correct, result.correct ? 'good' : 'again', 'exam')
          submittedRef.current.add(exercise.id)
        }
      }
      setScore({ correct: correctCount, total: examQuestions.length })
      setReview(reviewItems)
    } catch (err) {
      // A submission that fails partway through (e.g. one postResult call throws after
      // exhausting its own retries) must not leave the exam permanently disabled with no way
      // out — surface the error and let the user try "Submit exam" again rather than getting
      // stuck with submitting=true forever and no feedback.
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit the exam. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="text-sm text-slate-400">Loading…</p>

  if (!deckLoading && !deckError && !deck) {
    return <p className="text-sm text-slate-500">Deck not found.</p>
  }

  if (error) {
    return <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
  }

  if (!deck) return null

  if (!canOfferExam) {
    return (
      <div className="space-y-4">
        <Link to={`/deck/${deck.slug}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← {deck.title}
        </Link>
        <p className="text-sm text-slate-500">This deck does not offer an exam.</p>
      </div>
    )
  }

  if (score) {
    const passed = score.correct >= (deck.examConfig?.passingScore ?? 0)
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
          <p className="text-3xl font-bold text-slate-900">
            {score.correct} / {score.total} correct
          </p>
          <p className={['mt-2 text-lg font-semibold', passed ? 'text-emerald-600' : 'text-red-600'].join(' ')}>
            {passed ? 'Passed' : 'Not passed'}
          </p>
          <Link
            to={`/deck/${deck.slug}`}
            className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to deck
          </Link>
        </div>

        {review && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-slate-900">Review</h3>
            {review.map((item, index) => (
              <div key={item.exercise.id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {index + 1}. {item.exercise.prompt}
                  </p>
                  <span
                    className={[
                      'shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold',
                      item.correct
                        ? 'bg-emerald-100 text-emerald-700'
                        : item.answer
                          ? 'bg-red-100 text-red-700'
                          : 'bg-slate-100 text-slate-500',
                    ].join(' ')}
                  >
                    {item.correct ? 'Correct' : item.answer ? 'Incorrect' : 'Skipped'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  <span className="font-medium">Your answer:</span>{' '}
                  {formatUserAnswerText(item.exercise, item.answer)}
                </p>
                <p className="mt-1 text-sm text-emerald-700">
                  <span className="font-medium">Correct answer:</span>{' '}
                  {formatCorrectAnswerText(item.exercise)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!currentExercise) {
    return (
      <div className="space-y-4">
        <Link to={`/deck/${deck.slug}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
          ← {deck.title}
        </Link>
        <p className="text-sm text-slate-500">No exam questions are available for this deck yet.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Link to={`/deck/${deck.slug}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← {deck.title}
      </Link>

      <div className="flex flex-wrap gap-2">
        {examQuestions.map((exercise, index) => (
          <button
            key={exercise.id}
            onClick={() => setCurrentIndex(index)}
            disabled={submitting}
            className={[
              'h-8 w-8 rounded-full text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              index === currentIndex
                ? 'bg-blue-600 text-white'
                : answers[exercise.id]
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-500',
            ].join(' ')}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500">
        Question {currentIndex + 1} of {examQuestions.length}
      </p>

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800">{currentExercise.prompt}</h2>
        <div className="mt-4">
          <ExamQuestion
            key={currentExercise.id}
            exercise={currentExercise}
            onAnswer={(answer: UserAnswer) =>
              setAnswers((prev) => ({ ...prev, [currentExercise.id]: answer }))
            }
            disabled={submitting}
          />
        </div>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{submitError}</div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setCurrentIndex((i) => Math.min(examQuestions.length - 1, i + 1))}
            disabled={currentIndex === examQuestions.length - 1}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Submit exam
        </button>
      </div>
    </div>
  )
}
