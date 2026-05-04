# Practica Master Spec

## Status

This is the single source of truth for Practica product direction, current-state product behavior, and roadmap.

If any other Practica doc conflicts with this one, this file wins.

## One-Line Thesis

Practica is a private video practice mirror where learners lead their own progress and bring in trusted feedback when they want it.

## What Practica Is

- private by default
- learner-led
- member-owned archive
- video-first
- feedback is optional and secondary
- teacher and reviewer workflows sit on top of the learner-owned archive

## What Practica Is Not

- a public social app
- a public marketplace
- a heavy LMS
- a streak or practice-plan app
- a school administration system
- an AI-first revenue product

## Revenue Truth

Practica does not need AI or ML to start earning revenue.

Revenue should come from the workflow itself:

- private capture
- self-review
- trusted review
- reviewer inbox and response flow
- repeat practice and follow-up takes

If model-assisted features are added later, they should support the core loop by reducing friction or improving usefulness. They are not the commercial foundation.

## Wedge

The initial wedge is:

- independent drum teachers
- using Practica with their existing students
- for async between-lesson video review

That wedge is narrow on purpose. It is easier to explain, recruit, and charge for than broad “all embodied learning” positioning.

## Current Product Scope

### In scope today

- invite-only account creation
- private session upload and recording
- playback-ready media processing
- learner-owned archive and calendar view
- practice thread grouping
- session detail and metadata editing
- private authenticated review links
- structured `ReviewRequest` workflow
- reviewer inbox
- private video feedback replies
- feedback templates for faster reviewer response
- follow-up loop from feedback to next take

### Out of scope today

- public discovery
- public profiles or social feeds
- anonymous feedback access
- school or institution administration
- billing and subscriptions
- public marketplace mechanics
- practice-plan systems or streak systems
- rich comparison tooling beyond thread/history organization
- email or push-notification delivery infrastructure

## Core Loop

The core loop is:

1. record a private take
2. watch it privately
3. organize it into a thread
4. optionally request trusted feedback
5. receive a response
6. record the next take

This loop is the product. Everything else should support it.

## Product Goals Supported Today

1. A learner can create a private video take reliably.
2. A learner can revisit prior takes in a private archive.
3. A learner can group repeated takes into a named practice thread.
4. A learner can invite trusted feedback on a take.
5. A reviewer can respond with private video feedback attached to the take.
6. The learner can continue the loop with a follow-up take.

## Roles And Access Model

- `member`: any authenticated person.
- `learner` / `session owner` / `student`: the member who owns the take and archive artifact.
- `reviewer`: a trusted person who can respond to a review link or assigned review request.
- `teacher`: a workflow-context label, not a separate account type.

Rules:

- sessions are private to their owner unless explicitly shared
- structured review requests are visible only to the owner, the assigned reviewer, or staff
- teacher and student language is workflow language, not global identity language

## Current Technical Snapshot

Practica is already strongest at:

- private capture
- playback-ready takes
- private review threads
- structured async feedback loops

The current product does **not** require AI or ML to work or to generate revenue.

The current delivery state is still `Now`, with the biggest risks centered on:

- friction inside the proof loop
- reviewer provisioning and invite reliability
- consistency and reliability
- measurement

Current shipped baseline:

- reviewer invite lifecycle exists
- structured review requests and reviewer inbox are active
- response composer supports video-first feedback
- in-app resolution cues are present

Current gaps:

- reviewer onboarding is still thinner than the learner flow
- comparison and self-review can be stronger
- reviewer operating leverage can improve
- billing and monetization do not exist yet
- mobile native app does not exist

## Now / Next / Later

### Now

- remove friction from ask/join/respond/continue
- measure the core loop
- learn what reviewers will pay for

### Next

- deepen self-review value
- increase reviewer workflow leverage
- shape pricing around real use

### Later

- richer comparison
- deeper analytics
- billing infrastructure
- institutional or public expansion

## Product Principles

- private by default
- video first
- learner-led
- mirror before marketplace
- feedback attached to the artifact
- progress through repetition
- low pressure
- trusted network growth

## Naming Guidance

Preferred language:

- learner
- member
- take
- practice thread
- private archive
- practice mirror
- trusted feedback

Allowed workflow language:

- reviewer
- teacher
- student
- review request
- reviewer inbox

Avoid:

- public marketplace framing
- role-heavy institutional framing
- AI-first positioning for revenue

## Doc Policy

All other Practica product docs are supporting references or retired snapshots.

Use this file and `docs/README.md` as the only places to find the current truth.
