# Practica Now Execution Checklist

## Status

- Purpose: turn the `Now` roadmap into one practical execution plan
- Scope: only near-term work that improves the wedge and core proof loop
- Rule: if a task does not improve the core loop, move it out

## What This Checklist Is Optimizing For

This checklist is designed to improve one thing above all else:

> Make it effortless for a member to ask one trusted person for feedback, get a response, and record the next take.

## Success Condition

This execution phase is successful when:

- a member can get from ready take -> feedback request with no hesitation
- a reviewer can get from invite link -> response with minimal friction
- a member can get from feedback -> next take without losing context
- every important activation resolves to a clear waiting or terminal state inside the app
- a reviewer can see enough value in the loop to consider paying for it

## Progress Snapshot (as of April 16, 2026)

Current implementation phase:

- execution has moved from initial build into hardening + consistency

Status by priority:

- Priority 1: in progress (core resolution cues shipped; CTA/copy consistency still needs a final sweep)
- Priority 2: in progress (invite lifecycle is implemented; edge-case reliability validation remains)
- Priority 3: mostly in progress (response metadata and templates shipped; mobile-friction polish is ongoing)
- Priority 4: in progress (follow-up continuity exists; state-by-state regression pass still needed)
- Priority 5: pending (structured willingness-to-pay discovery remains active product research work)

## Priority 1 — Remove core-loop hesitation

### 1.1 Audit every first-click surface

Check each of these screens and answer:

- what is the first thing the user should click?
- is that obvious in under 3 seconds?

Surfaces:

- session detail
- review page
- reviewer inbox
- post-feedback state on creator-side surfaces

Done when:

- there is one obvious primary action per screen state
- the user can also tell who has the next turn and whether the current state is complete or waiting

### 1.2 Remove implementation-language from primary UI

Look for labels or patterns that expose system mechanics instead of intention.

Examples to avoid:

- multiple top-level pathways for the same job
- admin-state language in the main action flow
- status management buttons where opening the thread should do the work

Done when:

- users choose intentions, not internal workflow modes

### 1.3 Tighten copy across the loop

Review every core-loop label for clarity and brevity.

High-priority labels:

- ask for feedback
- reviewer join page
- response submit states
- next-take states
- pending invite states

Done when:

- each label tells the user what happens next, not how the system works

### 1.4 Make waiting states explicit

Key states:

- processing after upload
- waiting on reviewer after request creation
- waiting on creator after response submission
- pending invite states

Done when:

- users are not left guessing whether the workflow is still alive

## Priority 2 — Harden invite and join reliability

### 2.1 Verify reviewer invite flow end-to-end

Walk this exact path regularly:

- member creates invite
- reviewer opens link signed out
- reviewer signs up or logs in
- reviewer lands in thread
- reviewer becomes available for structured feedback afterward

Done when:

- invite claim works for both new and existing accounts

### 2.2 Verify claim-query preservation

Protected behavior:

- review links with `?claim=` must keep claim context through the SPA router and auth redirect path

Done when:

- signed-in and signed-out flows both preserve reviewer-claim behavior reliably

### 2.3 Keep invite state minimal and understandable

Rules:

- pending invites stay visible in invite manager
- claimed invites leave the pending list
- resend should be possible without creating new confusion

Done when:

- invite manager only shows items still awaiting action

## Priority 3 — Make reviewer response fast on mobile

### 3.1 Keep first response rich, later responses light

Rules:

- first response can include video + note + category + timestamp
- additional response should stay lighter if that reduces friction

Done when:

- reviewer can respond quickly without form fatigue

### 3.2 Improve timestamp interaction

Current desired pattern:

- `Use current moment`
- quick nudges for precision
- optional precise adjustment behind a secondary action

Done when:

- timestamp selection feels easy on mobile and precise enough for review use

### 3.3 Verify response upload experience

Check:

- record response
- upload response
- retry behavior on flaky network
- success state after submit

Done when:

- reviewer can complete a response without uncertainty

## Priority 4 — Preserve continuity into the next take

### 4.1 Verify follow-up handoff

Protected behavior:

- after feedback, the member should be able to record a next take without re-entering core context

Context to preserve:

- reviewer
- parent request
- goal
- practice thread

Done when:

- follow-up feels like continuation, not restart

### 4.2 Keep next-step CTA obvious

States to verify:

- waiting on reviewer
- feedback ready
- viewed
- needs resubmission
- declined unrelated

Done when:

- each state has one obvious primary action
- each state also explains whether the member or reviewer should act next

## Priority 5 — Start structured WTP discovery

### 5.1 Interview real reviewers

Target:

- 10 independent drum practitioners serving as reviewers in async review today

Learn:

- where they currently receive videos
- where context gets lost
- what takes the most time
- what they would pay to avoid

Done when:

- you can describe the economic value in the reviewer’s own words

### 5.2 Capture real buyer language

Create a list of exact phrases reviewers use for:

- the problem
- the workaround
- the desired outcome

Done when:

- the product language and pricing language reflect buyer language, not builder language

### 5.3 Define first commercial offer

Do not build billing first.

Instead define:

- what is included for free
- what is reviewer-paid
- what usage threshold triggers payment conversation

Done when:

- there is one simple reviewer-facing offer you can test in real conversations

## Instrumentation Checklist

Confirm these events are firing and useful:

- ask-for-feedback started
- reviewer invite created
- reviewer invite claim succeeded
- reviewer invite claim failed
- reviewer first response submitted
- feedback viewed
- next take launched

Done when:

- you can identify where users drop or continue in the loop

## QA Checklist For Every Protected Release

Before shipping any protected-flow change:

- backend regressions pass
- frontend build passes
- browser smoke path passes
- production deploy succeeds
- production happy path is walked once manually

## What Not To Work On During This Phase

Do not prioritize these yet:

- institutional tooling
- public discovery
- billing infrastructure
- advanced dashboards
- rich side-by-side comparison tools

These can matter later, but they do not currently beat friction reduction in the proof loop.

## Suggested Weekly Rhythm

### Week structure

- one protected-flow improvement
- one real user or buyer conversation batch
- one production happy-path walkthrough

### Weekly review questions

- where did users hesitate?
- where did the system force explanation?
- what caused retries or confusion?
- what would a reviewer pay for if this got 20% easier?

## Immediate Next 5 Moves

If you want the most leverage right now, do these next:

1. audit and tighten the signed-in reviewer claim flow on production
2. add one browser-path regression for invite-link claim + join
3. verify the current happy path manually with a member and reviewer account
4. interview 3 real reviewers about current async review workflow pain
5. write one draft reviewer offer based on that pain
