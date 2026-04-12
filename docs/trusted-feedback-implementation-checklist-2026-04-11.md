# Trusted Feedback Implementation Checklist

## Status

- Date: April 11, 2026
- Purpose: phased implementation checklist for `docs/technical-prd-trusted-feedback-flow-2026-04-11.md`
- Audience: product + engineering

## How To Use This Doc

This checklist translates the implementation PRD into a practical sequence of milestones, PR-sized tickets, and acceptance criteria.

Recommended execution model:

- ship in order
- keep each PR narrow
- protect the core loop first
- avoid mixing unrelated refactors

Recommended branch and PR shape:

- one PR for each numbered ticket group where possible
- one deployable milestone per phase
- feature-flag risky UI transitions if needed

## Phase Overview

### Phase 0 — Guardrails and characterization

Goal:

- freeze current behavior in tests before changing protected flows

### Phase 1 — Reviewer invite plumbing and sharing clarity

Goal:

- let a learner invite a new trusted reviewer directly from session detail
- make the two sharing paths explicit

### Phase 2 — Reviewer response composer

Goal:

- expose optional note, category, and template support while keeping video required

### Phase 3 — Loop continuity and processing momentum

Goal:

- make the next step obvious after feedback and preserve momentum while media is processing

### Phase 4 — Hardening and measurement

Goal:

- stabilize rollout, measure outcomes, and close edge cases

## Phase 0 — Guardrails and characterization

### P0.1 Backend characterization tests

Scope:

- extend tests around:
  - invite-only signup
  - private review link resolution
  - structured review request permissions
  - review feedback create/update/delete
  - owner viewed transition on responded requests

Files:

- `apps/backend/videos/tests/test_auth_onboarding.py`
- `apps/backend/videos/tests/test_feedback_requests.py`

Acceptance:

- existing flows are covered before invite plumbing changes begin

### P0.2 Frontend characterization coverage

Scope:

- document or add minimal test coverage for:
  - session detail share area
  - review-page auth-required state
  - review-page feedback composer current behavior

Files:

- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- current UI behavior is explicit enough to refactor safely

### P0.3 Feature flag decision

Scope:

- decide whether reviewer-invite plumbing ships behind a backend or frontend flag

Recommendation:

- use a lightweight setting or env gate only if implementation spans multiple deploys
- otherwise keep rollout simple and ship phase-by-phase

Acceptance:

- team agrees on rollout safety approach before schema changes

## Phase 1 — Reviewer invite plumbing and sharing clarity

## Milestone

Smallest shippable outcome:

- learner can create a reviewer invite from session detail
- recipient can sign up or sign in from that bundled link
- claiming that invite creates roster membership automatically
- learner can later use the structured reviewer chooser with that reviewer

### P1.1 Add `ReviewerInvite` model and migration

Backend

- add `ReviewerInvite` model
- add status enum:
  - `pending`
  - `claimed`
  - `revoked`
  - `expired`
- add intent enum:
  - `lightweight_review`
  - `roster_join`
- relate to:
  - `SignupInviteCode`
  - optional `ReviewLink`
  - optional `Session`
  - optional `ReviewRequest`
  - `created_by`
  - optional `claimed_by`

Suggested files:

- `apps/backend/videos/models.py`
- `apps/backend/videos/migrations/`
- `apps/backend/videos/admin.py`

Acceptance:

- migration applies cleanly
- admin can inspect invites and claim state

### P1.2 Add backend invite serializer and services

Backend

- create serializer for `ReviewerInvite`
- add service helpers for:
  - invite creation
  - invite revocation
  - invite claim
  - expiration check
  - roster membership creation/reactivation

Suggested files:

- `apps/backend/videos/serializers.py`
- `apps/backend/videos/reviews/services.py`
- `apps/backend/videos/reviews/queries.py`

Acceptance:

- claim/revoke/create logic lives in services, not scattered in views

### P1.3 Add reviewer invite API endpoints

Backend

- add:
  - `GET /api/reviewer-invites/`
  - `POST /api/reviewer-invites/`
  - `DELETE /api/reviewer-invites/:id/`
  - `POST /api/reviewer-invites/:id/claim/`
