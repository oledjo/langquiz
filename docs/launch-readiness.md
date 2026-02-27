# Launch Readiness and Growth Operations

## SLOs
- API availability: >= 99.5%
- Core endpoint p95 latency: < 500ms
- Frontend LCP: < 2.5s on home and /learn landing pages

## KPI targets
- Visitor -> signup >= 4%
- Signup -> first completed session >= 45%
- D7 retention >= 20%

## Core analytics events
- auth_signup_success
- auth_login_success
- session_started
- question_answered
- session_completed
- import_used
- day7_retained

## Uptime monitoring
Monitor these endpoints every minute:
- GET /api/health
- GET /api/ready
- GET /

Alert channels:
- Email (required)
- Slack webhook (recommended)

## Community distribution cadence
- Publish 2 guides/week under /learn/*
- Post in 3+ relevant communities weekly
- Include UTM links in every community post and campaign

## Paid micro-test guardrails
- Budget cap: $300/month
- Channels: Google Search, Meta, Reddit
- Kill tests that exceed target cost per D7 retained user
