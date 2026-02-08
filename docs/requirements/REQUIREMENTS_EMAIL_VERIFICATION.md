# Email Verification Requirements

## Overview

Email verification confirms user email ownership during registration. The flow uses a frontend-first pattern: API sends email → User clicks link → NextJS handles UX → API validates token.

## Architecture Pattern

```
User Registration → API sends email with NextJS link → User clicks email
    → NextJS /verify page → API validates token → NextJS shows result
```

## Environment Variables

- `URL_BASE_WEBSITE`: NextJS frontend base URL (e.g., `http://localhost:3001` or `https://yourapp.com`)
- Used in all email links to ensure users land on frontend pages

## API Responsibilities

### Send Verification Email
- Trigger: User registers via `POST /users/register`
- Email contains link: `{URL_BASE_WEBSITE}/verify?token={jwt_token}`
- JWT token: 30-minute expiration, contains `userId` and `email`
- User record created with `isEmailVerified=false`

### Verify Token Endpoint
**Endpoint:** `GET /users/verify?token={jwt_token}`

**Returns JSON:**
- Success (200): `{ "message": "Email verified successfully. You can now log in." }`
- Already verified (200): `{ "message": "Email is already verified. You can now log in." }`
- Invalid token (401): `{ "error": { "code": "INVALID_TOKEN", ... } }`
- Expired token (401): `{ "error": { "code": "TOKEN_EXPIRED", ... } }`
- Missing token (400): `{ "error": { "code": "VALIDATION_ERROR", ... } }`

**Side Effect:** Updates `isEmailVerified=true` and `emailVerifiedAt=<timestamp>` on success

## Frontend (NextJS) Responsibilities

### Create Verification Page
**Route:** `/verify`

**Behavior:**
1. Extract `token` from URL query params
2. Call API: `GET {API_URL}/users/verify?token={token}`
3. Handle responses:
   - **Valid token (200):** Show success message, redirect to `/login`
   - **Invalid/expired token (401):** Redirect to home page, show error modal with message
   - **Already verified (200):** Show already-verified message, redirect to `/login`
   - **Network error:** Show generic error modal

### User Experience
- Loading state while validating
- Clear success/error messaging
- Automatic redirect after 2-3 seconds (or "Continue" button)

## Security Notes

- Email verification ONLY confirms email ownership
- Does NOT grant authentication (no auto-login)
- User must manually login with password after verification
- This prevents unauthorized access if email is compromised

## Error Handling

Frontend should handle all error scenarios gracefully:
- Expired tokens: "Verification link expired. Please request a new one."
- Invalid tokens: "Invalid verification link. Please contact support."
- Network errors: "Unable to verify email. Please try again."

## Email Template Requirements

- Clear call-to-action button with verification link
- Fallback plain-text link (for email clients that block HTML)
- Expiration notice ("This link expires in 30 minutes")
- Support email for help