- scope list to invites created by current member or invites claimable by current member where needed

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/backend/practica/urls.py`

Acceptance:

- learner can create and revoke reviewer invites
- claim endpoint is idempotent where practical

### P1.4 Wire reviewer invite claim into auth flows

Backend

- after successful registration with invite code:
  - detect linked `ReviewerInvite`
  - mark it claimed
  - set `claimed_by`
  - create or reactivate `ReviewerRosterMembership`
- on authenticated open of a link with `claim` query param:
  - resolve invite
  - claim it if allowed
  - create/revive roster membership

Suggested files:

- `apps/backend/videos/serializers.py`
- `apps/backend/videos/views.py`
- `apps/backend/videos/reviews/api.py`

Acceptance:

- both new and existing members can complete reviewer invite claims
- claimed invites cannot be hijacked by another member

### P1.5 Replace bundled generic invite logic in session detail

Frontend

- refactor session detail share area to use reviewer-invite endpoints instead of raw invite-code creation for reviewer onboarding
- keep legacy share-link generation working while rollout is in progress if needed

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- the `Ask for feedback` flow can produce an invite-aware bundled URL for a new reviewer through the new backend API

### P1.6 Simplify feedback entry in `SessionDetail`

Frontend

- replace parallel primary actions with one `Ask for feedback` entry point
- branch internally to structured request or invite flow based on reviewer availability
- show plain-language help text explaining the outcome, not the implementation mode
- keep processing-state guard visible when the session is not ready

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- learner can clearly tell which path is lightweight sharing and which path is structured review

### P1.7 Add reviewer-empty-state flow

Frontend

- in request composer, if no designated reviewers exist:
  - show `Invite a reviewer first`
  - create reviewer invite from the same area
  - keep session context and return user to request flow

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- empty roster no longer blocks the learner without a next step

### P1.8 Show pending reviewer invites in session detail

Frontend

- display pending invites with:
  - label
  - created time
  - status
  - revoke action

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- learner can tell whether a reviewer invite is still pending or already claimed

### P1.9 Invite-aware auth copy

Frontend

- improve `AuthForm` copy when entering from a review link with claim context
- distinguish:
  - invited new reviewer
  - returning member who should sign in

Suggested files:

- `apps/frontend/src/components/AuthForm.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- invited reviewers understand why they are signing up and what happens next

### P1.10 Phase 1 test pass

Backend tests:

- invite create
- invite claim on register
- invite claim on sign-in
- roster membership auto-created
- revoked/expired invite rejection

Frontend validation:

- share UI renders both paths correctly
- empty-state invite path works
- invite-aware auth view is correct

Gate:

- `scripts/test-core-loop.sh`
- targeted backend tests for onboarding and feedback requests

Acceptance:

- phase 1 is deployable without breaking old review links or old invite-only signup

## Phase 2 — Reviewer response composer

## Milestone

Smallest shippable outcome:

- reviewer can record/upload a video, add an optional note, set category, use templates, and submit everything in one flow

### P2.1 Normalize backend feedback create/update contract

Backend

- ensure create and edit endpoints consistently support:
  - `text`
  - `feedback_category`
  - `timestamp_seconds`
  - `feedback_video`
- ensure serializers return these values consistently

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/backend/videos/library/api.py`
- `apps/backend/videos/serializers.py`

Acceptance:

- review-link and session-scoped feedback APIs behave consistently

### P2.2 Expose note field in review composer

Frontend

- add optional note textarea to the response composer
- include note in submit payload
- show note in feedback thread

Suggested files:

- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- reviewer can submit video plus note in one response

### P2.3 Expose category selector in review composer

Frontend

- add category selector using existing category options
- include category in submit payload
- display category badge in thread items

Suggested files:

- `apps/frontend/src/components/ReviewPage.jsx`
- `apps/frontend/src/utils.js` if shared options need reuse

Acceptance:

- reviewer can attach timing/groove/technique-style labels to feedback

### P2.4 Turn on templates in production UI

Frontend

- remove the dormant template UI guard
- allow template apply in review page
- allow save-template from current note text

Suggested files:

- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- reviewer can apply and save templates from the main response flow

### P2.5 Improve feedback edit flow

Frontend

- allow editing note and category in addition to timestamp and replacement video
- keep author-only edit/delete behavior

Suggested files:

- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- author can fully edit authored response metadata without losing the video-first constraint

### P2.6 Tighten response validation and messaging

Backend and frontend

- improve error messages for:
  - missing video
  - invalid category
  - revoked link
  - forbidden structured-request responder
- improve success messaging after response submit

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- users get clear next-step guidance on both success and failure

### P2.7 Phase 2 test pass

Backend tests:

- create response with video + note + category + timestamp
- edit response fields
- template CRUD remains intact

Frontend validation:

- composer submits all metadata correctly
- thread renders note/category state correctly

Gate:

- targeted feedback tests
- frontend build

Acceptance:

- phase 2 is deployable and backward-compatible with existing feedback data

## Phase 3 — Loop continuity and processing momentum

## Milestone

Smallest shippable outcome:

- learner always sees one clear next step after feedback
- processing wait state preserves share intent
- follow-up recording carries forward reviewer and context cleanly

### P3.1 Preserve share intent during processing

Frontend

- if learner tries to share before ready:
  - preserve requested intent in local component state
  - reopen the same action when processing becomes ready
- keep auto-refresh while processing is active

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- the learner does not have to restart the flow after waiting for readiness

### P3.2 Improve readiness and retry messaging

Frontend

- make `processing`, `ready`, and `failed` states clearer in the share module
- provide stronger retry guidance when playback fails to prepare

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- owners understand why a take cannot yet be shared and what to do next

### P3.3 Simplify post-feedback CTA logic

Frontend

- ensure one primary CTA per loop state:
  - `Review feedback`
  - `Record next take`
  - `Request next review`
- align CTA labels with current request status

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- next action is obvious from both session detail and review thread

### P3.4 Improve follow-up draft handoff

Frontend

- preserve prior reviewer, instrument, goal, exercise/song, notes, and practice thread when launching follow-up recording
- ensure the follow-up request composer is prefilled after save

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/SessionUpload.jsx`
- `apps/frontend/src/components/RecorderPage.jsx`

