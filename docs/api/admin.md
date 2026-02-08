# Admin Router

This router handles administrative operations that require elevated privileges.

All endpoints require authentication AND admin status (isAdmin=true) to access.

## Overview

Admin endpoints provide elevated access to:

- View all users in the system
- Delete any user by ID (with optional benevolent user conversion)
- View all meditations regardless of visibility
- Delete any meditation regardless of ownership
- View all queue records from the processing queue

## GET /admin/users

Retrieves a list of all users in the database.

- Authentication: Required
- Admin Status: Required (isAdmin=true)
- Returns all user records excluding the password field
- Includes system timestamps (createdAt, updatedAt)

### Parameters

None

### Sample Request

```bash
curl --location 'http://localhost:3000/admin/users' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Success (200):

```json
{
  "users": [
    {
      "id": 1,
      "email": "admin@example.com",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-02-01T10:30:00.000Z",
      "isAdmin": true,
      "createdAt": "2026-02-01T10:00:00.000Z",
      "updatedAt": "2026-02-01T10:30:00.000Z",
      "hasPublicMeditations": false
    },
    {
      "id": 2,
      "email": "user@example.com",
      "isEmailVerified": true,
      "emailVerifiedAt": "2026-02-02T14:20:00.000Z",
      "isAdmin": false,
      "createdAt": "2026-02-02T14:15:00.000Z",
      "updatedAt": "2026-02-02T14:20:00.000Z",
      "hasPublicMeditations": true
    },
    {
      "id": 3,
      "email": "newuser@example.com",
      "isEmailVerified": false,
      "emailVerifiedAt": null,
      "isAdmin": false,
      "createdAt": "2026-02-03T09:00:00.000Z",
      "updatedAt": "2026-02-03T09:00:00.000Z",
      "hasPublicMeditations": false
    }
  ]
}
```

### Error Responses

#### Missing or invalid token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "status": 401
  }
}
```

#### Authentication required (401)

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication required",
    "status": 401
  }
}
```

#### User not found (401)

If the authenticated user no longer exists in the database:

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "User not found",
    "status": 401
  }
}
```

#### Admin access required (403)

When the authenticated user is not an admin (isAdmin=false):

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "Admin access required",
    "status": 403
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve users",
    "status": 500
  }
}
```

### Notes

- The password field is always excluded from the response for security
- All users in the database are returned, including those with unverified emails
- Both authenticated and non-admin users receive a 403 error, not 401
- The admin middleware checks are performed after authentication middleware
- Timestamps (createdAt, updatedAt) are automatically managed by Sequelize
- The emailVerifiedAt field will be null for users who haven't verified their email
- The hasPublicMeditations field indicates whether the user has any meditations with visibility set to "public"

## DELETE /admin/users/:userId

Deletes any user by ID. Admin can delete any user including other admins.

- Authentication: Required
- Admin Status: Required (isAdmin=true)
- Supports optional benevolent user conversion to preserve public meditations
- Full documentation available in [deleteUser.md](deleteUser.md)

### Parameters

URL parameters:

- `userId` (number, required): The user ID to delete

Request body:

```json
{
  "savePublicMeditationsAsBenevolentUser": false // optional, boolean, default: false
}
```

### Sample Request

```bash
curl --location --request DELETE 'http://localhost:3000/admin/users/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMeditationsAsBenevolentUser": false
}'
```

### Sample Response

Success (200):

```json
{
  "message": "User deleted successfully",
  "userId": 5,
  "meditationsDeleted": 8,
  "elevenLabsFilesDeleted": 24,
  "benevolentUserCreated": false
}
```

### Notes

- See [deleteUser.md](deleteUser.md) for complete documentation including:
  - What gets deleted
  - Benevolent user conversion details
  - Error responses
  - Edge cases
  - Implementation details

## GET /admin/meditations

Retrieves a list of all meditations in the database regardless of visibility.

- Authentication: Required
- Admin Status: Required (isAdmin=true)
- Returns all meditations (public and private) with aggregated listen counts
- Similar to GET /meditations/all but without visibility filtering

### Parameters

None

### Sample Request

```bash
curl --location 'http://localhost:3000/admin/meditations' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Success (200):

