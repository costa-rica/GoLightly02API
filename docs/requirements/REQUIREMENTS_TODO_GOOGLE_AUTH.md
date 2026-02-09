# Google Authentication Implementation Requirements

This document outlines the tasks required to implement Google Authentication for user registration and login across the Go Lightly ecosystem.

## Overview

Users will be able to register and login using their Google accounts. The implementation will:

- Allow users to use BOTH email/password and Google authentication
- Automatically link Google accounts to existing email/password accounts
- Track authentication methods using an `authProvider` field
- Use `@react-oauth/google` library for frontend implementation

## Implementation Strategy

When a user authenticates with Google:

1. Frontend receives Google ID token
2. Frontend sends ID token to API endpoint `/users/google-auth`
3. API verifies token with Google's servers
4. API checks if user exists by email:
   - **New user**: Create account with `authProvider='google'`, no password, `isEmailVerified=true`
   - **Existing user (email/password)**: Update `authProvider='both'` to link accounts
   - **Existing user (Google)**: Return JWT token as normal login
5. API returns JWT access token
6. Frontend stores token in Redux and redirects to homepage

---

## Phase 1: Database Schema Changes (GoLightly02Db)

### Tasks

- [x] Make password column nullable in Users model
  - [x] Update `password` field definition to allow null
  - [x] Update TypeScript interface to `password: string | null`
  - [x] Test that Sequelize properly handles null passwords

- [x] Add `authProvider` column to Users model
  - [x] Add new column: `authProvider` (string, not null, default: 'local')
  - [x] Allowed values: 'local', 'google', 'both'
  - [x] Add TypeScript type definition
  - [x] Add database validation/constraints

- [x] Update existing database records
  - [x] ~~Create migration script to set `authProvider='local'` for all existing users~~ (N/A - starting with fresh database)
  - [x] Document migration process in README

- [x] Update model validations
  - [x] ~~Ensure password is required when `authProvider='local'` or `authProvider='both'`~~ (Validation at API level)
  - [x] Ensure password can be null when `authProvider='google'`
  - [x] Add validation comments in code

- [x] Rebuild and publish package
  - [x] Run `npm run build`
  - [x] Test in isolation
  - [x] Document breaking changes in CHANGELOG or README

- [x] Update database documentation
  - [x] Update `docs/DATABASE_OVERVIEW.md` with new schema changes
  - [x] Add notes about authProvider field usage
  - [x] Add examples of different user types

---

## Phase 2: API Backend Changes (GoLightly02API)

### Tasks

- [x] Install dependencies
  - [x] Run `npm install google-auth-library`
  - [x] ~~Run `npm install --save-dev @types/google-auth-library` (if available)~~ (Types included in package)
  - [x] Verify installation and types

- [x] Update GoLightly02Db package
  - [x] Run `npm install file:/Users/nick/Documents/GoLightly02Db`
  - [x] Verify new schema is available
  - [x] Test database connection with new schema

- [x] Add environment variables
  - [x] Add `GOOGLE_CLIENT_ID` to `.env`
  - [x] Add `GOOGLE_CLIENT_ID` to `.env.example` with description
  - [x] Validate env var on startup in `src/index.ts` (added to requiredVars array)

- [x] Create Google authentication module
  - [x] Create `src/modules/googleAuth.ts`
  - [x] Implement `verifyGoogleToken(token: string)` function
    - [x] Import OAuth2Client from google-auth-library
    - [x] Verify ID token with Google
    - [x] Extract email, name, and Google ID from payload
    - [x] Return user data or throw error
  - [x] Add error handling and logging
  - [x] Add TypeScript types for Google user data

- [x] Create Google authentication endpoint
  - [x] Add route: `POST /users/google-auth` in `src/routes/users.ts`
  - [x] Validate request body contains `idToken`
  - [x] Call `verifyGoogleToken()` to verify token
  - [x] Extract email from Google payload
  - [x] Check if user exists by email (case-insensitive lookup)
  - [x] **If user does NOT exist**:
    - [x] Create new User with:
      - [x] `email` from Google payload (normalized to lowercase)
      - [x] `password` = null
      - [x] `isEmailVerified` = true
      - [x] `emailVerifiedAt` = current timestamp
      - [x] `isAdmin` = false
      - [x] `authProvider` = 'google'
    - [x] Generate JWT access token with userId and email
    - [x] Return success response with token and user info
  - [x] **If user exists with authProvider='local'**:
    - [x] Update user record: set `authProvider='both'`
    - [x] Generate JWT access token
    - [x] Return success response with token and user info
  - [x] **If user exists with authProvider='google' or 'both'**:
    - [x] Generate JWT access token
    - [x] Return success response with token and user info
  - [x] Add comprehensive error handling
  - [x] Add logging for all cases

