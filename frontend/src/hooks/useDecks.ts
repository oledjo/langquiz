import { useEffect, useState } from 'react'
import { fetchDeckBySlug, fetchDecks } from '../api/decksApi'
import type { Deck } from '../types/deck'

export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // No setLoading(true)/setError(null) reset here: this effect has no
    // dependencies, so it only ever runs once on mount, and loading/error
    // already start at their correct initial values (true/null) above.
    let cancelled = false

    fetchDecks()
      .then((result) => {
        if (cancelled) return
        setDecks(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load decks.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return { decks, loading, error }
}

export function useDeck(slug: string) {
  const [deck, setDeck] = useState<Deck | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // Unlike useDecks above, this effect re-runs whenever `slug` changes (e.g.
    // navigating from /deck/a to /deck/b), so loading/error genuinely need to
    // reset for each new fetch rather than just once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset for a new slug, not a synchronous derivation
    setLoading(true)
    setError(null)

    fetchDeckBySlug(slug)
      .then((result) => {
        if (cancelled) return
        setDeck(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load deck.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  return { deck, loading, error }
}
