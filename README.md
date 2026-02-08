# GoLightly02API

## Project Overview

GoLightly02API is a REST API for creating and managing meditation meditations. Built with TypeScript and Express.js, it handles user authentication, meditation creation requests, and integrates with the GoLightly02Queuer service for audio processing.

## Setup

1. Ensure the local dependency exists at `../GoLightly02Db`
2. Install dependencies: `npm install`
3. Configure environment variables (see .env section below)
4. Build the project: `npm run build`

## Usage

Development mode with hot reload:

```bash
npm run dev
```

Production mode:

```bash
npm run build
npm start
```

The API will be available at `http://localhost:3000` (or the PORT specified in your .env file).

### API Endpoints

Users:

- POST `/users/register` - Register a new user (receives verification email)
- GET `/users/verify?token=<token>` - Verify email address
- POST `/users/login` - Login and receive JWT access token

Meditations (all require authentication):

- GET `/meditations/sound_files` - List available sound files
- POST `/meditations/create` - Create a new meditation (queues for processing)
- DELETE `/meditations/:id` - Delete a meditation (verifies ownership)

Health check:

- GET `/health` - Service health status

## Project Structure

```
GoLightly02API/
├── src/
│   ├── routes/
│   │   ├── users.ts          # User authentication endpoints
│   │   └── meditations.ts        # Meditation management endpoints
│   ├── modules/
│   │   ├── logger.ts         # Winston logging configuration
│   │   ├── errorHandler.ts  # Error handling utilities
│   │   ├── jwt.ts            # JWT token generation/verification
│   │   ├── passwordHash.ts  # Bcrypt password hashing
│   │   ├── authMiddleware.ts # JWT authentication middleware
│   │   └── emailService.ts  # Nodemailer email service
│   ├── templates/
│   │   └── emailVerification.html
│   ├── types/
│   └── index.ts             # Main application entry point
├── docs/
│   ├── PROJECT_REQUIREMENTS_DOCUMENT.md
│   ├── REQUIREMENTS_TODO.md
│   ├── DATABASE_OVERVIEW.md
│   ├── LOGGING_NODE_JS_V06.md
│   ├── ERROR_REQUIREMENTS.md
│   └── README-format.md
├── dist/                    # Compiled JavaScript output
├── package.json
├── tsconfig.json
├── .env
├── .env.example
└── README.md
```

## .env

```
# Application
NAME_APP=GoLightly02API
NODE_ENV=development
PORT=3000

# JWT Authentication
JWT_SECRET=your-secret-key-here

# Database (GoLightly02Db package)
PATH_DATABASE=/path/to/database/directory
NAME_DB=golightly.sqlite

# Logging
PATH_TO_LOGS=/path/to/logs
LOG_MAX_SIZE=5
LOG_MAX_FILES=5

# GoLightly02Queuer Integration
URL_MANTRIFY01QUEUER=http://localhost:3001

# File Paths
PATH_MP3_OUTPUT=/path/to/completed/meditations
PATH_MP3_SOUND_FILES=/path/to/sound/files

# Email (Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-password-here
EMAIL_FROM=GoLightly <your-email@gmail.com>
```

## References

- [Project Requirements](docs/PROJECT_REQUIREMENTS_DOCUMENT.md)
- [Requirements TODO](docs/REQUIREMENTS_TODO.md)
- [Database Overview](docs/DATABASE_OVERVIEW.md)
- [Logging Guidelines](docs/LOGGING_NODE_JS_V06.md)
- [Error Requirements](docs/ERROR_REQUIREMENTS.md)
- [README Format](docs/README-format.md)