- [x] Update existing login validation
  - [x] In `POST /users/login`, handle users with null passwords
  - [x] Return error if user has `authProvider='google'` and tries to login with password
  - [x] Error message: "This account uses Google Sign-In. Please use the Google button to log in."

- [x] Update registration validation
  - [x] In `POST /users/register`, check if email already exists with Google auth
  - [x] Return appropriate error if user exists with `authProvider='google'`
  - [x] Error message: "An account with this email already exists. Please use Google Sign-In."

- [x] Update API documentation
  - [x] Add Google authentication endpoint to `docs/api/users.md`
  - [x] Document request/response format
  - [x] Document all error cases
  - [x] Add example curl requests

- [ ] Testing (Skipped per user request)
  - [ ] Test new user registration via Google
  - [ ] Test existing email/password user signing in with Google (account linking)
  - [ ] Test existing Google user signing in again
  - [ ] Test invalid Google token
  - [ ] Test email/password login for Google-only users (should fail)
  - [ ] Test email/password login for linked accounts (should succeed)

### Implementation Notes

- Added four new error codes to `src/modules/errorHandler.ts`:
  - `GOOGLE_AUTH_FAILED`: General Google authentication failures
  - `INVALID_GOOGLE_TOKEN`: Invalid or expired Google ID tokens
  - `GOOGLE_USER_EXISTS`: When user tries to register with email/password but account exists with Google auth
  - `PASSWORD_AUTH_DISABLED`: When Google-only user tries to login with password
- Google token verification is performed server-side using `google-auth-library` for security
- Email addresses are normalized to lowercase for consistent lookups
- Response format for `/users/google-auth` matches existing `/users/login` endpoint for consistency
- Registration endpoint now sets `authProvider='local'` for new email/password users

---

## Phase 3: Frontend Changes (GoLightly02NextJs)

### Tasks

- [ ] Install dependencies
  - [ ] Run `npm install @react-oauth/google`
  - [ ] Verify installation and types

- [ ] Add environment variables
  - [ ] Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to `.env.local`
  - [ ] Add `NEXT_PUBLIC_GOOGLE_CLIENT_ID` to `.env.example` with description
  - [ ] Add validation for required env var

- [ ] Setup Google OAuth Provider
  - [ ] Import `GoogleOAuthProvider` from `@react-oauth/google`
  - [ ] Wrap app in `GoogleOAuthProvider` in `src/app/layout.tsx`
  - [ ] Pass `NEXT_PUBLIC_GOOGLE_CLIENT_ID` as clientId prop
  - [ ] Verify provider is working

- [ ] Create Google authentication API client
  - [ ] Add `googleAuth(idToken: string)` function to `src/lib/api/client.ts` or appropriate file
  - [ ] POST to `/users/google-auth` with idToken in body
  - [ ] Return response with accessToken and user info
  - [ ] Add TypeScript types for request/response
  - [ ] Add error handling

- [ ] Update Redux auth slice
  - [ ] Ensure auth slice can handle Google authentication response
  - [ ] Store user's authProvider in state
  - [ ] Update user interface to include authProvider field

- [ ] Add Google Sign-In button to ModalLogin
  - [ ] Import `GoogleLogin` from `@react-oauth/google`
  - [ ] Add Google Sign-In button component in modal
  - [ ] Style button to match existing design
  - [ ] Implement `onSuccess` callback:
    - [ ] Extract credential (ID token) from response
    - [ ] Call `googleAuth()` API function
    - [ ] Dispatch Redux action to store token and user
    - [ ] Close modal
    - [ ] Show success toast
    - [ ] Redirect to homepage or user dashboard
  - [ ] Implement `onError` callback:
    - [ ] Log error
    - [ ] Show error toast to user
    - [ ] Handle different error types

- [ ] Add Google Sign-In button to registration form
  - [ ] Add Google Sign-In button to registration page/form
  - [ ] Use same `GoogleLogin` component
  - [ ] Implement same success/error callbacks as login
  - [ ] Add text: "Or sign up with Google" or similar
  - [ ] Style to match existing registration form

- [ ] Update UI to show authentication method
  - [ ] Add indicator in user profile/settings showing authProvider
  - [ ] Show "Signed in with Google" badge if applicable
  - [ ] Show "Signed in with Email & Google" if both methods enabled

