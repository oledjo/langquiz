import { useEffect, useState } from 'react'
import { fetchReviewSettings, updateReviewSettings } from '../api/reviewSettingsApi'

const DEFAULT_MIN = 0.5
const DEFAULT_MAX = 2.0
const STEP = 0.1

function describeFrequency(multiplier: number): string {
  if (multiplier < 0.95) return 'Questions repeat more often than the default schedule.'
  if (multiplier > 1.05) return 'Questions repeat less often than the default schedule.'
  return 'Questions repeat on the default schedule.'
}

export function ReviewSettingsCard() {
  const [multiplier, setMultiplier] = useState(1)
  const [bounds, setBounds] = useState({ min: DEFAULT_MIN, max: DEFAULT_MAX })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchReviewSettings()
      .then((settings) => {
        if (cancelled) return
        setMultiplier(settings.interval_multiplier)
        setBounds({ min: settings.min_interval_multiplier, max: settings.max_interval_multiplier })
      })
      .catch(() => {
        if (!cancelled) setError('Could not load review settings.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleChange = async (nextValue: number) => {
    setMultiplier(nextValue)
    setSaved(false)
    setError(null)
    setSaving(true)
    try {
      await updateReviewSettings(nextValue)
      setSaved(true)
    } catch {
      setError('Could not save review settings.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Review frequency</h3>
      <p className="mt-1 text-sm text-slate-500">
        Control how often previously-answered questions come back up for review.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>More often</span>
            <span>Less often</span>
          </div>
          <input
            type="range"
            min={bounds.min}
            max={bounds.max}
            step={STEP}
            value={multiplier}
            disabled={saving}
            onChange={(e) => handleChange(Number(e.target.value))}
            className="w-full accent-blue-600"
            aria-label="Review interval multiplier"
          />
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">{describeFrequency(multiplier)}</p>
            <p className="text-sm font-semibold text-slate-900">{multiplier.toFixed(1)}x</p>
          </div>
          {saving && <p className="text-xs text-slate-400">Saving…</p>}
          {!saving && saved && <p className="text-xs text-green-600">Saved.</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}
