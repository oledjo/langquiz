import { useState } from 'react'

export interface CompositionSlice {
  key: string
  label: string
  value: number
  color: string
}

interface Props {
  slices: CompositionSlice[]
  total: number
  centerLabel?: string
}

interface Arc extends CompositionSlice {
  length: number
  renderedLength: number
  offset: number
  pct: number
}

const SIZE = 200
const CENTER = SIZE / 2
const RADIUS = 76
const STROKE_WIDTH = 32
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const GAP_PX = 3

export function DeckCompositionPieChart({ slices, total, centerLabel = 'questions' }: Props) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null)

  const visibleSlices = slices.filter((slice) => slice.value > 0)

  if (total === 0 || visibleSlices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-6 text-center">
        <p className="text-sm text-slate-500">No questions in this deck yet.</p>
      </div>
    )
  }

  const arcs = visibleSlices.reduce<Arc[]>((acc, slice) => {
    const previous = acc[acc.length - 1]
    const offset = previous ? previous.offset + previous.length : 0
    const length = (slice.value / total) * CIRCUMFERENCE
    const renderedLength = Math.max(length - GAP_PX, 0)
    return [...acc, { ...slice, length, renderedLength, offset, pct: Math.round((slice.value / total) * 100) }]
  }, [])

  const hoveredArc = arcs.find((arc) => arc.key === hovered) ?? null

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:justify-center">
      <div
        className="relative shrink-0"
        style={{ width: SIZE, height: SIZE }}
        onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => {
          setHovered(null)
          setTooltipPos(null)
        }}
      >
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label={`Deck composition: ${arcs.map((a) => `${a.label} ${a.value}`).join(', ')}`}
        >
          <g transform={`rotate(-90 ${CENTER} ${CENTER})`}>
            <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="#e1e0d9" strokeWidth={STROKE_WIDTH} />
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={`${arc.renderedLength} ${CIRCUMFERENCE - arc.renderedLength}`}
                strokeDashoffset={-arc.offset}
                opacity={hovered && hovered !== arc.key ? 0.45 : 1}
                style={{ cursor: 'pointer', transition: 'opacity 120ms ease' }}
                onMouseEnter={() => setHovered(arc.key)}
              />
            ))}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-slate-900">{hoveredArc ? hoveredArc.value : total}</p>
          <p className="text-xs text-slate-500">{hoveredArc ? hoveredArc.label : centerLabel}</p>
        </div>
        {hoveredArc && tooltipPos && (
          <div
            className="pointer-events-none fixed z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
            style={{ left: tooltipPos.x, top: tooltipPos.y - 10 }}
          >
            <p className="font-semibold text-slate-900">{hoveredArc.label}</p>
            <p className="text-slate-500">
              {hoveredArc.value} of {total} · {hoveredArc.pct}%
            </p>
          </div>
        )}
      </div>

      <dl className="w-full max-w-xs space-y-2">
        {arcs.map((arc) => (
          <div
            key={arc.key}
            className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors"
            style={{ backgroundColor: hovered === arc.key ? '#f4f4f2' : 'transparent' }}
            onMouseEnter={() => setHovered(arc.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <dt className="flex min-w-0 items-center gap-2 text-sm text-slate-700">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: arc.color }} />
              <span className="truncate">{arc.label}</span>
            </dt>
            <dd className="shrink-0 text-sm text-slate-500">
              <span className="font-semibold text-slate-800">{arc.value}</span> ({arc.pct}%)
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
