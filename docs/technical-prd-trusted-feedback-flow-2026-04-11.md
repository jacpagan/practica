# Trusted Feedback Flow Technical PRD

## Status

- Date: April 11, 2026
- Status: Proposed implementation PRD
- Scope: trusted feedback onboarding, sharing clarity, response composition, and loop continuity
- Builds on: `docs/practica-v2-prd.md`, `docs/platform-effects-mvp-playbook.md`, `docs/flow-audit.md`, `docs/technical-prd-2026-04-06.md`

## 1. Purpose

This document proposes a realistic implementation plan to reduce friction in Practica's trusted feedback flow without changing the core product model.

The product thesis remains:

> Practica is a private video practice mirror where learners lead their own progress and bring in trusted feedback when they want it.

This PRD focuses on improving the current loop:

- `record or upload`
- `watch`
- `share privately`
- `get feedback`
- `record the next take`

It does not reposition Practica as a marketplace, school workspace, or public network.

## 2. Problem Summary

Current code supports the loop, but several implementation details still create avoidable friction.

### 2.1 Current friction points

1. Sharing is conceptually split across two paths:
   - lightweight private share link
   - structured review request to a designated reviewer

   These are both valid, but the distinction is not clear enough in the UI.

2. First-time reviewer onboarding is too thin.
   - Structured requests require an existing reviewer roster membership.
   - The roster itself is not easy to create from the learner flow.
   - Empty-state guidance currently points to a next step that is not fully supported in-product.

3. Invited reviewers must authenticate before participating.
   - This is aligned with privacy goals.
   - But the join flow needs to feel intentional and lightweight, especially for first-time reviewers.

4. Reviewer response composition is more constrained than the data model.
   - The backend supports optional text, optional category, optional timestamp, and templates.
   - The current review page surfaces mainly video upload/recording and timestamp.
   - This makes fast, high-context responses harder than they need to be.

5. Owners cannot share until playback is ready.
   - This is the correct safety constraint.
   - But the product should do more to preserve momentum while processing completes.

6. Follow-up continuity is functional but still scattered.
   - The product supports resubmission and follow-up requests.
   - The next action is not always obvious at the moment feedback is received or reviewed.

7. Invite management is implemented as generic signup code management.
   - This works technically.
   - It does not yet express reviewer intent, claim state, or relationship outcome clearly.

## 3. Goals

This work should improve conversion and clarity without changing core product boundaries.

### 3.1 Product goals

- Keep sharing private by default.
- Preserve authenticated participation for trusted feedback.
- Let a learner invite a new trusted reviewer from the session flow.
- Let a learner send a structured review request once a reviewer relationship exists.
- Make first-time reviewer join feel purposeful and low-friction.
- Make reviewer responses faster while preserving video-first feedback.
- Make the next step after feedback obvious.

### 3.2 Success metrics

- Increased share-link to successful reviewer join rate.
- Increased first-time reviewer to active roster conversion rate.
- Increased review request creation rate after first reviewer join.
- Reduced drop-off between `link opened` and `feedback submitted`.
- Reduced time from `session ready` to `review requested`.
- Increased completed loop rate for `submission -> feedback -> follow-up take`.

## 4. Non-Goals

This project will not:

- add anonymous review participation
- add public discovery or marketplace behavior
- add email delivery or push notifications as a dependency
- add a heavy teacher workspace or school abstraction
- remove authentication requirements for trusted feedback
- replace video-first feedback with text-first feedback
- change global account identity into teacher/student account types

## 5. Proposed Solution

Implement the solution in four coordinated parts:

1. clarify the two sharing paths in the learner UI
2. introduce a dedicated reviewer invite and claim flow that can create roster relationships
3. expose the existing response metadata model in the review composer
4. improve continuity around `processing -> sharing -> response -> next take`

## 6. User Experience Changes

### 6.1 Session detail sharing model

Replace the current ambiguous share area with two explicit actions:

#### A. `Share private link`

Use when the learner wants lightweight trusted feedback without a formal assigned request.

Behavior:

- creates or reuses a `ReviewLink`
- optionally bundles a join claim for a first-time reviewer
- opens the same private thread at `/r/:token`
- does not create a `ReviewRequest`

#### B. `Request review`

Use when the learner wants a formal async feedback loop with an assigned reviewer.

Behavior:

- requires a reviewer already in the learner's roster
- creates `ReviewRequest`
- creates associated `ReviewLink`
- surfaces the request in reviewer inbox `/requests`

### 6.2 Empty-state improvement for no reviewers

When the learner opens `Request review` and has no available reviewers:

- show `Invite a reviewer first`
- allow the learner to create a reviewer invite directly from the same panel
- keep the current session context attached to that invite
- return the learner to the request composer after the invite is created

### 6.3 Reviewer join experience

When a reviewer opens a bundled invite link:

- show the private review preview
- explain that Practica is a private review thread for this take
- default to sign-up if the recipient is new
- preserve sign-in for existing members
- after successful auth, automatically complete any pending invite claim side effects
- land the reviewer directly in the private thread

### 6.4 Reviewer response composer

