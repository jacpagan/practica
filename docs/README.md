# Practica Docs

Practica is a private video practice mirror where learners lead their own progress and bring in trusted feedback when they want it.

## Source Of Truth

- `AGENTS.md` (repo root): engineering commands, structure, tests, and release expectations
- `docs/practica-master-spec.md`: single Practica product and technical source of truth

## Working Docs

- `docs/local-dev-playbook.md`: cheapest safe local workflow for Django + Vite, tmux layout, and small commit loop
- `docs/tdd-strategy.md`: focused test strategy for the core loop
- `docs/revenue-brief.md`: business prompt for revenue growth, pricing, and buyer focus
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
