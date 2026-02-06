# Database Router

This router handles database backup creation, listing, download, deletion, and restoration.

All endpoints require authentication and admin status (isAdmin=true).

## Notes

- Backup files are named `database_backup_YYYYMMDD_HHMMSS.zip`.
- CSV exports include headers and represent NULL values as empty strings.
- Filenames are validated to prevent path traversal.
- Database restore runs inside a transaction and rolls back on failure.

## POST /database/create-backup

Create a new database backup by exporting all tables to CSV and zipping the result.

- Authentication: Required
- Admin Status: Required (isAdmin=true)

### Parameters

None

### Sample Request

```bash
curl --location --request POST 'http://localhost:3000/database/create-backup' \
--header 'Authorization: Bearer <token>'
```

### Sample Response

Success (200):

```json
{
  "message": "Database backup created successfully",
  "filename": "database_backup_20260206_143022.zip",
  "path": "/path/to/database_backups/database_backup_20260206_143022.zip",
  "tablesExported": 9,
  "timestamp": "20260206_143022"
}
```

### Error Responses

#### Admin access required (403)

```json
{
  "error": {
    "code": "ADMIN_REQUIRED",
    "message": "Admin privileges required",
    "status": 403
  }
}
```

#### Backup failed (500)

```json
{
  "error": {
    "code": "BACKUP_FAILED",
    "message": "Failed to create database backup",
    "status": 500
  }
}
```

## GET /database/backups-list

List all backup zip files with metadata.

- Authentication: Required
- Admin Status: Required (isAdmin=true)

### Parameters

None

### Sample Request

```bash
curl --location 'http://localhost:3000/database/backups-list' \
--header 'Authorization: Bearer <token>'
```

### Sample Response

Success (200):

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

### Error Responses

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to list backups",
    "status": 500
  }
}
```

## GET /database/download-backup/:filename

Download a backup zip file as an attachment.

- Authentication: Required
- Admin Status: Required (isAdmin=true)

### Parameters

URL parameters:

- `filename` (string, required): Backup zip filename

### Sample Request

```bash
curl --location 'http://localhost:3000/database/download-backup/database_backup_20260206_143022.zip' \
--header 'Authorization: Bearer <token>' \
--output database_backup_20260206_143022.zip
```

### Sample Response

Success (200):

The response is a binary zip stream with headers:

- Content-Type: application/zip
- Content-Disposition: attachment; filename="database_backup_20260206_143022.zip"
- Content-Length: <bytes>

### Error Responses

#### Invalid filename (400)

```json
{
  "error": {
    "code": "INVALID_FILENAME",
    "message": "Filename must have .zip extension",
    "status": 400
  }
}
```

#### Backup not found (404)

```json
{
  "error": {
    "code": "BACKUP_NOT_FOUND",
    "message": "Backup file not found",
    "status": 404
  }
}
```

## DELETE /database/delete-backup/:filename

Delete a backup zip file.

- Authentication: Required
- Admin Status: Required (isAdmin=true)

### Parameters

URL parameters:

- `filename` (string, required): Backup zip filename

### Sample Request

```bash
curl --location --request DELETE 'http://localhost:3000/database/delete-backup/database_backup_20260206_143022.zip' \
--header 'Authorization: Bearer <token>'
```

### Sample Response

Success (200):

```json
{
  "message": "Backup deleted successfully",
  "filename": "database_backup_20260206_143022.zip"
}
```

### Error Responses

#### Backup not found (404)

```json
{
  "error": {
    "code": "BACKUP_NOT_FOUND",
    "message": "Backup file not found",
    "status": 404
  }
}
```

## POST /database/replenish-database

Restore the database from an uploaded backup zip file.

- Authentication: Required
- Admin Status: Required (isAdmin=true)
- Upload field: `file`

### Parameters

Form-data:

- `file` (file, required): Backup zip file

### Sample Request

```bash
curl --location --request POST 'http://localhost:3000/database/replenish-database' \
--header 'Authorization: Bearer <token>' \
--form 'file=@"/path/to/database_backup_20260206_143022.zip"'
```

### Sample Response

Success (200):

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

### Error Responses

#### Invalid backup file (400)

```json
{
  "error": {
    "code": "INVALID_BACKUP_FILE",
    "message": "No CSV files found in backup",
    "status": 400
  }
}
```

#### Restore failed (500)

```json
{
  "error": {
    "code": "RESTORE_FAILED",
    "message": "Failed to restore database",
    "status": 500
  }
}
```
