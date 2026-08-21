import { Router } from 'express'
import { db } from '../db/database'
import { optionalAuth } from '../auth/middleware'
import { mapDeckRow, type DeckRow } from '../decks/deckMapper'

export const decksRouter = Router()

// Official decks are readable without an account: a visitor has to be able to open a deck and
// answer a few questions before deciding to register. Community decks stay behind a token.
decksRouter.use(optionalAuth)

decksRouter.get('/', async (req, res) => {
  try {
    const result = req.userId
      ? await db.query<DeckRow>('SELECT * FROM decks ORDER BY title ASC')
      : await db.query<DeckRow>(`SELECT * FROM decks WHERE origin = 'official' ORDER BY title ASC`)
    res.json(result.rows.map(mapDeckRow))
  } catch (error) {
    console.error('Failed to load decks:', error)
    res.status(500).json({ error: 'Failed to load decks.' })
  }
})

decksRouter.get('/:slug', async (req, res) => {
  try {
    // A community deck reads as 404 rather than 403 for an anonymous caller: whether a given
    // slug exists is itself owner information, and the client renders both the same way.
    const result = req.userId
      ? await db.query<DeckRow>('SELECT * FROM decks WHERE slug = $1', [req.params.slug])
      : await db.query<DeckRow>(`SELECT * FROM decks WHERE slug = $1 AND origin = 'official'`, [
          req.params.slug,
        ])
    const row = result.rows[0]
    if (!row) {
      res.status(404).json({ error: 'Deck not found.' })
      return
    }
    res.json(mapDeckRow(row))
  } catch (error) {
    console.error('Failed to load deck:', error)
    res.status(500).json({ error: 'Failed to load deck.' })
  }
})
