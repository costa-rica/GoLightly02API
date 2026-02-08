# GoLightly02API Requirements TODO

This document tracks the implementation progress for the GoLightly02API project.

## Phase 1: Project Setup and Infrastructure

- [x] Install required dependencies
  - [x] express, @types/express
  - [x] typescript, ts-node, @types/node
  - [x] nodemailer, @types/nodemailer
  - [x] bcryptjs, @types/bcryptjs
  - [x] jsonwebtoken, @types/jsonwebtoken
  - [x] winston
  - [x] dotenv
  - [x] cors, @types/cors
  - [x] golightly02db (custom package)
- [x] Set up TypeScript configuration (tsconfig.json)
- [x] Create folder structure
  - [x] src/routes/
  - [x] src/modules/
  - [x] src/types/
  - [x] src/templates/
- [x] Create .env.example with all required variables
  - [x] JWT_SECRET
  - [x] URL_MANTRIFY01QUEUER
  - [x] PATH_MP3_OUTPUT
  - [x] PATH_MP3_SOUND_FILES
  - [x] PORT
  - [x] PATH_DATABASE
  - [x] NAME_DB
  - [x] NODE_ENV
  - [x] NAME_APP
  - [x] PATH_TO_LOGS
  - [x] LOG_MAX_SIZE (optional)
  - [x] LOG_MAX_FILES (optional)
  - [x] EMAIL_HOST (gmail SMTP)
  - [x] EMAIL_PORT
  - [x] EMAIL_USER
  - [x] EMAIL_PASSWORD (app password)
  - [x] EMAIL_FROM
- [x] Initialize database connection using golightly02db package

## Phase 2: Logging Setup

- [x] Create src/modules/logger.ts following LOGGING_NODE_JS_V06.md
  - [x] Environment variable validation (NODE_ENV, NAME_APP, PATH_TO_LOGS)
  - [x] Development mode: console only
  - [x] Testing mode: console + rotating files
  - [x] Production mode: rotating files only
  - [x] Configure file rotation with LOG_MAX_SIZE and LOG_MAX_FILES
  - [x] Set appropriate log levels per environment

## Phase 3: Error Handling

- [x] Create src/modules/errorHandler.ts following ERROR_REQUIREMENTS.md
  - [x] Standard error response format function
  - [x] Common error codes (VALIDATION_ERROR, AUTH_FAILED, NOT_FOUND, etc.)
  - [x] Environment-based error detail sanitization
- [x] Create Express error middleware
  - [x] Catch-all error handler
  - [x] 404 handler for unknown routes

## Phase 4: Authentication Infrastructure

- [x] Create src/modules/jwt.ts
  - [x] generateAccessToken function (user id and email)
  - [x] verifyAccessToken function
  - [x] generateEmailVerificationToken function (30min expiration)
  - [x] verifyEmailVerificationToken function
- [x] Create src/modules/passwordHash.ts
  - [x] hashPassword function using bcrypt
  - [x] comparePassword function
- [x] Create src/modules/authMiddleware.ts
  - [x] Extract and verify JWT from Authorization header
  - [x] Attach user info to request object
  - [x] Handle authentication errors

## Phase 5: Email Service

- [x] Create src/modules/emailService.ts
  - [x] Configure Nodemailer with Gmail SMTP
  - [x] sendVerificationEmail function
  - [x] Error handling and logging
- [x] Create src/templates/emailVerification.html
  - [x] Professional email template with verification link
  - [x] Include token as query parameter

## Phase 6: Users Router

- [x] Create src/routes/users.ts
- [x] POST /users/register
  - [x] Validate email and password in request body
  - [x] Check if user already exists
  - [x] Hash password with bcrypt
  - [x] Create user in database (isEmailVerified=false)
  - [x] Generate email verification token (30min expiration)
  - [x] Send verification email
  - [x] Return success response
  - [x] Error handling and logging
- [x] GET /users/verify
  - [x] Extract token from query parameter
  - [x] Verify and decode token
  - [x] Check token expiration
  - [x] Update user: isEmailVerified=true, emailVerifiedAt=Date.now()
  - [x] Return success response
  - [x] Error handling (expired token, invalid token, user not found)
- [x] POST /users/login
  - [x] Validate email and password in request body
  - [x] Find user by email
  - [x] Check isEmailVerified=true
  - [x] Compare password with hash
  - [x] Generate JWT access token
  - [x] Return token in response
  - [x] Error handling (user not found, email not verified, wrong password)

## Phase 7: Meditations Router

- [x] Create src/routes/meditations.ts
- [x] Apply authentication middleware to all routes
- [x] GET /meditations/sound_files
  - [x] Query SoundFiles table
  - [x] Return list of sound files
  - [x] Error handling
- [x] POST /meditations/create
  - [x] Validate meditationArray exists in request body
  - [x] Send POST request to queuer: URL_MANTRIFY01QUEUER + /meditations/new
  - [x] Wait for response starting with "Processing batch requests from CSV file"
  - [x] Return success if valid response
  - [x] Return error response if invalid or failed
  - [x] Error handling and logging
- [x] DELETE /meditations/:id
  - [x] Extract meditation ID from URL params
  - [x] Verify ownership via ContractUsersMeditations table
  - [x] Find meditation in Meditations table
  - [x] Delete .mp3 file from PATH_MP3_OUTPUT
  - [x] Delete meditation from database
  - [x] Return success response
  - [x] Error handling (not found, not owner, file deletion failed)

## Phase 8: Main Application

- [x] Create src/index.ts (or src/app.ts)
  - [x] Load dotenv configuration
  - [x] Import and initialize logger
  - [x] Import database and call initModels() and sequelize.sync()
  - [x] Create Express app
  - [x] Add CORS middleware
  - [x] Add JSON body parser
  - [x] Register users router (/users)
  - [x] Register meditations router (/meditations)
  - [x] Add 404 handler
  - [x] Add error handling middleware
  - [x] Start server on PORT from .env
  - [x] Log startup message
- [x] Create package.json scripts
  - [x] dev: ts-node src/index.ts
  - [x] build: tsc
  - [x] start: node dist/index.js

## Phase 9: Documentation

- [x] Create README.md following README-format.md
  - [x] Project Overview
  - [x] Setup instructions
  - [x] Usage examples
  - [x] Project Structure tree
  - [x] .env section with all variables
  - [x] References to docs/ files

## Phase 10: Testing and Validation

- [ ] Test database connection and models
- [ ] Test logger in all three modes (development, testing, production)
- [ ] Test POST /users/register
  - [ ] Valid registration
  - [ ] Duplicate email
  - [ ] Email sending
- [ ] Test GET /users/verify
  - [ ] Valid token
  - [ ] Expired token
  - [ ] Invalid token
- [ ] Test POST /users/login
  - [ ] Valid login
  - [ ] Unverified email
  - [ ] Wrong password
  - [ ] User not found
- [ ] Test GET /meditations/sound_files
  - [ ] With authentication
  - [ ] Without authentication
- [ ] Test POST /meditations/create
  - [ ] Valid meditation creation
  - [ ] Queuer integration
  - [ ] Error handling
- [ ] Test DELETE /meditations/:id
  - [ ] Owner can delete
  - [ ] Non-owner cannot delete
  - [ ] File deletion
- [x] Build project and verify no TypeScript errors
- [ ] Final review and commit