Keep video required for new feedback, but expose the rest of the supported context.

Add to `ReviewPage.jsx`:

- optional note field
- optional category selector
- timestamp controls remain
- saved templates section enabled in production UI
- template application fills the note field
- template save allowed when note text exists

This preserves the current video-first product rule while making each video response more informative and faster to author.

### 6.5 Follow-up continuity

Improve post-feedback CTAs:

- learner sees a single primary CTA after `responded` or `viewed`
- CTA text varies by status:
  - `Review feedback`
  - `Record next take`
  - `Request next review`
- follow-up recording should preserve prior reviewer, goal, and thread context by default

### 6.6 Share readiness guidance

Keep the rule that sharing requires playback-ready media.

Improve the waiting state by:

- making processing status more explicit in session detail
- preserving preselected share intent while waiting
- showing clearer retry guidance if processing fails
- auto-refreshing readiness state while the session is processing

## 7. Data Model Changes

## 7.1 New model: `ReviewerInvite`

Add a dedicated model for invite intent and claim lifecycle instead of relying only on generic signup codes.

Suggested fields:

- `created_by` -> `User`
- `invite_code` -> one-to-one with `SignupInviteCode`
- `review_link` -> optional `ReviewLink`
- `session` -> optional `Session`
- `review_request` -> optional `ReviewRequest`
- `status` -> `pending`, `claimed`, `revoked`, `expired`
- `intent` -> `lightweight_review`, `roster_join`
- `claimed_by` -> nullable `User`
- `claimed_at`
- `expires_at`
- `label`
- `created_at`
- `updated_at`

### Why this model is needed

Today `SignupInviteCode` only answers whether a user may register.

It does not answer:

- why the invite exists
- which learner created it
- which session it belongs to
- whether it should create a roster relationship
- whether it has already been claimed by a reviewer

`ReviewerInvite` gives the product a first-class object for reviewer onboarding while reusing existing invite-only auth controls.

## 7.2 Existing model behavior to preserve

- `SignupInviteCode` remains the auth gate for registration.
- `ReviewerRosterMembership` remains the source of truth for structured request eligibility.
- `ReviewLink` remains the private thread token.
- `ReviewRequest` remains the structured loop artifact.

## 8. Backend Requirements

### 8.1 Invite creation and claim side effects

On reviewer invite creation:

- create a one-use `SignupInviteCode`
- create `ReviewerInvite`
- optionally attach existing `ReviewLink`
- return the bundled URL with `claim=<invite_code>`

On successful registration with an invite code:

- after user creation, check whether the invite code belongs to a pending `ReviewerInvite`
- if yes, mark the invite as claimed
- store `claimed_by`
- if invite intent includes roster creation, create or reactivate `ReviewerRosterMembership`

On successful sign-in with a claim code present in URL:

- resolve the `ReviewerInvite`
- if the current user is not yet the claimant, claim it if allowed
- create or reactivate the roster membership if not already active

This allows both new and existing members to accept reviewer invites cleanly.

### 8.2 Review request creation remains roster-gated

Do not remove roster validation from `ReviewRequestSerializer`.

Instead, ensure the invite flow creates the roster relationship before the learner needs to use `Request review`.

### 8.3 Response composer support

Expose and fully support in review-link feedback endpoints:

- `text`
- `feedback_category`
- `timestamp_seconds`
- `feedback_video`
- `client_upload_id`

Current backend support already exists in large part. The main work is consistency, validation, and frontend exposure.

### 8.4 Invite management endpoints

Add endpoints:

- `GET /api/reviewer-invites/`
- `POST /api/reviewer-invites/`
- `DELETE /api/reviewer-invites/:id/`
- `POST /api/reviewer-invites/:id/claim/` for explicit claim completion when needed

Notes:

- `claim` should usually happen automatically after auth
- the explicit claim endpoint exists for reliability and recovery
- revoking a reviewer invite should also disable any still-unused signup path for that invite

### 8.5 Backward compatibility

- Existing generic invite-code flows must continue to work.
- Existing private review links must continue to resolve.
- Existing structured review requests must remain unchanged.
- Old links with `?claim=<invite_code>` should still work, but new flows should prefer a tracked `ReviewerInvite` behind that claim code.

## 9. Frontend Requirements

### 9.1 `SessionDetail.jsx`

Update the share module to:

- separate `Share private link` from `Request review`
- keep `Open test view`
- show pending reviewer invites
- offer `Invite reviewer` when roster is empty
- preserve selected reviewer and request draft context across processing-state refreshes

### 9.2 `AuthForm.jsx`

Support invite-aware copy for reviewer onboarding:

- `You were invited to a private feedback thread`
- `Create your account once to watch the take and respond privately`

Preserve locked invite code behavior.

### 9.3 `ReviewPage.jsx`

Update the response composer to show:

- note textarea
- category selector
- saved templates section
- save-template action
- clearer success states after submission

Do not remove the requirement for a response video on new feedback.

### 9.4 `TeachingView.jsx`

No major structural change is required.

Small improvements:

- show whether the reviewer relationship was newly invited or already established
- show first-response urgency for newly claimed reviewers if relevant

