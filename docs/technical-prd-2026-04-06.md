# Practica Technical Product Requirements Document

**Date:** April 27, 2026
**Status:** Current-state technical PRD  
**Version:** Reflects the app as implemented as of commit `1c2985b` (update this line when the snapshot meaningfully drifts).

## 1. Purpose

This document describes Practica as it exists today in code and production behavior.

It is not a strategy roadmap. It is a technical product snapshot of:

- the current user-facing product,
- the current backend and frontend system shape,
- the implemented flows and constraints,
- the active data model,
- and the known limitations that still affect product quality.

## 2. Product Definition

Practica is a private video practice application for learners to:

- record or upload a take,
- watch themselves privately,
- organize repeated takes into practice threads,
- and invite trusted feedback through lightweight review links or structured review requests.

The app is student- or learner-centered in product behavior. Teacher and reviewer workflows exist as a secondary layer on top of the learner-owned archive.

## 3. Product Scope Today

### 3.1 In scope

- invite-only account creation
- token-based authenticated web app
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

### 3.2 Out of scope

- public discovery
- public profiles or social feeds
- anonymous feedback access
- school or institution administration
- billing and subscriptions
- public marketplace mechanics
- practice-plan systems or streak systems
- rich comparison tooling beyond thread/history organization
- email or push-notification delivery infrastructure

## 4. Product Goals Supported Today

The current product supports these functional goals:

1. A learner can create a private video take reliably.
2. A learner can revisit prior takes in a private archive.
3. A learner can group repeated takes into a named practice thread.
4. A learner can invite trusted feedback on a take.
5. A reviewer can respond with private video feedback attached to the take.
6. The learner can continue the loop with a follow-up take.

## 5. Roles And Access Model

### 5.1 Base identity

- Every signed-in person is a `member` backed by Django `auth_user`.
- The frontend uses token auth stored in browser local storage.

### 5.2 Workflow roles

- `session owner` / `student`: the member who owns the take and archive artifact.
- `reviewer`: a trusted person who can respond to a review link or assigned review request.
- `teacher`: not a distinct account type; represented operationally through reviewer workflows.

### 5.3 Access rules

- Sessions are private to their owner unless explicitly shared.
- Structured review requests are only visible to the owner, the assigned reviewer, or staff.
- Review links are private links, but the current v2 review thread still requires authentication to participate.
- Reviewer roster membership gates structured review request creation.

## 6. Current User-Facing Surfaces

### 6.1 Authentication

**Routes and UI**

- unauthenticated default surface: `AuthForm`
- public policy route: `/privacy`

**Requirements**

- The system must support registration via `username`, `password`, `display_name`, and `invite_code`.
- The system must reject invalid or exhausted invite codes.
- The system must support login with username/password.
- The client must persist auth tokens locally and restore the signed-in session via `/api/auth/me/`.

**Current implementation notes**

- Registration is invite-only.
- No password reset, email verification, or social login is implemented.

### 6.2 Archive / calendar

**Routes**

- `/`
- `/archive`
- `/calendar`

**Requirements**

- The system must show the signed-in member only their own sessions.
- The archive must group activity by date.
- The archive must summarize repeated takes by `practice_series`.
- The archive must support month-based navigation and month-bounded loading.
- The archive must surface follow-up signals from structured review requests where available.

**Current implementation notes**

- The primary archive UI is calendar-first.
- Day views group sessions by practice thread.
- A learner can jump from calendar day -> thread -> session detail.

### 6.3 Practice thread view

**Route**

- `/series/:seriesName`

**Requirements**

- The system must show all sessions in the selected `practice_series` owned by the current member.
- The system must expose recent thread context, including latest session and prior sessions.
- The system must allow renaming the practice thread.
- The system must support creating a new take directly into the current thread.

**Current implementation notes**

- Practice threads are string-based via `practice_series`, not a separate normalized model.
- Thread view exposes a lightweight progression surface, not a full comparison tool.

### 6.4 Upload flow

**Route**

- `/upload`

**Requirements**

