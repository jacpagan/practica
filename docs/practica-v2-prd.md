# Practica v2 PRD

## Status

This document is the strategic source of truth for Practica v2.

It supersedes older generic positioning like "personal practice tracker" as the main product direction, while preserving the shipped private-library product as the foundation Practica already has.

Related docs:

- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline
- `docs/flow-audit.md`: implementation audit and platform-foundation gaps

## Executive Summary

Practica v2 turns the current private async video feedback product into a teacher-led private platform for async music instruction.

The v2 bet is:

- start with existing teacher-student relationships,
- focus on independent drum teachers first,
- keep student archives private and student-owned,
- give teachers lightweight workflow control,
- and measure success by completed review cycles, not by uploaded videos alone.

Practica is not an open marketplace in v2. It is a private interaction platform that helps teachers review more student practice with less chaos and better follow-through.

## Evidence Base

The strategic direction in this PRD is grounded in the codebase and repo documentation.

### What the product is today

The shipped product already implements:

- a private video library for user-owned sessions,
- authenticated private review links,
- video-first feedback replies,
- timestamp-aware feedback,
- playback processing and upload infrastructure,
- and owner-side session detail views that aggregate feedback around a source video.

Current product artifacts and implementation signals:

- `docs/platform-effects-mvp-playbook.md`
- `docs/flow-audit.md`
- `apps/backend/videos/models.py`
- `apps/backend/videos/views.py`
- `apps/backend/videos/serializers.py`
- `apps/frontend/src/components/SessionUpload.jsx`
- `apps/frontend/src/components/SessionDetail.jsx`
- `apps/frontend/src/components/ReviewPage.jsx`

### Strategic tension in the repo

The repo also contains signs of earlier, broader platform ambition:

- the root `README.md` previously framed Practica as a practice tracking system,
- historical migrations explored teacher-student relationships, invite codes, spaces, plans, and metrics,
- and alternate product descriptions leaned toward a broader role-based learning platform.

The v2 strategy resolves that tension by choosing a concrete next step:

- do not jump to a public marketplace,
- do not reintroduce full school or studio abstractions yet,
- do reintroduce the smallest possible teacher workflow layer on top of the existing private-library foundation.

## Product Thesis

Practica should become the private operating system for async music instruction between teachers and their existing students.

The core value proposition is:

"A student sends one private review request, the teacher responds with clear video feedback, and both sides keep a durable record of improvement over time."

## Product Type

Practica v2 is a teacher-led private platform, not an open marketplace.

That means:

- relationships start from existing teacher-student trust,
- access remains private and permissioned,
- teacher workflow matters more than public discovery,
- and network effects come from better specialization, credibility, and outcomes rather than from open-feed liquidity.

## Wedge

### Initial category

Independent drum teachers.

Why this wedge:

- drums are already the strongest instrument signal in the repo,
- video feedback is especially valuable for timing, posture, stick control, and groove,
- teachers already manage recurring student rosters,
- and async review naturally complements live lessons.

### Expansion path

If the drum-teacher wedge works, the product can later expand to:

- guitar,
- voice,
- piano,
- bass,
- and adjacent performance-coaching domains.

## Users

### Primary buyer

Independent teacher.

### Primary workflow owner

Teacher.

### Primary archive owner

Student.

### Core user types

#### Teacher

- Has an existing roster of students.
- Wants to review more student practice between lessons.
- Wants less context-switching across messaging apps and file links.
- Wants durable feedback history without a heavy LMS.

#### Student

- Records practice videos regularly.
- Wants clear, high-bandwidth feedback between lessons.
- Values privacy and a low-pressure workflow.
- Wants their own archive to remain theirs even if they stop working with one teacher.

## Problem Statement

Today, many teachers and students manage between-lesson feedback across text threads, shared drives, and ad hoc video links.

That creates predictable failure modes:

- feedback is scattered,
- version history is unclear,
- playback reliability is inconsistent,
- privacy and access control are weak,
- and there is no durable improvement loop tied to the original submission.

Practica solves this by making the submission, the review request, the feedback response, and the resubmission loop live in one private system.

## Jobs To Be Done

### Teacher JTBD

- When my students need feedback between lessons, help me review their practice asynchronously in a way that is fast, clear, and repeatable.

### Student JTBD

- When I am unsure whether I am practicing correctly, help me send one clear private submission and get specific video feedback tied to my actual performance.

## Product Principles

