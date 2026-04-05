# Practica Platform Revolution Audit

## Purpose

This document maps Practica to the core interaction ideas from *Platform Revolution* while staying aligned with `docs/practica-v2-prd.md`.

## Platform Definition For Practica

Practica should be treated as a trusted private interaction platform for self-led practice with optional trusted feedback.

That means Practica is:

- centered on private learner-owned video takes,
- designed for repeated self-review over time,
- capable of bringing in trusted reviewers when useful,
- and optimized for durable improvement rather than public discovery.

## Core Interaction Mapping

Practica’s core interaction should now be defined as:

- **Primary participant**: learner using a private video take as a mirror
- **Optional second participant**: trusted reviewer or teacher
- **Value unit**: a private `Session`, optionally extended by `ReviewLink`, `ReviewRequest`, and `VideoFeedback`
- **Filter**: private archive access, practice threads, review links, reviewer inbox, and request state
- **Outcome**: clearer self-observation, better next takes, and optional trusted feedback that improves the next attempt

## Current Alignment

### Strong alignment

- Private by default
- Clear learner-owned video artifact
- Durable archive and repeated-take structure
- Trusted feedback attached to the take
- Invite-based trust model
- Structured reviewer workflows available without making the whole product public or institutional

### Partial alignment

- The learner-led mirror is stronger in product behavior than in product language.
- Reviewer routing and provisioning still require too much manual setup.
- Platform health metrics still lean too heavily toward workflow completion and not enough toward repeat self-led practice.

## Biggest Gaps

### 1. The learner-led interaction should be more explicit

Practica already behaves like a private practice mirror, but that value is still under-described compared with the review workflow.

### 2. Reviewer provisioning is still operationally awkward

The trusted-feedback layer is useful, but the path into designated reviewer relationships still needs to be more first-class.

### 3. Platform metrics should measure self-led value too

The platform should care about:

- repeat takes,
- revisit behavior,
- comparison behavior,
- review-request completion,
- turnaround time,
- and resubmission rate.

## Practical Scorecard

- **Learner-owned core artifact**: strong
- **Self-led practice loop**: strong but under-marketed
- **Trusted feedback layer**: strong
- **Structured reviewer workflow**: credible but still operationally thin
- **Governance and privacy**: strong
- **Public marketplace behavior**: intentionally absent

## Recommended Next Work

1. Keep sharpening the learner-led product narrative.
2. Strengthen repeat-take comparison and replay.
3. Simplify trusted reviewer provisioning.
4. Measure both self-led practice and completed feedback loops.
5. Preserve private, low-pressure interaction design.
