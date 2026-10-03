import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { setDeckLearningPaused, setTopicLearningPaused } from '../api/decksApi'
import { useStudyToday } from '../hooks/useStudyToday'
import { selectNewExercises } from '../lib/newExercises'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useStats } from '../hooks/useProgress'
import { formatTopicLabel, getStatusBadge, getTopicInsight } from '../lib/topicInsights'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

export function DeckDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { deck, loading, error, setDeck } = useDeck(slug ?? '')
  const { user, isGuest } = useAuth()
  const canPauseLearning = Boolean(user && !isGuest)
  const [pauseSaving, setPauseSaving] = useState(false)
  const [pauseError, setPauseError] = useState<string | null>(null)
  const { today } = useStudyToday()
  const isOwner = Boolean(deck && user && !isGuest && deck.ownerId === String(user.id))
  const { exercises: deckExercises } = useDeckExercises(deck?.id ?? '')
  const { stats } = useStats(deck?.id)
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])
  const topics = useMemo(
    () => [...new Set(deckExercises.map((exercise) => exercise.topic))].sort(),
    [deckExercises]
  )

  const topicInsights = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getTopicInsight>>()
    topics.forEach((topic) => {
      const topicExercises = deckExercises.filter((exercise) => exercise.topic === topic)
      map.set(topic, getTopicInsight(topicExercises, statsByExerciseId))
    })
    return map
  }, [deckExercises, statsByExerciseId, topics])

  const pausedTopics = useMemo(() => new Set(deck?.pausedTopics ?? []), [deck])
  const untriedCount = useMemo(
    () => (deck ? selectNewExercises(deck, deckExercises, statsByExerciseId, Number.POSITIVE_INFINITY).length : 0),
    [deck, deckExercises, statsByExerciseId]
  )
  const newToday = Math.min(untriedCount, today?.newRemaining ?? untriedCount)

  const toggleTopicPaused = async (topic: string) => {
    if (!deck) return
    const paused = !pausedTopics.has(topic)
    setPauseSaving(true)
    setPauseError(null)
    try {
      await setTopicLearningPaused(deck.id, topic, paused)
      const next = paused ? [...pausedTopics, topic].sort() : [...pausedTopics].filter((t) => t !== topic)
      setDeck({ ...deck, pausedTopics: next })
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to update the topic.')
    } finally {
      setPauseSaving(false)
    }
  }

  const toggleLearningPaused = async () => {
    if (!deck) return
    const paused = !deck.learningPaused
    if (
      paused &&
      !window.confirm(
        'Stop learning this deck? Its questions will no longer come up for review. Your statistics are kept, and you can resume at any time.'
      )
    ) {
      return
    }
    setPauseSaving(true)
    setPauseError(null)
    try {
      await setDeckLearningPaused(deck.id, paused)
      setDeck({ ...deck, learningPaused: paused })
    } catch (err) {
      setPauseError(err instanceof Error ? err.message : 'Failed to update the deck.')
    } finally {
      setPauseSaving(false)
    }
  }

  const toggleTopic = (topic: string) => {
    setSelectedTopics((prev) => {
      const exists = prev.includes(topic)
      const next = exists ? prev.filter((t) => t !== topic) : [...prev, topic]
      return next.length === topics.length ? [] : next
    })
  }

  return (
    <section className="space-y-4">
      <Link to="/" className="text-sm font-semibold text-blue-700 hover:text-blue-800">
        ← All decks
      </Link>

      {loading && <p className="text-sm text-slate-400">Loading deck…</p>}

      {!loading && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      {!loading && !error && !deck && <p className="text-sm text-slate-500">Deck not found.</p>}

      {!loading && !error && deck && (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
            {isOwner && (
              <Link
                to={`/deck/${deck.slug}/edit`}
                className={['rounded-lg px-3 py-1 text-sm font-semibold text-blue-700 ring-1 ring-blue-200 hover:bg-blue-50', focusRingClass].join(' ')}
              >
                Edit deck
              </Link>
            )}
          </div>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{deck.title}</h2>
          {deck.description && <p className="mt-2 text-sm text-slate-600">{deck.description}</p>}

          {deck.facetDefinitions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {deck.facetDefinitions.map((facet) => (
                <span
                  key={facet.key}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                >
                  {facet.label}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Modes: {deck.studyModes.join(', ')} · Languages: {deck.locales.join(', ') || '—'}
          </p>

          {deck.learningPaused && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Learning paused</p>
              <p className="mt-1">
                Questions from this deck are not scheduled for review. Your statistics are kept — resume to bring
                them back into your reviews.
              </p>
            </div>
          )}

          {deck.studyModes.includes('practice') && topics.length > 1 && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">Focus on specific topics (optional)</h3>
              <p className="mt-1 text-xs text-slate-500">
                {selectedTopics.length === 0 ? 'All topics selected.' : `${selectedTopics.length} topic(s) selected.`}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {topics.map((topic) => {
                  const isSelected = selectedTopics.length === 0 || selectedTopics.includes(topic)
                  const insight = topicInsights.get(topic)
                  if (!insight) return null
                  const badge = getStatusBadge(insight.status)
                  const topicPaused = pausedTopics.has(topic)
                  return (
                    <div key={topic} className="flex items-stretch gap-1">
                      <button
                        type="button"
                        onClick={() => toggleTopic(topic)}
                        className={[
                          'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          focusRingClass,
                          isSelected
                            ? 'border-blue-300 bg-blue-50/70 text-slate-800'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200',
                        ].join(' ')}
                      >
                        <span className="truncate font-medium">{formatTopicLabel(topic)}</span>
                        {topicPaused ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Paused
                          </span>
                        ) : (
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                            {badge.label}
                          </span>
                        )}
                      </button>
                      {canPauseLearning && !deck.learningPaused && (
                        <button
                          type="button"
                          onClick={() => void toggleTopicPaused(topic)}
                          disabled={pauseSaving}
                          aria-label={`${topicPaused ? 'Resume' : 'Stop'} learning ${formatTopicLabel(topic)}`}
                          title={topicPaused ? 'Resume learning this topic' : 'Stop learning this topic'}
                          className={[
                            'shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60',
                            focusRingClass,
                          ].join(' ')}
                        >
                          {topicPaused ? '▶' : '⏸'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            {canPauseLearning && !deck.learningPaused && newToday > 0 && (
              <Link
                to={`/deck/${deck.slug}/new`}
                className={[
                  'block w-full rounded-xl bg-emerald-600 px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-emerald-700 sm:inline-block sm:w-auto',
                  focusRingClass,
                ].join(' ')}
              >
                Learn {newToday} new
              </Link>
            )}
            {deck.studyModes.includes('practice') && (
              <Link
                to={`/deck/${deck.slug}/study`}
                state={selectedTopics.length > 0 ? { topics: selectedTopics } : undefined}
                className={[
                  'block w-full rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors sm:inline-block sm:w-auto',
                  focusRingClass,
                  'bg-blue-600 text-white hover:bg-blue-700',
                ].join(' ')}
              >
                Start practicing
              </Link>
            )}
            {deck.studyModes.includes('exam') && (
              <Link
                to={`/deck/${deck.slug}/exam`}
                className={[
                  'block w-full rounded-xl border-2 border-blue-600 px-5 py-3 text-center text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 sm:inline-block sm:w-auto',
                  focusRingClass,
                ].join(' ')}
              >
                Start exam
              </Link>
            )}
          </div>

          {canPauseLearning && !deck.learningPaused && untriedCount > 0 && newToday === 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Today's new-question limit is reached — {untriedCount} new question(s) wait for tomorrow.
            </p>
          )}

          {canPauseLearning && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => void toggleLearningPaused()}
                disabled={pauseSaving}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 transition-colors disabled:opacity-60',
                  focusRingClass,
                  deck.learningPaused
                    ? 'text-blue-700 ring-blue-200 hover:bg-blue-50'
                    : 'text-slate-600 ring-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {deck.learningPaused ? 'Resume learning' : 'Stop learning'}
              </button>
              {!deck.learningPaused && (
                <p className="mt-2 text-xs text-slate-400">
                  Removes this deck's questions from your reviews. Statistics are kept.
                </p>
              )}
              {pauseError && <p className="mt-2 text-xs text-red-600">{pauseError}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
