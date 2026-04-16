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

- let a member invite a new trusted reviewer directly from session detail
- make the two sharing paths explicit

### Phase 2 — Reviewer response composer

Goal:

- expose optional note, category, and template support while keeping video required

### Phase 3 — Loop continuity and processing momentum

Goal:

- make the next step obvious after feedback and preserve momentum while media is processing
- add clearer in-app resolution cues before considering outbound notifications

### Phase 4 — Hardening and measurement

Goal:

- stabilize rollout, measure outcomes, and close edge cases

## Implementation Snapshot (as of April 16, 2026)

Current assessed phase:

- late Phase 3 moving into Phase 4 hardening

Done / largely shipped:

- Phase 0 guardrails are in place with backend coverage in protected auth + review-request flows
- Phase 1 reviewer-invite plumbing is implemented end-to-end (`ReviewerInvite` model, invite APIs, claim behavior, roster side effects, session-detail invite UX)
- Phase 2 response-composer capabilities are implemented (video + note + category + timestamp + templates + edit flows)
- Phase 3 first-pass continuity work is shipped (resolution banners, share-intent persistence during processing, `Opened` / `Responded` / `Viewed` cues)

Remaining / needs completion:

- Phase 3 final continuity polish should be validated against current CTA behavior and follow-up handoff consistency
- Phase 4.1 instrumentation events are not yet documented as shipped in this checklist
- Phase 4.2 invite edge-case cleanup needs an explicit completion sweep and sign-off
- Phase 4.3 docs/support updates are partially done; keep syncing current-state docs as behavior changes

## Phase 0 — Guardrails and characterization

### P0.1 Backend characterization tests

Scope:

- extend tests around:
  - invite-only signup
  - private review link resolution
  - structured review request permissions
  - review feedback create/update/delete
  - creator viewed transition on responded requests

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

- member can create a reviewer invite from session detail
- recipient can sign up or sign in from that bundled link
- claiming that invite creates roster membership automatically
- member can later use the structured reviewer chooser with that reviewer

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

- member can create and revoke reviewer invites
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

- member can clearly tell which path is lightweight sharing and which path is structured review

### P1.7 Add reviewer-empty-state flow

Frontend

- in request composer, if no designated reviewers exist:
  - show `Invite a reviewer first`
  - create reviewer invite from the same area
  - keep session context and return user to request flow

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- empty roster no longer blocks the member without a next step

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

- member can tell whether a reviewer invite is still pending or already claimed

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

- member always sees one clear next step after feedback
- processing wait state preserves share intent
- follow-up recording carries forward reviewer and context cleanly
- waiting states are legible and the next actor is obvious without leaving the app

Current shipped progress:

- first-pass resolution banners are shipped for session processing, request states, and invite states
- queued share intent is now preserved across reload while processing
- important thread transitions now show timestamp cues like `Opened`, `Responded`, and `Viewed`

Current status:

- Phase 3 is mostly shipped in first pass
- run one final UX pass to confirm CTA singularity and context-preserving follow-up behavior on all protected states

### P3.1 Preserve share intent during processing

Frontend

- if member tries to share before ready:
  - preserve requested intent in local component state
  - reopen the same action when processing becomes ready
- keep auto-refresh while processing is active

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- the member does not have to restart the flow after waiting for readiness

### P3.2 Improve readiness and retry messaging

Frontend

- make `processing`, `ready`, and `failed` states clearer in the share module
- provide stronger retry guidance when playback fails to prepare
- make `saving`, `processing`, `ready`, and `failed` feel like bounded states rather than silent waiting

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`

Acceptance:

- creators understand why a take cannot yet be shared and what to do next

### P3.3 Simplify post-feedback CTA logic

Frontend

- ensure one primary CTA per loop state:
  - `Review feedback`
  - `Record next take`
  - `Request next review`
- align CTA labels with current request status
- make the current waiting state explicit, including who acts next

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

- member can move from feedback to next take without re-entering core context

### P3.5 Improve creator feedback review state transitions

Backend and frontend

- ensure `responded -> viewed` transition is visible and understandable
- avoid confusing duplicate controls like `Mark seen` if auto-view behavior already occurred
- make it clear to the reviewer when the creator has actually seen the response

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance:

- viewed state feels automatic and predictable rather than manual and redundant

### P3.6 Phase 3 test pass

Backend tests:

- responded request becomes viewed when creator opens review thread
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

Current status:

- in progress (hardening not yet complete)
- instrumentation and explicit edge-case closure remain the primary open items

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
- update the activation-resolution audit if the priority order or shipped resolution cues change

Files:

- `docs/technical-prd-2026-04-06.md`
- `docs/activation-resolution-audit.md`
- `docs/release-checklist.md` if rollout steps change

Acceptance:

- docs reflect shipped behavior, not just intended behavior

Current status:

- current-state docs now reflect the shipped resolution layer and timestamp cues

## Phase 4 PR-Sized Delivery Plan

Use this sequence to close remaining hardening work with narrow, reviewable PRs.

### PR4.1 — Core-loop instrumentation baseline

Owner:

- backend + frontend engineer pair

Scope:

- add event hooks for:
  - reviewer invite created
  - reviewer invite claimed
  - reviewer invite claim failed
  - share blocked while processing
  - first response submitted
  - follow-up take launched
- ensure each event includes enough context to segment by:
  - session id
  - request id when present
  - actor role (`creator` / `reviewer`)

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/backend/videos/views.py`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

