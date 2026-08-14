import type { Exercise } from '../types/exercise'
import type { ExerciseStats } from '../api/progressApi'

export type TopicStatus = 'new' | 'review' | 'strong'

export interface TopicInsight {
  totalExercises: number
  attempted: number
  correct: number
  accuracyPct: number | null
  status: TopicStatus
}

export function getTopicInsight(
  topicExercises: Exercise[],
  statsByExerciseId: Map<string, ExerciseStats>
): TopicInsight {
  const aggregate = topicExercises.reduce(
    (acc, exercise) => {
      const stat = statsByExerciseId.get(exercise.id)
      if (!stat) return acc
      acc.attempted += stat.total_attempts
      acc.correct += stat.correct_attempts
      return acc
    },
    { attempted: 0, correct: 0 }
  )

  const accuracyPct =
    aggregate.attempted > 0 ? Math.round((aggregate.correct / aggregate.attempted) * 100) : null

  let status: TopicStatus = 'new'
  if (aggregate.attempted === 0) status = 'new'
  else if ((accuracyPct ?? 0) < 70) status = 'review'
  else status = 'strong'

  return {
    totalExercises: topicExercises.length,
    attempted: aggregate.attempted,
    correct: aggregate.correct,
    accuracyPct,
    status,
  }
}

export function getStatusBadge(status: TopicStatus): { label: string; className: string } {
  if (status === 'strong') {
    return { label: 'Strong', className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' }
  }
  if (status === 'review') {
    return { label: 'Needs review', className: 'bg-amber-100 text-amber-800 border border-amber-200' }
  }
  return { label: 'New', className: 'bg-slate-100 text-slate-700 border border-slate-200' }
}

export function formatTopicLabel(topic: string): string {
  return topic
    .split(' ')
    .map((word) => {
      if (!word) return word
      const [first, ...rest] = word
      return `${first.toLocaleUpperCase()}${rest.join('').toLocaleLowerCase()}`
    })
    .join(' ')
}
