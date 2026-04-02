# Practica v2 PRD

## Status

This document is the strategic source of truth for Practica v2.

It replaces older role-heavy framing and clarifies the current direction:
Practica is a private video practice archive with trusted feedback, built on a member-first identity model with an explicit teacher workflow layer.

Related docs:

- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline
- `docs/flow-audit.md`: implementation audit and reliability gaps

## Executive Summary

Practica v2 is a private, video-first platform for ongoing practice and feedback among trusted people.

The core bet is:

- identity should stay member-first and role-light,
- every take should remain private by default,
- feedback should stay attached to the video,
- repeated takes should be easy to organize over time,
- and the product should optimize for durable practice history and completed review cycles rather than public discovery.

Practica is not a marketplace, a social feed, or a school workspace.
It is a private place to record, revisit, and exchange trusted feedback.

## Product Thesis

Practica should become the private operating system for video-based improvement.

The core value proposition is:

"Record a take, keep it private, get video feedback from trusted people, and build a durable history of progress over time."

## Product Model

Practica is a member-first private platform with a teacher workflow layer.

That means:

- no permanent teacher/student identity model as the global account ontology,
- no public discovery,
- no public profiles or marketplace mechanics,
- no role-based hierarchy as the foundation of identity,
- and explicit workflow objects for teacher-led operations where they add operational value.

People can still mentor each other, teach each other, review each other, or invite each other.
Those are relationship and permission patterns attached to workflows, not permanent platform identities.

## Canonical Architecture Model

Practica v2 should be implemented as two compatible layers:

### 1. Identity layer (member-first)

- `member` is the base account identity.
- `session owner` owns archive artifacts and sharing intent.
- `reviewer` can respond to feedback links and review requests.
- `inviter` is a permission capability, not a separate identity class.

### 2. Workflow layer (teacher-led where needed)

- `ReviewRequest` is the primary workflow object for structured review cycles.
- `teacher` and `student` are workflow-context labels, not global account types.
- `teacher inbox`, `roster`, and `designated-teacher permissions` operate on top of member identities.
- `ReviewLink` remains an access primitive and can coexist with `ReviewRequest`.

## Core Roles

Practica should prefer situational roles over fixed role labels.

### Session owner

- Records or uploads a video.
- Owns the private archive entry.
- Controls whether a feedback link exists.

### Reviewer

- Receives a private feedback link.
- Watches the video.
- Responds with video feedback.

### Member

- Any authenticated person inside the trusted network.
- Can be a session owner on one video and a reviewer on another.

### Inviter

- A trusted person or platform admin who brings someone into Practica.
- Invite permissions are product policy, not identity class.

### Teacher (workflow role)

- A member assigned to one or more `ReviewRequest` items.
- Owns request execution from inbox to response.
- Never takes ownership of the student archive artifact.

### Student (workflow role)

- A member who submits takes for teacher feedback within a request cycle.
- Retains ownership of their private archive entries.

## Product Principles

- `Private by default`: nothing is public unless explicitly shared.
- `Video first`: the video is the center of the experience.
- `Feedback attached to the artifact`: feedback belongs with the source video.
- `Member-first identity`: the product should avoid rigid global teacher/student ontology.
- `Teacher workflow primitives`: structured teacher operations should be modeled with explicit workflow objects.
- `Progress through repetition`: the product should make repeated takes easy to organize.
- `Low pressure`: no streaks, no gamified accountability loops, no public performance layer.
- `Trusted network growth`: membership should expand through invites and existing trust, not open viral loops.

## Primary User Stories

### Practice archive

- As a member, I want to record or upload a private take quickly.
- As a member, I want to revisit my previous takes easily.
- As a member, I want repeated takes on the same skill to live together.

### Trusted feedback

- As a session owner, I want to share one private link for feedback.
- As a reviewer, I want to respond with a video quickly.
- As a reviewer, I may add a short optional caption, but the feedback remains video-first.
- As a feedback author, I want to edit or delete my own feedback.

