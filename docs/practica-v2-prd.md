# Practica v2 PRD

## Status

This document is the strategic source of truth for Practica v2.

It replaces older role-heavy framing and clarifies the current direction:
Practica is a private video practice archive with trusted feedback, built for people who are all still learning.

Related docs:

- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline
- `docs/flow-audit.md`: implementation audit and reliability gaps

## Executive Summary

Practica v2 is a private, video-first platform for ongoing practice and feedback among trusted people.

The core bet is:

- everyone is a learner,
- every take should remain private by default,
- feedback should stay attached to the video,
- repeated takes should be easy to organize over time,
- and the product should optimize for durable practice history rather than public discovery.

Practica is not a marketplace, a social feed, or a school workspace.
It is a private place to record, revisit, and exchange trusted feedback.

## Product Thesis

Practica should become the private operating system for video-based improvement.

The core value proposition is:

"Record a take, keep it private, get video feedback from trusted people, and build a durable history of progress over time."

## Product Model

Practica is a learner-first private platform.

That means:

- no permanent teacher/student identity model,
- no public discovery,
- no public profiles or marketplace mechanics,
- no role-based hierarchy as the foundation of the product,
- and no assumption that one person is always the instructor and another is always the student.

People can still mentor each other, coach each other, review each other, or invite each other.
Those are relationship and permission patterns, not permanent platform identities.

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

## Product Principles

- `Private by default`: nothing is public unless explicitly shared.
- `Video first`: the video is the center of the experience.
- `Feedback attached to the artifact`: feedback belongs with the source video.
- `Everyone is a learner`: the product should avoid rigid teacher/student ontology.
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

Practica is moving toward a private learner network, not a teacher-led operating system.

Key decisions:

- keep the private library,
- keep private feedback links,
- keep video-first responses,
- add lightweight practice threads for repeated takes,
- require trusted onboarding,
- and avoid hard-coding fixed teacher/student product identity into the long-term model.

## What Practica Is

- A private video archive
- A trusted feedback tool
- A place for repeated practice history
- A learner-first product
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
- `practice thread`
- `take`
- `private library`

Avoid as foundational product language:

- `teacher`
- `student`
- `roster`
- `designated teacher`
- `teacher workflow`

Those legacy terms may still exist in code and migrations, but product-facing language should move away from them.

## Success Metrics

Practica should care more about retained practice behavior than role-specific workflow metrics.

Early indicators:

- repeat uploads per member,
- repeated takes inside the same practice thread,
- feedback-link creation rate,
- video feedback response rate,
- and revisit behavior on older takes.

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

### 4. Invite-only membership

- Gate signup through invite codes.
- Keep onboarding inside trusted boundaries.

## Migration Note

The repository still contains legacy naming and structures tied to `teacher`, `student`, `roster`, and `review request` concepts.

That should be treated as implementation history, not the long-term product ontology.

The practical direction is:

- update product docs first,
- rename product-facing UI next,
- add neutral API aliases before deep model renames,
- and only later decide whether the database/domain model should be fully renamed.
