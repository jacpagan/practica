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
5. reviewer access and video-feedback submission

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

### 5. Reviewer feedback flow

- Reviewer opens `/r/:token`.
- Frontend loads:
  - `/api/review/:token/`
  - `/api/review/:token/feedback/`
- Backend resolves the link through shared review-link logic and returns explicit invalid, expired, or revoked states.
- Reviewer records or uploads a response video.
- Frontend posts feedback to `/api/review/:token/feedback/`.
- Backend saves a `VideoFeedback` row and returns the created feedback item.

## What Is Working Well In The Shipped Foundation

- The private library, session detail, and review page form a coherent owner-to-reviewer loop.
- Review-link invalid, expired, and revoked states are modeled explicitly in backend responses and frontend UX.
- Share-link creation is gated on playback readiness.
- Review responses are already video-first and can include timestamps plus optional notes.
- The product has stronger privacy semantics than general-purpose messaging or file-sharing tools.

## Top Flow Gaps For The Member-First v2 With Teacher Workflow Layer

### P0 — The review flow is built for generic authenticated responders, not assigned teacher workflow owners

The current review flow enforces authenticated access and explicit invalid, expired, and revoked states, but it does not model an assigned teacher workflow object.

Impact:

- Any logged-in authorized responder can act like the reviewer.
- Teacher queue ownership, response promises, and routing are not first-class.
- This is good enough for private-link collaboration but not yet for a structured teacher workflow layer.

### P0 — `ReviewLink` is an access primitive, not a workflow primitive

The current product uses `ReviewLink` to gate access, but teacher-led workflows need a structured request object with intent and ownership.

Impact:

- There is no native place for goal, turnaround, designated teacher, or request status.
- Teacher inbox, roster, and cycle analytics cannot be modeled cleanly on links alone.
- The product cannot yet distinguish a casual share from a formal feedback request.

### P1 — There is no teacher inbox or roster surface

The shipped product gives owners a library and reviewers a link page, but it does not give teachers an operational home.

Impact:

- Teachers cannot see all pending work in one place.
- Repeated use depends on memory, ad hoc links, or external coordination.
- The product still behaves more like a tool than a platform.

### P1 — Member archive ownership is clear, but teacher workflow ownership is not

The current data model keeps `Session.user` as the archive owner, which is strategically correct for v2. What is missing is a relationship and workflow layer that gives teachers controlled access without taking content ownership away from members.

Impact:

- There is no explicit teacher-student roster model scoped to workflow context.
- The system cannot express designated reviewer permissions cleanly.
- Studio and multi-teacher expansion remain awkward until this layer exists.

### P1 — Standardization is too light for analytics, routing, and future matching

The current `Session`, `Chapter`, `Tag`, and timestamped feedback model contains strong raw material, but it lacks a small shared schema for instrument, level, goal, turnaround, and feedback category.

Impact:

- Search, analytics, and AI summarization will remain shallow.
- Teacher triage will be slower than necessary.
- Platform learning loops will be hard to compare across submissions.

### P2 — The current low-pressure UX can be damaged by overbuilding v2

The shipped product is intentionally simple, private, and low pressure. Adding teacher workflow without identity/workflow separation could turn the product into a heavy LMS too early.

Impact:

- Member experience could become too administrative.
- Teachers could face more overhead than value.
- The product could lose its strongest emotional advantage: easy private sharing and clear video feedback.

## Recommended Delivery Order

1. Preserve and harden the current trusted private-library and playback flow.
2. Add `ReviewRequest` as a workflow object without breaking existing sharing.
3. Add a teacher inbox for pending and completed requests.
4. Add a lightweight roster and designated-teacher permissions.
5. Add structured request metadata and reusable templates.
6. Add cycle analytics after the workflow object exists.

## Suggested Definition Of Done For v2 Foundation Work

- The member can still record, upload, watch, and privately share without extra friction.
- A teacher can own a request from inbox to response without using external tools.
- The system can distinguish a generic link from a formal teacher review request.
- Permissions fail closed and are easy to explain in the UI.
- Completed review cycles are measurable from backend events and visible in product surfaces.

## Canonical Model Alignment Notes

To stay aligned with the v2 PRD:

- Keep `member` as the global identity model.
- Treat `teacher` and `student` as workflow-context labels on `ReviewRequest`.
- Keep `ReviewLink` for lightweight access and `ReviewRequest` for structured workflow.
- Preserve member ownership of `Session` artifacts across all teacher workflows.
