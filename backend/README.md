# LangQuiz backend

## One-time Anki import

The local importer reads from [AnkiConnect](https://foosoft.net/projects/anki-connect/) at
`http://127.0.0.1:8765`. It is deliberately read-only: it never creates, edits, reviews,
or deletes Anki notes, cards, decks, or review history.

It considers only these decks:

- `German::1. Немецкий`
- `German::2. Deutsch`
- `German::3. Goethe Institute A1 Wordlist`

Start with a dry run while Anki Desktop and AnkiConnect are running:

```bash
npm run import:anki -- analyze --report anki-import-report.json
```

The JSON report includes each candidate, skipped items, the exact observed model field names,
and a manifest hash. The first version does not import review-event history. Cards whose
review due date cannot be resolved exactly are marked `needs_review`; Anki's review due index
requires the collection creation time. Set `ANKI_COLLECTION_CREATED_AT` only when you have the
exact ISO timestamp from Anki collection metadata; the importer never guesses it.

After reviewing that exact report, apply it with a user access token:

```bash
REPS_API_URL=https://your-repzy-api.example \
REPS_AUTH_TOKEN=your-user-jwt \
npm run import:anki -- apply --report anki-import-report.json
```

Apply reads Anki again and refuses to send anything if its source manifest has changed.
`REPS_AUTH_TOKEN` is sent only to `REPS_API_URL`, never to AnkiConnect. `REPS_API_URL` must not
point at AnkiConnect. Verify an applied run with its returned id:

```bash
REPS_API_URL=https://your-repzy-api.example \
REPS_AUTH_TOKEN=your-user-jwt \
npm run import:anki -- verify --report anki-import-report.json --run-id 123
```
