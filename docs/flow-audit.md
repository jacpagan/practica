# Flow Audit

## Scope

This audit covers the current end-to-end user flows implemented across:

- `apps/frontend/src/App.jsx`
- `apps/frontend/src/components/SessionUpload.jsx`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`
- `apps/backend/videos/views.py`
- `apps/backend/videos/serializers.py`

Primary flows reviewed:

1. Authentication
2. Private library upload
3. Session detail and processing
4. Private share-link creation and revocation
5. Reviewer access and video-feedback submission

## Current-State Flow Map

### 1. Authentication

- Anonymous users hit the SPA and are shown `AuthForm`.
- Successful login or registration stores a token in local storage.
- App bootstrap calls `/api/auth/me/` to restore the session.
- After auth, the SPA keeps the originally parsed route and renders the matching view.

### 2. Owner Upload Flow

- Authenticated user navigates to `/upload`.
- User records or selects a video in `SessionUpload`.
- Frontend submits either:
  - regular multipart form POST to `/api/sessions/`, or
  - direct multipart upload flow for large files.
- Backend creates a `Session`, attaches tags, and starts media processing.
- Frontend navigates to `/sessions/:id` after success.

### 3. Owner Session Detail Flow

- User opens `/sessions/:id`.
- Frontend fetches `/api/sessions/:id/`.
- User can edit metadata, retry processing, refresh, download original, delete, or create a private review link.
- Feedback videos attached to the session render inline in the detail view.

### 4. Private Share Link Flow

- Owner creates a link via `/api/sessions/:id/share/`.
- Backend creates or reuses an active `ReviewLink`.
- Frontend copies the link for sharing.
- Reviewer is expected to open `/r/:token`, authenticate, watch the source video, and submit a video reply.

### 5. Reviewer Feedback Flow

- Reviewer opens `/r/:token`.
- Frontend loads:
  - `/api/review/:token/`
  - `/api/review/:token/feedback/`
- Reviewer records or uploads a response video.
- Frontend posts to `/api/review/:token/feedback/`.
- Backend saves a `VideoFeedback` row and returns the created feedback item.

## Top Flow Gaps

### P0 — Review-link resolution is broken at the backend

The review endpoints call `_active_review_link_or_404(token)`, but that helper is not defined in `apps/backend/videos/views.py`.

Impact:

- Review link open can fail before business rules are applied.
- Review feedback submission can fail before authorization and validation logic runs.
- The entire share/reviewer flow is unstable.

### P0 — Share-link revoke contract is mismatched between frontend and backend

The frontend calls `DELETE /api/sessions/:id/share/`, while the backend exposes `POST /api/sessions/:id/share/revoke/`.

Impact:

- Owners can create links but cannot reliably turn them off from the UI.
- A “revoked” link may remain active even though the user explicitly attempted to disable it.
- This breaks trust in privacy and access control.

### P1 — Owners can share sessions that are not actually review-ready

Share-link creation has no guard against `processing_status` states like `processing` or `failed`.

Impact:

- Reviewers can receive links to videos that are not playable.
- The reviewer journey can dead-end after successful login.
- Owners are not warned that they are sharing a broken review experience.

### P1 — Standard session upload lacks backend video-file validation

Large direct uploads validate file type in the backend, but regular `/api/sessions/` creation trusts the serializer and has no equivalent server-side video validation.

Impact:

- Frontend filtering can be bypassed.
- Non-video files can enter the session pipeline.
- Downstream processing and playback logic can fail in inconsistent ways.

### P1 — Upload flow allows leaving the screen during an active save

`SessionUpload` disables the submit button while uploading, but the cancel action stays available and the global nav remains active.

Impact:

- Users can abandon an in-flight upload with no definitive outcome.
- Retries can create ambiguity about whether a session was saved.
- This is especially risky on slow networks and large uploads.

### P2 — Staff permission semantics are inconsistent

`can_edit_session()` allows staff edits, but `_visible_sessions_qs()` only returns the current user’s sessions.

Impact:

- Staff capability is implied in serializers and permission helpers but blocked by queryset visibility.
- Admin/debug flows are harder to reason about.

### P2 — Review-link failure states are not modeled clearly

The current flow does not visibly distinguish invalid token, expired token, revoked token, or disabled feedback.

Impact:

- Reviewers get generic failure states.
- Owners cannot tell what action to take next.
- Support/debug time goes up because all failures look similar.

## Agile Stories

### Story 1 — Make private review links resolvable

- **As a** reviewer
- **I want** every private review link to resolve through one explicit backend rule
- **So that** valid links open and invalid ones fail predictably

Acceptance criteria:

- Backend defines a single helper/service that resolves a review link by token.
- Valid link requires `is_active=True` and `expires_at > now`.
- Invalid, expired, or revoked links return controlled API errors instead of server errors.
- Both `/api/review/:token/` and `/api/review/:token/feedback/` use the same resolution logic.

### Story 2 — Let owners reliably revoke private links

- **As an** owner
- **I want** the “Turn off link” action to match the backend contract
- **So that** shared access ends immediately when I revoke it

Acceptance criteria:

- Frontend calls the actual revoke endpoint and method used by the backend, or backend supports the frontend contract.
- Revoked links no longer open the review page.
- Revocation updates the owner UI without requiring a manual refresh.
- Backend test covers create → revoke → rejected access.

### Story 3 — Only share review-ready sessions

- **As an** owner
- **I want** to share only sessions that can actually be reviewed
- **So that** reviewers never land on a broken playback page

Acceptance criteria:

- Backend blocks share-link creation unless the session is review-ready.
- Frontend explains why link creation is unavailable for `processing` and `failed` sessions.
- Retry-processing path returns the session to a state that can later become shareable.
- Reviewers never receive a link for a non-playable session.

### Story 4 — Enforce server-side video validation for all upload paths

- **As a** system
- **I want** every upload entry point to validate file type consistently
- **So that** invalid files are rejected before session creation and processing

Acceptance criteria:

- `/api/sessions/` rejects non-video uploads on the backend.
- Multipart and non-multipart uploads follow the same validation rules.
- Error messages are user-readable and consistent.
- Tests cover valid video upload and invalid file rejection.

### Story 5 — Make active uploads non-ambiguous

- **As an** owner
- **I want** clear behavior while a video is saving
- **So that** I do not accidentally interrupt or duplicate an upload

Acceptance criteria:

- Upload screen prevents destructive navigation while upload is active, or explicitly confirms it.
- Cancel action is disabled or converted into an intentional abort flow during upload.
- UI communicates whether the upload can resume, retry, or is definitely lost.
- Post-upload success always lands in a deterministic next state.

### Story 6 — Model review-link failure states explicitly

- **As a** reviewer
- **I want** meaningful link failure messages
- **So that** I know whether to log in again, request a new link, or stop trying

Acceptance criteria:

- API differentiates invalid, expired, and revoked links.
- Frontend renders distinct messages for each failure state.
- Disabled feedback renders a specific “view-only” or “feedback disabled” state.

### Story 7 — Align staff visibility with permission rules

- **As a** staff user
- **I want** visibility rules to match edit permissions
- **So that** admin-only support flows behave consistently

Acceptance criteria:

- Queryset visibility and permission helpers follow the same staff policy.
- Staff-only access is either fully supported or intentionally removed.
- Tests verify the chosen rule.

## Recommended Delivery Order

1. Story 1 — Fix review-link resolution
2. Story 2 — Fix revoke-link contract
3. Story 3 — Guard share to review-ready sessions
4. Story 4 — Add backend validation for normal uploads
5. Story 5 — Harden in-flight upload UX
6. Story 6 — Improve review-link failure states
7. Story 7 — Align staff semantics

## Suggested Definition of Done

- Backend tests cover the happy path and the blocked path for each flow transition.
- Frontend screens reflect backend state instead of assuming success.
- A user can never advance to the next screen unless the backend agrees the transition is valid.
- Link, upload, and review flows all fail closed instead of failing ambiguously.
