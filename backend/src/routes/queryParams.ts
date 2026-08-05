export function parseDeckIdParam(value: unknown): number | null {
  if (typeof value !== 'string' || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
