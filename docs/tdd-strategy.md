# Practica TDD Strategy

## Purpose

Practica should evolve by protecting the core proof and progress loop with tests before widening scope.

The rule is simple:

1. capture the behavior,
2. make the test fail,
3. implement the smallest fix,
4. refactor only after green.

## Protected Flows

The following flows are product-critical and should be treated as protected:

- private upload and recording
- playback-ready session processing
- proof archive history
- progress summary calculation
- private-share access
- learner ownership and permissions
- multipart upload recovery for long videos
- any legacy review flows that are still touched

## Repo Gate

Use `scripts/test-core-loop.sh` as the default local test gate for core-loop work.

That script currently checks:

- focused backend regression suites around proof capture, playback, history, permissions, legacy review flows, and multipart uploads
- frontend production build integrity

## Working Rules

- add a focused regression test before fixing a protected-flow bug when practical
- add characterization coverage before major refactors in protected areas
- avoid mixed commits for protected-flow changes
- backport any production hotfix into git immediately
- prefer small, behavior-focused commits over broad cleanups

## Definition Of Green

A protected change is ready when:

- the focused tests pass,
- the frontend build passes,
- permissions still fail closed,
- and the change does not expand scope beyond the bug or behavior under test.
