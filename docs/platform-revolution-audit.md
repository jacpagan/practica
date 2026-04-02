# Practica Platform Revolution Audit

## Purpose

This document maps Practica's current product and implementation to the core platform design ideas from *Platform Revolution*.

It is not a legal or certification checklist. The book describes platform design principles: core interaction, participant roles, governance, filters, producer tools, and feedback loops. This audit uses those principles while staying aligned with `docs/practica-v2-prd.md`.

## Platform Definition For Practica

Practica should be treated as a trusted private interaction platform for async music instruction.

That means Practica is:

- a system that facilitates repeated exchanges between students and teachers,
- centered on private video submissions and private video feedback,
- designed for durable learning history rather than public discovery,
- and optimized for the completed review cycle: `submission -> feedback -> resubmission`.

Practica is not trying to be:

- a public marketplace,
- a public social network,
- or a heavy school operating system.

That boundary is consistent with both `docs/practica-v2-prd.md` and the book's idea that platforms should be explicit about the interaction they enable.

## Core Interaction Mapping

`Platform Revolution` says a platform should define a clear core interaction:

1. participants,
2. value unit,
3. filter,
4. and the rules that make exchange trustworthy.

Practica's current core interaction should be defined as:

- **Producer**: student submitting a practice video
- **Consumer**: teacher reviewing that submission
- **Value unit**: a private `Session` plus a structured `ReviewRequest` and attached `VideoFeedback`
- **Filter**: teacher inbox, roster, teacher selection, request status, and private review link access
- **Outcome**: actionable video feedback that leads to a next take

This is the right platform shape for Practica.

## Current Alignment

### Strong alignment

- **Private by default**: sessions remain owner-controlled and are not public.
- **Clear value unit**: the video artifact is central, and feedback stays attached to it.
- **Workflow object exists**: `ReviewRequest` upgrades sharing from access control to an actual workflow primitive.
- **Producer tools exist**: students can record, upload, organize by series, and request review.
- **Consumer tools exist**: teachers have inbox, roster, and feedback templates.
- **Invite-based trust model exists**: signup invite codes support a trusted-network growth model.
- **Repeat interaction model exists**: follow-up requests and practice series support recurring exchange instead of one-off transactions.

### Partial alignment

- **Filters are present but still basic**: inbox and roster exist, but ranking, prioritization, and capacity-aware routing are still shallow.
- **Governance exists but is incomplete**: review links and auth are in place, but policy boundaries have only partly been encoded.
- **Data loops exist but are thin**: the app captures request status and some insights, but does not yet measure full platform liquidity well.
- **Matching is manual**: students choose a teacher directly; there is no richer routing layer beyond search and recent teachers.

### Intentional non-goals that are still compliant

- **No public discovery**: acceptable because Practica is a private trusted platform, not a mass-market marketplace.
- **No public reputation layer**: acceptable for the current wedge.
- **No heavy institution abstraction**: acceptable because the current platform unit is teacher-student review flow, not school administration.

## Biggest Compliance Gaps

### 1. Governance around designated teacher access

For formal review requests, the platform should enforce who is allowed to participate in the interaction.

Before this audit, any authenticated user with a formal review-request link could submit feedback. That weakened the platform's governance model and blurred the difference between:

- generic private sharing, and
- a designated teacher workflow.

This is now tightened in code:

- `apps/backend/videos/views.py` now restricts review-request links to the assigned teacher and student.
- Only the assigned teacher can submit feedback on a formal `ReviewRequest` link.
- Generic v1-style private share links still preserve the broader authenticated-response behavior when no `ReviewRequest` is attached.

This change improves trust, role clarity, and platform governance without breaking the shipped v1 foundation.

### 2. Core interaction metrics are still too thin

The book emphasizes measuring platform health around successful interactions, not just raw signups or content volume.

Practica still lacks first-class metrics for:

- request acceptance/open rate,
- teacher response time,
- request completion rate,
- resubmission rate,
- time from response to student view,
- and repeat cycles per teacher-student pair.

Without these, the product cannot fully measure liquidity in its core interaction.

### 3. Filtering and routing are still lightweight

Teachers can see requests, but the system does not yet strongly prioritize work by:

- overdue deadline,
- requested turnaround,
- unviewed responses,
- repeated follow-up chains,
- or teacher capacity.

That limits the platform's ability to efficiently match attention to work.

### 4. Platform rules are implicit in places

Some important platform rules are encoded in behavior but not yet fully made explicit in product surfaces or analytics, including:

- who can respond to which request,
- when a request is considered complete,
- when a cycle is stale,
- and what permissions continue after a link is revoked.

These should become more explicit in both UI language and reporting.

## What The Current Codebase Already Has

### Backend primitives

- `Session`: private student-owned archive item
- `ReviewLink`: access primitive for private review access
- `ReviewRequest`: workflow primitive for teacher-led review cycles
- `TeacherRosterMembership`: repeat relationship layer
- `FeedbackTemplate`: reusable teacher tooling
- `VideoFeedback`: artifact-attached response unit

### Product surfaces

- `Library`: student archive and upload flow
- `SessionDetail`: owner controls, request creation, share controls, feedback visibility
- `ReviewPage`: private review-link interaction surface
- `TeachingView`: inbox, roster, and template management

These are credible platform components, not just point-feature screens.

## Practical Scorecard

- **Core interaction**: good
- **Producer tooling**: good
- **Consumer tooling**: good
- **Governance and trust**: improving, now materially better
- **Filters and routing**: partial
- **Measurement of interaction success**: partial to weak
- **Network growth design**: good for a trusted niche platform
- **Marketplace mechanics**: intentionally absent

Overall assessment: Practica already behaves like an emerging private vertical platform, but it is not yet fully instrumented or governed like a mature one.

## Recommended Next Work

1. Add platform-health metrics around completed review cycles.
2. Separate generic share-link UX from formal review-request UX even more clearly.
3. Add teacher-side prioritization by deadline, turnaround, and stale requests.
4. Add request lifecycle reporting per teacher-student pair.
5. Add explicit UI copy for request access, ownership, and response permissions.

## Definition Of Done For Stronger Platform Alignment

Practica is in a strong `Platform Revolution` position when:

- the core interaction is clearly defined and measured,
- participant permissions are enforced consistently,
- teachers have tools to reliably process incoming work,
- students retain ownership of their archive,
- repeat review cycles are easy to complete,
- and growth remains trust-based rather than public and chaotic.

That target is compatible with Practica's current product direction and does not require shifting toward a public marketplace.
