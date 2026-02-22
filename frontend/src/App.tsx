import { useEffect, useMemo, useState } from 'react'
import { getExercisesFiltered } from './registry/exerciseRegistry'
import { QuizSession } from './components/QuizSession'
import { ProgressDashboard } from './components/ProgressDashboard'
import type { Filters } from './components/TopicFilter'
import type { Exercise } from './types/exercise'
import { useStats } from './hooks/useProgress'
import { useUserExercises } from './hooks/useUserExercises'
import { useExercises } from './hooks/useExercises'
import type { ExerciseStats } from './api/progressApi'
import { LangQuizLogo } from './components/LangQuizLogo'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { AuthPage } from './auth/AuthPage'

type View = 'home' | 'quiz' | 'dashboard'

type TopicStatus = 'new' | 'review' | 'strong'

interface TopicInsight {
  totalExercises: number
  attempted: number
  correct: number
  accuracyPct: number | null
  status: TopicStatus
}

const SESSION_PRESETS = [
  { label: 'Quick', questions: 5, minutes: 5 },
  { label: 'Focused', questions: 10, minutes: 12 },
  { label: 'Deep', questions: 15, minutes: 20 },
  { label: 'Intense', questions: 20, minutes: 30 },
] as const

const focusRingClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2'

const LLM_EXERCISE_PROMPT_SAMPLE = `Generate 12 German learning exercises as strict JSON for LangQuiz.

Return ONLY valid JSON, no markdown and no explanation.
Use this exact structure:
{
  "exercises": [
    {
      "type": "selection",
      "topic": "adjective declension",
      "subtopic": "weak-declension",
      "language": "de",
      "difficulty": 3,
      "prompt": "Choose the correct adjective ending.",
      "context": "Der alt___ Mann schläft.",
      "options": ["-e", "-en", "-er", "-es"],
      "answer": 0,
      "explanation": "After definite article der, nominative masculine takes -e.",
      "tags": ["adjectives", "weak-declension", "nominative", "masculine"]
    }
  ]
}

Allowed "type" values:
- "selection" requires "options" (string[]) and "answer" (number)
- "free-type" requires "answers" (string[]) and optional "caseSensitive" (boolean)
- "multiselect" requires "options" (string[]) and "answers" (number[])

Rules:
- difficulty must be integer 1..5
- Keep language = "de"
- Include explanation for each item
- Ensure answer indexes are valid for options
- Mix types: 5 selection, 4 free-type, 3 multiselect
- Do NOT include "id" field (LangQuiz auto-generates IDs on import)`

function selectWeightedExercises(
  pool: Exercise[],
  count: number,
  statsByExerciseId: Map<string, ExerciseStats>
): Exercise[] {
  const remaining = [...pool]
  const chosen: Exercise[] = []

  while (chosen.length < count && remaining.length > 0) {
    const weights = remaining.map((exercise) => {
      const stat = statsByExerciseId.get(exercise.id)
      if (!stat) return 1
      const failed = Math.max(0, stat.total_attempts - stat.correct_attempts)
      const failRate = stat.total_attempts > 0 ? failed / stat.total_attempts : 0
      return 1 + failed * 3 + failRate * 2
    })

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let target = Math.random() * totalWeight
    let selectedIndex = 0

    for (let i = 0; i < weights.length; i += 1) {
      target -= weights[i]
      if (target <= 0) {
        selectedIndex = i
        break
      }
    }

    chosen.push(remaining[selectedIndex])
    remaining.splice(selectedIndex, 1)
  }

  return chosen
}

function formatTopicLabel(topic: string): string {
  return topic
    .split(' ')
    .map((word) => {
      if (!word) return word
      const [first, ...rest] = word
      return `${first.toLocaleUpperCase()}${rest.join('').toLocaleLowerCase()}`
    })
    .join(' ')
}

