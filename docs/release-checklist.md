# Practica Release Checklist

Use this checklist for the normal Practica flow:

`make a change -> test locally -> push to main -> let GitHub Actions deploy -> verify on production`

This is optimized for small safe changes, low token spend, and the current `main -> production` release model.

## 1. Make The Change

Start the normal local dev loop.

### Backend

```bash
cd /Users/josepagan/Documents/Code/practica
source .venv/bin/activate
cd apps/backend
env -u DATABASE_URL -u DB_NAME -u DB_USER -u DB_PASSWORD -u DB_HOST -u DB_PORT \
  python manage.py runserver 127.0.0.1:8000
```

### Frontend

```bash
cd /Users/josepagan/Documents/Code/practica/apps/frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

Make the smallest focused change you can.

## 2. Test On Dev

Run the cheapest checks that match the change.

### Frontend-only change

```bash
cd /Users/josepagan/Documents/Code/practica/apps/frontend
npm run build
```

If the change touches routed UI or a protected flow, also run:

```bash
cd /Users/josepagan/Documents/Code/practica/apps/frontend
npx playwright test tests/smoke.spec.ts
```

### Backend or core-loop change

```bash
cd /Users/josepagan/Documents/Code/practica
bash scripts/test-core-loop.sh
```

### Django health check

Use this when you touched app wiring, settings, routes, or runtime behavior:

```bash
curl -fsS http://127.0.0.1:8000/health/
```

### Manual dev check

Open the exact flow you changed and use it once.

Examples:

- `/record` for recorder changes
- upload flow for capture and save changes
- review flow for feedback and inbox changes

## 3. Review Your Diff

Before committing, confirm you are only shipping the intended files.

```bash
cd /Users/josepagan/Documents/Code/practica
git status --short
git diff
```

Stage only the files you intend to ship.

```bash
git add path/to/file1 path/to/file2
```

## 4. Commit

Use a small focused commit message.

```bash
git commit -m "Fix: concise description"
```

Examples:

- `Fix: guard review page for missing session`
- `Feature: add camera input selection to recorder`

## 5. Push To Production Branch

Practica currently ships from `main`.

```bash
git push origin main
```

## 6. Watch GitHub Actions

After pushing, open GitHub Actions and look for:

- `Frontend CI` for frontend-only pushes
- `CI` for backend or mixed pushes
- `Deploy via SSM` for production deploy

Inside the deploy run, check the `Validation Gate` summary.

It should tell you:

- target ref
- target SHA
- changed files
- required workflows before deploy

## 7. Verify Production Health

After deploy finishes, verify health first.

```bash
curl -fsS https://practica.jpagan.com/health/
curl -fsS https://practica.jpagan.com/ready/
curl -fsS https://practica.jpagan.com/version
```

You want:

- `/health/` to report `healthy`
- `/ready/` to report `ready`
- `/version` or `/health/` SHA to match the commit you just pushed

## 8. Verify The Feature On Production

Open the live app and test the exact changed flow once.

Examples:

### Recorder change

- open `https://practica.jpagan.com/record`
- confirm the expected UI is present
- test a short record flow

### Upload or review change

- open the changed workflow directly
- complete one realistic pass
- confirm no obvious regressions

## 9. If Something Fails

### Local test fails

- fix locally first
- do not push hoping production will clarify it

### CI fails

- open the failing workflow
- fix only the actual failing issue
- push again

### Deploy fails

- open `Deploy via SSM`
- check the `Validation Gate` summary first
- then check the failing step logs

### Production health fails

- stop pushing more changes
- inspect the deploy failure or health output first

## 10. Roll Back If Needed

If production is broken and the change must come out quickly:

```bash
git revert <commit_sha>
git push origin main
```

Then verify:

```bash
curl -fsS https://practica.jpagan.com/health/
curl -fsS https://practica.jpagan.com/ready/
```

## Short Version

Use this default loop:

```bash
# make the change

# test locally
cd apps/frontend && npm run build

# review
cd /Users/josepagan/Documents/Code/practica
git status --short
git diff

# commit
git add ...
git commit -m "Fix: ..."

# ship
git push origin main

# verify prod
curl -fsS https://practica.jpagan.com/health/
curl -fsS https://practica.jpagan.com/ready/
curl -fsS https://practica.jpagan.com/version
```
