# Practica Master Spec

## Status

This is the single source of truth for Practica product direction, current-state product behavior, and roadmap.

If any other Practica doc conflicts with this one, this file wins.

## One-Line Thesis

Practica is a private skill game where one person does a tiny action, records proof, and sees progress over time.

## What Practica Is

- private by default
- member-led
- member-owned proof archive
- video-first
- progress-first
- one active skill or habit at a time

## What Practica Is Not

- a public social app
- a public marketplace
- a heavy LMS
- a school administration system
- an AI-first revenue product
- a teacher-first workflow product

## Revenue Truth

Practica does not need AI or ML to start earning revenue.

Revenue should come from the loop itself:

- private capture
- immediate proof
- progress feedback
- repeat usage over time

If model-assisted features are added later, they should support the loop by reducing friction or improving usefulness. They are not the commercial foundation.

## Wedge

The initial wedge is:

- one person
- one habit or skill
- one daily proof loop

That wedge is narrow on purpose. It is easier to explain, recruit, and charge for than broad “all embodied learning” positioning.

## Current Product Scope

### In scope today

- invite-only account creation
- private session upload and recording
- playback-ready media processing
- member-owned proof archive and history view
- one active skill or habit label per member
- session detail and metadata editing
- progress summaries from completed proof events
- Today / Record / Progress navigation
- private authenticated legacy review flows where already shipped

### Out of scope today

- public discovery
- public profiles or social feeds
- anonymous feedback access
- school or institution administration
- billing and subscriptions
- public marketplace mechanics
- rich comparison tooling beyond proof/history organization
- email or push-notification delivery infrastructure

## Core Loop

The core loop is:

1. pick one skill or habit
2. do a tiny action
3. record proof
4. see progress
5. repeat tomorrow

This loop is the product. Everything else should support it.

## Product Goals Supported Today

1. A member can create a private proof take reliably.
2. A member can revisit prior takes in a private archive.
3. A member can keep one skill or habit visible.
4. A member can see streak, XP, and level progress.
5. A member can continue the loop with another take.

## Roles And Access Model

- `member`: any authenticated person.
- `skill owner`: the member who owns the proof archive and active skill.
- `reviewer`: a dormant workflow-context label for legacy review flows.
- `teacher`: a dormant workflow-context label, not a primary product identity.

Rules:

- sessions are private to their owner unless explicitly shared
- progress data is derived from the member’s own proof history
- dormant review flows remain private to the owner, the assigned reviewer, or staff if they are touched
- teacher and student language is legacy workflow language, not the primary product frame

## Current Technical Snapshot

Practica is already strongest at:

- private capture
- playback-ready takes
- private proof history
- repeatable progress tracking
- quick record and save loops

The current product does **not** require AI or ML to work or to generate revenue.

The current delivery state is still `Now`, with the biggest risks centered on:

- friction inside the proof loop
- clarity of the Today / Record / Progress surfaces
- consistency and reliability
- measurement of the habit loop

Current shipped baseline:

- private upload and playback exist
- legacy review flows still exist in the backend
- session history and routing exist
- the shell can be refocused around proof and progress

Current gaps:

- Today / Record / Progress surfaces are still being aligned
- game-like progress needs clearer framing
- billing and monetization do not exist yet
- mobile native app does not exist

## Now / Next / Later

### Now

- remove friction from pick/do/record/progress
- measure the proof loop
- learn what members will pay for

### Next

- deepen progress feedback
- make the active skill clearer
- shape pricing around real use

### Later

- richer comparison
- deeper analytics
- billing infrastructure
- institutional or public expansion

## Product Principles

- private by default
- video first
- member-led
- proof before anything else
- progress through repetition
- low pressure
- tiny actions
- fun enough to return tomorrow

## Naming Guidance

Preferred language:

- member
- skill
- proof
- today
- progress
- private archive

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
- teacher-first positioning as the primary story

## Doc Policy

All other Practica product docs are supporting references or retired snapshots.

Use this file and `docs/README.md` as the only places to find the current truth.
