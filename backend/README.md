# LangQuiz backend

## One-time Anki import

The local importer reads from [AnkiConnect](https://foosoft.net/projects/anki-connect/) at
`http://127.0.0.1:8765`. It is deliberately read-only: it never creates, edits, reviews,
or deletes Anki notes, cards, decks, or review history.

It considers only these decks:

- `German::1. Немецкий`
- `German::2. Deutsch`
- `German::3. Goethe Institute A1 Wordlist`

### Required release sequence

Production import is deliberately a human-controlled release, never an automated test or
deployment step. Follow this sequence exactly:

1. **Analyze** the open local collection and create a report.
2. **Inspect** that report: all expected decks and card counts, `needs_review` entries,
   unsupported models, duplicates, and the manifest hash.
3. Perform a **human-confirmed pilot apply** against a staging Repzy account/API using that
   unchanged report. This is the only supported pilot: the importer does not have an
   unreviewed “partial production” mode.
4. **Verify** the pilot run by its returned run id. Resolve every missing mapping before
   proceeding.
5. Run **full apply** against production only after a human explicitly confirms the inspected,
   verified report. Then run verify again against the production run id.

Neither `npm test` nor `npm run build` performs an apply. The command line has no automatic
production confirmation, scheduling, or retry; an operator must run each apply command.

Start with analysis while Anki Desktop and AnkiConnect are running:

```bash
npm run import:anki -- analyze --report anki-import-report.json
```

The JSON report includes each candidate, skipped items, the exact observed model field names,
and a manifest hash. The first version does not import review-event history. Cards whose
review due date cannot be resolved exactly are marked `needs_review`; Anki's review due index
requires the collection creation time. Set `ANKI_COLLECTION_CREATED_AT` only when you have the
exact ISO timestamp from Anki collection metadata; the importer never guesses it.

For the human-confirmed staging pilot, apply that exact report with a staging user access token:

```bash
REPS_API_URL=https://your-staging-repzy-api.example \
REPS_AUTH_TOKEN=your-user-jwt \
npm run import:anki -- apply --report anki-import-report.json
```

Apply reads Anki again and refuses to send anything if its source manifest has changed. Verify
the pilot before a production apply. `REPS_AUTH_TOKEN` is sent only to `REPS_API_URL`, never to
AnkiConnect. `REPS_API_URL` must not point at AnkiConnect.

```bash
REPS_API_URL=https://your-staging-repzy-api.example \
REPS_AUTH_TOKEN=your-user-jwt \
npm run import:anki -- verify --report anki-import-report.json --run-id 123
```

After a human reviews the successful pilot, repeat `apply` and `verify` with the production
`REPS_API_URL` and a production user token. Keep the report unchanged; a changed source must
start again at analysis.
