# Database Router Implementation Requirements

This document outlines the implementation plan for the database backup and restore endpoints.

## Overview

Create a new router at `src/routes/database.ts` with 5 endpoints for managing database backups and restoration. All endpoints require authentication and admin-only access.

## Environment Variables

Required:
- `PATH_PROJECT_RESOURCES`: Base path where database_backups/ directory will be created

## Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| /database/create-backup | POST | Admin | Export all tables to CSV, zip folder, cleanup |
| /database/backups-list | GET | Admin | List all backup .zip files |
| /database/download-backup/:filename | GET | Admin | Download backup as attachment |
| /database/delete-backup/:filename | DELETE | Admin | Delete backup file |
| /database/replenish-database | POST | Admin | Restore database from uploaded .zip backup |

## Implementation Phases

### Phase 1: Setup and Middleware

Tasks:
- [x] Create `src/modules/database/` directory
- [x] Create `src/modules/database/export.ts` file (table export and CSV creation)
- [x] Create `src/modules/database/compression.ts` file (zip/unzip operations)
- [x] Create `src/modules/database/import.ts` file (CSV import and table restoration)
- [x] Create `src/modules/database/validation.ts` file (filename validation, path security)
- [x] Create `src/modules/database/filesystem.ts` file (directory creation, path management)
- [x] Create `src/routes/database.ts` file
- [x] Install required dependencies (archiver, csv-writer, csv-parser, multer, unzipper)
- [x] Import database models from mantrify01db
- [x] Import authMiddleware and create adminMiddleware (or verify admin in routes)
- [x] Create router and apply authMiddleware to all routes
- [x] Add admin check middleware/logic
- [x] Register router in `src/index.ts` with `/database` path
- [x] Add `PATH_PROJECT_RESOURCES` to required env vars validation in `src/index.ts`

### Phase 2: Helper Functions

All helper functions are organized in `src/modules/database/` following the modular pattern of the codebase.

#### src/modules/database/filesystem.ts
- [x] `ensureBackupDirectory()` - Create `database_backups/` if missing
- [x] `getBackupPath()` - Return full path to database_backups/
- [x] `generateTimestamp()` - Create YYYYMMDD_HHMMSS format timestamp
- [x] `cleanupDirectory(dirPath)` - Delete folder and contents

#### src/modules/database/validation.ts
- [x] `validateFilename(filename)` - Check for path traversal attacks (../, absolute paths)
- [x] `validateZipExtension(filename)` - Ensure filename ends with .zip
- [x] `sanitizeFilename(filename)` - Remove dangerous characters

#### src/modules/database/export.ts
- [x] `getAllTables()` - Return list of all Sequelize models/tables
- [x] `exportTableToCSV(tableName, model, outputPath)` - Export single table to CSV with headers
- [x] `createBackup(backupDir)` - Orchestrate full backup process (export all tables)

#### src/modules/database/compression.ts
- [x] `zipDirectory(sourceDir, outPath)` - Zip directory using archiver
- [x] `extractZip(zipPath, extractPath)` - Extract zip file for restore using unzipper

#### src/modules/database/import.ts
- [x] `importCSVToTable(csvPath, tableName, model)` - Import single CSV to table
- [x] `restoreFromBackup(extractedPath)` - Orchestrate full restore process (import all CSVs with transaction)
- [x] `parseCSVRow(row)` - Parse CSV row with NULL handling

### Phase 3: POST /database/create-backup

Tasks:
- [x] Validate user is authenticated and admin
- [x] Check PATH_PROJECT_RESOURCES env var exists
- [x] Call `ensureBackupDirectory()` to create database_backups/ if needed
- [x] Generate timestamp using `generateTimestamp()`
- [x] Create backup folder name: `database_backup_${timestamp}`
- [x] Create full backup folder path inside database_backups/
- [x] Get list of all tables from database
- [x] If no tables exist, throw error with AppError
- [x] Loop through each table and export to CSV:
  - [x] Name CSV file as `${tableName}.csv`
  - [x] Include column headers in CSV
  - [x] Represent NULL values as empty strings (standard CSV convention)
  - [x] Log which table is being exported
  - [x] If export fails, log error with table name and throw