- `Private by default`: no student video becomes public or discoverable by default.
- `Student-owned archive`: the student keeps ownership of their session history.
- `Show first, then tell`: feedback remains video-first.
- `Teacher workflow over teacher analytics`: inbox, queue, roster, and templates before dashboards.
- `Completed cycles over content volume`: repeated `submission -> feedback -> resubmission` matters more than raw uploads.
- `Simple first, structured where it compounds`: add only enough structure to unlock routing, measurement, and repeatability.
- `Known relationships before discovery`: build for existing teacher-student graphs before building marketplace liquidity.

## Goals

### Product goals

- Turn the current private-link workflow into a first-class teacher-student review workflow.
- Give teachers a lightweight operating surface for pending reviews and active rosters.
- Preserve the student's private library as the system of record.
- Increase the percentage of submissions that receive feedback and lead to resubmission.

### Business goals

- Prove willingness to pay from independent music teachers.
- Establish a credible teacher OS wedge before expanding into studios or discovery.
- Build durable platform data around submissions, feedback, and iteration loops.

## Non-Goals For v2

Practica v2 does not aim to ship:

- an open teacher marketplace,
- public profiles and ratings,
- school-wide workspaces,
- courses and curriculum hierarchy,
- practice plans and daily streak mechanics,
- generic social feeds,
- or AI-generated text-only coaching that replaces human video feedback.

## Core Value Unit

The core value unit is the completed review cycle:

1. student submission,
2. structured review request,
3. teacher video feedback,
4. student consumption of feedback,
5. student resubmission.

This should become the main product, operational, and analytics primitive.

## V2 Scope

### 1. `ReviewRequest` as a first-class object

The current `ReviewLink` is an access-control primitive. Practica v2 needs a workflow primitive.

`ReviewRequest` should capture:

- source `Session`,
- student,
- designated teacher,
- instrument,
- level,
- goal,
- exercise or song,
- optional timestamps or chapters,
- requested turnaround,
- deadline,
- current status,
- and payment state if the business model requires it later.

### 2. Teacher inbox

Teachers need a simple queue for:

- new requests,
- opened requests,
- due soon,
- responded,
- viewed,
- resubmitted,
- and closed loops.

The inbox is a workflow surface, not a reporting dashboard.

### 3. Teacher roster

Teachers need a lightweight view of active students, including:

- recent submissions,
- pending requests,
- turnaround health,
- and repeat cycle frequency.

This should remain intentionally small in v2.

### 4. Feedback composition

The teacher feedback surface should preserve the current strengths and add small workflow upgrades:

- record or upload a feedback video,
- attach optional timestamps,
- add short supporting notes,
- categorize feedback markers,
- and save reusable response patterns or templates.

### 5. Governance and permissions

Practica v2 must tighten the current private-link model into deliberate workflow governance:

- designated teacher ownership of a request,
- deterministic request states,
- revocable access,
- expiration semantics,
- view-only vs reply permissions,
- and explicit invalid, expired, and revoked handling.

### 6. Student loop continuity

Students should be able to:

- create a review request from an existing private session,
- see the request state clearly,
- review teacher feedback in context,
- and start the next submission from that same thread of work.

## Functional Requirements

### FR-1 Student creates a review request from a session

- Student selects a private session from their library.
- Student creates a request for a designated teacher.
- Student provides at least a goal and instrument metadata.
- Student can optionally attach timestamps, tags, chapters, reference material, and a note.
- System creates a request record and grants access only to the designated teacher and authorized viewers.

### FR-2 Teacher has an actionable inbox

- Teacher can view pending and completed requests in one place.
- Teacher can filter by status, student, and due date.
- Teacher can open a request directly into the original source video.
- Teacher can see enough request metadata to triage quickly.

### FR-3 Teacher can reply with video-first feedback

- Teacher records or uploads a response video.
- Teacher can attach one or more timestamps or markers.
- Teacher can add optional short notes.
- Feedback remains attached to the source session and request context.

### FR-4 Student sees the loop state

- Student can tell whether a request is pending, opened, responded, viewed, or closed.
- Student can watch the teacher response in the source session detail view.
- Student can create a follow-up submission without losing the thread of work.

### FR-5 Permissions are explicit

- Only designated teacher accounts can submit feedback on a teacher-owned request unless the owner explicitly broadens access.
- Revoked or expired requests fail closed with clear UX states.
- Student archive ownership remains unchanged even if teacher access is revoked.

