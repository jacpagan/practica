# Practica Now / Next / Later

## Status

- Purpose: a lean roadmap that follows `docs/practica-operating-system.md`
- Rule: every item must improve the core loop, the wedge, or willingness to pay learning

## How To Read This

- **Now**: must matter for the current wedge and core proof loop
- **Next**: valuable once the current loop feels dependable and obvious
- **Later**: good ideas that should wait until the wedge is clearly working

## Current Reality

Practica is already strongest at:

- private capture
- playback-ready takes
- private review threads
- structured async feedback loops

The biggest remaining risk is not missing breadth.

It is leaving friction inside the proof loop:

- ask for feedback
- join as reviewer
- respond
- review feedback
- record the next take

The next priority is not outbound email.

It is making each of those states resolve clearly inside the app.

## Implementation Snapshot (as of April 16, 2026)

Current assessed delivery state:

- still in `Now`, with foundational implementation already shipped
- main risk has shifted from missing features to consistency, reliability, and measurement

Shipped baseline supporting `Now`:

- reviewer invite lifecycle exists (`ReviewerInvite`, claim flow, roster side effects)
- structured review requests + reviewer inbox are active
- response composer supports video-first feedback with optional note/category/timestamp/template flows
- first-pass in-app resolution cues are live (`Requested`, `Opened`, `Responded`, `Viewed` + invite/session resolution summaries)

Primary remaining `Now` work:

- finish hardening invite edge cases under retries and repeat visits
- enforce one unmistakable primary CTA across all loop states
- add and review core-loop instrumentation for hesitation/failure points
- run recurring protected-flow QA sweeps for invite -> response -> next-take continuity

## Now

These are the highest-value items for the current wedge.

### 1. Make the happy path unmistakable

Goal:

- the first click should be obvious at every step in the feedback loop

Why now:

- confusion here directly reduces completion and willingness to adopt
- users should not need an external notification just to understand who acts next

Examples:

- simplify wording on feedback entry and response states
- reduce secondary admin affordances in the main path
- make first-time reviewer join feel guided and predictable
- make waiting states explicit instead of silent
- show who has the next turn after request and response actions

### 2. Harden reviewer invite and claim reliability

Goal:

- invites should work every time for the intended person, whether signed in or not

Why now:

- reviewer onboarding is still the most fragile point in the workflow

Examples:

- keep claim query and auth redirect behavior reliable
- reduce stale state between claimed invites and available reviewer roster
- make invite fallback and copy-again behavior dependable

### 3. Tighten the response loop end-to-end

Goal:

- make `submission -> feedback -> next take` feel like one continuous thread

Why now:

- this is the core proof loop for reviewer value

Examples:

- keep reviewer response friction low on mobile
- preserve follow-up request context cleanly
- ensure creator-side surfaces show the next action immediately

### 4. Add meaningful product instrumentation

Goal:

- know where users hesitate, fail, or continue

Why now:

- the team is still finding important UX issues only after shipping

Track first:

- ask-for-feedback start rate
- invite-link creation rate
- invite claim success/failure
- first-response submission
- feedback viewed
- next-take launch

### 5. Start real WTP discovery with reviewers

Goal:

- understand exactly what a reviewer would pay for and why

Why now:

- monetization should follow the workflow pain that is already visible

Questions:

- what are they replacing now?
- where is the time loss?
- what makes Practica feel indispensable?

## Next

These are the next-best moves once the loop is dependable.

### 1. Strengthen self-review and comparison

Goal:

- make the mirror more valuable even before feedback is requested

Why next:

- this deepens member retention and strengthens the non-reviewer value proposition

Examples:

- easier thread replay across takes
- clearer timeline of repeated takes
- comparison-oriented playback touches that do not add heavy complexity

### 2. Improve reviewer operating leverage

Goal:

- make async teaching more efficient without turning Practica into a heavy LMS

Why next:

- once the base loop works, reviewer efficiency becomes a stronger paid differentiator

Examples:

- better reviewer inbox prioritization
- lightweight member summaries
- clearer outstanding-loop views

### 3. Package and price the reviewer workflow layer

Goal:

- move from abstract monetization ideas to a real commercial offer

Why next:

- pricing only makes sense once the workflow is clearly useful and stable

Likely direction:

- reviewer-paid
- member-included participation
- pricing around active teaching workflow, not per-review fees

### 4. Improve production QA loop for protected flows

Goal:

- shorten the time between discovering friction and knowing exactly where it came from

Why next:

- the app is now feature-richer, so protected-flow confidence matters even more

Examples:

- better browser-path coverage for invite and response flows
- production smoke scripts for the core loop

## Later

These may be good, but they should wait.

### 1. Rich comparison tools

Examples:

- side-by-side take comparison
- annotation overlays
- more granular movement/posture comparison aids

Why later:

- valuable, but not the current wedge unlock

### 2. Deeper analytics surfaces

Examples:

- richer dashboards
- trend reporting for reviewers
- member progress summaries

Why later:

- instrumentation and product fit must come first

### 3. Billing system implementation

Examples:

- subscriptions
- plan enforcement
- account billing UI

Why later:

- only after packaging and WTP are clearer

### 4. Institutional or school features

Examples:

- multi-reviewer administration
- school-wide rosters
- classroom management concepts

Why later:

- this is outside the current wedge and risks pulling the product away from the private mirror thesis

### 5. Public or marketplace mechanics

Why later:

- likely wrong for the current product model
- should only be considered if strategy changes materially

## What We Should Avoid Right Now

- broadening the app before the core loop is unmistakably good
- adding more workflow modes in the main UI
- building pricing infrastructure before buyer pain is better validated
- optimizing reviewer dashboards before the feedback loop is truly smooth

## Single-Sentence Priority

If there is one thing Practica should optimize right now, it is this:

> Make it effortless for a member to ask one trusted person for feedback, get a response, and record the next take.

## Working Roadmap Summary

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
