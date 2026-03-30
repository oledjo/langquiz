# LangQuiz — Further Improvements Plan (Q2–Q3 2026)

This plan assumes the current baseline already includes:
- Auth, progress tracking, and review scheduling
- Exercise import + admin moderation flows
- Analytics and retention notification scaffolding

## Prioritization Framework

- **P0 (Now):** Highest impact on learning outcomes or production risk
- **P1 (Next):** Strong impact on growth and content throughput
- **P2 (Later):** Nice-to-have or scale optimization

## Implementation Status (updated 2026-03-30)

- ✅ Implemented: idempotency key support for progress submissions (backend + frontend retry-safe client header).
- ✅ Implemented: Spaced-repetition v2 answer grading (`again` / `hard` / `good` / `easy`) with updated scheduling behavior.
- ⏳ In progress: stricter validation workstream remains open.

---

## P0 — Product Quality and Learning Outcomes (0–6 weeks)

### 1) Spaced repetition quality pass

**Why**
Current scheduling exists, but answer behavior and difficulty progression can be tuned to increase weekly retention.

**Scope**
- Introduce explicit answer grades (easy / good / hard / again) in addition to binary correctness.
- Tune interval multipliers by level (A1/A2 vs B2/C1 learners).
- Add lapse handling rules (e.g., repeated failures reduce interval and increase priority).
- Add guardrails to prevent overloading users with due cards in one session.

**Deliverables**
- Scheduler config module and versioning for safe experiments.
- Backfill-safe migration for any new scheduling fields.
- Dashboard: due volume, completion rate, and same-day relapse rate.

**Success metrics**
- +10% increase in 7-day retained learners.
- -15% same-day re-fail rate on reviewed items.

---

### 2) Session reliability and idempotency hardening

**Why**
Intermittent network/client refreshes can create duplicate answer events and inconsistent stats.

**Scope**
- Add idempotency keys to answer submission API.
- Ensure duplicate submissions are safely ignored and logged.
- Add request correlation IDs to all write endpoints.
- Add retry-safe client handling for transient failures.

**Deliverables**
- API contract update for idempotency key.
- DB uniqueness/index strategy for de-duplication.
- Error budget alerts for 5xx spikes on write routes.

**Success metrics**
- <0.5% duplicate answer event rate.
- <1% failed session completion due to transient API errors.

---

### 3) Content validation strict mode

**Why**
Imported/generated exercises can contain subtle errors that reduce trust and learning quality.

**Scope**
- Extend validators for language-specific checks (e.g., German case/article sanity checks where applicable).
- Add explanation-quality lints (minimum useful length, forbidden placeholders, consistency).
- Add duplicate/near-duplicate detection against existing corpus.

**Deliverables**
- Validation severity levels: warning vs blocking.
- Import report with actionable failure reasons.
- Admin review queue filters by validation risk score.

**Success metrics**
- -30% admin rejection rate after first import submission.
- -25% learner-reported “answer/explanation mismatch” issues.

---

## P1 — Growth and Content Operations (6–12 weeks)

### 4) Onboarding optimization and activation experiments

**Scope**
- First-session wizard: language, level, weekly goal, reminder preference.
- Personalized default study plan (e.g., 5-question quick win on signup).
- A/B tests for first-run UX variants.

**Success metrics**
- Visitor → signup conversion +20% relative.
- Signup → first completed session +15% relative.

---

### 5) Learning path and curriculum structure

**Scope**
- Curated topic sequences per language and CEFR level.
- Prerequisite graph for grammar topics.
- Progress milestones and completion badges.

**Success metrics**
- +12% week-2 session starts.
- +10% average sessions per activated user.

---

### 6) SEO content pipeline integration

**Scope**
- Connect marketing content plan to actual publishing checklist.
- Add structured data and internal links between guides and practice modules.
- Track organic landing page to quiz-start funnel.

**Success metrics**
- +30% organic sessions to /learn/*.
- +15% organic-to-signup conversion on educational pages.

---

## P2 — Platform and Scale (12+ weeks)

### 7) Observability and incident readiness

**Scope**
- Distributed tracing for key request paths.
- SLO dashboards (availability, p95 latency, client-side errors).
- Runbooks for auth, DB latency, and migration incidents.

### 8) Internationalization and multi-language UX

**Scope**
- UI localization framework and content fallback strategy.
- Locale-aware formatting and language-specific keyboard/input support.
- Progressive rollout by highest-demand locales.

### 9) Monetization readiness (without launch)

**Scope**
- Feature flags for premium gates.
- Entitlement model and billing-provider abstraction.
- Instrumentation for paywall experiment readiness.

---

## Execution Plan by Sprint

### Sprint 1
- Implement idempotency keys + duplicate-write protection.
- Ship scheduler config extraction + telemetry.

### Sprint 2
- Add answer-grade UX and backend schedule adjustments.
- Launch strict content validation with warnings.

### Sprint 3
- Enable blocking validation for high-risk rules.
- Roll out onboarding wizard V1.

### Sprint 4
- Add first learning paths and milestone tracking.
- Launch onboarding A/B test and evaluate activation impact.

---

## Risks and Mitigations

- **Risk:** Over-tuning scheduler harms some learner cohorts.
  - **Mitigation:** Feature flag by cohort + rollback-able config versions.
- **Risk:** Validation strictness slows content throughput.
  - **Mitigation:** Start in warning mode, then progressively enforce.
- **Risk:** Experiment noise due to small samples.
  - **Mitigation:** Predefine MDE thresholds and run-time minimums.

---

## Immediate Next Actions (This Week)

1. Define P0 RFCs for scheduler tuning and idempotent submissions.
2. Add baseline telemetry queries for current duplicate events and relapse rates.
3. Draft validation rule catalog (blocking vs warning) with examples.
4. Lock success metric definitions and owners for each initiative.
