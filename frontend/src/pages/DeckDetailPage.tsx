import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDeck } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useStats } from '../hooks/useProgress'
import { formatTopicLabel, getStatusBadge, getTopicInsight } from '../lib/topicInsights'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

export function DeckDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { deck, loading, error } = useDeck(slug ?? '')
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
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{deck.origin}</p>
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
                  return (
                    <button
                      key={topic}
                      type="button"
                      onClick={() => toggleTopic(topic)}
                      className={[
                        'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                        focusRingClass,
                        isSelected
                          ? 'border-blue-300 bg-blue-50/70 text-slate-800'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-blue-200',
                      ].join(' ')}
                    >
                      <span className="truncate font-medium">{formatTopicLabel(topic)}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
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
        </div>
      )}
    </section>
  )
}
