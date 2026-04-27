# Practica Platform Engineering Charter

**Date:** April 27, 2026
**Status:** Shared working charter  
**Audience:** founder + platform engineer

## 1. Purpose

This document defines what platform engineering means for Practica right now.

It is meant to be readable, practical, and stable enough that we can both agree on it before more work gets layered onto the system.

## 2. Practica In One Sentence

Practica is a private video practice mirror that helps learners record themselves, watch themselves clearly, and bring in trusted feedback when it helps.

## 3. Platform Mission

The platform mission is to make Practica's core loop boringly reliable, private by default, and easy to evolve.

That means turning the app from a working product into a dependable system for:

- learner-owned private video capture,
- browser-safe playback,
- trusted feedback,
- and completed review cycles over time.

## 4. Product Truth We Must Protect

Platform engineering work must preserve these truths:

- Practica is a **private practice mirror** first.
- The learner or member owns the archive.
- Video is the central artifact.
- Trusted feedback is attached to the artifact.
- Teacher and student are workflow labels, not global identity types.
- The highest-value workflow is `submission -> feedback -> resubmission`.

Platform work must not accidentally push the product toward:

- public discovery,
- marketplace mechanics,
- heavy LMS abstractions,
- streak systems,
- or role-heavy institutional architecture.

## 5. Platform JTBD

If a platform engineer joins Practica, their jobs to be done are:

### 5.1 Core loop reliability

- Make `capture -> upload -> playback-ready -> request -> response -> follow-up take` dependable.
- Reduce the number of ways a learner can get stuck after doing the right thing.

### 5.2 Operational clarity

- Make production understandable quickly.
- Make it easy to answer: what is broken, for whom, and where in the loop?

### 5.3 Privacy and permission integrity

- Keep sessions private by default.
- Make permissions fail closed.
- Ensure review threads and review requests only expose the right data to the right people.

### 5.4 Media system stability

- Make uploads resilient.
- Make playback assets reliable.
- Make feedback videos browser-safe.
- Make processing failure states understandable and recoverable.

### 5.5 Safe change velocity

- Make it easier to ship without fear.
- Improve testing, deploy safety, migration safety, and rollback confidence.

### 5.6 Founder independence

- Reduce the amount of invisible knowledge required to operate the product.
- Make future-you less dependent on memory and heroics.

## 6. Responsibilities

Platform engineering owns the following responsibilities.

### 6.1 Reliability

- upload durability
- playback readiness
- review request lifecycle stability
- feedback submission reliability
- follow-up loop continuity

### 6.2 Infrastructure and delivery

- deployment safety
- environment consistency
- build and runtime health checks
- backup and restore confidence
- production recovery paths

### 6.3 Security and privacy

- secret handling
- storage access patterns
- authenticated/private review flows
- permission boundaries
- safe operational access to production

### 6.4 Observability

- health signals
- request logging
- actionable error reporting
- deploy visibility
- core-loop instrumentation

### 6.5 Data stewardship

- schema health
- migration safety
- backup verification
- restore confidence
- understanding real table usage over time

### 6.6 Developer experience

- local setup reliability
- focused test gates
- lightweight technical documentation
- lower-friction debugging

## 7. Non-Goals

Platform engineering is not currently responsible for inventing:

- public growth mechanics
- marketplace dynamics
- billing strategy
- consumer social features
- school-grade admin systems
- speculative abstractions without clear product pressure

Platform engineering should also avoid broad refactors that do not improve:

- core-loop reliability,
- privacy,
- observability,
- or delivery confidence.

## 8. Current Platform Assessment

As of April 27, 2026, Practica has a credible foundation but is not yet a fully mature platform.

### 8.1 What is already strong

- clear private core artifact: `Session`
- learner-owned archive
- browser-served single-door product
- authenticated review threads
- structured `ReviewRequest` workflow
- production health and readiness checks
- deploy path through GitHub Actions + SSM
- focused core-loop test gate

