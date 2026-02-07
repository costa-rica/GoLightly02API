# Delete User Requirements - Implementation Checklist

## Overview

Implement a modular user deletion process that handles file cleanup, database record removal, and optional public mantra preservation through user anonymization.

## Target Endpoints

- **DELETE /admin/users/:userId** - Admin deletes any user by ID
- **DELETE /users/me** - User deletes their own account

## Request Body (Both Endpoints)

```json
{
  "savePublicMantrasAsBenevolentUser": true  // optional, boolean, default: false
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
    savePublicMantrasAsBenevolentUser: boolean = false
  ): Promise<DeleteUserResult>
  ```
- [x] Add user validation: query User table and verify user exists
- [x] Add log: "Initiating user deletion for user ID: {userId}"
- [x] Query `ContractUsersMantras` to get all mantraIds for the user
- [x] Implement logic to filter mantras based on `savePublicMantrasAsBenevolentUser`:
  - [x] If true: query Mantras table and filter to only private mantras
  - [x] If false: include all user's mantras
  - [x] Store in `userDeleteMantraIdsArray`
- [x] Add log: "Found {count} mantra(s) to delete for user {userId}"
- [x] Query `ContractMantrasElevenLabsFiles` to get elevenLabsFileIds for mantras
- [x] Store unique ElevenLabs file IDs in `elevenLabsFileIdsArray`
- [x] Add log: "Found {count} ElevenLabs files associated with mantras to delete"
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
- [x] Query Mantras table where `id IN userDeleteMantraIdsArray` to get file paths
- [x] Implement mantra MP3 file deletion loop:
  - [x] For each mantra, determine full path (filePath or PATH_MP3_OUTPUT fallback)
  - [x] Check if file exists with `fs.existsSync()`
  - [x] If exists, delete with `fs.unlinkSync()`
  - [x] Add success log: "Deleted mantra file: {fullPath}"
  - [x] If not exists, add warning log: "Mantra file not found, skipping: {fullPath}"
  - [x] Catch and log errors but continue processing
  - [x] Track success count
- [x] Add summary log: "Deleted {successCount} of {totalCount} mantra MP3 files"

**Commit after completing Phase 2** ✅

---

## PHASE 3: Database Cleanup
**Delete database records in proper order using transaction**

- [x] Start database transaction using `sequelize.transaction()`
- [x] Wrap database operations in try/catch
- [x] Delete ElevenLabsFiles records where `id IN elevenLabsFileIdsArray`
- [x] Add log: "Deleted {count} ElevenLabs file records from database"
- [x] Delete Mantras records where `id IN userDeleteMantraIdsArray`
  - [x] This cascades to: ContractUsersMantras, ContractMantrasElevenLabsFiles, ContractMantrasSoundFiles
- [x] Add log: "Deleted {count} mantra records from database (cascade deletes contract tables)"
- [x] Delete all ContractUserMantraListen records where `userId = {userId}`
- [x] Add log: "Deleted {count} listen records for user {userId}"
- [x] Delete Queue records where `userId = {userId}`
- [x] Add log: "Deleted {count} queue records for user {userId}"
- [x] Implement user record handling:
  - [x] If `savePublicMantrasAsBenevolentUser === true`:
    - [x] Update User: set email to `BenevolentUser{userId}@go-lightly.love`
    - [x] Update User: set isAdmin to false
    - [x] Add log: "User {userId} converted to benevolent user: BenevolentUser{userId}@go-lightly.love"
  - [x] If `savePublicMantrasAsBenevolentUser === false`:
    - [x] Delete User record where id = userId
    - [x] Add log: "Deleted user record for user {userId}"
- [x] Commit transaction on success
- [x] Rollback transaction on error and re-throw
- [x] Add final log: "User deletion completed successfully for user ID: {userId}"
- [x] Return result object with userId, mantrasDeleted, elevenLabsFilesDeleted, benevolentUserCreated

**Commit after completing Phase 3** ✅

---

## PHASE 4: Admin Endpoint
**Implement DELETE /admin/users/:userId**