```json
{
  "meditations": [
    {
      "id": 1,
      "meditationArray": [
        {
          "id": 1,
          "pause_duration": "3.0"
        },
        {
          "id": 2,
          "text": "Hello world",
          "voice_id": "nPczCjzI2devNBz1zQrb",
          "speed": "0.85"
        }
      ],
      "filename": "output_20260203_113759.mp3",
      "filePath": "/path/to/meditations/",
      "visibility": "public",
      "title": "Morning Meditation",
      "description": "A peaceful morning meditation",
      "createdAt": "2026-02-03T11:37:59.000Z",
      "updatedAt": "2026-02-03T11:37:59.000Z",
      "listens": 42
    },
    {
      "id": 2,
      "meditationArray": [...],
      "filename": "output_20260203_120000.mp3",
      "filePath": "/path/to/meditations/",
      "visibility": "private",
      "title": "Personal Affirmations",
      "description": null,
      "createdAt": "2026-02-03T12:00:00.000Z",
      "updatedAt": "2026-02-03T12:00:00.000Z",
      "listens": 5
    }
  ]
}
```

### Error Responses

#### Missing or invalid token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "status": 401
  }
}
```

#### Admin access required (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "Admin access required",
    "status": 403
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve meditations",
    "status": 500
  }
}
```

### Notes

- Returns ALL meditations regardless of visibility (public, private, etc.)
- Does not require ownership verification - admins can see all meditations
- The `listens` field is calculated by summing all listen counts from the ContractUserMeditationsListen table
- All fields from the Meditations table are included in the response
- Unlike GET /meditations/all, there is no `includePrivate` parameter - all meditations are always returned

## DELETE /admin/meditations/:meditationId

Deletes any meditation and its associated MP3 file (admin can delete any meditation regardless of ownership).

- Authentication: Required
- Admin Status: Required (isAdmin=true)
- Does not require ownership verification
- Deletes both the database record and the physical file
- Supports meditations stored in both filePath directory and PATH_MP3_OUTPUT fallback

### Parameters

URL parameters:

- `meditationId` (number, required): The meditation ID to delete

### Sample Request

```bash
curl --location --request DELETE 'http://localhost:3000/admin/meditations/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Success (200):

```json
{
  "message": "Meditation deleted successfully",
  "meditationId": 5
}
```

### Error Responses

#### Invalid meditation ID (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid meditation ID",
    "status": 400
  }
}
```

#### Missing or invalid token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "status": 401
  }
}
```

#### Admin access required (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "Admin access required",
    "status": 403
  }
}
```

#### Meditation not found (404)

```json
{
  "error": {
    "code": "MANTRA_NOT_FOUND",
    "message": "Meditation not found",
    "status": 404
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete meditation",
    "status": 500
  }
}
```

### Notes

- Admin can delete ANY meditation regardless of who created it
- No ownership verification is performed (unlike DELETE /meditations/:id)
- The endpoint attempts to delete the physical MP3 file before deleting the database record
- If the file doesn't exist on disk, the database record is still deleted
- Supports both filePath (if specified in database) and PATH_MP3_OUTPUT fallback
- All related records in junction tables should be handled by database cascading rules

## GET /admin/queuer

Retrieves all records from the Queue table showing meditation processing status.

- Authentication: Required
- Admin Status: Required (isAdmin=true)
- Returns all queue records ordered by ID (most recent first)
- Shows the status of all meditation creation jobs

### Parameters

None

### Sample Request

```bash
curl --location 'http://localhost:3000/admin/queuer' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Success (200):

```json
{
  "queue": [
    {
      "id": 5,
      "userId": 2,
      "status": "done",
      "jobFilename": "job_20260204_140530.csv",
      "createdAt": "2026-02-04T14:05:30.000Z",
      "updatedAt": "2026-02-04T14:06:15.000Z"
    },
    {
      "id": 4,
      "userId": 1,
      "status": "concatenator",
      "jobFilename": "job_20260204_135212.csv",
      "createdAt": "2026-02-04T13:52:12.000Z",
      "updatedAt": "2026-02-04T13:53:45.000Z"
    },
    {
      "id": 3,
      "userId": 2,
      "status": "queued",
      "jobFilename": "job_20260204_131005.csv",
      "createdAt": "2026-02-04T13:10:05.000Z",
      "updatedAt": "2026-02-04T13:10:05.000Z"
    }
  ]
}
```

### Error Responses

#### Missing or invalid token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "status": 401
  }
}
```

#### Admin access required (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "Admin access required",
    "status": 403
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve queue records",
    "status": 500
  }
}
```

### Queue Status Values

The `status` field indicates the current processing stage:

- **queued**: Job is waiting to be processed
- **started**: Job processing has begun
- **elevenlabs**: Currently processing text-to-speech with ElevenLabs
- **concatenator**: Currently concatenating audio files
- **done**: Job completed successfully

### Notes

- Records are returned in descending order by ID (most recent first)
- The `jobFilename` is the CSV file stored in the GoLightly02Queuer service
- Each queue record is associated with a user via `userId`
- The Queue table is managed by the GoLightly02Queuer service
- This endpoint provides visibility into the meditation creation pipeline for monitoring and debugging
- All fields from the Queue table are included in the response