### Practice threads

- As a member, I want multiple takes of the same exercise to stay grouped over days and weeks.
- As a member, I want to open one thread like `Singles @ 120 BPM` and see the timeline of takes.
- As a member, I want starting a new take in the same thread to feel fast and natural.

### Invite-only trust model

- As a platform admin, I want to control who can sign up.
- As a product, Practica should prefer invite-only onboarding over open account creation.
- As a new member, I should join with context and trust, not into an empty app.

## Current Strategic Direction

Practica is moving toward a private member network with a first-class teacher workflow layer.

Key decisions:

- keep the private library,
- keep private feedback links,
- keep video-first responses,
- add lightweight practice threads for repeated takes,
- add `ReviewRequest` as a workflow primitive for structured cycles,
- add teacher inbox + roster + designated-teacher permissions on top of member identity,
- require trusted onboarding,
- and avoid hard-coding fixed teacher/student identity into the long-term account model.

## What Practica Is

- A private video archive
- A trusted feedback tool
- A place for repeated practice history
- A member-first product
- A teacher-workflow-capable product
- A lightweight private network

## What Practica Is Not

- A public marketplace
- A social content feed
- A school workspace platform
- A role-heavy LMS
- A practice-plan or streak app
- A public creator discovery system

## Growth Model

Practica should grow through trusted relationships, not through open signups and public visibility.

Preferred growth loop:

1. One trusted member joins.
2. They record private videos.
3. They share a private feedback link or invite another trusted person.
4. That person joins in context.
5. The network grows through real practice relationships.

## Invite Policy

The default posture should be invite-only.

Near-term recommendation:

- platform admins control signup access,
- signup requires a valid invite code,
- invite codes should be limited-use,
- and new accounts should enter through a trusted path.

Future options can include:

- admin-generated member invites,
- member-generated invites within limits,
- or context-specific invite links.

## Naming Guidance

Preferred product language:

- `member`
- `session owner`
- `reviewer`
- `responder`
- `feedback`
- `feedback link`
- `review request`
- `practice thread`
- `take`
- `private library`

Allowed workflow language (when discussing structured teaching workflows):

- `teacher`
- `student`
- `teacher inbox`
- `roster`
- `designated teacher`

Avoid as foundational identity language:

- rigid global `teacher` account type
- rigid global `student` account type
- role hierarchy as the basis of account identity

Teacher/student terms are valid in workflow contexts, but should not define the global identity ontology.

## Success Metrics

Practica should care about both retained practice behavior and completed review-cycle workflow quality.

Early indicators:

- repeat uploads per member,
- repeated takes inside the same practice thread,
- feedback-link creation rate,
- video feedback response rate,
- revisit behavior on older takes,
- review-request completion rate,
- and median submission-to-feedback turnaround.

## Near-Term Roadmap

### 1. Private library reliability

- Make upload, playback, and session detail boringly reliable.

### 2. Practice threads

- Group repeated takes under one private thread.
- Make comparison over time easier.

### 3. Video-first trusted feedback

- Keep link-based video feedback simple.
- Support optional short captions attached to feedback videos.
- Preserve author edit/delete for their own feedback.

### 4. Teacher workflow layer

- Add `ReviewRequest` with assignee, goal, turnaround, and status.
- Add teacher inbox for pending/in-progress/completed requests.
- Add lightweight roster and designated-teacher permissions.
- Preserve `Session` ownership with the submitting member.

### 5. Invite-only membership

- Gate signup through invite codes.
- Keep onboarding inside trusted boundaries.

## Migration Note

The repository still contains mixed naming and structures tied to both learner-first and teacher-led phrasing.

That should be treated as implementation history, not the long-term product ontology.

The practical direction is:

- update product docs first,
- rename product-facing UI next,
- add member-first + workflow-aware API aliases before deep model renames,
- and only later decide whether the database/domain model should be fully renamed.
