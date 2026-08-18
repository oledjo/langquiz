import { useMemo } from 'react'
import { useStatistics, useStats } from '../hooks/useProgress'
import type { Exercise } from '../types/exercise'
import { DeckCompositionPieChart, type CompositionSlice } from './DeckCompositionPieChart'

interface Props {
  exercises?: Exercise[]
  deckId?: string
}

export function QuestionBreakdown({ exercises = [], deckId }: Props) {
  const { stats, loading: statsLoading } = useStats(deckId)
  const { statistics, loading: statisticsLoading } = useStatistics(deckId)

  const byId = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises])

  const practiceResult = useMemo(() => {
    const totalQuestions = exercises.length
    let mastered = 0
    let struggling = 0
    let mixed = 0
    let tried = 0
    stats.forEach((row) => {
      if (!byId.has(row.exercise_id)) return
      tried += 1
      if (row.correct_attempts <= 0) struggling += 1
      else if (row.correct_attempts >= row.total_attempts) mastered += 1
      else mixed += 1
    })
    const notTried = Math.max(totalQuestions - tried, 0)
    return { totalQuestions, notTried, mastered, mixed, struggling }
  }, [byId, exercises.length, stats])

  const practiceResultSlices: CompositionSlice[] = [
    { key: 'not-tried', label: 'Not tried yet', value: practiceResult.notTried, color: '#c3c2b7' },
    { key: 'mastered', label: 'Always correct', value: practiceResult.mastered, color: '#0ca30c' },
    { key: 'mixed', label: 'Mixed results', value: practiceResult.mixed, color: '#fab219' },
    { key: 'struggling', label: 'Always missed', value: practiceResult.struggling, color: '#d03b3b' },
  ]

  const reviewState = statistics?.cardCounts ?? { new: 0, young: 0, mature: 0 }
  const reviewStateTotal = reviewState.new + reviewState.young + reviewState.mature
  const reviewStateSlices: CompositionSlice[] = [
    { key: 'new', label: 'New', value: reviewState.new, color: '#3b82f6' },
    { key: 'young', label: 'Young', value: reviewState.young, color: '#f59e0b' },
    { key: 'mature', label: 'Mature', value: reviewState.mature, color: '#16a34a' },
  ]

  if (statsLoading) {
    return <div className="py-8 text-center text-gray-400">Loading question breakdown...</div>
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Question breakdown</h3>
      <p className="mt-1 text-sm text-slate-500">How the deck's questions split, by practice result and by review state.</p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">By practice result</p>
          <DeckCompositionPieChart slices={practiceResultSlices} total={practiceResult.totalQuestions} centerLabel="questions" />
        </div>
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">By review state</p>
          {statisticsLoading ? (
            <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
          ) : (
            <DeckCompositionPieChart slices={reviewStateSlices} total={reviewStateTotal} centerLabel="cards" />
          )}
        </div>
      </div>
    </div>
  )
}
