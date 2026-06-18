# LangQuiz MVP Simplification Plan

## Purpose

LangQuiz currently contains a broad set of production and growth features: auth, guest mode, progress tracking, spaced review scheduling, custom exercise import, admin moderation, analytics events, retention email scaffolding, and SEO/marketing pages. That breadth is useful later, but it increases first-time-user complexity and implementation risk for an MVP.

This plan defines a smaller MVP that preserves the core promise: **a learner can quickly start a focused language-practice session, answer questions, get feedback, and see what to review next.**

## Product thesis

A successful MVP should optimize for one simple loop:

1. Pick a language and level.
2. Start a short practice session.
3. Answer questions with immediate feedback.
4. Finish with a simple next recommendation.
5. Return later to review weak or due items.

Anything that does not directly support this loop should be hidden, deferred, or limited to internal/admin use.

## Current feature inventory

### Keep as MVP core

- Email registration/login plus guest trial, because authenticated learners need saved progress while low-friction visitors can still try the product.
- Built-in exercise bank loaded from the backend, because the app already centralizes exercise delivery through API routes and frontend hooks.
- Practice sessions with selection, multi-select, and free-type question components.
- Basic progress and stats, because the home screen already uses stats to weight practice toward missed items and identify weak topics.
- Spaced-review queue in a minimal form: show a single "Review due" action only when reviews exist.

### Simplify for MVP

- Topic selection should be reduced from many visible controls to a guided start flow: language, level, and optional topic.
- Session-size controls should be reduced to one default short session and one optional longer session.
- Progress dashboard should become a compact "Your progress" page with only accuracy, completed questions, weak topics, and due reviews.
- Custom exercise import should move behind an "Advanced" or "Teacher tools" entry point instead of appearing as a primary home action.
- Admin moderation, voting, share-for-approval, analytics, retention emails, and marketing pages should remain technically available but not central in the learner UI.

### Defer from MVP user experience

- Public voting counts and topic vote totals.
- Learner-facing imported-exercise sharing workflows.
- Multiple session presets beyond short/focused.
- Detailed source filtering between shared bank and imported questions.
- Broad language/topic browsing as the default experience.
- Retention notification UI until email deliverability and preference controls are production-ready.

## MVP feature set

### 1. Authentication and entry

**MVP behavior**

- Landing/auth screen offers two choices: "Start free practice" and "Sign in / create account".
- Guest mode allows one unsaved session using built-in content.
- Signed-in mode saves progress and unlocks review history.

**Why minimal**

The app already supports authenticated users and guests. The MVP should avoid explaining account mechanics up front; users should experience practice first.

### 2. Guided session setup

**MVP behavior**

- Home screen starts with a single primary card: "What do you want to practice today?"
- Required fields: language and level.
- Optional field: topic, with "Recommended" as the default.
- Primary CTA: "Start 10-question session".
- Secondary CTA appears only when due reviews exist: "Review due questions".

**Remove or hide initially**

- Difficulty dropdown.
- Group dropdown unless content volume requires it.
- Source dropdown.
- Multi-select topic grid as the primary chooser.
- Public vote counts.
- Five session-size presets and slider.

### 3. Quiz session

**MVP behavior**

- Keep existing question types.
- Show one question at a time.
- After answer, show correctness, explanation, and one clear next button.
- End screen shows score, weak topics, and one next action: retry missed/due items or return home.

**Why minimal**

The question engine is the core product. Simplification should avoid reducing answer quality or feedback quality.

### 4. Progress and review

**MVP behavior**

- Home shows a compact progress summary for signed-in users:
  - Questions answered.
  - Overall accuracy.
  - Due review count.
  - Top 3 weak topics.
- Progress page shows the same information with topic rows, not deep analytics.
- Review scheduling remains backend-driven, but the UI only exposes "Due now" and "Needs review".

**Defer**

- Scheduler health metrics in the learner UI.
- Advanced lapse/scheduler explanations.
- Detailed per-question history unless needed for debugging.

### 5. Content scope

**MVP behavior**