- The system must allow upload of a video file with title and optional metadata.
- The system must support `practice_series`, `description`, `reference_title`, `reference_url`, and tags during create/update flows.
- The system must reject non-video uploads.
- The system must support uploads up to `2GB`.
- When direct S3 uploads are configured, the client must use multipart upload with resume support.
- When direct uploads are not configured, the client must fall back to app-mediated upload.
- After upload, the system must create a `Session` and begin media processing.

**Current implementation notes**

- The frontend keeps a local preview before upload.
- Multipart resume state is stored client-side.
- Navigation warns before aborting an in-progress upload.

### 6.5 Built-in recording

**Routes**

- `/record`
- recorder modal entry from upload flow

**Requirements**

- The app must support browser-based recording using camera and microphone.
- Built-in recording must be limited to `300` seconds (`5` minutes).
- The recorder must create a file that flows into the same upload/session creation path as manual file uploads.

**Current implementation notes**

- Recording is browser-only.
- Recording is positioned as quick capture, while longer takes should use file upload.

### 6.6 Session detail

**Route**

- `/sessions/:id`

**Requirements**

- The owner must be able to watch the take.
- The owner must see playback status (`uploaded`, `processing`, `ready`, `failed`).
- The owner must be able to edit session metadata.
- The owner must be able to move a session into or out of a practice thread.
- The owner must be able to rename practice threads across sessions.
- The owner must be able to delete the session.
- The owner must be able to retry media processing when a session is stuck or failed.
- The owner must be able to create or revoke a private review link.
- The owner must be able to create structured review requests to designated reviewers.
- The owner must be able to open the private review thread for a request.
- The owner must be able to launch a follow-up recording flow from the current loop.

**Current implementation notes**

- Playback prefers derived processing assets when available.
- Session detail is the main orchestration surface for review requests.
- The session detail UI shows request state and attached feedback context.

### 6.7 Lightweight review link flow

**Routes**

- owner creates via `/api/sessions/:id/share/`
- recipient opens `/r/:token`

**Requirements**

- The owner must be able to create a private review link for a session.
- The system must support link expiration and revocation.
- The review link page must resolve the session and link state.
- The system must reject invalid, expired, or revoked links.
- The current product must require authentication before review participation.

**Current implementation notes**

- `GET /api/review/:token/` is public in the technical sense but returns `auth_required: true` and only exposes full workflow data to authorized signed-in users.
- Lightweight review links can exist independently of structured review requests.

### 6.8 Structured review request flow

**Primary surfaces**

- session detail request composer
- review page `/r/:token`
- reviewer inbox `/requests`

**Requirements**

- A learner must be able to request structured review on a playback-ready session.
- A request must require an assigned reviewer from the learner’s active roster.
- A request must capture workflow metadata such as instrument, goal, notes, exercise or song, optional turnaround, and optional deadline.
- A follow-up request must preserve the reviewer relationship and link back to the parent request.
- The request must generate an associated `ReviewLink` for the private thread.
- The system must track request lifecycle events and status changes.

**Current statuses**

- `requested`
- `opened`
- `responded`
- `viewed`
- `needs_resubmission`
- `declined_unrelated`
- `flagged`
- `resubmitted`
- `revoked`
- `closed`

**Current implementation notes**

- The learner can only request review on their own playback-ready sessions.
- Follow-up requests require a new session and the same reviewer as the parent request.
- Roster membership is enforced at validation time.

### 6.9 Review page / private thread

**Route**

- `/r/:token`

**Requirements**

- The page must show the shared session and any associated request context.
- The reviewer must be able to respond with private video feedback.
- Video feedback may include optional text, optional category, and optional timestamp.
- The system must support edit/delete of authored feedback items.
- The page must support template application for feedback notes.
- If the page represents a structured request, only the assigned reviewer may respond.
- When the reviewer responds on a structured request, the request status must move to `responded`.
- When the owner views a responded request, the system must be able to transition to `viewed`.

**Current implementation notes**

