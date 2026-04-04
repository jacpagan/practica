# Flow Audit

This document audits the shipped flow foundation and highlights the gaps that matter most before and during Practica v2.

For strategic direction, use `docs/practica-v2-prd.md`.

## Scope

This audit covers the implemented end-to-end user flows across:

- `apps/frontend/src/App.jsx`
- `apps/frontend/src/components/SessionUpload.jsx`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`
- `apps/backend/videos/views.py`
- `apps/backend/videos/serializers.py`
- `apps/backend/videos/models.py`

Primary shipped flows reviewed:

1. authentication
2. private library upload
3. session detail and processing
4. private share-link creation and revocation
5. structured review-request creation and follow-up
6. reviewer access and video-feedback submission
7. reviewer workspace triage

## Current-State Flow Map

### 1. Authentication

- Anonymous users land in the SPA and see `AuthForm`.
- Login and registration store an auth token locally.
- App bootstrap restores user state through `/api/auth/me/`.
- Authenticated users keep using the route-oriented SPA flow.

### 2. Owner upload flow

- Authenticated user navigates to `/upload`.
- User records or selects a video in `SessionUpload`.
- Frontend submits either:
  - regular multipart POST to `/api/sessions/`, or
  - direct multipart upload flow for large files.
- Backend creates a `Session`, attaches tags, and starts media processing.
- Frontend navigates to `/sessions/:id` after success.

### 3. Owner session detail flow

- User opens `/sessions/:id`.
- Frontend fetches `/api/sessions/:id/`.
- User can edit metadata, retry processing, refresh, delete, or create a private review link.
- Share-link creation is gated by `processing_status === 'ready'`.
- Feedback videos render inline in the detail view.

### 4. Private share-link flow

- Owner creates a link through `/api/sessions/:id/share/`.
- Backend creates or reuses an active `ReviewLink`.
- Owner can copy or revoke the link from the session detail page.
- Reviewer opens `/r/:token`, authenticates, watches the source video, and can submit a feedback video if the link allows it.

### 5. Structured review-request flow

- Owner opens session detail and starts `Request feedback`.
- Frontend loads designated reviewers from `/api/connections/?role=student`.
- Owner can only assign a reviewer who already has an active roster relationship with that member.
- Frontend posts to `/api/review-requests/`.
- Backend creates a `ReviewRequest`, attaches a `ReviewLink`, records events, and preserves member ownership of the `Session`.
- Follow-up requests can be created on a new session while keeping the same reviewer and thread continuity.

### 6. Reviewer feedback flow

- Reviewer opens `/r/:token`.
- Frontend loads:
  - `/api/review/:token/`
  - `/api/review/:token/feedback/`
- Backend resolves the link through shared review-link logic and returns explicit invalid, expired, or revoked states.
- If the link belongs to a `ReviewRequest`, only the assigned reviewer and owner can access the structured thread.
- Reviewer records or uploads a response video.
- Frontend posts feedback to `/api/review/:token/feedback/`.
- Backend saves a `VideoFeedback` row, updates request state, and returns the created feedback item.

### 7. Reviewer workspace flow

- Reviewer opens `/requests`.
- Frontend loads `/api/inbox/`.
- Requests are grouped by next action: `needs action`, `waiting on member`, and `done`.
- Reviewer can open a thread directly into the private review page.

## What Is Working Well In The Shipped Foundation

- The private library, session detail, and review page form a coherent owner-to-reviewer loop.
- Review-link invalid, expired, and revoked states are modeled explicitly in backend responses and frontend UX.
- Share-link creation is gated on playback readiness.
- Review responses are already video-first and can include timestamps plus optional notes.
- `ReviewRequest` is now a real workflow primitive with assignee, status, events, and follow-up chaining.
- Reviewer inbox, roster-backed assignment, templates, and lightweight insights exist in the shipped foundation.
- Assigned review requests now fail closed: owners can only assign designated reviewers already on their roster.
- The owner and reviewer surfaces now expose clearer next steps across `requested`, `responded`, `needs_resubmission`, and follow-up states.
- The product has stronger privacy semantics than general-purpose messaging or file-sharing tools.

## Top Flow Gaps For The Member-First v2 With Teacher Workflow Layer

### P0 — Designated reviewer permissions exist, but reviewer provisioning is still thin

The shipped app now enforces roster-backed reviewer assignment for formal `ReviewRequest` creation. The remaining gap is how those roster relationships are created and managed.

Impact:

- Formal requests currently depend on admin- or invite-seeded roster setup.
- Private-link invites do not yet upgrade someone into a designated reviewer relationship.
- Repeated teacher workflows still require manual setup outside the main request composer.

### P0 — The review cycle exists, but continuation still spans multiple surfaces

The core `submission -> feedback -> resubmission` loop is present, but members still move between thread view, session detail, and fresh recording flow to continue the cycle.

Impact:

- The next action is clearer than before, but still split across more than one surface.
- Members may understand the thread state before they understand exactly where to record the next take.
- The product is close to a durable loop, but not yet fully frictionless.

### P1 — The reviewer workspace is now real, but intentionally minimal

The shipped reviewer workspace now supports inbox triage and thread entry, but it is still deliberately lightweight.

Impact:

- Reviewers can separate urgent work from waiting threads, which is good.
- Roster browsing, lightweight workload context, and repeated-use habits are still thin.
- This is the right tradeoff for now, but it remains a product area to harden carefully.

### P1 — Member archive ownership is correct, but reviewer provisioning remains operationally awkward

The current model correctly preserves `Session.user` as the member-owned archive artifact and uses `ReviewRequest` plus roster membership for workflow context. What remains awkward is the operational path into that relationship.

Impact:

- The ownership model is right for v2.
- The permission model is safer than before.
- The setup path into designated reviewer relationships is still not a first-class product moment.

### P1 — Standardization is too light for analytics, routing, and future matching

The current `Session`, `Chapter`, `Tag`, and timestamped feedback model contains strong raw material, but it lacks a small shared schema for instrument, level, goal, turnaround, and feedback category.

Impact:

- Search, analytics, and AI summarization will remain shallow.
- Teacher triage will be slower than necessary.
- Platform learning loops will be hard to compare across submissions.

### P1 — Local validation and environment reliability lag behind the shipped workflow layer

The product layer has moved faster than the local validation path.

Impact:

- The backend test path is still sensitive to local Postgres environment leakage.
- The SQLite path still hits legacy migration SQL incompatibilities and stale local schema issues.
- This slows down confidence-building work on otherwise focused product changes.

### P2 — The current low-pressure UX can be damaged by overbuilding v2

The shipped product is intentionally simple, private, and low pressure. Adding teacher workflow without identity/workflow separation could turn the product into a heavy LMS too early.

Impact:

- Member experience could become too administrative.
- Teachers could face more overhead than value.
- The product could lose its strongest emotional advantage: easy private sharing and clear video feedback.

## Recommended Delivery Order

1. Preserve and harden the current trusted private-library and playback flow.
2. Harden designated-reviewer provisioning without breaking private-link sharing.
3. Keep optimizing the completed review cycle: `submission -> feedback -> resubmission`.
4. Strengthen the lightweight reviewer workspace without turning it into a heavy dashboard.
5. Add structured request metadata and reusable templates where they directly improve routing and repeated use.
6. Improve local validation reliability so workflow changes are easy to verify.
7. Add richer cycle analytics only after workflow, permissions, and reliability are stable.

## Suggested Definition Of Done For v2 Foundation Work

- The member can still record, upload, watch, and privately share without extra friction.
- An assigned reviewer can own a request from inbox to response without using external tools.
- The system can distinguish a generic link from a formal teacher review request.
- Permissions fail closed and are easy to explain in the UI.
- Completed review cycles are measurable from backend events and visible in product surfaces.

## Canonical Model Alignment Notes

To stay aligned with the v2 PRD:

- Keep `member` as the global identity model.
- Treat `teacher` and `student` as workflow-context labels on `ReviewRequest`.
- Keep `ReviewLink` for lightweight access and `ReviewRequest` for structured workflow.
- Preserve member ownership of `Session` artifacts across all teacher workflows.