- [x] After all CSVs created, zip the backup folder
- [x] Name zip file: `database_backup_${timestamp}.zip`
- [x] If zipping fails, delete any partial files and throw error
- [x] If zipping succeeds, delete original backup folder
- [x] Delete any non-.zip files in case of partial failure
- [x] Return success response with backup filename and path
- [x] Add comprehensive error handling with proper logging

### Phase 4: GET /database/backups-list

Tasks:
- [x] Validate user is authenticated and admin
- [x] Check PATH_PROJECT_RESOURCES env var exists
- [x] Get path to database_backups/ directory
- [x] Check if directory exists; if not, return empty array
- [x] Read all files in database_backups/ directory
- [x] Filter to only .zip files
- [x] Get file stats (size, creation date) for each backup
- [x] Sort by creation date (newest first)
- [x] Return array of backup files with metadata:
  - filename
  - size (in bytes or MB)
  - createdAt (timestamp)
- [x] Add error handling and logging

### Phase 5: GET /database/download-backup/:filename

Tasks:
- [x] Validate user is authenticated and admin
- [x] Extract :filename param from request
- [x] Validate filename includes .zip extension
- [x] Validate filename against path traversal attacks (no ../, absolute paths, etc.)
- [x] Check PATH_PROJECT_RESOURCES env var exists
- [x] Construct full path to backup file
- [x] Check if file exists; if not, return 404
- [x] Verify file is actually a file (not directory)
- [x] Set response headers:
  - Content-Type: application/zip
  - Content-Disposition: attachment; filename="${filename}"
  - Content-Length: file size
- [x] Stream file to response using fs.createReadStream
- [x] Add error handling for file read errors
- [x] Log download event with admin user ID and filename

### Phase 6: DELETE /database/delete-backup/:filename

Tasks:
- [x] Validate user is authenticated and admin
- [x] Extract :filename param from request
- [x] Validate filename includes .zip extension
- [x] Validate filename against path traversal attacks
- [x] Check PATH_PROJECT_RESOURCES env var exists
- [x] Construct full path to backup file
- [x] Check if file exists; if not, return 404
- [x] Verify file is actually a file (not directory)
- [x] Delete the file using fs.unlinkSync or fs.promises.unlink
- [x] If deletion fails, log error and throw AppError
- [x] Return success response with deleted filename
- [x] Log deletion event with admin user ID and filename

### Phase 7: POST /database/replenish-database

Tasks:
- [x] Validate user is authenticated and admin
- [x] Set up multer middleware for file upload (accept .zip only)
- [x] Validate uploaded file exists
- [x] Validate uploaded file is a .zip file
- [x] Create temporary extraction directory with unique name
- [x] Extract .zip file to temporary directory
- [x] Read all .csv files from extracted directory
- [x] For each CSV file:
  - [x] Parse filename to determine table name (remove .csv extension)
  - [x] Validate table exists in database
  - [x] Read CSV with headers
  - [x] Parse each row and insert into database
  - [x] Handle NULL values (empty strings -> null)
  - [x] Log progress (e.g., "Importing X rows into TableName")
  - [x] If import fails, log which table/row failed
- [x] Use transaction for all imports (rollback on failure)
- [x] After successful import, cleanup temporary directory
- [x] Delete uploaded .zip file
- [x] Return success response with:
  - [x] Number of tables imported
  - [x] Number of rows imported per table
  - [x] Total rows imported
- [x] Add comprehensive error handling:
  - [x] Invalid zip file
  - [x] Missing CSV files
  - [x] Table doesn't exist
  - [x] CSV format errors
  - [x] Database insert errors
- [x] Log all steps of restoration process

### Phase 8: Documentation

Tasks:
- [ ] Create `docs/api/database.md` with endpoint documentation
- [ ] Document each endpoint with:
  - Description
  - Authentication requirements (admin only)
  - Request format (body/params)
  - Response format
  - Error responses
  - Sample requests (curl examples)
- [ ] Add notes about:
  - Backup file naming convention
  - CSV format (headers, NULL handling)
  - Path traversal security
  - Transaction handling in replenish