- Feedback video is required for new feedback creation in the current v2 flow.
- The product still carries `is_legacy_text_feedback` support in the model for older data paths.
- The review page is the main place where the reviewer uses saved templates.

### 6.10 Reviewer workspace

**Route**

- `/requests`

**Requirements**

- A reviewer must have an inbox listing assigned review requests.
- The inbox must prioritize requests that still need action.
- The reviewer must be able to open the private thread from the inbox.

**Current implementation notes**

- The current reviewer workspace is intentionally lightweight.
- There is no full teacher control panel or institutional workspace.

### 6.11 Notifications

**Requirements**

- The app must show lightweight in-app notifications for review responses that the owner has not yet marked viewed.
- The owner must be able to mark a response as viewed from the notification surface.
- Notification pause state and seen state must persist locally in the browser.

## 7. Frontend Application Architecture

### 7.1 Stack

- React 18
- Vite
- Tailwind CSS
- single-page app routed in `App.jsx`

### 7.2 Current routes

- `/`, `/archive`, `/calendar`, `/library` -> calendar / archive (query `?date=` supported on `/`)
- `/privacy` -> privacy page
- `/upload` -> upload flow
- `/record`, `/recording` -> dedicated recording flow (aliases)
- `/requests` -> reviewer inbox
- `/series/:seriesName` -> practice thread view
- `/sessions/:id` -> session detail
- `/r/:token` -> private review thread

### 7.3 Client state model

- auth token stored in local storage
- route state held in React app state and browser history
- upload guard state blocks accidental navigation during active upload
- multipart upload resume state stored client-side
- notifications seen/pause state stored client-side

### 7.4 Primary frontend modules

- `App.jsx`: route orchestration and shared shell
- `SessionUpload.jsx`: upload form and upload lifecycle
- `RecorderPage.jsx` / `RecorderModal.jsx` / `VideoRecorder.jsx`: browser recording
- `CalendarView.jsx`: archive calendar and day drill-down
- `SeriesView.jsx`: practice thread history
- `SessionDetail.jsx`: playback, metadata, request orchestration
- `ReviewPage.jsx`: private review thread and reviewer feedback flow
- `TeachingView.jsx`: reviewer inbox
- `NotificationsBell.jsx`: owner-side response notifications

## 8. Backend Application Architecture

### 8.1 Stack

- Django 6.x (unpinned in `requirements.txt`; CI and production use compatible 6.x)
- Django REST Framework
- Django token auth
- SQLite by default in local development
- PostgreSQL in production

### 8.2 Domain modules

- `videos.views`: auth, invite codes, diagnostics, health
- `videos.library.api`: session CRUD and owner-side actions
- `videos.media.api`: multipart uploads and processing callbacks
- `videos.reviews.api`: review links, feedback, inbox, templates, review requests
- `videos.reviews.services`: request lifecycle state transitions and events
- `videos.services.media_pipeline`: browser playback processing pipeline

### 8.3 Current operational architecture

- Django serves API and the built SPA entrypoint
- production runs on EC2 via Docker Compose
- production services include `backend`, `db` (Postgres), and `redis`
- production deploy uses GitHub Actions + AWS SSM
- media can be stored locally or in S3 depending on environment
- session processing can use AWS MediaConvert or local ffmpeg fallback

## 9. Data Model

### 9.1 Core tables in current models

- `Profile`: display name extension on auth user
- `SignupInviteCode`: invite-only registration control
- `Tag`: freeform session organization tags
- `Session`: learner-owned private take
- `SessionAsset`: derived playback assets for a session
- `MultipartSessionUpload`: direct-upload staging record
- `Exercise`: named exercise library object
- `Chapter`: timestamped marker inside a session
- `SessionLastSeen`: per-user last seen marker for session feedback
- `VideoFeedback`: attached private reviewer response
- `ReviewLink`: private link wrapper around a session/thread
- `ReviewerRosterMembership`: trusted reviewer relationship
- `ReviewRequest`: structured async review workflow record
- `ReviewRequestEvent`: request lifecycle audit trail
- `FeedbackTemplate`: reviewer-saved template text

