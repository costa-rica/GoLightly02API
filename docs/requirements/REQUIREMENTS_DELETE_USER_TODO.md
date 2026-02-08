# Delete User Requirements - Implementation Checklist

## Overview

Implement a modular user deletion process that handles file cleanup, database record removal, and optional public meditation preservation through user anonymization.

## Target Endpoints

- **DELETE /admin/users/:userId** - Admin deletes any user by ID
- **DELETE /users/me** - User deletes their own account

## Request Body (Both Endpoints)

```json
{
  "savePublicMeditationsAsBenevolentUser": true // optional, boolean, default: false
}
```

---

## PHASE 1: Core Delete User Module

**Create the reusable deleteUser module with data collection logic**

- [x] Create `/src/modules/deleteUser.ts` file
- [x] Add TypeScript interface for function return type
- [x] Implement main `deleteUser()` function signature:
  ```typescript
  export async function deleteUser(
    userId: number,
    savePublicMeditationsAsBenevolentUser: boolean = false,
  ): Promise<DeleteUserResult>;
  ```
- [x] Add user validation: query User table and verify user exists
- [x] Add log: "Initiating user deletion for user ID: {userId}"
- [x] Query `ContractUsersMeditations` to get all meditationIds for the user
- [x] Implement logic to filter meditations based on `savePublicMeditationsAsBenevolentUser`:
  - [x] If true: query Meditations table and filter to only private meditations
  - [x] If false: include all user's meditations
  - [x] Store in `userDeleteMeditationIdsArray`
- [x] Add log: "Found {count} meditation(s) to delete for user {userId}"
- [x] Query `ContractMeditationsElevenLabsFiles` to get elevenLabsFileIds for meditations
- [x] Store unique ElevenLabs file IDs in `elevenLabsFileIdsArray`
- [x] Add log: "Found {count} ElevenLabs files associated with meditations to delete"
- [x] Query `ElevenLabsFiles` table to get file paths
- [x] Create array of full paths: `{ id, fullPath: path.join(filePath, filename) }`
- [x] Add log: "Retrieved file paths for {count} ElevenLabs files"

**Commit after completing Phase 1** ✅

---

## PHASE 2: Filesystem Cleanup

**Delete physical files from the filesystem**

- [x] Implement ElevenLabs file deletion loop:
  - [x] For each file path, check if file exists with `fs.existsSync()`
  - [x] If exists, delete with `fs.unlinkSync()`
  - [x] Add success log: "Deleted ElevenLabs file: {fullPath}"
  - [x] If not exists, add warning log: "ElevenLabs file not found, skipping: {fullPath}"
  - [x] Catch and log errors but continue processing
  - [x] Track success count
- [x] Add summary log: "Deleted {successCount} of {totalCount} ElevenLabs files"
- [x] Query Meditations table where `id IN userDeleteMeditationIdsArray` to get file paths
- [x] Implement meditation MP3 file deletion loop:
  - [x] For each meditation, determine full path (filePath or PATH_MP3_OUTPUT fallback)
  - [x] Check if file exists with `fs.existsSync()`
  - [x] If exists, delete with `fs.unlinkSync()`
  - [x] Add success log: "Deleted meditation file: {fullPath}"
  - [x] If not exists, add warning log: "Meditation file not found, skipping: {fullPath}"
  - [x] Catch and log errors but continue processing
  - [x] Track success count
- [x] Add summary log: "Deleted {successCount} of {totalCount} meditation MP3 files"

**Commit after completing Phase 2** ✅

---

## PHASE 3: Database Cleanup

**Delete database records in proper order using transaction**

- [x] Start database transaction using `sequelize.transaction()`
- [x] Wrap database operations in try/catch
- [x] Delete ElevenLabsFiles records where `id IN elevenLabsFileIdsArray`
- [x] Add log: "Deleted {count} ElevenLabs file records from database"
- [x] Delete Meditations records where `id IN userDeleteMeditationIdsArray`
  - [x] This cascades to: ContractUsersMeditations, ContractMeditationsElevenLabsFiles, ContractMeditationsSoundFiles
- [x] Add log: "Deleted {count} meditation records from database (cascade deletes contract tables)"
- [x] Delete all ContractUserMeditationsListen records where `userId = {userId}`
- [x] Add log: "Deleted {count} listen records for user {userId}"
- [x] Delete Queue records where `userId = {userId}`
- [x] Add log: "Deleted {count} queue records for user {userId}"
- [x] Implement user record handling:
  - [x] If `savePublicMeditationsAsBenevolentUser === true`:
    - [x] Update User: set email to `BenevolentUser{userId}@go-lightly.love`
    - [x] Update User: set isAdmin to false
    - [x] Add log: "User {userId} converted to benevolent user: BenevolentUser{userId}@go-lightly.love"
  - [x] If `savePublicMeditationsAsBenevolentUser === false`:
    - [x] Delete User record where id = userId
    - [x] Add log: "Deleted user record for user {userId}"
- [x] Commit transaction on success
- [x] Rollback transaction on error and re-throw
- [x] Add final log: "User deletion completed successfully for user ID: {userId}"
- [x] Return result object with userId, meditationsDeleted, elevenLabsFilesDeleted, benevolentUserCreated

**Commit after completing Phase 3** ✅

---

## PHASE 4: Admin Endpoint

**Implement DELETE /admin/users/:userId**

