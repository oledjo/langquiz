import { Router } from 'express'
import { db } from '../db/database'
import { requireAuth } from '../auth/middleware'
import { mapDeckRow, type DeckRow } from '../decks/deckMapper'

export const decksRouter = Router()

decksRouter.use(requireAuth)

decksRouter.get('/', async (_req, res) => {
  try {
    const result = await db.query<DeckRow>('SELECT * FROM decks ORDER BY title ASC')
    res.json(result.rows.map(mapDeckRow))
  } catch (error) {
    console.error('Failed to load decks:', error)
    res.status(500).json({ error: 'Failed to load decks.' })
  }
})

decksRouter.get('/:slug', async (req, res) => {
  try {
    const result = await db.query<DeckRow>('SELECT * FROM decks WHERE slug = $1', [req.params.slug])
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
