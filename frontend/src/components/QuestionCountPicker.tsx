import { useState } from 'react'

interface Props {
  totalAvailable: number
  onConfirm: (count: number) => void
  // These three are optional and only meaningful together — omit all of them to render the
  // picker without the "untried only" toggle (e.g. contexts with no attempt history to filter by).
  untriedOnly?: boolean
  onUntriedOnlyChange?: (value: boolean) => void
  untriedCount?: number
}

const PRESET_FRACTIONS = [10, 25, 50]

export function QuestionCountPicker({ totalAvailable, onConfirm, untriedOnly, onUntriedOnlyChange, untriedCount }: Props) {
  const presets = Array.from(new Set([...PRESET_FRACTIONS.filter((n) => n < totalAvailable), totalAvailable])).filter(
    (n) => n > 0
  )
  const [customValue, setCustomValue] = useState('')
  const showUntriedToggle = onUntriedOnlyChange !== undefined && untriedCount !== undefined

  const handleCustomSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = Number(customValue)
    if (!Number.isInteger(parsed) || parsed < 1) return
    onConfirm(Math.min(parsed, totalAvailable))
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800">How many questions?</h2>
      <p className="mt-1 text-sm text-slate-500">{totalAvailable} available in this deck.</p>

      {showUntriedToggle && (
        <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={untriedOnly ?? false}
            disabled={untriedCount === 0 && !untriedOnly}
            onChange={(event) => onUntriedOnlyChange?.(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          />
          Only questions I haven't tried yet ({untriedCount} available)
        </label>
      )}

      {totalAvailable === 0 ? (
        <p className="mt-4 text-sm text-slate-500">No questions match this filter.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {presets.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => onConfirm(count)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50"
              >
                {count === totalAvailable ? `All (${count})` : count}
              </button>
            ))}
          </div>

          <form onSubmit={handleCustomSubmit} noValidate className="mt-4 flex items-center gap-2">
            <label htmlFor="custom-question-count" className="text-sm text-slate-500">
              Or a custom number:
            </label>
            <input
              id="custom-question-count"
              type="number"
              min={1}
              max={totalAvailable}
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              className="w-20 rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={!customValue}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start
            </button>
          </form>
        </>
      )}
    </div>
  )
}