- [ ] Add "Add Password" functionality (optional enhancement)
  - [ ] For users with `authProvider='google'`, allow adding password
  - [ ] Create form to set password
  - [ ] Update user record to `authProvider='both'`
  - [ ] Add UI in user settings/profile

- [ ] Update error handling in LoginForm
  - [ ] Show appropriate error if user tries to login with password but only has Google auth
  - [ ] Suggest using Google Sign-In button instead

- [ ] Testing
  - [ ] Test Google Sign-In button appears in ModalLogin
  - [ ] Test Google Sign-In button appears in registration
  - [ ] Test successful Google registration (new user)
  - [ ] Test successful Google login (existing user)
  - [ ] Test account linking (existing email/password user signs in with Google)
  - [ ] Test that JWT token is stored in Redux
  - [ ] Test that user is redirected after successful login
  - [ ] Test error handling for failed Google authentication
  - [ ] Test UI shows correct authProvider status
  - [ ] Test on different browsers (Chrome, Firefox, Safari)
  - [ ] Test on mobile devices

---

## Phase 4: Google Cloud Console Setup

### Tasks

- [ ] Create or access Google Cloud project
  - [ ] Go to https://console.cloud.google.com/
  - [ ] Create new project or select existing project
  - [ ] Note project ID for documentation

- [ ] Enable Google+ API
  - [ ] Navigate to "APIs & Services" > "Library"
  - [ ] Search for "Google+ API"
  - [ ] Click "Enable"

- [ ] Create OAuth 2.0 credentials
  - [ ] Navigate to "APIs & Services" > "Credentials"
  - [ ] Click "Create Credentials" > "OAuth client ID"
  - [ ] Select "Web application" as application type
  - [ ] Configure OAuth consent screen if prompted
  - [ ] Add authorized JavaScript origins:
    - [ ] `http://localhost:3001` (development)
    - [ ] Your production domain (when deployed)
  - [ ] Add authorized redirect URIs (if needed):
    - [ ] `http://localhost:3001` (development)
    - [ ] Your production domain (when deployed)
  - [ ] Save and copy Client ID

- [ ] Configure OAuth consent screen
  - [ ] Navigate to "OAuth consent screen"
  - [ ] Select "External" user type (or "Internal" if workspace)
  - [ ] Fill in app information:
    - [ ] App name: "Go Lightly"
    - [ ] User support email
    - [ ] Developer contact email
  - [ ] Add scopes:
    - [ ] `email`
    - [ ] `profile`
    - [ ] `openid`
  - [ ] Add test users (for development/testing phase)
  - [ ] Save configuration

- [ ] Document credentials
  - [ ] Store Client ID securely (password manager, env vars)
  - [ ] Add Client ID to both API and Frontend `.env` files
  - [ ] Document setup process in README or docs

- [ ] Test OAuth flow
  - [ ] Test that Google Sign-In button works
  - [ ] Verify that scopes are correctly requested
  - [ ] Check that user data is returned properly

---

## Phase 5: Security & Edge Cases

### Tasks

- [ ] Security hardening
  - [ ] Ensure Google ID token is ALWAYS verified server-side
  - [ ] Never trust client-provided user data without token verification
  - [ ] Use HTTPS in production (HTTP allowed only in development)
  - [ ] Implement rate limiting on `/users/google-auth` endpoint
  - [ ] Add request logging for audit trail

- [ ] Handle edge cases
  - [ ] User signs up with Google, then tries to register with same email and password
    - [ ] Show error: "Account already exists with Google Sign-In"
  - [ ] User signs up with email/password, then signs in with Google
    - [ ] Successfully link accounts (set authProvider='both')
  - [ ] User with linked account (both methods) deletes password
    - [ ] Update authProvider back to 'google'
    - [ ] Ensure user can still login with Google
  - [ ] Google token expires or is invalid
    - [ ] Return clear error message
    - [ ] Log error details for debugging
  - [ ] User's Google email changes
    - [ ] Document that email is stored at registration and doesn't auto-update
    - [ ] Consider adding email update functionality

- [ ] Error message standardization
  - [ ] Ensure all Google auth errors follow ERROR_REQUIREMENTS.md format
  - [ ] Use appropriate error codes (INVALID_TOKEN, AUTH_FAILED, etc.)
  - [ ] Log detailed errors server-side, show user-friendly messages client-side

