# Login Testing Guide (User + Admin)

This document explains what to test and how to test login flows for:
- Worker login (OTP)
- Admin login (PIN)

It includes UI and API checks, expected outcomes, and common failure scenarios.

## 1. Prerequisites

1. Start services.

```bash
docker compose up -d --build
```

2. Seed deterministic demo users.

```bash
make seed-demo
```

3. Confirm app URLs:
- Frontend: http://localhost:5173
- Backend docs: http://localhost:8000/docs

4. Confirm auth environment values (defaults):
- ADMIN_PIN=admin123
- AUTH_DEBUG_RETURN_OTP=true
- OTP_EXP_MINUTES=5

## 2. Test Data

Use these worker test users (seeded by make seed-demo):
- 9000000001
- 9000000002
- 9000000003
- 9000000004

Use this non-existing phone for negative tests:
- 9999999999

Admin PIN for default setup:
- admin123

Worker OTP in current demo implementation:
- Randomized 6-digit OTP per request

Note: if AUTH_DEBUG_RETURN_OTP=true, API response includes debug_otp and UI can show it for testing.

## 3. Worker Login Tests (UI)

### W1 - Happy path login
Goal: worker can log in and reach dashboard.

Steps:
1. Open http://localhost:5173/worker/login
2. Enter seeded phone (for example 9000000001)
3. Click Send OTP
4. Enter the OTP shown by debug_otp (or delivered via your OTP provider)
5. Click Verify OTP

Expected:
- Navigates to /dashboard
- Worker session is active (token stored in local storage)
- Dashboard data loads without auth errors

### W2 - Invalid phone format
Goal: client-side validation blocks malformed input.

Steps:
1. Enter 12345
2. Click Send OTP

Expected:
- Error: Enter a valid 10-digit mobile number
- No backend request should be needed for pass/fail

### W3 - Unregistered phone
Goal: unknown worker cannot request OTP.

Steps:
1. Enter 9999999999
2. Click Send OTP

Expected:
- Error: No account found for this number. Please register first.
- Login does not proceed

### W4 - Wrong OTP
Goal: OTP verification fails correctly.

Steps:
1. Request OTP for a seeded phone
2. Enter 000000
3. Click Verify OTP

Expected:
- Error from server: Invalid OTP
- Remains on login page

### W5 - Protected route check
Goal: dashboard route is protected when not logged in.

Steps:
1. Open an incognito window
2. Navigate directly to http://localhost:5173/dashboard

Expected:
- Redirect to /worker/login

## 4. Admin Login Tests (UI)

### A1 - Happy path admin login
Goal: admin can access dashboard with valid PIN.

Steps:
1. Open http://localhost:5173/admin
2. Enter PIN admin123
3. Click Enter

Expected:
- Admin dashboard loads
- Admin tabs are visible (overview, workers, claims, simulate, zones)

### A2 - Invalid PIN
Goal: invalid PIN is rejected.

Steps:
1. Open /admin
2. Enter wrong PIN (for example 000000)
3. Click Enter

Expected:
- Error: Invalid admin credentials
- Dashboard remains locked

### A3 - Admin-only endpoint access
Goal: worker token cannot access admin APIs.

Steps:
1. Log in as worker in one browser
2. Open browser dev tools console and call:

```javascript
fetch('/api/admin/dashboard').then(r => r.status)
```

Expected:
- Status is 401 or 403

## 5. API-Level Auth Tests (Optional but recommended)

### API1 - Request worker OTP

```bash
curl -s -X POST http://localhost:8000/api/auth/worker/request-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9000000001"}'
```

Expected:
- 200 OK
- Response includes sent=true
- If debug OTP enabled, response includes debug_otp

### API2 - Verify worker OTP

```bash
curl -s -X POST http://localhost:8000/api/auth/worker/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone":"9000000001","otp":"<OTP_FROM_API1_DEBUG_OTP>"}'
```

Expected:
- 200 OK
- Response includes access_token and role=worker

### API3 - Admin login

```bash
curl -s -X POST http://localhost:8000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"pin":"admin123"}'
```

Expected:
- 200 OK
- Response includes access_token and role=admin

### API4 - Admin endpoint with worker token (negative)
1. Get worker token from API2 response.
2. Call admin endpoint:

```bash
curl -i http://localhost:8000/api/admin/dashboard \
  -H "Authorization: Bearer <WORKER_TOKEN>"
```

Expected:
- 403 Forbidden

### API5 - Worker endpoint without token (negative)

```bash
curl -i http://localhost:8000/api/workers/<WORKER_ID>/dashboard
```

Expected:
- 401 Unauthorized

## 6. Pass/Fail Checklist

Mark each as Pass/Fail:
- Worker login happy path
- Worker invalid phone validation
- Worker unregistered phone rejection
- Worker invalid OTP rejection
- Dashboard protected-route redirect
- Admin login happy path
- Admin invalid PIN rejection
- RBAC: worker blocked from admin APIs
- RBAC: unauthenticated user blocked from protected APIs

Release readiness for auth is green only if all checklist items pass.

## 7. Troubleshooting

- If worker login fails with Worker not found:
  - Run make seed-demo again

- If admin login always fails:
  - Check ADMIN_PIN in environment and restart server

- If OTP is not visible in UI:
  - Ensure AUTH_DEBUG_RETURN_OTP=true
  - Check request-otp API response for debug_otp value

- If routes are not redirecting correctly:
  - Clear browser local storage for key hermetical-store
  - Reload app

## 8. Phase 3 Validation Log (April 2026)

The following checks were executed in Docker during this phase:

- Client production build in container: PASS
- API health endpoint: PASS (200)
- Admin login and dashboard endpoints: PASS (200)
- Worker OTP request and verify flow: PASS (200)
- Worker protected dashboard/policy/preferences endpoints: PASS (200)
- Disruption simulation endpoint: PASS (201)
- Claims timeline and evidence receipt endpoints (post-simulation): PASS (200)

Notes:
- A JSX structure issue in Admin dashboard was detected by Dockerized Vite build and fixed.
- Claims timeline/receipt checks require a generated claim for the same authenticated worker.

## 9. Next Production Test Additions

1. Add Playwright end-to-end tests:
- Worker login -> dashboard -> timeline -> receipt download
- Admin login -> claims review -> simulation -> workers lookup

2. Add API contract tests for:
- communication preference validation edge cases
- privacy deletion lifecycle and retention endpoints
- consent and evidence receipt hash integrity

3. Add security tests for:
- OTP rate limiting and lockout behavior
- role boundary checks for all admin endpoints
- non-dev runtime safety assertions

4. Add performance checks:
- claim timeline response latency under concurrent load
- scheduler stability under repeated simulation triggers