### 9.2 Core relationships

- `User 1 -> many Session`
- `Session 1 -> many SessionAsset`
- `Session many <-> many Tag`
- `Session 1 -> many VideoFeedback`
- `Session 1 -> many ReviewLink`
- `Session 1 -> many ReviewRequest`
- `ReviewRequest 1 -> many VideoFeedback`
- `ReviewRequest 1 -> many ReviewRequestEvent`
- `ReviewerRosterMembership` links `reviewer` and `student`
- `ReviewRequest` may point to a `parent_request` for follow-up loops

### 9.3 Data model notes

- `practice_series` is currently a string field on `Session`, not a dedicated thread model.
- The app includes `Exercise` and `Chapter` models, but these are not a primary surfaced flow in the current SPA.
- Some older migrations contain retired concepts from prior product directions; current runtime models above are the source of truth.

## 10. API Surface Summary

### 10.1 Auth and identity

- `POST /api/auth/register/`
- `POST /api/auth/login/`
- `GET /api/auth/me/`
- `GET /api/users/search/`

### 10.2 Invite codes

- `GET /api/invite-codes/`
- `POST /api/invite-codes/`
- `DELETE /api/invite-codes/:id/`

### 10.3 Sessions

- `GET /api/sessions/`
- `POST /api/sessions/`
- `GET /api/sessions/:id/`
- `PATCH /api/sessions/:id/`
- `DELETE /api/sessions/:id/`
- `POST /api/sessions/threads/rename/`
- `POST|DELETE /api/sessions/:id/share/`
- `POST /api/sessions/:id/share/revoke/`
- `POST /api/sessions/:id/retry-processing/`
- `POST /api/sessions/:id/set_tags/`
- `POST /api/sessions/:id/add_chapter/`
- `PATCH /api/sessions/:id/chapters/:chapter_id/update/`
- `DELETE /api/sessions/:id/chapters/:chapter_id/`
- `POST /api/sessions/:id/video-feedback/`
- `PATCH|DELETE /api/sessions/:id/video-feedback/:feedback_id/`
- `POST /api/sessions/:id/mark_seen/`

### 10.4 Multipart uploads and processing

- `POST /api/sessions/multipart/initiate/`
- `POST /api/sessions/multipart/status/`
- `POST /api/sessions/multipart/sign-part/`
- `POST /api/sessions/multipart/complete/`
- `POST /api/sessions/multipart/abort/`
- `POST /api/sessions/:id/processing-update/`

### 10.5 Review links and feedback threads

- `GET /api/review/:token/`
- `GET|POST|PATCH|DELETE /api/review/:token/feedback/`

### 10.6 Review requests and reviewer surfaces

- `GET|POST /api/review-requests/`
- `PATCH /api/review-requests/:id/`
- `POST /api/review-requests/:id/mark-viewed/`
- `GET /api/inbox/`
- `GET /api/connections/`
- `GET /api/feedback-insights/`
- `GET|POST /api/feedback-templates/`
- `PATCH|DELETE /api/feedback-templates/:id/`

### 10.7 Diagnostics

- `GET /health/`
- `GET /ready/`
- `GET /version`
- `POST /api/client-errors/`

## 11. Media Processing Requirements

### 11.1 Session processing

- New uploaded sessions must enter `processing` immediately after creation.
- The system must create browser-playable derivatives when required.
- The system must store derived assets as `SessionAsset` records.
- The system must support both AWS MediaConvert and local ffmpeg fallback paths.
- If processing is unavailable, the session must enter `failed` with a user-visible error.

### 11.2 Session asset types supported today

- `proxy_mp4`
- `hls_master`
- `thumb_sprite`
- `thumb_vtt`

### 11.3 Feedback video processing

- Reviewer feedback videos must be normalized into browser-safe playback form before save completion.
- Feedback creation currently expects a video artifact, not text-only authoring, for the active path.

## 12. Privacy, Security, And Permissions

### 12.1 Privacy model

