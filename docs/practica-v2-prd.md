# Practica v2 PRD

## Status

This document is the strategic source of truth for Practica v2.

The product thesis is now centered on one sentence:

> Practica is a private video practice mirror where learners lead their own progress and bring in trusted feedback when they want it.

Related docs:

- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline
- `docs/flow-audit.md`: implementation audit and reliability gaps
- `docs/platform-revolution-audit.md`: interaction and platform analysis

## Executive Summary

Practica is a private, video-first product for self-led improvement.

The learner records a take, watches themselves honestly, notices posture, timing, expression, alignment, and movement, then decides what to do next.

Trusted feedback is important, but it is optional and secondary to the learner-owned mirror.

That means Practica should optimize first for:

- fast private capture,
- easy replay and revisiting,
- repeated takes over time,
- self-review and comparison,
- and optional trusted feedback attached to the take.

Teacher or reviewer workflows remain valuable, but they should sit on top of the learner-led product rather than define the whole product.

## Product Thesis

Practica should become the private operating environment for embodied practice.

The core value proposition is:

> Record a take, watch yourself clearly, track your own progress over time, and invite trusted feedback only when it helps.

## Product Model

Practica is a learner-led private practice mirror with an optional trusted-feedback layer.

That means:

- the learner owns the archive,
- the archive is private by default,
- the video is the center of the experience,
- repeated takes should stay organized over time,
- feedback should stay attached to the take,
- and reviewer workflows should support the learner rather than replace learner agency.

## Canonical Architecture Model

Practica v2 should be implemented as two compatible layers:

### 1. Practice mirror layer

- `member` is the base identity.
- `session owner` owns the take and the archive artifact.
- `practice thread` groups repeated takes over time.
- `Session` remains the core artifact.

### 2. Trusted feedback layer

- `ReviewLink` supports lightweight trusted sharing.
- `ReviewRequest` supports more structured async feedback cycles.
- `reviewer`, `teacher`, and `student` remain workflow-context labels, not global identity types.
- reviewer inbox, roster, and templates exist to support repeated trusted feedback where useful.

## Core Roles

### Learner

- Records or uploads private takes.
- Watches and revisits their own practice.
- Decides when to continue alone and when to ask for feedback.
- Owns the archive artifact and the progression over time.

### Reviewer

- Watches a take shared by the learner.
- Responds with private video feedback.
- Supports the learner without taking ownership of the archive.

### Teacher

- A reviewer inside a more structured teaching workflow.
- Useful for repeated async instruction and inbox-style review work.
- Still a workflow role, not the global product identity.

### Member

- Any authenticated person in the trusted network.
- Can be practicing on one take and reviewing another.

## Product Principles

- `Private by default`: nothing is public unless explicitly shared.
- `Video first`: self-observation starts with the take itself.
- `Learner-led`: the learner leads their own progress.
- `Mirror before marketplace`: the product should help someone see themselves clearly before trying to create public discovery or social pressure.
- `Feedback attached to the artifact`: trusted responses belong with the take.
- `Progress through repetition`: repeated takes should be easy to organize and revisit.
- `Low pressure`: no public feed, no streak pressure, no gamified accountability loop.
- `Trusted network growth`: the product should spread through existing relationships, not public visibility.

## Primary User Stories

### Private practice mirror

- As a learner, I want to record or upload a private take quickly.
- As a learner, I want to watch myself clearly and notice what changed.
- As a learner, I want repeated takes on the same skill to stay together.
- As a learner, I want my archive to remain mine.

### Trusted feedback

- As a learner, I want to ask for trusted feedback only when I want it.
- As a reviewer, I want to respond privately with video feedback attached to the take.
- As a learner, I want feedback to stay with the take so I can revisit it later.

### Structured reviewer workflows

- As a learner, I want optional formal review requests when I am working with a repeated reviewer or teacher.
- As a reviewer, I want an inbox that shows what needs my attention now.
- As a teacher, I want to support repeated cycles without turning the product into a heavy LMS.

## What Practica Is

- A private video practice mirror
- A private archive of repeated takes
- A tool for self-led embodied learning
- A place to bring in trusted feedback when useful
- A lightweight async review workflow when needed

## What Practica Is Not

- A public marketplace
- A public social feed
- A creator-discovery platform
- A heavy school operating system
- A role-heavy LMS
- A streak or practice-plan app

## Go-To-Market Reality

The product truth is broader than the first wedge.

Practica can be useful for drums, piano, movement practice, posture-heavy work, performance prep, martial arts forms, breathwork, qigong, or any skill where seeing yourself changes how you learn.

But the initial go-to-market should still stay narrow.

Recommended wedge:

- independent drum teachers,
- using Practica with their existing students,
- for async between-lesson video review.

That wedge is easier to explain, recruit, and charge for than a broad “all embodied learning” positioning.

## Growth Model

Practica should grow through trusted relationships.

Preferred loop:

1. A learner joins through a trusted path.
2. They record private takes.
3. They get value from self-review immediately.
4. They invite one trusted reviewer or teacher when they want outside eyes.
5. Repeated practice and trusted exchange deepen usage over time.

## Naming Guidance

Preferred product language:

- `learner`
- `member`
- `session owner`
- `take`
- `practice thread`
- `private archive`
- `practice mirror`
- `trusted feedback`
- `reviewer`

Allowed workflow language where needed:

- `teacher`
- `student`
- `teacher inbox`
- `roster`
- `review request`

Avoid as foundational product framing:

- fixed teacher/student identity ontology
- public coaching marketplace language
- heavy institutional workflow language

## Success Metrics

Practica should measure both self-led practice value and trusted-feedback value.

### Practice mirror metrics

- repeat uploads per member
- repeated takes inside the same practice thread
- revisit behavior on older takes
- comparison behavior across takes
- retention of active learners week over week

### Trusted feedback metrics

- feedback-link creation rate
- review-request creation rate
- reviewer response rate
- review-request completion rate
- median submission-to-feedback turnaround
- resubmission rate after feedback

## Near-Term Roadmap

### 1. Private mirror reliability

- Make upload, playback, and session detail boringly reliable.
- Preserve private ownership of the archive.

### 2. Practice threads

- Group repeated takes under one private thread.
- Make self-comparison over time easier.

### 3. Trusted feedback

- Keep private-link feedback simple.
- Keep feedback attached to the take.
- Preserve edit/delete for the feedback author.

### 4. Reviewer workflow layer

- Keep `ReviewRequest` for structured repeated workflows.
- Keep reviewer inbox and roster lightweight.
- Do not let reviewer tooling overpower the learner-led product.

### 5. Invite-only growth

- Keep trusted onboarding.
- Keep sharing private and intentional.

## Strategic Boundaries

Practica should not chase broad public attention.

The product should win by compressing attention around one meaningful next step:

- record,
- watch,
- notice,
- retry,
- and invite trusted feedback when it helps.

That is a much stronger product identity than trying to maximize generic engagement.