- [ ] Data privacy compliance
  - [ ] Review Google's data usage policies
  - [ ] Ensure compliance with terms of service
  - [ ] Add privacy policy disclosures about Google authentication
  - [ ] Document what data is stored from Google (email only)

---

## Phase 6: Documentation & Deployment

### Tasks

- [ ] Update project documentation
  - [ ] Update `docs/PROJECT_OVERVIEW_GOLIGHTLY02.md` with Google auth implementation
  - [ ] Update API documentation with new endpoint
  - [ ] Update database schema documentation
  - [ ] Add troubleshooting section for common Google auth issues

- [ ] Update environment variable documentation
  - [ ] Document GOOGLE_CLIENT_ID in API README
  - [ ] Document NEXT_PUBLIC_GOOGLE_CLIENT_ID in NextJs README
  - [ ] Add instructions for obtaining Google credentials

- [ ] Create developer guide
  - [ ] Document how to set up Google Cloud Console
  - [ ] Document how to test Google auth locally
  - [ ] Document how to configure for production

- [ ] Production deployment checklist
  - [ ] Update Google Cloud Console with production domain
  - [ ] Add production authorized origins and redirect URIs
  - [ ] Verify SSL/HTTPS is configured
  - [ ] Test Google Sign-In in production environment
  - [ ] Monitor logs for any authentication errors

- [ ] User-facing documentation
  - [ ] Create FAQ or help doc about Google Sign-In
  - [ ] Explain benefits of linking accounts
  - [ ] Explain how to add password to Google-only account
  - [ ] Add troubleshooting for common user issues

---

## Phase 7: Testing & Quality Assurance

### Tasks

- [ ] Unit tests (API)
  - [ ] Test `verifyGoogleToken()` function with valid token
  - [ ] Test `verifyGoogleToken()` function with invalid token
  - [ ] Test new user creation via Google auth
  - [ ] Test account linking for existing users
  - [ ] Test duplicate email handling

- [ ] Integration tests (API)
  - [ ] Test complete Google authentication flow
  - [ ] Test JWT token generation for Google users
  - [ ] Test database updates for authProvider field

- [ ] End-to-end tests (Frontend)
  - [ ] Test new user registration with Google
  - [ ] Test existing user login with Google
  - [ ] Test account linking flow
  - [ ] Test error handling and messages
  - [ ] Test token storage in Redux

- [ ] Manual testing scenarios
  - [ ] New user signs up with Google
  - [ ] Existing email/password user signs in with Google (account linking)
  - [ ] Existing Google user signs in again
  - [ ] User with both methods logs in with email/password
  - [ ] User with both methods logs in with Google
  - [ ] User with Google-only tries to login with password (should fail)
  - [ ] Invalid/expired Google token handling
  - [ ] Network error during Google authentication

- [ ] Cross-browser testing
  - [ ] Test in Chrome
  - [ ] Test in Firefox
  - [ ] Test in Safari
  - [ ] Test in Edge
  - [ ] Test on mobile browsers (iOS Safari, Android Chrome)

- [ ] Performance testing
  - [ ] Measure Google auth response time
  - [ ] Test with multiple concurrent Google auth requests
  - [ ] Verify database performance with authProvider queries

---

## Success Criteria

- [ ] Users can register using Google Sign-In button
- [ ] Users can login using Google Sign-In button
- [ ] Existing email/password users can link their Google account
- [ ] Users with linked accounts can use either method to login
- [ ] Database correctly tracks authProvider for all users
- [ ] No breaking changes to existing email/password authentication
- [ ] All security checks pass (server-side token verification)
- [ ] Error handling is comprehensive and user-friendly
- [ ] Documentation is complete and accurate
- [ ] All tests pass

---

## Notes & Considerations

### Security Best Practices

- Always verify Google ID tokens on the server side using Google's libraries
- Never trust user data from the client without verification
- Use HTTPS in production
- Implement rate limiting on authentication endpoints
- Log authentication attempts for security auditing

### User Experience

- Make Google Sign-In button prominent and easy to find
- Provide clear error messages when authentication fails
- Explain benefits of linking accounts
- Allow users to see which authentication methods they have enabled

### Database Migration

- Existing users will have `authProvider='local'` by default
- No existing passwords need to be modified
- The password column will remain populated for all current users

### Future Enhancements

- Support for other OAuth providers (Facebook, Apple, Microsoft)
- Two-factor authentication
- Account recovery options for Google-only accounts
- Email change functionality
- Account unlinking (remove Google from linked account)

---

**Document Version**: 1.0
**Created**: February 9, 2026
**Status**: Planning Phase
