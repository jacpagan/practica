# Practica Docs

Practica is a private video practice mirror where learners lead their own progress and bring in trusted feedback when they want it.

## Source Of Truth

- `AGENTS.md` (repo root): engineering commands, structure, tests, and release expectations
- `docs/role-path-story-map.md`: canonical implemented map of roles, routes, stories, and systems data flow
- `docs/practica-v2-prd.md`: strategic product direction and roadmap
- `docs/platform-effects-mvp-playbook.md`: shipped v1 baseline
- `docs/flow-audit.md`: current flow audit and gaps
- `docs/platform-revolution-audit.md`: interaction and platform analysis
- `docs/platform-engineering-charter-2026-04-06.md`: shared platform engineering mission, scope, and operating agreement
- `docs/tdd-strategy.md`: core-loop testing and stabilization strategy
- `docs/technical-prd-2026-04-06.md`: current-state technical product snapshot
- `docs/technical-prd-trusted-feedback-flow-2026-04-11.md`: implementation PRD for trusted feedback onboarding and loop-friction reduction
- `docs/trusted-feedback-implementation-checklist-2026-04-11.md`: phased implementation checklist and ticket plan for the trusted feedback flow

## Working Docs

- `docs/local-dev-playbook.md`: cheapest safe local workflow for Django + Vite, tmux layout, and small commit loop
- `docs/release-checklist.md`: step-by-step checklist for local testing, push-to-main, deploy, and production verification
- `docs/production-runbook.md`: operator-focused production checks, verification, and recovery steps

## Product Framing

Use this order of truth when talking about Practica:

1. It is a private practice mirror.
2. It helps learners review themselves clearly over time.
3. It supports trusted feedback when useful.
4. It can support structured reviewer or teacher workflows without becoming a public marketplace or heavy LMS.

## Naming Guidance

Preferred global language:

- `learner`
- `member`
- `take`
- `practice thread`
- `private archive`
- `practice mirror`
- `trusted feedback`

Allowed workflow-context language:

- `reviewer`
- `teacher`
- `student`
- `review request`
- `reviewer inbox`

Avoid broad public-marketplace framing or role-heavy identity framing unless a specific workflow needs it.
