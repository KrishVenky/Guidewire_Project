# FAILURE.md

This file records failures observed during Phase 3 implementation and verification,
with root cause and fix details for future debugging.

## 2026-04-17 - Client build failed: `vite: command not found`

- Context:
  - Running local `npm run build` in `client/` failed with missing `vite`.
- Root cause:
  - Local dependencies were not installed in this environment.
- Fix:
  - Switched to Dockerized build flow:
    - `docker compose run --rm --no-deps client sh -lc "npm install && npm run build"`
- Prevention:
  - Prefer containerized build checks in this repository for consistency.

## 2026-04-17 - Docker build failed on JSX parse error in Admin Dashboard

- Context:
  - Vite/esbuild reported: `Expected ")" but found "{"` in admin claims section.
- Root cause:
  - `tab === 'claims'` render returned multiple sibling blocks without a wrapper.
- Fix:
  - Wrapped claims tab content in a React fragment in:
    - `client/src/pages/AdminDashboard/AdminDashboard.jsx`
- Verification:
  - Dockerized client build passed after patch.

## 2026-04-17 - Worker endpoints returning 401 in smoke test

- Context:
  - Direct calls to worker dashboard/policy/preferences returned unauthorized.
- Root cause:
  - Worker bearer token was not included in initial smoke calls.
- Fix:
  - Added OTP request/verify flow to obtain worker token and reused it for protected endpoints.
- Verification:
  - Worker dashboard, policies, and communication preferences returned 200.

## 2026-04-17 - Timeline/receipt smoke check had no claim to inspect

- Context:
  - Timeline and evidence receipt checks initially returned no target claim.
- Root cause:
  - Selected worker had no generated claim yet, or simulation ran against another worker's zone.
- Fix:
  - Simulated disruption for the same authenticated worker zone using admin token.
  - Re-ran claims list then timeline/receipt retrieval.
- Verification:
  - Claims list 200, timeline 200, evidence receipt 200.

## 2026-04-17 - Terminal session closed during long smoke script

- Context:
  - One scripted command failed with terminal closed error.
- Root cause:
  - Transient terminal session drop.
- Fix:
  - Re-ran the script in a fresh command execution.
- Prevention:
  - Keep smoke scripts idempotent and split very long scripts into smaller steps.

## 2026-04-17 - Script noise: `zsh: command not found: #`

- Context:
  - Inline comments in a multiline command produced shell noise.
- Root cause:
  - Comment lines were interpreted unexpectedly in command execution context.
- Fix:
  - Ignore noise when command still succeeds, or remove inline comments and use compact scripts.
- Prevention:
  - Use standalone script files for long smoke flows with comments.

## Open Non-blocking Warnings

### Docker Compose warning about obsolete `version` key

- Context:
  - Compose warns that `version` is obsolete and ignored.
- Current impact:
  - Non-blocking; stack still starts and runs.
- Planned fix:
  - Remove `version` key from `docker-compose.yml` in production hardening pass.