- [x] Open `/src/routes/admin.ts`
- [x] Import deleteUser module: `import { deleteUser } from "../modules/deleteUser"`
- [x] Create DELETE `/users/:userId` endpoint
- [x] Extract userId from `req.params.userId` and parse to number
- [x] Validate userId is a valid number
- [x] Extract `savePublicMantrasAsBenevolentUser` from request body (default: false)
- [x] Add log: "Admin user {adminId} initiated deletion of user {userId}"
- [x] Call `await deleteUser(userId, savePublicMantrasAsBenevolentUser)`
- [x] Return success response (200):
  ```json
  {
    "message": "User deleted successfully",
    "userId": number,
    "mantrasDeleted": number,
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

- [ ] Open `/src/routes/users.ts`
- [ ] Import deleteUser module: `import { deleteUser } from "../modules/deleteUser"`
- [ ] Create DELETE `/me` endpoint
- [ ] Apply authMiddleware to the endpoint
- [ ] Extract userId from `req.user.userId` (from JWT token)
- [ ] Extract `savePublicMantrasAsBenevolentUser` from request body (default: false)
- [ ] Add log: "User {userId} initiated self-deletion"
- [ ] Call `await deleteUser(userId, savePublicMantrasAsBenevolentUser)`
- [ ] Return success response (200):
  ```json
  {
    "message": "Your account has been deleted successfully",
    "userId": number,
    "mantrasDeleted": number,
    "elevenLabsFilesDeleted": number,
    "benevolentUserCreated": boolean
  }
  ```
- [ ] Handle errors appropriately:
  - [ ] 401: Authentication failed
  - [ ] 500: Internal server error
- [ ] Add error logging

**Commit after completing Phase 5**

---

## PHASE 6: Testing
**Test all scenarios and edge cases**

- [ ] Test admin endpoint: DELETE /admin/users/:userId
  - [ ] With savePublicMantrasAsBenevolentUser=false (complete deletion)
  - [ ] With savePublicMantrasAsBenevolentUser=true (keep public mantras)
  - [ ] With invalid userId
  - [ ] With non-existent userId
  - [ ] Without admin privileges
- [ ] Test self-service endpoint: DELETE /users/me
  - [ ] With savePublicMantrasAsBenevolentUser=false
  - [ ] With savePublicMantrasAsBenevolentUser=true
  - [ ] Without authentication
- [ ] Test edge cases:
  - [ ] User with no mantras
  - [ ] User with only public mantras + savePublicMantrasAsBenevolentUser=true
  - [ ] User with only private mantras + savePublicMantrasAsBenevolentUser=true
  - [ ] User with no public mantras + savePublicMantrasAsBenevolentUser=true
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

- [ ] Create `/docs/api/deleteUser.md` with:
  - [ ] Overview of delete user functionality
  - [ ] Documentation for DELETE /admin/users/:userId
  - [ ] Documentation for DELETE /users/me
  - [ ] Request body schema with savePublicMantrasAsBenevolentUser explanation
  - [ ] Sample requests for both endpoints
  - [ ] Sample responses for success cases
  - [ ] Error response examples
  - [ ] Examples with savePublicMantrasAsBenevolentUser=true
  - [ ] Examples with savePublicMantrasAsBenevolentUser=false
  - [ ] Notes about benevolent user conversion
  - [ ] Notes about what gets deleted
- [ ] Update `/docs/api/admin.md`:
  - [ ] Add DELETE /users/:userId to admin endpoints list
  - [ ] Add link to deleteUser.md for full details
- [ ] Update `/docs/api/users.md`:
  - [ ] Add DELETE /me to user endpoints list
  - [ ] Add link to deleteUser.md for full details
- [ ] Review all documentation for accuracy and completeness

**Commit after completing Phase 7**

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
1. User has no mantras → skip file deletion, process normally
2. User has no public mantras but savePublicMantrasAsBenevolentUser=true → deletes all mantras, converts to benevolent user
3. Files already deleted → log warning, continue
4. Self-deletion invalidates user's token → expected behavior

### Important Constraints
- Sound files are NOT deleted (shared across multiple mantras)
- Queue records ARE deleted for the user
- ALL ContractUserMantraListen records deleted for user
- Benevolent user: only email and isAdmin change, everything else stays same