- [ ] Update main API documentation to reference database endpoints

### Phase 9: Testing and Validation

Tasks:
- [ ] Test create-backup with empty database
- [ ] Test create-backup with populated database
- [ ] Test create-backup when PATH_PROJECT_RESOURCES is missing
- [ ] Test create-backup when disk space is full (error handling)
- [ ] Test backups-list with no backups
- [ ] Test backups-list with multiple backups
- [ ] Test download-backup with valid filename
- [ ] Test download-backup with invalid filename (404)
- [ ] Test download-backup with path traversal attempts (security)
- [ ] Test delete-backup with valid filename
- [ ] Test delete-backup with invalid filename (404)
- [ ] Test delete-backup with path traversal attempts (security)
- [ ] Test replenish-database with valid backup
- [ ] Test replenish-database with corrupted zip
- [ ] Test replenish-database with missing CSV files
- [ ] Test replenish-database with invalid table names
- [ ] Test replenish-database transaction rollback on failure
- [ ] Test all endpoints without authentication (401)
- [ ] Test all endpoints with non-admin user (403)
- [ ] Run build and verify no TypeScript errors

## Technical Details

### CSV Format
- First row contains column headers (exact column names from database)
- NULL values represented as empty strings
- Standard CSV escaping for special characters (quotes, commas, newlines)
- UTF-8 encoding

### Backup File Structure
```
database_backup_20260206_143022/
├── Users.csv
├── Mantras.csv
├── ContractUsersMantras.csv
├── ContractUserMantraListen.csv
├── ElevenLabsFiles.csv
├── Queue.csv
├── SoundFiles.csv
├── ContractMantrasElevenLabsFiles.csv
└── ContractMantrasSoundFiles.csv
```

After zipping: `database_backup_20260206_143022.zip`

### Tables to Export/Import
1. Users
2. Mantras
3. ContractUsersMantras
4. ContractUserMantraListen
5. ElevenLabsFiles
6. Queue
7. SoundFiles
8. ContractMantrasElevenLabsFiles
9. ContractMantrasSoundFiles

### Security Considerations
- All endpoints require admin authentication
- Path traversal validation on filename params
- File type validation on uploads
- Sanitize filenames to prevent command injection
- Use transactions for database restoration
- Log all database operations with admin user ID

### Dependencies to Install
```bash
npm install archiver csv-writer csv-parser multer
npm install --save-dev @types/archiver @types/multer
```

## Error Codes

Add to `src/modules/errorHandler.ts`:
- `ADMIN_REQUIRED`: User is not an admin
- `BACKUP_FAILED`: Backup creation failed
- `BACKUP_NOT_FOUND`: Backup file not found
- `INVALID_FILENAME`: Invalid or malicious filename
- `RESTORE_FAILED`: Database restoration failed
- `INVALID_BACKUP_FILE`: Backup file is corrupted or invalid

## Success Response Formats

### POST /database/create-backup
```json
{
  "message": "Database backup created successfully",
  "filename": "database_backup_20260206_143022.zip",
  "path": "/path/to/database_backups/database_backup_20260206_143022.zip",
  "tablesExported": 9,
  "timestamp": "20260206_143022"
}
```

### GET /database/backups-list
```json
{
  "backups": [
    {
      "filename": "database_backup_20260206_143022.zip",
      "size": 1024000,
      "sizeFormatted": "1.02 MB",
      "createdAt": "2026-02-06T14:30:22.000Z"
    }
  ],
  "count": 1
}
```

### DELETE /database/delete-backup/:filename
```json
{
  "message": "Backup deleted successfully",
  "filename": "database_backup_20260206_143022.zip"
}
```

### POST /database/replenish-database
```json
{
  "message": "Database restored successfully",
  "tablesImported": 9,
  "rowsImported": {
    "Users": 5,
    "Mantras": 12,
    "ContractUsersMantras": 15,
    "ContractUserMantraListen": 8,
    "ElevenLabsFiles": 20,
    "Queue": 3,
    "SoundFiles": 10,
    "ContractMantrasElevenLabsFiles": 25,
    "ContractMantrasSoundFiles": 18
  },
  "totalRows": 116
}
```
