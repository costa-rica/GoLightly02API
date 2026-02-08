# Delete User Endpoints

This document covers user deletion functionality, including both admin and self-service deletion endpoints.

## Overview

The delete user functionality provides two endpoints for removing users from the system:

1. **DELETE /admin/users/:userId** - Admin endpoint to delete any user
2. **DELETE /users/me** - Self-service endpoint for users to delete their own account

Both endpoints support an optional `savePublicMeditationsAsBenevolentUser` flag that allows preserving public meditations while anonymizing the user account.

## What Gets Deleted

When a user is deleted, the following actions occur:

### Files Deleted

- All ElevenLabs audio files associated with the user's meditations (to be deleted)
- All meditation MP3 files for meditations owned by the user (to be deleted)
- Sound files are NOT deleted (they are shared across multiple meditations)

### Database Records Deleted

- ElevenLabs file records from `ElevenLabsFiles` table
- Meditation records from `Meditations` table (for meditations to be deleted)
- Contract records from `ContractUsersMeditations` (via cascade)
- Contract records from `ContractMeditationsElevenLabsFiles` (via cascade)
- Contract records from `ContractMeditationsSoundFiles` (via cascade)
- All user's listen records from `ContractUserMeditationsListen` table
- All user's queue records from `Queue` table
- User record from `Users` table (unless converting to benevolent user)

## Benevolent User Conversion

When `savePublicMeditationsAsBenevolentUser: true` is specified:

- Only PRIVATE meditations are deleted
- PUBLIC meditations are preserved
- User's email is changed to `BenevolentUser{userId}@go-lightly.love`
- User's `isAdmin` status is set to `false`
- All other user fields remain unchanged (password, isEmailVerified, etc.)
- User can no longer login (email changed)
- Public meditations remain available in the system

This allows users to contribute their public meditations to the community while removing their personal identity from the system.

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
  "savePublicMeditationsAsBenevolentUser": false // optional, boolean, default: false
}
```

### Sample Request - Complete Deletion

```bash
curl --location --request DELETE 'http://localhost:3000/admin/users/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMeditationsAsBenevolentUser": false
}'
```

### Sample Response - Complete Deletion

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

### Sample Request - Benevolent User Conversion

```bash
curl --location --request DELETE 'http://localhost:3000/admin/users/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMeditationsAsBenevolentUser": true
}'
```

### Sample Response - Benevolent User Conversion

Success (200):

```json
{
  "message": "User deleted successfully",
  "userId": 5,
  "meditationsDeleted": 3,
  "elevenLabsFilesDeleted": 9,
  "benevolentUserCreated": true
}
```

In this example:

- User had 8 total meditations (3 private, 5 public)
- Only 3 private meditations were deleted
- 5 public meditations were preserved
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
- If user has no public meditations but `savePublicMeditationsAsBenevolentUser: true`, all meditations are deleted and user is still converted to benevolent user
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
  "savePublicMeditationsAsBenevolentUser": false // optional, boolean, default: false
}
```

### Sample Request - Complete Deletion

```bash
curl --location --request DELETE 'http://localhost:3000/users/me' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--header 'Content-Type: application/json' \
--data-raw '{
  "savePublicMeditationsAsBenevolentUser": false
}'
```

### Sample Response - Complete Deletion

Success (200):

```json
{
  "message": "Your account has been deleted successfully",
  "userId": 12,
  "meditationsDeleted": 5,
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
  "savePublicMeditationsAsBenevolentUser": true
}'
```

### Sample Response - Benevolent User Conversion

Success (200):

```json
{
  "message": "Your account has been deleted successfully",
  "userId": 12,
  "meditationsDeleted": 2,
  "elevenLabsFilesDeleted": 6,
  "benevolentUserCreated": true
}
```

In this example:

- User had 5 total meditations (2 private, 3 public)
- Only 2 private meditations were deleted
- 3 public meditations were preserved
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
- Even if `savePublicMeditationsAsBenevolentUser: true`, user cannot retain admin status
- User cannot undo this operation
- All database operations are performed in a transaction (rollback on error)

---

## Response Fields

Both endpoints return the same response structure:

- `message` (string): Success message
- `userId` (number): The ID of the deleted/converted user
- `meditationsDeleted` (number): Number of meditations removed from the system
- `elevenLabsFilesDeleted` (number): Number of ElevenLabs audio files deleted from filesystem
- `benevolentUserCreated` (boolean): Whether the user was converted to a benevolent user

## Edge Cases

### User with No Meditations

If a user has no meditations:

- File deletion steps are skipped
- Queue and listen records are still deleted
- User record is handled according to `savePublicMeditationsAsBenevolentUser` flag

Example response:

```json
{
  "message": "User deleted successfully",
  "userId": 8,
  "meditationsDeleted": 0,
  "elevenLabsFilesDeleted": 0,
  "benevolentUserCreated": false
}
```

### User with No Public Meditations (Benevolent Conversion Requested)

If `savePublicMeditationsAsBenevolentUser: true` but user has no public meditations:

- All meditations are deleted (filter returns all as private)
- User is still converted to benevolent user
- Email changed to `BenevolentUser{userId}@go-lightly.love`

Example response:

```json
{
  "message": "User deleted successfully",
  "userId": 9,
  "meditationsDeleted": 4,
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
[warn]: Meditation file not found, skipping: /path/to/missing_meditation.mp3
```

## Implementation Details

### Process Flow

1. Validate user exists
2. Determine which meditations to delete (all or private only)
3. Get associated ElevenLabs file IDs
4. Delete ElevenLabs files from filesystem
5. Delete meditation MP3 files from filesystem
6. Start database transaction
7. Delete ElevenLabs file records
8. Delete meditation records (cascades to contract tables)
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
[info]: Found 3 private meditation(s) to delete for user 5
[info]: Found 9 ElevenLabs files associated with meditations to delete
[info]: Retrieved file paths for 9 ElevenLabs files
[info]: Deleted ElevenLabs file: /path/to/file1.mp3
[info]: Deleted 9 of 9 ElevenLabs file(s)
[info]: Deleted meditation file: /path/to/meditation1.mp3
[info]: Deleted 3 of 3 meditation MP3 file(s)
[info]: Deleted 9 ElevenLabs file record(s) from database
[info]: Deleted 3 meditation record(s) from database (cascade deletes contract tables)
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
