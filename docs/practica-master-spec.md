# Practica Master Spec

## Status

This is the single source of truth for Practica product direction, current-state product behavior, and roadmap.

If any other Practica doc conflicts with this one, this file wins.

## One-Line Thesis

Practica helps one person turn meaningful practice into private proof and visible progress.

## Initial Design Partner

The first concrete product-design loop is Jose practicing Dorothy's Qigong teaching.

Jose is the only required product user during the first pilot. Dorothy may assign an exercise directly, or Jose may assign himself an exercise he already learned from Dorothy. Teacher participation in Practica is optional.

## Core Problem

A person learns meaningful exercises and habits from teachers, clinicians, coaches, or experience, then forgets what to practice or loses evidence of the work between lessons and appointments.

Practica should make that work easy to resume, record, and understand without requiring the person who taught it to operate another platform.

## Core Loop

1. A member chooses a meaningful routine or recalls something a teacher taught them.
2. The member selects one routine for Today.
3. Practica shows one clear set of actions without requiring another person's account.
4. The member practices and records private proof as video, photo, count, or note.
5. Practica organizes the member's proof and makes progress visible.
6. The member may privately review it or selectively show relevant evidence to a trusted teacher, clinician, or coach.
7. Any correction or lesson becomes the next self-assigned practice.
8. Repeat.

This solo-capable loop is the product during the pilot. Direct teacher assignment is an optional later convenience, not a dependency.

## Pilot Success Question

Does Practica make the student practice more effectively between lessons and make the next lesson more valuable for both student and teacher?

For the initial pilot, ask specifically:

- Does Jose practice more consistently between sessions with Dorothy?
- Does Jose remember what Dorothy asked him to work on?
- Can Jose bring a useful, selective summary or proof to Dorothy without requiring her to learn Practica?
- Does the next lesson begin with better information about what Jose practiced and wants to ask?

## Product Principles

- private by default
- video first
- practice between lessons is the center of the product
- teacher guidance should be lightweight
- teachers and coaches should not need accounts for the member to benefit
- the member controls assignments, provenance, and sharing
- student recording should be extremely fast
- one clear practice is better than a complicated curriculum
- corrections should lead naturally to the next practice
- progress should come from real evidence over time
- low pressure
- no streak pressure
- every practice counts

## What Practica Is

- a lightweight bridge between lessons
- a private practice recorder and archive
- a way for a member to self-assign focused practice from prior teaching
- a way to remember what to do today and who taught it
- a way to see progress over time and selectively share relevant evidence
- initially validated through movement practice, beginning with Qigong

## What Practica Is Not

- a public social network
- a public marketplace
- a heavy LMS
- a school administration system
- an AI-first product
- an automated replacement for a teacher
- a giant exercise catalog

## Initial Roles

### Member

The member owns their private practice archive, creates or selects routines, records proof, and tracks progress.

### Teacher

The teacher can continue teaching outside Practica. The member records who taught an exercise and can selectively show relevant evidence. A teacher account may later support direct assignments and corrections when the teacher wants it.

The teacher experience must remain lightweight. Practica should not create a large administrative burden.

## Current Product Scope

### Already useful foundations

- invite-only account creation
- private session upload and recording
- playback-ready media processing
- member-owned proof archive and history view
- optional skill or habit tags per proof
- session detail and metadata editing
- progress summaries from completed proof events
- lightweight insights from practice data
- Today / Journal / Progress navigation with Record as the primary capture action
- private authenticated legacy review flows
- a tiny scheduled mobility pilot that places one ready-to-record movement on Today

These pieces should be reused where they strengthen the teacher -> assignment -> student practice -> review -> correction loop.

### Product gaps for the Jose + Dorothy pilot

- member can create and self-assign a simple practice
- assignment can include a short reference video and focused cues
- student has a no-choice Today view showing the assigned practice
- student can record the practice with minimal friction
- practice evidence is clearly associated with the assignment
- member can prepare a focused view or export for a trusted teacher
- optional correction capture can inform the next self-assigned practice
- simple weekly summary such as practices completed and minutes practiced

### Out of scope during the pilot

- public discovery
- public profiles or social feeds
- marketplace mechanics
- leaderboards
- follower systems
- broad institutional administration
- giant program libraries
- AI posture scoring
- automated movement judgment
- rep-counting as a core product requirement
- complex analytics
- native mobile apps

## Feature Filter

During the Jose + Dorothy pilot, no feature should be prioritized unless it measurably improves Jose's private practice loop or makes the next lesson more useful without burdening Dorothy.

Before building a feature, ask:

> Does this help Jose practice better between sessions, preserve what Dorothy taught, or improve the next lesson without requiring Dorothy to operate Practica?

If the answer is no, put it in the backlog.

## AI Position

Practica does not need AI or ML to prove the core value.

AI may later help summarize practice, reduce review burden, find relevant moments, or provide other assistance. It should not replace teacher judgment, and it is not required for the initial pilot.

## Four-Week Pilot

### Week 1 — Assignment and practice

Dorothy assigns Jose a small practice. Jose uses Practica to remember it, practice it, and record evidence.

### Week 2 — Review and correction

Dorothy reviews relevant practice evidence and leaves a focused correction. Jose uses that correction in the next practice.

### Week 3 — Additional students

If the loop is useful for Dorothy and Jose, invite 2–3 additional students chosen by Dorothy and observe where the workflow breaks.

### Week 4 — Value and willingness to pay

Review usage and interview Dorothy and participating students. Determine whether the product saves time, improves practice or teaching, and whether either side would pay for the experience.

## Now / Next / Later

### Now

- make Jose's solo-capable Dorothy/Qigong loop work end to end
- ship custom routines, learned-from provenance, private journal proof, and a member-selected Today routine
- preserve and reuse existing private recording and progress infrastructure
- remove friction from Today's Practice -> Record -> Save
- implement the smallest useful assignment and teacher-review workflow
- run the four-week Qigong pilot
- measure practice completion and qualitative teaching value

### Next

- improve teacher review efficiency
- improve before/after progress visibility
- test with a few additional movement teachers and students
- determine who pays and shape pricing around observed value

### Later

- expand to adjacent teacher-student practices such as Tai Chi, Feldenkrais, yoga, Pilates, personal training, music, golf, or tennis if the underlying loop generalizes
- richer comparisons and analytics
- carefully chosen AI assistance
- billing infrastructure
- broader commercial expansion

## Current Technical Snapshot

Practica already has strong foundations in private capture, playback-ready takes, private history, and progress tracking. The immediate engineering goal is not to replace those foundations but to connect them into the between-session teacher-student loop.

## Naming Guidance

Preferred product language:

- student
- teacher
- practice
- today's practice
- assignment
- practice video
- correction
- progress
- private archive

Avoid positioning Practica primarily as:

- a social network
- an AI coach
- a marketplace
- an LMS
- a generic habit tracker

## Decision Process

Product decisions should follow this loop:

Conversation and observation -> Master Spec -> code -> real-world pilot -> feedback -> Master Spec -> next change.

The master spec should change when real evidence from the pilot changes our understanding of the product.

## Doc Policy

All other Practica product docs are supporting references or retired snapshots.

Use this file and `docs/README.md` as the primary places to find the current product truth.
