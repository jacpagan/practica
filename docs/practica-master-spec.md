# Practica Master Spec

## Status

This is the single source of truth for Practica product direction, current-state product behavior, and roadmap.

If any other Practica doc conflicts with this one, this file wins.

## One-Line Thesis

Practica helps a student make the time between lessons count.

## Initial Design Partner

The first concrete product-design loop is Jose + Dorothy + Qigong.

This is intentionally specific. We will learn from a real teacher and a real student before generalizing the product.

## Core Problem

A teacher may see a student for an hour, give corrections and suggest practice, then have little visibility into what happens before the next lesson. The student may forget what to practice, practice inconsistently, or repeat a movement incorrectly without realizing it.

Practica should make the time between lessons useful without turning the teacher into a full-time administrator.

## Core Loop

1. Teacher teaches the student.
2. Teacher assigns a small, concrete practice, optionally with a short reference video and one or two cues.
3. Student opens Practica and immediately sees what to practice today.
4. Student practices and records private video proof.
5. Practica records completion and organizes the student's practice history.
6. Teacher can quickly review relevant practice evidence.
7. Teacher leaves a focused correction or identifies what to work on next.
8. That correction informs the student's next practice.
9. Repeat.

This loop is the product during the pilot.

## Pilot Success Question

Does Practica make the student practice more effectively between lessons and make the next lesson more valuable for both student and teacher?

For the initial pilot, ask specifically:

- Does Jose practice more consistently between sessions with Dorothy?
- Does Jose remember what Dorothy asked him to work on?
- Can Dorothy understand Jose's between-session progress without reviewing too much material?
- Does Dorothy arrive at the next lesson with better information about what Jose needs?
- Does the product save Dorothy time or improve the quality of her teaching?

## Product Principles

- private by default
- video first
- practice between lessons is the center of the product
- teacher guidance should be lightweight
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
- a way for a teacher to assign focused between-session practice
- a way for a student to remember what to do today
- a way for teacher and student to see progress over time
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

### Student

The student owns their private practice archive, sees assigned practice, records sessions, and tracks progress.

### Teacher

The teacher can assign a focused practice, provide a reference or cue, review relevant evidence, and leave a focused correction.

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
- Record / Progress navigation
- private authenticated legacy review flows
- a tiny scheduled mobility pilot that places one ready-to-record movement on Today

These pieces should be reused where they strengthen the teacher -> assignment -> student practice -> review -> correction loop.

### Product gaps for the Jose + Dorothy pilot

- teacher can create or assign a simple practice
- assignment can include a short reference video and focused cues
- student has a no-choice Today view showing the assigned practice
- student can record the practice with minimal friction
- practice evidence is clearly associated with the assignment
- teacher has a fast way to review the student's relevant practice
- teacher can leave a focused correction or next-practice instruction
- student sees that correction when practicing again
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

During the Jose + Dorothy pilot, no feature should be prioritized unless it measurably improves the teacher-student practice loop.

Before building a feature, ask:

> Does this help Jose practice better between sessions with Dorothy, or help Dorothy teach Jose better without adding unreasonable work?

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

- make the Jose + Dorothy loop work end to end
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
