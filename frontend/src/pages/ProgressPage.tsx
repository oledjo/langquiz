import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProgressDashboard } from '../components/ProgressDashboard'
import { StudyStatistics } from '../components/StudyStatistics'
import { useDecks } from '../hooks/useDecks'
import { useDeckExercises } from '../hooks/useDeckExercises'
import { useExercises } from '../hooks/useExercises'
import type { Exercise } from '../types/exercise'

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

export function ProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { decks } = useDecks()

  const selectedSlug = searchParams.get('deck')
  const selectedDeck = useMemo(
    () => (selectedSlug ? (decks.find((deck) => deck.slug === selectedSlug) ?? null) : null),
    [decks, selectedSlug]
  )
  const deckId = selectedDeck?.id

  // Global exercises (used for "All decks") already carries its own loading/guest-aware
  // behavior via useExercises — always called (not conditionally) since hooks can't be called
  // conditionally, and its cost when unused (a deck is selected) is one extra fetch this page
  // already causes today for the unscoped case anyway.
  const { exercises: allExercises } = useExercises()
  const { exercises: deckExercises } = useDeckExercises(deckId ?? '')
  const exercises: Exercise[] = deckId ? deckExercises : allExercises

  const selectDeck = (slug: string | null) => {
    if (slug) {
      setSearchParams({ deck: slug })
    } else {
      setSearchParams({})
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Progress</h2>
        <p className="mt-1 text-sm text-slate-500">See how you're doing, across all decks or just one.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={!selectedDeck}
          onClick={() => selectDeck(null)}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
            focusRingClass,
            !selectedDeck
              ? 'bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
          ].join(' ')}
        >
          All decks
        </button>
        {decks.map((deck) => (
          <button
            key={deck.id}
            type="button"
            aria-pressed={selectedDeck?.id === deck.id}
            onClick={() => selectDeck(deck.slug)}
            className={[
              'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
              focusRingClass,
              selectedDeck?.id === deck.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
            ].join(' ')}
          >
            {deck.title}
          </button>
        ))}
      </div>

      <ProgressDashboard exercises={exercises} deckId={deckId} />

      <StudyStatistics deckId={deckId} />
    </section>
  )
}