Acceptance:

- learner can move from feedback to next take without re-entering core context

### P3.5 Improve owner feedback review state transitions

Backend and frontend

- ensure `responded -> viewed` transition is visible and understandable
- avoid confusing duplicate controls like `Mark seen` if auto-view behavior already occurred

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- viewed state feels automatic and predictable rather than manual and redundant

### P3.6 Phase 3 test pass

Backend tests:

- responded request becomes viewed when owner opens review thread
- follow-up request preserves reviewer relationship rules

Frontend validation:

- next-step CTA behavior by state
- preserved draft behavior while processing

Gate:

- `scripts/test-core-loop.sh`
- frontend build

Acceptance:

- phase 3 is deployable and closes the main continuity gaps

## Phase 4 — Hardening and measurement

## Milestone

Smallest shippable outcome:

- instrumentation is in place, rollout is stable, and edge cases are covered

### P4.1 Add analytics or event instrumentation

Scope:

- instrument:
  - reviewer invite created
  - reviewer invite claimed
  - reviewer invite claim failed
  - share blocked while processing
  - first response submitted
  - follow-up take launched

Acceptance:

- team can measure whether friction is actually falling

### P4.2 Edge-case cleanup

Scope:

- audit and fix:
  - revoked invite behavior
  - expired invite behavior
  - duplicate claim attempts
  - stale pending invite display
  - existing-member claim collisions

Acceptance:

- invite state remains coherent under retries and repeat visits

### P4.3 Docs and support update

Scope:

- update current-state technical PRD if implementation meaningfully diverges
- update any internal release notes or support playbooks

Files:

- `docs/technical-prd-2026-04-06.md`
- `docs/release-checklist.md` if rollout steps change

Acceptance:

- docs reflect shipped behavior, not just intended behavior

## Suggested PR Order

Recommended PR sequence:

1. characterization tests only
2. `ReviewerInvite` model + migration + admin
3. invite services + API endpoints
4. auth-side invite claim behavior
5. session detail share UI split
6. request-composer empty-state invite path
7. review page note/category/template support
8. feedback edit-flow improvements
9. continuity and CTA cleanup
10. instrumentation and docs cleanup

## Recommended First Sprint

If you want the fastest path to visible product improvement, do this first:

1. `P0.1`
2. `P1.1`
3. `P1.2`
4. `P1.3`
5. `P1.4`
6. `P1.6`
7. `P1.7`

That gets you to the most important unlock:

- invite reviewer directly from session detail
- claim that invite cleanly
- create roster membership automatically
- unblock structured review requests afterward

## Definition Of Ready For Implementation

Start implementation when:

- the `ReviewerInvite` schema is agreed
- claim behavior for existing signed-in users is agreed
- phase 1 acceptance criteria are accepted as the first milestone
- core-loop regression tests are in place

## Definition Of Done For The Overall Project

This checklist is complete when:

- learner share choices are clear
- reviewer onboarding is self-serve inside the session flow
- reviewer join results in usable roster state
- response authoring is faster and richer without losing video-first behavior
- follow-up loops feel continuous
- metrics confirm better completion through the trusted feedback flow
