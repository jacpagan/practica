# Practica v1 Private Video Feedback Playbook

This document captures the shipped v1 baseline.

It remains useful when preserving or refactoring the current private-library workflow, but it is no longer the strategic source of truth for what Practica should build next.

For product direction, use `docs/practica-v2-prd.md`.

## v1 Product Model

Practica is a private video library with private link sharing and authenticated video feedback.

Core rules:

- Every user is an individual creator.
- Every user can record, upload, watch, and share videos.
- Every uploaded video goes into the user’s private library.
- Nothing is public by default.
- Feedback happens through a private link.
- Anyone responding through that link must log in.
- Feedback is video-first.
- The app supports optional text notes attached to a video response, but not text-only feedback.

## Primary Flow

1. Log in.
2. Open `Library`.
3. Record or upload a video.
4. Watch the video immediately.
5. Save it to the private library.
6. When ready, open the video detail page.
7. Create a private feedback link.
8. Send the link to another logged-in user.
9. That person watches the original video.
10. They respond with a video feedback clip.
11. The owner reviews all feedback videos in the original video detail page.

## Core Surfaces

- `Library`
- `Record`
- `Video Detail`
- `Private Feedback Link`
- `Video Feedback Replies`

## Product Principles

- `Private by default`: no video is visible until the owner shares a private link.
- `Show first, then tell`: feedback should arrive as video.
- `Low pressure`: no streaks, no check-ins, no daily accountability framing.
- `Simple library`: upload once, review whenever you want, share when you want feedback.
- `Playback matters`: a recorded video should be watchable immediately and comfortably.

## What Was Intentionally Out In v1

The shipped v1 product intentionally did not center on:

- spaces
- teacher/student roles
- coach dashboards
- practice plans
- daily check-ins
- invite-code onboarding
- coach metrics

## Acceptance Criteria

A user can:

- record a video and watch it immediately
- save it to a private library
- open it later without friction
- generate a private link for feedback
- receive video feedback from another logged-in user
- keep all videos private until explicitly shared

## Naming Guide For v1

Preferred product terms:

- `Library`
- `Private link`
- `Video feedback`
- `Record`
- `Upload`
- `Response video`

Avoid old product terms in v1-facing copy:

- `teacher`
- `student`
- `coach`
- `space`
- `plan`
- `check-in`
- `journal`
- `coach dashboard`

## Strategic Note

Practica v2 uses a member-first identity model with a teacher workflow layer.

The v1 baseline still matters because it captures what Practica already does well:

- private library,
- private feedback links,
- video-first responses,
- and durable archive value.

The v2 direction builds on that baseline by emphasizing:

- member-first identity language,
- trusted invite-only growth,
- practice threads for repeated takes,
- private feedback between members,
- and `ReviewRequest` for structured teacher-led cycles.

Teacher/student language remains valid in workflow contexts (for example teacher inbox, roster, designated teacher), but should not be treated as global account identity types.
