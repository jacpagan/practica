# Practica Flow Audit

## Scope

This document audits the current product against the v2 thesis:

> Practica is a private video practice mirror where learners lead their own progress and bring in trusted feedback when they want it.

It focuses on:

- the learner-led mirror loop,
- the trusted-feedback loop,
- and the optional structured reviewer workflow.

## Current-State Flow Map

### 1. Authentication

- Invite-only signup exists.
- Authenticated members enter a private archive, not a public profile.

### 2. Learner upload flow

- Learner opens `/upload` or `/record`.
- Learner records or uploads a private take.
- Backend creates a `Session` and prepares playback assets.
- Learner lands on session detail once the take is saved.

### 3. Learner session detail flow

- Learner watches the take.
- Learner can rename or organize it into a practice thread.
- Learner can choose to keep practicing alone or invite trusted feedback.

### 4. Private share-link flow

- Learner creates a private review link.
- Trusted reviewer signs in and watches the take.
- Reviewer responds with attached video feedback.

### 5. Structured review-request flow

- Learner chooses a designated reviewer.
- Frontend creates a `ReviewRequest`.
- Reviewer sees the request in `/requests`.
- Status changes track the loop from request to response to continuation.

### 6. Follow-up loop

- Learner views feedback.
- Learner decides whether to continue the loop.
- Learner records a new take.
- Follow-up request continues the thread.

## What Is Working Well

- The private archive is real.
- The learner-owned `Session` artifact is the center of the experience.
- Playback-ready processing makes private review practical.
- Feedback stays attached to the take.
- The structured reviewer layer is now functional without redefining the whole product.

## Main Product Truth

The app is strongest when it acts like a practice mirror first.

The learner value is immediate:

- record,
- watch,
- notice,
- adjust,
- repeat.

Trusted feedback is valuable, but it should feel like an optional layer that supports learner agency.

## Top Gaps

### P0 — The learner-led mirror still needs to feel more central than the reviewer layer

Impact:

- If the app sounds like a review tool first, self-led value gets hidden.
- The strongest emotional value may be under-explained even when the product behavior already supports it.

### P0 — Reviewer provisioning still adds operational friction

Impact:

- Formal `ReviewRequest` flows still depend on designated reviewer setup.
- That setup path is still too founder-operated and too thin for easy onboarding.

### P0 — The completed loop must stay frictionless

Impact:

- `submission -> feedback -> resubmission` is the core proof-of-value loop for teacher-led use.
- Any friction across upload, request creation, or continuation breaks first-customer confidence.

### P1 — Comparison and self-review can still get stronger

Impact:

- The product already preserves history.
- It can do more to help the learner compare posture, timing, expression, or movement across takes.

### P1 — Metrics should reflect self-led practice, not only feedback workflows

Impact:

- Repeat takes and revisit behavior matter as much as request completion.
- The product should learn from practice behavior, not just reviewer throughput.

## Recommended Delivery Order

1. Preserve and harden upload, playback, and session detail.
2. Keep reinforcing the learner-led mirror in copy and UX.
3. Keep the trusted-feedback loop simple and reliable.
4. Improve designated-reviewer provisioning.
5. Deepen comparison and replay across repeated takes.
6. Add richer metrics for repeat practice and completed feedback loops.

## Definition Of Done

Practica is in a strong v2 foundation state when:

- a learner gets value before inviting anyone,
- a trusted reviewer can still respond without external tools,
- repeated takes stay organized over time,
- permissions are private and easy to explain,
- and completed review cycles are visible and measurable.