Acceptance criteria:

- every listed event fires exactly once per successful user action where applicable
- failed invite claim path emits failure event with reason code
- event payload shape is documented in code or release notes
- no regression in protected-flow behavior

Out of scope:

- dashboards, retention analytics, and pricing analysis

PR4.1 implementation TODO (concrete):

1. Standardize event names and required fields

- `reviewer_invite_created`
  - required payload: `session_id`, `action`
  - optional payload: `review_request_id`, `invite_intent`
- `reviewer_invite_claimed`
  - required payload: `invite_id`, `review_token_present`
  - optional payload: `claim_source`
- `reviewer_invite_claim_failed`
  - required payload: `reason`, `review_token_present`
  - optional payload: `invite_id`, `claim_source`
- `share_blocked_session_not_ready`
  - required payload: `session_id`, `processing_status`, `action`
  - optional payload: `review_request_id`
- `reviewer_first_response_submitted`
  - required payload: `review_request_id`, `via_claim_link`
  - optional payload: `category`, `has_note`, `response_mode`
- `follow_up_take_launched`
  - required payload: `session_id`, `review_request_id`, `prior_status`
  - optional payload: `practice_series`

2. Frontend insertion points by function

- `apps/frontend/src/components/SessionDetail.jsx`
  - `openRequestComposer`: emit `share_blocked_session_not_ready` when user enters ask-for-feedback while not ready
  - `inviteReviewerFromComposer`: emit `share_blocked_session_not_ready` on pre-ready invite attempt
  - `inviteReviewerFromComposer`: emit `reviewer_invite_created` on successful invite creation
  - `startFollowUp`: emit `follow_up_take_launched` when follow-up recording starts
- `apps/frontend/src/components/ReviewPage.jsx`
  - review-link load effect: emit `reviewer_invite_claimed` when claim succeeds via `claim=` context
  - review-link load effect: emit `reviewer_invite_claim_failed` when claim returns `claim_error`
  - response submit handler: emit `reviewer_first_response_submitted` only on first authored response
- `apps/frontend/src/utils.js`
  - `reportClientEvent`: keep as single event transport wrapper to `/api/client-errors/`

3. Backend ingestion normalization by function

- `apps/backend/videos/views.py`
  - `client_error_view`: when `source == ProductEvent`, parse `message` as `event_name` and log structured key-value payload for easier querying
  - include normalized fields in logs: `event_name`, `path`, `is_authenticated`, `client_trace_id`, and whitelisted `extra` keys
  - keep non-product client errors on existing log path

4. Delivery checks

- smoke-check each event manually in browser devtools + backend logs
- verify no duplicate fire for single-click actions
- verify first-response event does not fire for second/subsequent responses
- verify claim-failed events include a bounded `reason` string

### PR4.2 — Invite edge-case reliability sweep

Owner:

- backend engineer

Scope:

- close and test invite edge cases:
  - revoked invite claim attempts
  - expired invite claim attempts
  - duplicate claim attempts by same user
  - claim collision attempts by different users
  - stale pending invites after claim/revoke
- make claim API outcomes explicit and idempotent where possible

Suggested files:

- `apps/backend/videos/reviews/api.py`
- `apps/backend/videos/reviews/services.py`
- `apps/backend/videos/serializers.py`
- `apps/backend/videos/tests/test_reviewer_invites.py`

Acceptance criteria:

- all edge cases return clear and stable status + message contracts
- duplicate claims do not corrupt invite or roster state
- claimed invites no longer appear as pending in creator surfaces
- targeted invite tests pass for all listed scenarios

Out of scope:

- redesign of invite UX wording

### PR4.3 — CTA/state consistency pass for protected loop

Owner:

- frontend engineer

Scope:

- enforce one primary CTA per loop state on creator and reviewer surfaces
- align labels with state semantics (`Review feedback`, `Record next take`, `Request next review`)
- ensure waiting-state language always identifies next actor
- verify follow-up handoff preserves reviewer/context without re-entry friction

Suggested files:

- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`
- `apps/frontend/src/components/CalendarView.jsx`

Acceptance criteria:

- each protected state renders one clear primary action
- creator/reviewer waiting states are explicit and non-conflicting
- follow-up launch preserves expected context fields
- frontend build succeeds and targeted loop validation passes

Out of scope:

- net-new workflow branches or major UI redesign

### PR4.4 — Docs + release/readiness sync

Owner:

- product/engineering lead

Scope:

- update current-state docs to match shipped hardening behavior
- capture rollout verification steps for support/release
- refresh execution checklist statuses after PR4.1–PR4.3 merge

Suggested files:

- `docs/technical-prd-2026-04-06.md`
- `docs/activation-resolution-audit.md`
- `docs/release-checklist.md`
- `docs/practica-now-execution-checklist.md`

Acceptance criteria:

- docs describe shipped behavior, not intended behavior
- release checklist includes any new verification for instrumentation and invite edge cases
- no Phase 4 item remains ambiguous about owner or completion signal

Out of scope:

- long-form strategy updates outside current wedge

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

- member share choices are clear
- reviewer onboarding is self-serve inside the session flow
- reviewer join results in usable roster state
- response authoring is faster and richer without losing video-first behavior
- follow-up loops feel continuous
- metrics confirm better completion through the trusted feedback flow