### 8.2 What is still thin

- reviewer provisioning and roster setup
- richer comparison and replay inside practice threads
- deeper production observability around the review loop
- schema and environment confidence across local vs prod data
- operational clarity around real usage and DB shape

### 8.3 Where platform risk currently lives

- large video upload behavior
- media processing edge cases
- production visibility gaps
- thin boundaries in some hotspot files
- future schema cleanup and legacy concept removal

## 9. Principles For Platform Decisions

When choosing what to build or clean up, use these rules.

### 9.1 Protect the learner first

If a platform change makes the learner archive less private, less clear, or less dependable, it is the wrong change.

### 9.2 Protect the review cycle second

If a change risks `submission -> feedback -> resubmission`, it needs extra caution and regression coverage.

### 9.3 Prefer boring over clever

Reliable systems beat elegant but fragile systems.

### 9.4 Prefer operational clarity over hidden magic

The system should be inspectable by a tired founder at 11 p.m.

### 9.5 Prefer focused systems over generalized frameworks

Only add abstraction after repeated pressure from real product needs.

### 9.6 Prefer small changes with proof

Small validated changes beat large rewrites.

## 10. First 30-Day Priorities

If platform engineering work starts now, the first 30 days should focus on these outcomes.

### 10.1 Make production inspectable

- verify safe prod access path for read-only debugging
- document exact commands for `manage.py shell`, `dbshell`, and core diagnostics
- tighten backup + restore confidence

### 10.2 Make the core loop observable

- define the exact checkpoints for the protected loop
- log or measure failures at each checkpoint
- reduce ambiguity when uploads or responses fail

### 10.3 Reduce media pipeline risk

- harden multipart upload and processing recovery
- verify asset creation and playback fallback behavior
- clarify operator response when processing is delayed or failed

### 10.4 Reduce hotspot risk

- identify the few files with too much orchestration responsibility
- split only where it reduces breakage risk in protected flows

### 10.5 Align docs with reality

- keep one accurate technical PRD
- keep one platform charter
- avoid sprawling docs that create maintenance overhead

## 11. Success Metrics

Platform success should be measured by product stability, not infrastructure vanity.

### 11.1 Reliability metrics

- upload success rate
- playback-ready completion rate
- review request creation success rate
- reviewer response success rate
- follow-up request continuation success rate

### 11.2 Latency and turnaround metrics

- time from upload completion to playback-ready
- time from request creation to first reviewer open
- time from request creation to first response

### 11.3 Operational metrics

- deploy success rate
- mean time to diagnose a production issue
- backup restore verification success
- rate of production incidents affecting protected flows

### 11.4 Product-trust metrics

- repeat uploads per active learner
- repeat takes within a thread
- resubmission rate after feedback
- viewed-after-response rate

## 12. Working Agreement

This is the agreement we should be able to hold each other to.

### 12.1 What we will do

- keep the core loop protected
- keep privacy first
- prefer focused improvements over endless redesigns
- document only what helps us operate and decide
- ship with validation when protected flows are touched

### 12.2 What we will not do

- overbuild for imagined scale
- add abstractions to feel sophisticated
- let platform work drift into unrelated product strategy
- treat documentation as a second product

## 13. Definition Of Good Platform Work

Platform work is good when:

- the learner can trust the archive,
- the reviewer can trust the thread,
- the founder can trust deploys,
- production failures are diagnosable,
- and future changes become safer, not scarier.

## 14. Definition Of Done For This Phase

This platform phase is in a good state when:

- the core loop is measurable end to end,
- production can be inspected without guesswork,
- backups and restores are trusted,
- uploads and playback are boring,
- and platform knowledge is no longer trapped in one person's head.

## 15. Short Version

Practica platform engineering exists to make a private video practice mirror dependable.

The job is not to make the system look advanced. The job is to make the learner's private evidence trail, trusted feedback, and follow-up loop work every time.
