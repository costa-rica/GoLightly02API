# Delete User Endpoints

This document covers user deletion functionality, including both admin and self-service deletion endpoints.

## Overview

The delete user functionality provides two endpoints for removing users from the system:

1. **DELETE /admin/users/:userId** - Admin endpoint to delete any user
2. **DELETE /users/me** - Self-service endpoint for users to delete their own account

Both endpoints support an optional `savePublicMantrasAsBenevolentUser` flag that allows preserving public mantras while anonymizing the user account.

## What Gets Deleted

When a user is deleted, the following actions occur:

### Files Deleted
- All ElevenLabs audio files associated with the user's mantras (to be deleted)
- All mantra MP3 files for mantras owned by the user (to be deleted)
- Sound files are NOT deleted (they are shared across multiple mantras)

### Database Records Deleted
- ElevenLabs file records from `ElevenLabsFiles` table
- Mantra records from `Mantras` table (for mantras to be deleted)
- Contract records from `ContractUsersMantras` (via cascade)
- Contract records from `ContractMantrasElevenLabsFiles` (via cascade)
- Contract records from `ContractMantrasSoundFiles` (via cascade)
- All user's listen records from `ContractUserMantraListen` table
- All user's queue records from `Queue` table
- User record from `Users` table (unless converting to benevolent user)

## Benevolent User Conversion

When `savePublicMantrasAsBenevolentUser: true` is specified:

- Only PRIVATE mantras are deleted
- PUBLIC mantras are preserved
- User's email is changed to `BenevolentUser{userId}@go-lightly.love`
- User's `isAdmin` status is set to `false`
- All other user fields remain unchanged (password, isEmailVerified, etc.)
- User can no longer login (email changed)
- Public mantras remain available in the system

This allows users to contribute their public mantras to the community while removing their personal identity from the system.

---

## DELETE /admin/users/:userId

Deletes any user by ID. Admin-only endpoint.

- Authentication: Required (JWT token)
- Admin Status: Required (isAdmin=true)
- Deletes any user regardless of who created them
- Supports optional benevolent user conversion

### Parameters

URL parameters:
- `userId` (number, required): The user ID to delete

Request body:
```json
{
  "savePublicMantrasAsBenevolentUser": false  // optional, boolean, default: false
}
```

### Sample Request - Complete Deletion

```bash
curl --location --request DELETE 'http://localhost:3000/admin/users/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMantrasAsBenevolentUser": false
}'
```

### Sample Response - Complete Deletion

Success (200):
```json
{
  "message": "User deleted successfully",
  "userId": 5,
  "mantrasDeleted": 8,
  "elevenLabsFilesDeleted": 24,
  "benevolentUserCreated": false
}
```

### Sample Request - Benevolent User Conversion

```bash
curl --location --request DELETE 'http://localhost:3000/admin/users/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMantrasAsBenevolentUser": true
}'
```

### Sample Response - Benevolent User Conversion

Success (200):
```json
{
  "message": "User deleted successfully",
  "userId": 5,
  "mantrasDeleted": 3,
  "elevenLabsFilesDeleted": 9,
  "benevolentUserCreated": true
}
```

In this example:
- User had 8 total mantras (3 private, 5 public)
- Only 3 private mantras were deleted
- 5 public mantras were preserved
- User's email changed to `BenevolentUser5@go-lightly.love`
- User's isAdmin set to false

### Error Responses

#### Invalid user ID (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid user ID",
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

#### User not found (404)

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete user",
    "status": 500
  }
}
```

### Notes

- Admin can delete any user, including other admins
- If user has no public mantras but `savePublicMantrasAsBenevolentUser: true`, all mantras are deleted and user is still converted to benevolent user
- File deletion errors are logged but do not fail the deletion process
- All database operations are performed in a transaction (rollback on error)
- Missing files from filesystem are logged as warnings but do not prevent deletion

---

## DELETE /users/me

Self-service endpoint for users to delete their own account.

- Authentication: Required (JWT token)
- Admin Status: Not required
- User can only delete their own account
- Supports optional benevolent user conversion
- User's JWT token becomes invalid after deletion

### Parameters

Request body:
```json
{
  "savePublicMantrasAsBenevolentUser": false  // optional, boolean, default: false
}
```

### Sample Request - Complete Deletion

```bash
curl --location --request DELETE 'http://localhost:3000/users/me' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMantrasAsBenevolentUser": false
}'
```

### Sample Response - Complete Deletion

Success (200):
```json
{
  "message": "Your account has been deleted successfully",
  "userId": 12,
  "mantrasDeleted": 5,
  "elevenLabsFilesDeleted": 15,
  "benevolentUserCreated": false
}
```

### Sample Request - Benevolent User Conversion

```bash
curl --location --request DELETE 'http://localhost:3000/users/me' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMantrasAsBenevolentUser": true
}'
```

### Sample Response - Benevolent User Conversion

Success (200):
```json
{
  "message": "Your account has been deleted successfully",
  "userId": 12,
  "mantrasDeleted": 2,
  "elevenLabsFilesDeleted": 6,
  "benevolentUserCreated": true
}
```

In this example:
- User had 5 total mantras (2 private, 3 public)
- Only 2 private mantras were deleted
- 3 public mantras were preserved
- User's email changed to `BenevolentUser12@go-lightly.love`
- User's isAdmin set to false
- User can no longer login (email changed)

### Error Responses

#### Authentication failed (401)

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication required",
    "status": 401
  }
}
```