### FR-6 Request and cycle analytics exist from day one

- System tracks request creation, open, response, student-viewed, and resubmission events.
- Request status changes are queryable in product surfaces and reporting.
- Metrics support the north star and leading indicators defined below.

## Data Model Direction

The current data model already provides a strong base through `Session`, `ReviewLink`, `VideoFeedback`, `Chapter`, and `SessionLastSeen`.

Likely v2 additions:

- `TeacherProfile`: identifies a user operating as a teacher.
- `TeacherRosterMembership`: maps teacher-student relationships without taking archive ownership away from students.
- `ReviewRequest`: workflow object for the review cycle.
- `FeedbackTemplate`: reusable teacher reply patterns.
- optional categorized feedback markers or request metadata tables if needed for normalization.

Important constraint:

- `Session.user` should remain the student archive owner.

## API Direction

Indicative API additions for v2:

- `POST /api/review-requests/`
- `GET /api/review-requests/`
- `GET /api/review-requests/:id/`
- `PATCH /api/review-requests/:id/`
- `POST /api/review-requests/:id/respond/`
- `POST /api/review-requests/:id/mark-viewed/`
- `GET /api/teacher/inbox/`
- `GET /api/teacher/roster/`
- `GET /api/teacher/templates/`
- `POST /api/teacher/templates/`

The current review-link routes can remain for compatibility and non-teacher workflows, but v2 teacher flows should be routed through `ReviewRequest`.

## UX Requirements

### Student experience

- Keep the current upload and session-detail experience familiar.
- Add review-request creation without making the student feel like they are entering a heavy LMS.
- Keep privacy language explicit and reassuring.

### Teacher experience

- Optimize for quick triage and fast response.
- Do not require teachers to navigate full admin-style dashboards.
- Make the inbox the default starting surface.

## Success Metrics

### North star

- Completed review cycles per week.

### Leading indicators

- Active teachers with at least one pending or completed request each week.
- Active students with at least one request each week.
- Percentage of requests that receive a teacher response.
- Median teacher turnaround time.
- Percentage of responded requests viewed by students.
- Percentage of responded requests that lead to resubmission within 7 days and 30 days.

### Quality guardrails

- Playback-ready share or request success rate.
- Review-request open success rate.
- Feedback submission success rate.
- Expired, revoked, and invalid access states handled without ambiguity.

## Monetization Direction

For the teacher-led v2 strategy, teachers are the first buyer.

Recommended initial commercial model:

- teacher SaaS by seat or by active student band.

Rationale:

- the new control point is the teacher inbox and roster,
- the teacher realizes the clearest workflow ROI,
- and the product remains aligned with private known-relationship workflows.

Possible future monetization layers:

- premium student add-ons,
- paid review transactions,
- studio plans,
- and AI-assisted workflow augmentation.

## Release Plan

### Phase 0: Foundation hardening

- Resolve any trust-critical link, playback, upload, and review-state issues.
- Ensure the current private workflow is boringly reliable.

### Phase 1: Teacher OS v2

- Add `ReviewRequest`.
- Add teacher inbox.
- Add lightweight roster.
- Add designated-teacher permissions.
- Add simple templates.

### Phase 2: Structured improvement layer

- Add standardized request metadata.
- Add feedback categories and richer markers.
- Add cycle analytics and health views.

### Phase 3: Studio layer

- Consider school or studio workspaces only after teacher rosters and repeat cycles are healthy.

### Phase 4: Optional marketplace expansion

- Add public profiles, reputation, pricing, matching, payouts, and moderation only if Practica intentionally moves beyond the private-platform model.

## Risks

- Reintroducing too much teacher complexity too early could break the product's current low-pressure feel.
- A teacher inbox without strong governance will create confusion about ownership and response expectations.
- Marketplace ambitions too early could weaken the private-by-default trust advantage.
- Over-structuring feedback could flatten the human, demonstrative value of video replies.

## Decision Rules

When prioritizing product work, prefer features that:

- increase completed review cycles,
- reduce teacher review friction,
- preserve student ownership and privacy,
- strengthen governance and trust,
- or improve playback and upload reliability.

Deprioritize features that:

- optimize for public discovery,
- add heavy school-style administration,
- reintroduce streaks or daily-pressure mechanics,
- or replace human video feedback with text-first automation.

## One-Sentence Positioning

Practica helps drum teachers review more student practice asynchronously through private video requests, video-first feedback, and durable improvement history.
