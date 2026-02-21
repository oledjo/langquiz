interface Props {
  correct: boolean
  explanation?: string
}

export function ResultFeedback({ correct, explanation }: Props) {
  return (
    <div
      className={[
        'rounded-xl p-4 space-y-1 border-2',
        correct
          ? 'border-green-300 bg-green-50 text-green-800'
          : 'border-red-300 bg-red-50 text-red-800',
      ].join(' ')}
    >
      <p className="font-semibold text-lg">{correct ? 'Correct!' : 'Not quite.'}</p>
      {explanation && <p className="text-sm opacity-90">{explanation}</p>}
    </div>
  )
}