## 10. API Contract Changes

### 10.1 New serializer surfaces

Add serializer for `ReviewerInvite` including:

- `id`
- `label`
- `intent`
- `status`
- `claim_code`
- `invite_url`
- `session`
- `review_link`
- `claimed_by`
- `claimed_at`
- `expires_at`
- `created_at`

### 10.2 Review feedback payloads

Ensure `POST /api/review/:token/feedback/` and `PATCH /api/review/:token/feedback/` consistently accept and return:

- `text`
- `feedback_category`
- `timestamp_seconds`
- `feedback_video`

### 10.3 Auth registration side effects

The registration response shape does not need to change.

The required backend change is transactional behavior after invite-code redemption:

- consume code
- create user
- create profile
- complete linked `ReviewerInvite` claim if applicable
- create roster membership if applicable

## 11. Permissions And Security

Preserve all current privacy boundaries.

### 11.1 Must remain true

- Sessions remain private unless explicitly shared.
- Review participation still requires authentication.
- Structured requests remain visible only to owner, assigned reviewer, or staff.
- Reviewer invites must not expose private session metadata beyond the current review preview already visible on the review route.

### 11.2 Claim safety rules

- A `ReviewerInvite` can only be claimed once.
- Claim must fail if the invite is revoked, expired, or already claimed by another user.
- If an existing authenticated user follows a claim link, the backend must validate whether that user may take over the pending invite.
- Staff may inspect and repair broken invite state, but normal users may not reassign claimed invites.

## 12. Delivery Plan

Ship this in three phases.

### Phase 1 — Sharing clarity and reviewer invite plumbing

Scope:

- add `ReviewerInvite` model and migrations
- add reviewer invite endpoints
- update registration/sign-in claim side effects
- split session-detail share UI into clear paths
- show pending reviewer invites

Acceptance:

- learner can create a reviewer invite from session detail
- new reviewer can sign up from the bundled link and land in the thread
- accepting the invite creates roster membership automatically
- future structured requests can be created for that reviewer

### Phase 2 — Response composition improvements

Scope:

- expose note field, category selector, templates, and template save in review page
- keep video-required rule for new responses
- improve reviewer success and error messaging

Acceptance:

- reviewer can record/upload video, add note, choose category, and attach timestamp in one flow
- reviewer can reuse templates from the review page
- existing edit/delete remains intact

### Phase 3 — Loop continuity and processing momentum

Scope:

- clearer post-response CTA states
- preserve request draft intent while session is processing
- improve readiness and retry copy
- improve next-take defaults from existing request context

Acceptance:

- learner sees one clear next action after feedback
- follow-up recording carries forward reviewer and request context
- processing wait state no longer discards share intent

## 13. Testing Strategy

This work touches protected flows and requires regression coverage.

### 13.1 Backend tests

Add or update tests for:

- reviewer invite creation
- reviewer invite claim on registration
- reviewer invite claim on sign-in
- roster membership auto-creation or reactivation
- revoked or expired invite rejection
- structured request creation after successful invite claim
- review feedback create/update with text and category fields preserved

### 13.2 Frontend tests

At minimum validate:

- share module behavior in `SessionDetail`
- reviewer join auth screen states
- review page response composer with optional metadata
- follow-up CTA behavior after response status transitions

### 13.3 Local gate

Use `scripts/test-core-loop.sh` as the default gate and extend it if needed for this work.

## 14. Analytics And Observability

Add instrumentation for:

- reviewer invite created
- reviewer invite claimed
- reviewer invite claim failed
- roster membership auto-created from invite
- private link opened with claim code
- first response submitted by newly claimed reviewer
- share blocked because session not ready
- follow-up take launched from responded or viewed state

This should help measure whether the flow is becoming easier, not just technically broader.

## 15. Rollout Plan

- Ship behind a feature flag if possible for invite plumbing and UI changes.
- Keep old share-link generation working during migration.
- Migrate no historical data unless needed for analytics.
- Do not require immediate conversion of existing invite codes into `ReviewerInvite` rows.
- Only new reviewer-onboarding flows need the new object model.

## 16. Risks And Tradeoffs

### 16.1 Extra model complexity

Adding `ReviewerInvite` increases system complexity.

This is acceptable because it removes logic that is currently spread awkwardly across:

- generic invite codes
- review links
- roster membership rules
- session-detail UI branching

### 16.2 Auth friction remains by design

Authentication is still required to participate in feedback.

This is a deliberate privacy tradeoff, not a bug. The goal is to make auth feel intentional and guided, not to remove it.

### 16.3 Video-first rule can still feel heavier than text-first tools

That is acceptable as long as:

- notes and templates make response creation faster
- recording and upload remain reliable
- the flow makes the next step obvious

## 17. Definition Of Done

This project is complete when:

- a learner can invite a new trusted reviewer directly from session detail
- that reviewer can join from the private link and become part of the learner's roster
- the learner can later send structured review requests to that reviewer without manual setup
- the reviewer can respond with video plus optional note/category/timestamp/template context
- the learner can clearly move from feedback to the next take
- all changes preserve private-by-default access and the member-owned archive model
