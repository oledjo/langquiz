import { getAvailableTopics, getBuiltInExercises } from '../registry/exerciseRegistry'

export interface Filters {
  language: string
  topic: string
  difficulty: number
  level: string
  group: string
}

interface Props {
  filters: Filters
  onChange: (f: Filters) => void
}

export function TopicFilter({ filters, onChange }: Props) {
  const topics = getAvailableTopics(getBuiltInExercises(), filters.language || undefined)

  return (
    <div className="flex flex-wrap gap-3 text-sm">
      <select
        value={filters.language}
        onChange={(e) => onChange({ ...filters, language: e.target.value, topic: '' })}
        className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
      >
        <option value="de">German (de)</option>
        <option value="es">Spanish (es)</option>
        <option value="">All languages</option>
      </select>

      <select
        value={filters.topic}
        onChange={(e) => onChange({ ...filters, topic: e.target.value })}
        className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
      >
        <option value="">All topics</option>
        {topics.map((t) => (
          <option key={t} value={t}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </option>
        ))}
      </select>

      <select
        value={filters.difficulty}
        onChange={(e) => onChange({ ...filters, difficulty: Number(e.target.value) })}
        className="border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:border-blue-400"
      >
        <option value={0}>All difficulties</option>
        {[1, 2, 3, 4, 5].map((d) => (
          <option key={d} value={d}>
            {'★'.repeat(d)}{'☆'.repeat(5 - d)} (Level {d})
          </option>
        ))}
      </select>
    </div>
  )
}
