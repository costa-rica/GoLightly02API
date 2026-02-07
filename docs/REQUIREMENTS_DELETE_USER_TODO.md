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

- [ ] Create `/src/modules/deleteUser.ts` file
- [ ] Add TypeScript interface for function return type
- [ ] Implement main `deleteUser()` function signature:
  ```typescript
  export async function deleteUser(
    userId: number,
    savePublicMantrasAsBenevolentUser: boolean = false
  ): Promise<DeleteUserResult>
  ```
- [ ] Add user validation: query User table and verify user exists
- [ ] Add log: "Initiating user deletion for user ID: {userId}"
- [ ] Query `ContractUsersMantras` to get all mantraIds for the user
- [ ] Implement logic to filter mantras based on `savePublicMantrasAsBenevolentUser`:
  - [ ] If true: query Mantras table and filter to only private mantras
  - [ ] If false: include all user's mantras
  - [ ] Store in `userDeleteMantraIdsArray`
- [ ] Add log: "Found {count} mantra(s) to delete for user {userId}"
- [ ] Query `ContractMantrasElevenLabsFiles` to get elevenLabsFileIds for mantras
- [ ] Store unique ElevenLabs file IDs in `elevenLabsFileIdsArray`
- [ ] Add log: "Found {count} ElevenLabs files associated with mantras to delete"
- [ ] Query `ElevenLabsFiles` table to get file paths
- [ ] Create array of full paths: `{ id, fullPath: path.join(filePath, filename) }`
- [ ] Add log: "Retrieved file paths for {count} ElevenLabs files"

**Commit after completing Phase 1**

---

## PHASE 2: Filesystem Cleanup
**Delete physical files from the filesystem**

- [ ] Implement ElevenLabs file deletion loop:
  - [ ] For each file path, check if file exists with `fs.existsSync()`
  - [ ] If exists, delete with `fs.unlinkSync()`
  - [ ] Add success log: "Deleted ElevenLabs file: {fullPath}"
  - [ ] If not exists, add warning log: "ElevenLabs file not found, skipping: {fullPath}"
  - [ ] Catch and log errors but continue processing
  - [ ] Track success count
- [ ] Add summary log: "Deleted {successCount} of {totalCount} ElevenLabs files"
- [ ] Query Mantras table where `id IN userDeleteMantraIdsArray` to get file paths
- [ ] Implement mantra MP3 file deletion loop:
  - [ ] For each mantra, determine full path (filePath or PATH_MP3_OUTPUT fallback)
  - [ ] Check if file exists with `fs.existsSync()`
  - [ ] If exists, delete with `fs.unlinkSync()`
  - [ ] Add success log: "Deleted mantra file: {fullPath}"
  - [ ] If not exists, add warning log: "Mantra file not found, skipping: {fullPath}"
  - [ ] Catch and log errors but continue processing
  - [ ] Track success count
- [ ] Add summary log: "Deleted {successCount} of {totalCount} mantra MP3 files"

**Commit after completing Phase 2**

---

## PHASE 3: Database Cleanup
**Delete database records in proper order using transaction**

- [ ] Start database transaction using `sequelize.transaction()`
- [ ] Wrap database operations in try/catch
- [ ] Delete ElevenLabsFiles records where `id IN elevenLabsFileIdsArray`
- [ ] Add log: "Deleted {count} ElevenLabs file records from database"
- [ ] Delete Mantras records where `id IN userDeleteMantraIdsArray`
  - [ ] This cascades to: ContractUsersMantras, ContractMantrasElevenLabsFiles, ContractMantrasSoundFiles
- [ ] Add log: "Deleted {count} mantra records from database (cascade deletes contract tables)"
- [ ] Delete all ContractUserMantraListen records where `userId = {userId}`
- [ ] Add log: "Deleted {count} listen records for user {userId}"
- [ ] Delete Queue records where `userId = {userId}`
- [ ] Add log: "Deleted {count} queue records for user {userId}"
- [ ] Implement user record handling:
  - [ ] If `savePublicMantrasAsBenevolentUser === true`:
    - [ ] Update User: set email to `BenevolentUser{userId}@go-lightly.love`
    - [ ] Update User: set isAdmin to false
    - [ ] Add log: "User {userId} converted to benevolent user: BenevolentUser{userId}@go-lightly.love"
  - [ ] If `savePublicMantrasAsBenevolentUser === false`:
    - [ ] Delete User record where id = userId
    - [ ] Add log: "Deleted user record for user {userId}"
- [ ] Commit transaction on success
- [ ] Rollback transaction on error and re-throw
- [ ] Add final log: "User deletion completed successfully for user ID: {userId}"
- [ ] Return result object with userId, mantrasDeleted, elevenLabsFilesDeleted, benevolentUserCreated

**Commit after completing Phase 3**

---

## PHASE 4: Admin Endpoint
**Implement DELETE /admin/users/:userId**

- [ ] Open `/src/routes/admin.ts`
- [ ] Import deleteUser module: `import { deleteUser } from "../modules/deleteUser"`
- [ ] Create DELETE `/users/:userId` endpoint
- [ ] Extract userId from `req.params.userId` and parse to number
- [ ] Validate userId is a valid number
- [ ] Extract `savePublicMantrasAsBenevolentUser` from request body (default: false)
- [ ] Add log: "Admin user {adminId} initiated deletion of user {userId}"
- [ ] Call `await deleteUser(userId, savePublicMantrasAsBenevolentUser)`
- [ ] Return success response (200):
  ```json
  {
    "message": "User deleted successfully",
    "userId": number,
    "mantrasDeleted": number,
    "elevenLabsFilesDeleted": number,
    "benevolentUserCreated": boolean
  }
  ```
- [ ] Handle errors appropriately:
  - [ ] 400: Invalid userId
  - [ ] 404: User not found
  - [ ] 500: Internal server error
- [ ] Add error logging

**Commit after completing Phase 4**

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
