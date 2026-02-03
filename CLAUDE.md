# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mantrify01API is a TypeScript/Express.js REST API for meditation mantra creation and management. It integrates with the Mantrify01Queuer service for audio processing and uses a custom Mantrify01Db SQLite/Sequelize package for data persistence. The system supports user authentication with email verification and JWT-based session management.

## Build and Development Commands

```bash
# Development (hot reload with ts-node)
npm run dev

# Build TypeScript to JavaScript
npm run build

# Production (run compiled code)
npm start
```

The API runs on port 3000 by default (configurable via PORT in .env).

## Architecture

### Modular Design Philosophy

The codebase follows a strict modularity principle: all helper functions and utilities live in `src/modules/` to enable easy replacement without cascading changes. Types go in `src/types/`, routes in `src/routes/`, and email templates in `src/templates/`.

### Database Integration

Uses the **Mantrify01Db** custom package (located at `../Mantrify01Db`) which provides:
- Sequelize models: `User`, `Mantra`, `Queue`, `SoundFiles`, `ContractUsersMantras`
- Database initialization via `initModels()` and `sequelize.sync()`
- Import pattern: `import { initModels, sequelize, User, Mantra } from "mantrify01db"`

Database must be initialized in `src/index.ts` before any models are used.

### Authentication Flow

1. **Registration** (`POST /users/register`):
   - Hashes password with bcrypt
   - Creates user with `isEmailVerified=false`
   - Generates JWT verification token (30-minute expiration)
   - Sends verification email via Nodemailer

2. **Verification** (`GET /users/verify?token=<token>`):
   - Validates JWT token expiration
   - Updates `isEmailVerified=true` and sets `emailVerifiedAt`
   - Users cannot login until verified

3. **Login** (`POST /users/login`):
   - Checks `isEmailVerified` status
   - Compares password with bcrypt hash
   - Returns JWT access token (no expiration)

4. **Protected Routes**:
   - All `/mantras/*` endpoints require `authMiddleware`
   - Middleware extracts user from `Authorization: Bearer <token>` header
   - Attaches `req.user` with `{ userId, email }`

### Mantra Creation Flow

`POST /mantras/create` accepts a `mantraArray` with three element types:
- `pause`: `{ id, pause_duration }`
- `text`: `{ id, text, voice_id, speed }`
- `sound_file`: `{ id, sound_file }`

The API forwards this to **Mantrify01Queuer** (`URL_MANTRIFY01QUEUER` + `/mantras/new`) and validates the response starts with "Processing batch requests from CSV file". The queuer handles all database updates for `Mantras`, `Queue`, and `ContractUsersMantras` tables.

### Mantra Deletion

`DELETE /mantras/:id` verifies ownership via `ContractUsersMantras` table before:
1. Deleting the MP3 file from `PATH_MP3_OUTPUT`
2. Removing the database record

### Logging (Winston)

Follows **docs/LOGGING_NODE_JS_V06.md** requirements:

- **Development**: Console only
- **Testing**: Console + rotating files
- **Production**: Rotating files only

Configuration in `src/modules/logger.ts` validates required env vars (`NODE_ENV`, `NAME_APP`, `PATH_TO_LOGS`) and exits fatally if missing. Log rotation uses `LOG_MAX_SIZE` (MB) and `LOG_MAX_FILES` for retention.

For early exit scenarios (guardrails, validation failures), use async IIFE pattern with 100ms delay before `process.exit()` to ensure Winston flushes to disk.

### Error Handling

Follows **docs/ERROR_REQUIREMENTS.md** standard format:

```json
{
  "error": {
    "code": "ERROR_CODE_HERE",
    "message": "User-facing message",
    "details": "Debug info (dev only)",
    "status": 500
  }
}
```

`src/modules/errorHandler.ts` provides:
- `AppError` class for throwing errors with codes
- `ErrorCodes` constants (VALIDATION_ERROR, AUTH_FAILED, etc.)
- `createErrorResponse()` utility
- Express middleware: `errorHandler` (catch-all) and `notFoundHandler` (404)

Details are sanitized in production (`NODE_ENV !== 'development'`).

### Email Service

Uses Nodemailer with Gmail SMTP (requires app password in `EMAIL_PASSWORD`). Template in `src/templates/emailVerification.html` with `{{verificationUrl}}` placeholder.

## Critical Environment Variables

Required for startup (validated in `src/modules/logger.ts` and `src/index.ts`):
- `NODE_ENV`, `NAME_APP`, `PATH_TO_LOGS` (logging)
- `PORT`, `JWT_SECRET` (server/auth)
- `PATH_DATABASE`, `NAME_DB` (database)
- `URL_MANTRIFY01QUEUER` (integration)
- `PATH_MP3_OUTPUT`, `PATH_MP3_SOUND_FILES` (file management)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_FROM` (email)

Optional: `LOG_MAX_SIZE` (default 5MB), `LOG_MAX_FILES` (default 5)

## External Service Integration

**Mantrify01Queuer**: Expects `POST /mantras/new` with `{ userId, mantraArray }` body. Success response must start with "Processing batch requests from CSV file" string. The queuer manages all mantra processing and database updates for mantra records.

## Code Style Guidelines

- **No bold text** in section headings or list item beginnings (per docs/README-format.md)
- Modular design: changes should be localized to single files
- All database operations use Sequelize ORM via Mantrify01Db package
- JWT tokens: email verification expires in 30min, access tokens don't expire
- Email addresses normalized to lowercase before storage/lookup