- Launch with a curated content set for German first, plus small Spanish/French sampler packs if already available.
- Default learners to A1/A2 content unless they choose another level.
- Keep only grammar and vocabulary groups internally; do not force users to choose between them on first use.

**Content acceptance bar**

- Every exercise must have a prompt, answer, and explanation.
- Free-type answers should remain constrained to short lexical answers to avoid frustrating grading ambiguity.
- Imported/generated content should pass validation before becoming learner-visible.

### 6. Custom content and admin tools

**MVP behavior**

- Admin routes and tooling remain available for operators.
- Custom import is hidden behind an "Advanced" section for signed-in users or an internal admin flow.
- Learner-facing "Share imported for approval" is deferred.

**Why minimal**

Custom import is powerful but not required for proving the learner practice loop. It also adds schema, validation, moderation, and support burden.

## Recommended simplified navigation

### Signed-out

- Practice preview / auth page
  - Start free practice
  - Sign in
  - Create account

### Guest

- Practice home
- Quiz session
- Sign up prompt after session

### Signed-in learner

- Practice
- Progress
- Account/sign out

### Admin

- Practice
- Progress
- Admin tools

## Home screen target design

1. Header: logo, lightweight account control.
2. Primary setup card:
   - Language selector.
   - Level selector.
   - Recommended topic selector.
   - Start session button.
3. If signed in and reviews are due: review card.
4. If signed in and weak topics exist: weak-topic chips.
5. Advanced accordion:
   - Import exercises.
   - Source filter.
   - Custom content cleanup.

This keeps the first screen focused on starting practice rather than managing content.

## Implementation phases

### Phase 0 — Product freeze and measurement

- Define the MVP routes and nav states listed above.
- Confirm the minimum content set by language/level.
- Keep analytics events for signup, session start, question answered, session completed, and review started only.

### Phase 1 — UI simplification

- Replace the large topic-grid-first home layout with guided setup.
- Collapse import/custom-content controls into an advanced section.
- Remove vote counts from learner topic cards.
- Reduce session presets to:
  - Quick: 10 questions.
  - Deep practice: 20 questions.
- Keep due-review CTA visible only when due count is greater than zero.

### Phase 2 — Progress simplification

- Redesign progress around four learner-facing metrics: answered, accuracy, due reviews, weak topics.
- Remove or hide detailed stats that do not suggest an immediate next action.
- Add a "Practice weak topics" CTA that preselects the weakest topics.

### Phase 3 — Content and validation hardening

- Audit the built-in exercises for required explanations and level coverage.
- Promote only validated exercises to the shared bank.
- Keep admin moderation for internal content operations.

### Phase 4 — Deferred feature gates

- Gate custom import, sharing, voting, retention email settings, and broad source filtering behind feature flags or advanced/admin entry points.
- Reintroduce these only after the core loop meets activation and retention targets.

## MVP success metrics

- Visitor to first question answered: at least 55%.
- Signup to first completed session: at least 45%.
- Median time from landing to first question: under 60 seconds.
- Session completion rate: at least 70% for 10-question sessions.
- Day-7 retained learners: at least 20%.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Hiding custom import disappoints power users | Keep it in an Advanced section, not removed. |
| Fewer filters reduce perceived control | Use "Recommended" defaults and weak-topic CTAs. |
| Guest mode may reduce signups | Prompt signup after a completed guest session with a save-progress message. |
| Simplified progress may feel shallow | Link every metric to an action: review due, practice weak topics, continue level. |
| Spaced review complexity leaks into UI | Show only due count and review button; keep algorithm details internal. |

## Explicit non-goals for MVP

- Marketplace or community content workflows.
- Public voting as a learner-facing decision signal.
- Complex teacher/classroom management.
- Native mobile app.
- Full retention email preference center.
- AI exercise generation inside the app UI.

## Decision checklist before build

- Is the feature necessary for a learner to complete the first practice loop?
- Does it reduce time to first question?
- Does it create a clear next action after a session?
- Can it be explained in one sentence on mobile?
- Can it be hidden without breaking data integrity?

If the answer is "no" to the first three questions, defer or hide it for MVP.