function formatTimestamp(date: Date | null): string {
  if (!date) return 'No recent import'
  return `Updated ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function getTopicInsight(topicExercises: Exercise[], statsByExerciseId: Map<string, ExerciseStats>): TopicInsight {
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

function getStatusBadge(status: TopicStatus): { label: string; className: string } {
  if (status === 'strong') {
    return {
      label: 'Strong',
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    }
  }
  if (status === 'review') {
    return {
      label: 'Needs review',
      className: 'bg-amber-100 text-amber-800 border border-amber-200',
    }
  }
  return {
    label: 'New',
    className: 'bg-slate-100 text-slate-700 border border-slate-200',
  }
}

function MainApp() {
  const { user, logout } = useAuth()
  const { userExercises, importExercises, deleteByTopic, clearAll, topicCounts } = useUserExercises()
  const { exercises: dbExercises, reload: reloadExercises } = useExercises()

  const [view, setView] = useState<View>('home')
  const [filters, setFilters] = useState<Filters>({ language: 'de', topic: '', difficulty: 0 })
  const [selectedTopicsForStart, setSelectedTopicsForStart] = useState<string[]>([])
  const [presetIndex, setPresetIndex] = useState(1)
  const [sessionExercises, setSessionExercises] = useState<Exercise[] | null>(null)
  const [sessionKey, setSessionKey] = useState(0)
  const [sessionInProgress, setSessionInProgress] = useState(false)
  const [sessionConfig, setSessionConfig] = useState<{ topicsKey: string; presetIndex: number } | null>(null)

  const [customJsonInput, setCustomJsonInput] = useState('')
  const [customImportMessage, setCustomImportMessage] = useState('')
  const [customImportUpdatedAt, setCustomImportUpdatedAt] = useState<Date | null>(null)
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false)

  const { stats } = useStats()

  useEffect(() => {
    if (!isCustomModalOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCustomModalOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isCustomModalOpen])

  const allExercises = useMemo(() => dbExercises, [dbExercises])

  const exercises = useMemo(
    () =>
      getExercisesFiltered(allExercises, {
        language: filters.language || undefined,
        topic: filters.topic || undefined,
        difficulty: filters.difficulty || undefined,
      }),
    [allExercises, filters]
  )

  const statsByExerciseId = useMemo(() => new Map(stats.map((s) => [s.exercise_id, s])), [stats])

  const languageExercises = useMemo(
    () => allExercises.filter((e) => (filters.language ? e.language === filters.language : true)),
    [allExercises, filters.language]
  )

  const topics = useMemo(
    () => [...new Set(languageExercises.map((exercise) => exercise.topic))].sort(),
    [languageExercises]
  )

  const topicInsights = useMemo(() => {
    const map = new Map<string, TopicInsight>()
    topics.forEach((topic) => {
      const topicExercises = languageExercises.filter((exercise) => exercise.topic === topic)
      map.set(topic, getTopicInsight(topicExercises, statsByExerciseId))
    })

    map.set('', getTopicInsight(languageExercises, statsByExerciseId))
    return map
  }, [languageExercises, statsByExerciseId, topics])

  const sessionPreset = SESSION_PRESETS[presetIndex]
  const selectedTopicsKey = [...selectedTopicsForStart].sort().join('|')
  const availableForSelectedTopics = languageExercises.filter((exercise) =>
    selectedTopicsForStart.length === 0 ? true : selectedTopicsForStart.includes(exercise.topic)
  )
  const plannedQuestionCount = Math.min(sessionPreset.questions, availableForSelectedTopics.length)
  const hasSessionPool = availableForSelectedTopics.length > 0

  const canContinueCurrentSession =
    !!sessionInProgress &&
    !!sessionConfig &&
    sessionConfig.topicsKey === selectedTopicsKey &&
    sessionConfig.presetIndex === presetIndex

  const startCtaLabel = canContinueCurrentSession
    ? 'Continue session'
    : `Start ${Math.max(plannedQuestionCount, 1)}-question session`

  const setImportStatus = (message: string) => {
    setCustomImportMessage(message)
    setCustomImportUpdatedAt(new Date())
  }

  const startOrContinueSession = () => {
    if (canContinueCurrentSession) {
      setView('quiz')
      return
    }

    if (!hasSessionPool) return

    const selected = selectWeightedExercises(
      availableForSelectedTopics,
      plannedQuestionCount,
      statsByExerciseId
    )

    setFilters((prev) => ({ ...prev, topic: '', difficulty: 0 }))
    setSessionExercises(selected)
    setSessionKey((k) => k + 1)
    setSessionConfig({ topicsKey: selectedTopicsKey, presetIndex })
    setSessionInProgress(true)
    setView('quiz')
  }

  const handleCustomFileSelect = async (file: File | null) => {
    if (!file) return
    const text = await file.text()
    setCustomJsonInput(text)
  }

  const handleImportCustomExercises = async () => {
    const result = await importExercises(customJsonInput)
    await reloadExercises()

    if (result.added === 0 && result.errors.length === 0) {
      setImportStatus('No exercises were added.')
      return
    }

    const firstErrors = result.errors.slice(0, 2).join(' ')
    const suffix = result.errors.length > 2 ? ` (+${result.errors.length - 2} more errors)` : ''
    setImportStatus(
      `Imported ${result.added}, skipped ${result.skipped}.${firstErrors ? ` ${firstErrors}${suffix}` : ''}`
    )
  }

  const handleClearCustomExercises = async () => {
    await clearAll()
    await reloadExercises()
    setImportStatus('Custom exercises removed.')
  }

  const handleDeleteImportedTopic = async (topic: string) => {
    const removed = await deleteByTopic(topic)
    await reloadExercises()
    if (removed === 0) {
      setImportStatus(`No imported exercises found for "${topic}".`)
      return
    }
    setSelectedTopicsForStart((prev) => prev.filter((t) => t !== topic))
    setImportStatus(`Removed ${removed} imported exercise(s) from "${topic}".`)
  }

  const copyPromptSample = async () => {
    try {
      await navigator.clipboard.writeText(LLM_EXERCISE_PROMPT_SAMPLE)
      setImportStatus('Prompt sample copied to clipboard.')
    } catch {
      setImportStatus('Could not copy prompt sample. Copy it manually from the modal.')
    }
  }

  const shouldMountQuiz = view === 'quiz' || sessionInProgress

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <LangQuizLogo />
            <h1 className="text-xl font-bold text-blue-700">LangQuiz</h1>
          </div>

          <nav className="grid w-full grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:w-auto sm:min-w-[220px]">
            {(['home', 'dashboard'] as const).map((tab) => {
              const isActive = view === tab
              const label = tab === 'home' ? 'Home' : 'Progress'
              return (
                <button
                  key={tab}
                  onClick={() => setView(tab)}
                  className={[
                    'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
                    focusRingClass,
                    isActive
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-slate-500 hover:bg-slate-200 hover:text-slate-700',
                  ].join(' ')}
                >
                  {label}
                </button>
              )
            })}
          </nav>

          <div className="flex items-center gap-2 sm:ml-2">
            <span className="hidden text-xs text-slate-500 sm:block">{user?.email}</span>
            <button
              onClick={logout}
              className={[
                'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50',
                focusRingClass,
              ].join(' ')}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6 sm:py-6">
        {view === 'home' && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-900">Choose one or more topics</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Build a focused session in one step.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setIsCustomModalOpen(true)}
                    className={[
                      'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700',
                      focusRingClass,
                    ].join(' ')}
                  >
                    Import
                  </button>
                </div>
              </div>

              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Language</label>
                  <select
                    value={filters.language}
                    onChange={(e) => {
                      const nextLanguage = e.target.value
                      setFilters({ ...filters, language: nextLanguage, topic: '' })
                      setSelectedTopicsForStart([])
                    }}
                    className={[
                      'mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700',
                      'focus:border-blue-400 focus:outline-none',
                      focusRingClass,
                    ].join(' ')}
                  >
                    <option value="de">German (de)</option>
                    <option value="es">Spanish (es)</option>
                    <option value="">All languages</option>
                  </select>
                </div>
                <p className="text-xs text-slate-500">
                  Topics with low historical accuracy are marked as <span className="font-semibold text-amber-700">Needs review</span>.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {['', ...topics].map((topic) => {
                  const isSelected =
                    topic === '' ? selectedTopicsForStart.length === 0 : selectedTopicsForStart.includes(topic)
                  const insight = topicInsights.get(topic)
                  if (!insight) return null
                  const badge = getStatusBadge(insight.status)
                  const label = topic === '' ? 'All topics' : formatTopicLabel(topic)
                  const customCount = topic === '' ? userExercises.length : (topicCounts[topic] ?? 0)
                  const isCustomTopic = customCount > 0
                  const accuracyText =
                    insight.accuracyPct === null
                      ? 'No attempts yet'
                      : `${insight.accuracyPct}% correct · ${insight.attempted} attempts`

                  return (
                    <div key={topic || 'all'} className="space-y-2">
                      <button
                        onClick={() => {
                          if (topic === '') {
                            setSelectedTopicsForStart([])
                            return
                          }
                          setSelectedTopicsForStart((prev) => {
                            if (prev.length === 0) return [topic]
                            const exists = prev.includes(topic)
                            const next = exists ? prev.filter((t) => t !== topic) : [...prev, topic]
                            if (next.length === 0 || next.length === topics.length) return []
                            return next
                          })
                        }}
                        className={[
                          'w-full rounded-xl border p-4 text-left transition-colors',
                          focusRingClass,
                          isSelected
                            ? 'border-blue-400 bg-blue-50/70'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30',
                        ].join(' ')}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="text-lg font-semibold text-slate-800">{label}</h3>
                          <div className="flex items-center gap-1.5">
                            {isCustomTopic && (
                              <span className="rounded-full px-2 py-0.5 text-xs font-semibold border border-blue-200 bg-blue-100 text-blue-700">
                                Custom
                              </span>
                            )}
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
                              {badge.label}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-600">
                          {insight.totalExercises} exercises
                          {isCustomTopic && (
                            <span className="text-blue-700 font-medium"> · {customCount} imported</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{accuracyText}</p>
                      </button>
                      {topic !== '' && isCustomTopic && (
                        <button
                          onClick={() => handleDeleteImportedTopic(topic)}
                          className={[
                            'text-xs font-semibold rounded-lg border border-red-200 bg-red-50 text-red-700 px-2.5 py-1.5 hover:bg-red-100',
                            focusRingClass,
                          ].join(' ')}
                        >
                          Delete imported
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {selectedTopicsForStart.length === 0
                  ? 'All topics selected.'
                  : `${selectedTopicsForStart.length} topic(s) selected.`}
              </p>

              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <p className="text-slate-600">
                    Session size: <span className="font-semibold text-slate-900">{sessionPreset.label}</span>
                  </p>
                  <p className="font-semibold text-slate-900">
                    {plannedQuestionCount} questions • {sessionPreset.minutes} min
                  </p>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {SESSION_PRESETS.map((preset, i) => (
                    <button
                      key={preset.label}
                      onClick={() => setPresetIndex(i)}
                      className={[
                        'rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                        focusRingClass,
                        presetIndex === i
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-700 border border-slate-300 hover:border-blue-300 hover:text-blue-700',
                      ].join(' ')}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <input
                  type="range"
                  min={0}
                  max={SESSION_PRESETS.length - 1}
                  step={1}
                  value={presetIndex}
                  onChange={(e) => setPresetIndex(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />

                <div className="mt-1 grid grid-cols-4 text-[11px] font-medium text-slate-500">
                  {SESSION_PRESETS.map((preset) => (
                    <span key={preset.label} className="text-center">
                      {preset.label}
                    </span>
                  ))}
                </div>

                <p className="mt-3 text-xs text-slate-600">
                  Questions are randomly sampled and weighted toward exercises you previously missed.
                </p>

                <button
                  onClick={startOrContinueSession}
                  disabled={!hasSessionPool && !canContinueCurrentSession}
                  className={[
                    'mt-4 block w-full rounded-xl px-5 py-3 text-center text-sm font-semibold transition-colors sm:mx-auto sm:w-auto',
                    focusRingClass,
                    hasSessionPool || canContinueCurrentSession
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'cursor-not-allowed bg-slate-300 text-slate-600',
                  ].join(' ')}
                >
                  {startCtaLabel}
                </button>
              </div>
            </div>

          </section>
        )}

        {shouldMountQuiz && (
          <div className={view === 'quiz' ? 'block' : 'hidden'}>
            <QuizSession
              key={sessionKey}
              exercises={sessionExercises ?? exercises}
              onSessionEnd={() => setSessionInProgress(false)}
            />
          </div>
        )}

        {view === 'dashboard' && <ProgressDashboard exercises={allExercises} />}
      </main>

      {isCustomModalOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => setIsCustomModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Import custom exercises"
            className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-slate-800">Load your own exercises</h3>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className={[
                  'rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200',
                  focusRingClass,
                ].join(' ')}
              >
                Close
              </button>
            </div>

            <p className="mb-3 text-sm text-slate-600">
              Paste JSON array (or {'{ "exercises": [...] }'}) using the app exercise schema.
            </p>

            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  LLM Prompt Sample
                </p>
                <button
                  onClick={copyPromptSample}
                  className={[
                    'rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900',
                    focusRingClass,
                  ].join(' ')}
                >
                  Copy prompt
                </button>
              </div>
              <pre className="max-h-44 overflow-auto whitespace-pre-wrap text-xs text-slate-700">
                {LLM_EXERCISE_PROMPT_SAMPLE}
              </pre>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-600">
                Custom exercises loaded: <span className="font-semibold text-slate-800">{userExercises.length}</span>
              </p>
              <p className="text-xs text-slate-500">{formatTimestamp(customImportUpdatedAt)}</p>
            </div>
            {customImportMessage && (
              <p className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                {customImportMessage}
              </p>
            )}

            <textarea
              value={customJsonInput}
              onChange={(e) => setCustomJsonInput(e.target.value)}
              rows={8}
              placeholder='[{"type":"selection","topic":"my-topic","subtopic":"basics","language":"de","difficulty":2,"prompt":"...","options":["a","b"],"answer":0}]'
              className={[
                'mb-3 w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-700 focus:border-blue-400 focus:outline-none',
                focusRingClass,
              ].join(' ')}
            />

            <div className="flex flex-wrap gap-2">
              <label
                className={[
                  'cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50',
                  focusRingClass,
                ].join(' ')}
              >
                Upload JSON file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => handleCustomFileSelect(e.target.files?.[0] ?? null)}
                />
              </label>

              <button
                onClick={handleImportCustomExercises}
                disabled={!customJsonInput.trim()}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold',
                  focusRingClass,
                  customJsonInput.trim()
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'cursor-not-allowed bg-slate-300 text-slate-600',
                ].join(' ')}
              >
                Import exercises
              </button>

              <button
                onClick={handleClearCustomExercises}
                disabled={userExercises.length === 0}
                className={[
                  'rounded-lg px-4 py-2 text-sm font-semibold',
                  focusRingClass,
                  userExercises.length > 0
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400',
                ].join(' ')}
              >
                Clear custom
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AppShell() {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (!user) return <AuthPage />
  return <MainApp />
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