#### Invalid or expired token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired token",
    "status": 401
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete user account",
    "status": 500
  }
}
```

### Notes

- User's JWT token becomes invalid immediately after deletion (if completely deleted)
- If benevolent user conversion, account remains but user cannot login (email changed)
- Even if `savePublicMantrasAsBenevolentUser: true`, user cannot retain admin status
- User cannot undo this operation
- All database operations are performed in a transaction (rollback on error)

---

## Response Fields

Both endpoints return the same response structure:

- `message` (string): Success message
- `userId` (number): The ID of the deleted/converted user
- `mantrasDeleted` (number): Number of mantras removed from the system
- `elevenLabsFilesDeleted` (number): Number of ElevenLabs audio files deleted from filesystem
- `benevolentUserCreated` (boolean): Whether the user was converted to a benevolent user

## Edge Cases

### User with No Mantras

If a user has no mantras:
- File deletion steps are skipped
- Queue and listen records are still deleted
- User record is handled according to `savePublicMantrasAsBenevolentUser` flag

Example response:
```json
{
  "message": "User deleted successfully",
  "userId": 8,
  "mantrasDeleted": 0,
  "elevenLabsFilesDeleted": 0,
  "benevolentUserCreated": false
}
```

### User with No Public Mantras (Benevolent Conversion Requested)

If `savePublicMantrasAsBenevolentUser: true` but user has no public mantras:
- All mantras are deleted (filter returns all as private)
- User is still converted to benevolent user
- Email changed to `BenevolentUser{userId}@go-lightly.love`

Example response:
```json
{
  "message": "User deleted successfully",
  "userId": 9,
  "mantrasDeleted": 4,
  "elevenLabsFilesDeleted": 12,
  "benevolentUserCreated": true
}
```

### Files Already Deleted

If files have been manually deleted from the filesystem:
- Warnings are logged for missing files
- Deletion process continues normally
- Database records are still removed
- Response shows count of files actually deleted

Example log output:
```
[warn]: ElevenLabs file not found, skipping: /path/to/missing.mp3
[warn]: Mantra file not found, skipping: /path/to/missing_mantra.mp3
```

## Implementation Details

### Process Flow

1. Validate user exists
2. Determine which mantras to delete (all or private only)
3. Get associated ElevenLabs file IDs
4. Delete ElevenLabs files from filesystem
5. Delete mantra MP3 files from filesystem
6. Start database transaction
7. Delete ElevenLabs file records
8. Delete mantra records (cascades to contract tables)
9. Delete all user's listen records
10. Delete user's queue records
11. Delete or convert user record
12. Commit transaction
13. Return success response

### Logging

All major steps are logged with appropriate levels:
- **info**: Normal progress updates
- **warn**: File not found (skip and continue)
- **error**: Database errors, critical failures

Example log sequence:
```
[info]: Initiating user deletion for user ID: 5
[info]: Found 3 private mantra(s) to delete for user 5
[info]: Found 9 ElevenLabs files associated with mantras to delete
[info]: Retrieved file paths for 9 ElevenLabs files
[info]: Deleted ElevenLabs file: /path/to/file1.mp3
[info]: Deleted 9 of 9 ElevenLabs file(s)
[info]: Deleted mantra file: /path/to/mantra1.mp3
[info]: Deleted 3 of 3 mantra MP3 file(s)
[info]: Deleted 9 ElevenLabs file record(s) from database
[info]: Deleted 3 mantra record(s) from database (cascade deletes contract tables)
[info]: Deleted 15 listen record(s) for user 5
[info]: Deleted 2 queue record(s) for user 5
[info]: User 5 converted to benevolent user: BenevolentUser5@go-lightly.love
[info]: User deletion completed successfully for user ID: 5
```

### Transaction Safety

All database operations are wrapped in a Sequelize transaction:
- If any database operation fails, all changes are rolled back
- File deletion failures do NOT trigger rollback (files can be manually cleaned up)
- Ensures data consistency across all related tables