- Sessions are private by default.
- Only the session owner can list, retrieve, edit, or delete their own sessions unless staff.
- Review requests are scoped to the owner, reviewer, or staff.
- Review links are private and revocable.
- Review interaction is authenticated even when the link itself is shareable.

### 12.2 Security controls implemented today

- token auth for SPA requests
- rate limits on registration, login, and client error endpoints
- hidden admin path in production
- health/readiness endpoints for deployment safety
- request and client error logging

### 12.3 Not implemented today

- granular team/workspace permissions
- anonymous reviewer participation
- end-user billing permissions model
- formal audit UI beyond request events

## 13. Current Operational And Reliability Requirements

- The app must build as a single production bundle served by Django.
- The app must expose health and readiness checks for deployment verification.
- The backend must run migrations before production cutover.
- Production deploy must verify backend health before public verification.
- The app must preserve the core loop under focused regression coverage.

### 13.1 Current local and CI gate

The protected local gate is `scripts/test-core-loop.sh`, which currently verifies:

- auth onboarding
- review request and feedback behavior
- multipart upload recovery
- frontend production build

## 14. Known Limitations And Product Gaps

### 14.1 Product gaps already visible in current code and docs

- the learner-led mirror is stronger in behavior than in marketing language
- reviewer provisioning still depends on roster setup and is thinner than the main learner flow
- thread comparison is organizational, not yet a strong side-by-side or progress-analysis tool
- the reviewer workspace is lightweight and not yet a full teacher operating surface
- metrics endpoints exist, but richer self-led practice measurement is still limited

### 14.2 Technical/product limitations

- no billing or monetization system
- no password recovery flow
- no mobile native app; current product is mobile web and desktop web only
- no dedicated frontend unit/integration test suite beyond production build and E2E-style coverage
- no currently active public landing/marketing funnel inside the product app

### 14.3 Codebase notes relevant to current-state understanding

- some backend models and migrations reflect retired concepts from earlier product directions
- `apps/backend/videos/urls.py` contains legacy HTML-era routes that are not wired into the current root URL config
- some API capabilities, such as chapters/exercises and insights, are more complete in the backend than in the current frontend UX

## 15. Non-Functional Expectations

The current app implicitly requires:

- boringly reliable upload and playback for the core loop
- private-by-default data handling
- browser-safe playback for both learner sessions and reviewer feedback videos
- clear recovery paths when media processing fails
- low-friction follow-up loop after feedback

## 16. Technical Source Map

Key implementation files for this current-state PRD:

- `apps/frontend/src/App.jsx`
- `apps/frontend/src/auth.jsx`
- `apps/frontend/src/components/CalendarView.jsx`
- `apps/frontend/src/components/SeriesView.jsx`
- `apps/frontend/src/components/SessionUpload.jsx`
- `apps/frontend/src/components/RecorderPage.jsx`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`
- `apps/frontend/src/components/TeachingView.jsx`
- `apps/frontend/src/components/NotificationsBell.jsx`
- `apps/backend/practica/urls.py`
- `apps/backend/practica/settings.py`
- `apps/backend/videos/models.py`
- `apps/backend/videos/serializers.py`
- `apps/backend/videos/views.py`
- `apps/backend/videos/library/api.py`
- `apps/backend/videos/media/api.py`
- `apps/backend/videos/media/services.py`
- `apps/backend/videos/reviews/api.py`
- `apps/backend/videos/reviews/services.py`
- `scripts/test-core-loop.sh`

## 17. Bottom Line

As of April 27, 2026, Practica is a working private video practice application with a credible learner-owned archive, a playback-processing pipeline, authenticated private review threads, and a structured reviewer workflow layer.

Its strongest implemented loop is:

`upload or record -> playback-ready session -> review request or private thread -> reviewer response -> learner follow-up take`

Its biggest current limitations are not conceptual but operational:

- reviewer provisioning is still thinner than the learner flow,
- comparison and self-review depth are still lighter than the archive foundation,
- and the teacher workflow layer is useful but not yet fully mature.
