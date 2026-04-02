# Documentation Index

This repository now has an explicit product-strategy source of truth.

## Source Of Truth

- `docs/practica-v2-prd.md`: strategic product requirements document for Practica v2.
- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline and current-product playbook for the private-library MVP.
- `docs/flow-audit.md`: implementation audit of the shipped flows and the platform-foundation gaps that matter before and during v2.

## How To Use These Docs

- Use the v2 PRD when making roadmap, copy, architecture, and prioritization decisions.
- Use the v1 playbook when preserving or refactoring the shipped private-library and private-link workflow.
- Use the flow audit when fixing trust, privacy, playback, and review-cycle reliability issues.

## Current Strategic Direction

Practica is a private member-first video feedback platform with a teacher workflow layer.

Key strategic decisions:

- Keep `member` as the global account identity model.
- Use `teacher`/`student` as workflow-context labels on explicit workflow objects.
- Keep video archives private and member-owned.
- Treat repeated takes and durable feedback history as the core unit of value.
- Add `ReviewRequest`, teacher inbox, roster, and designated-teacher permissions as workflow primitives.
- Grow through trusted invites, not open public signup or discovery.
- Preserve lightweight UX and avoid heavy LMS patterns.
