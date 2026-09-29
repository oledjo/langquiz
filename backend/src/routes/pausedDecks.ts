/**
 * SQL predicate: true when the question's deck is one the user stopped learning. Expects the
 * query to have `exercises e` and `user_exercises ue` joined for the question, the same way every
 * deck-scoped progress query resolves a question's deck (`COALESCE(e.deck_id, ue.deck_id)`).
 */
export function pausedDeckSql(userIdExpr: string): string {
  return `EXISTS (SELECT 1 FROM user_paused_decks upd WHERE upd.user_id = ${userIdExpr} AND upd.deck_id = COALESCE(e.deck_id, ue.deck_id))`
}