- [x] Open `/src/routes/admin.ts`
- [x] Import deleteUser module: `import { deleteUser } from "../modules/deleteUser"`
- [x] Create DELETE `/users/:userId` endpoint
- [x] Extract userId from `req.params.userId` and parse to number
- [x] Validate userId is a valid number
- [x] Extract `savePublicMeditationsAsBenevolentUser` from request body (default: false)
- [x] Add log: "Admin user {adminId} initiated deletion of user {userId}"
- [x] Call `await deleteUser(userId, savePublicMeditationsAsBenevolentUser)`
- [x] Return success response (200):
  ```json
  {
    "message": "User deleted successfully",
    "userId": number,
    "meditationsDeleted": number,
    "elevenLabsFilesDeleted": number,
    "benevolentUserCreated": boolean
  }
  ```
- [x] Handle errors appropriately:
  - [x] 400: Invalid userId
  - [x] 404: User not found (handled by deleteUser module)
  - [x] 500: Internal server error
- [x] Add error logging

**Commit after completing Phase 4** ✅

---

## PHASE 5: Self-Service Endpoint

**Implement DELETE /users/me**

- [x] Open `/src/routes/users.ts`
- [x] Import deleteUser module: `import { deleteUser } from "../modules/deleteUser"`
- [x] Create DELETE `/me` endpoint
- [x] Apply authMiddleware to the endpoint
- [x] Extract userId from `req.user.userId` (from JWT token)
- [x] Extract `savePublicMeditationsAsBenevolentUser` from request body (default: false)
- [x] Add log: "User {userId} initiated self-deletion"
- [x] Call `await deleteUser(userId, savePublicMeditationsAsBenevolentUser)`
- [x] Return success response (200):
  ```json
  {
    "message": "Your account has been deleted successfully",
    "userId": number,
    "meditationsDeleted": number,
    "elevenLabsFilesDeleted": number,
    "benevolentUserCreated": boolean
  }
  ```
- [x] Handle errors appropriately:
  - [x] 401: Authentication failed
  - [x] 500: Internal server error
- [x] Add error logging

**Commit after completing Phase 5** ✅

---

## PHASE 6: Testing

**Test all scenarios and edge cases**

- [ ] Test admin endpoint: DELETE /admin/users/:userId
  - [ ] With savePublicMeditationsAsBenevolentUser=false (complete deletion)
  - [ ] With savePublicMeditationsAsBenevolentUser=true (keep public meditations)
  - [ ] With invalid userId
  - [ ] With non-existent userId
  - [ ] Without admin privileges
- [ ] Test self-service endpoint: DELETE /users/me
  - [ ] With savePublicMeditationsAsBenevolentUser=false
  - [ ] With savePublicMeditationsAsBenevolentUser=true
  - [ ] Without authentication
- [ ] Test edge cases:
  - [ ] User with no meditations
  - [ ] User with only public meditations + savePublicMeditationsAsBenevolentUser=true
  - [ ] User with only private meditations + savePublicMeditationsAsBenevolentUser=true
  - [ ] User with no public meditations + savePublicMeditationsAsBenevolentUser=true
  - [ ] Files already deleted from filesystem
  - [ ] Database records exist but files are missing
- [ ] Verify logging output is comprehensive and correct
- [ ] Verify database transaction rollback on error
- [ ] Verify all related database records are deleted
- [ ] Verify benevolent user email format and isAdmin=false
- [ ] Verify file deletion errors don't fail the entire process

**Commit after completing Phase 6**

---

## PHASE 7: Documentation

**Create and update API documentation**

- [x] Create `/docs/api/deleteUser.md` with:
  - [x] Overview of delete user functionality
  - [x] Documentation for DELETE /admin/users/:userId
  - [x] Documentation for DELETE /users/me
  - [x] Request body schema with savePublicMeditationsAsBenevolentUser explanation
  - [x] Sample requests for both endpoints
  - [x] Sample responses for success cases
  - [x] Error response examples
  - [x] Examples with savePublicMeditationsAsBenevolentUser=true
  - [x] Examples with savePublicMeditationsAsBenevolentUser=false
  - [x] Notes about benevolent user conversion
  - [x] Notes about what gets deleted
- [x] Update `/docs/api/admin.md`:
  - [x] Add DELETE /users/:userId to admin endpoints list
  - [x] Add link to deleteUser.md for full details
- [x] Update `/docs/api/users.md`:
  - [x] Add DELETE /me to user endpoints list
  - [x] Add link to deleteUser.md for full details
- [x] Review all documentation for accuracy and completeness

**Commit after completing Phase 7** ✅

---

## Implementation Notes

### Error Handling Strategy

- Wrap entire process in try/catch
- Use database transaction for all database operations (rollback on error)
- File deletion failures should log warnings but NOT fail the process
- Return appropriate HTTP status codes

### Logging Strategy

- **info** level: Normal progress updates at each step
- **warn** level: File not found (skip and continue)
- **error** level: Database errors, critical failures

### Edge Cases to Handle

1. User has no meditations → skip file deletion, process normally
2. User has no public meditations but savePublicMeditationsAsBenevolentUser=true → deletes all meditations, converts to benevolent user
3. Files already deleted → log warning, continue
4. Self-deletion invalidates user's token → expected behavior

### Important Constraints

- Sound files are NOT deleted (shared across multiple meditations)
- Queue records ARE deleted for the user
- ALL ContractUserMeditationsListen records deleted for user
- Benevolent user: only email and isAdmin change, everything else stays same
