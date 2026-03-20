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

Practica is moving from a private async video feedback tool toward a teacher-led private platform for async music instruction.

Key strategic decisions:

- Start with existing teacher-student relationships, not an open marketplace.
- Focus the initial wedge on independent drum teachers.
- Keep student video archives private and student-owned.
- Treat the completed review cycle as the core unit of value: `submission -> feedback -> resubmission`.
- Build teacher workflow primitives next: `ReviewRequest`, inbox, roster, and templates.
