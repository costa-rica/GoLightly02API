# Mantras Router

This router handles mantra creation, retrieval, and deletion operations.

All endpoints require authentication via JWT access token in the Authorization header.

## POST /mantras/create

Creates a new meditation mantra by combining pauses, text-to-speech, and sound files.

- Authentication: Required
- Processes mantra through Mantrify01Queuer service
- Returns queue ID and final file path
- Mantra array supports three element types: pause, text, and sound_file

### Parameters

Request body:

- `mantraArray` (array, required): Array of mantra elements in sequence

Each element must have an `id` and one of the following:

- `pause_duration` (string): Duration in seconds (e.g., "3.0")
- `text` (string): Text to convert to speech with optional `voice_id` and `speed`
- `sound_file` (string): Filename of a sound file from the sound_files list

### Sample Request

```bash
curl --location 'http://localhost:3000/mantras/create' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data '{
  "mantraArray": [
    {
      "id": 1,
      "pause_duration": "3.0"
    },
    {
      "id": 2,
      "text": "Hello world",
      "voice_id": "nPczCjzI2devNBz1zQrb",
      "speed": "0.85"
    },
    {
      "id": 3,
      "sound_file": "FOLYMisc-A_calm_meditative_-Elevenlabs.mp3"
    }
  ]
}'
```

### Sample Response

```json
{
  "message": "Mantra created successfully",
  "queueId": 1,
  "filePath": "/Users/nick/Documents/_project_resources/Mantrify/audio_concatenator_output/20260203/output_20260203_113759.mp3"
}
```

### Error Responses

#### Missing or invalid mantraArray (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "mantraArray is required and must be an array",
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

#### Queuer service error (500)

```json
{
  "error": {
    "code": "QUEUER_ERROR",
    "message": "Failed to communicate with queuer service",
    "status": 500
  }
}
```

### Mantra element types

Pause element:

- `id` (number): Unique identifier for the element
- `pause_duration` (string): Duration in seconds (e.g., "3.0", "5.5")

Text element:

- `id` (number): Unique identifier for the element
- `text` (string): Text to convert to speech
- `voice_id` (string, optional): ElevenLabs voice ID (defaults to system default)
- `speed` (string, optional): Speech speed multiplier (e.g., "0.85", "1.0")

Sound file element:

- `id` (number): Unique identifier for the element
- `sound_file` (string): Filename from the sound_files endpoint

## GET /mantras/all

Retrieves a list of mantras with aggregated listen counts.

- Authentication: Required
- Returns all public mantras by default
- Optionally includes user's private mantras when includePrivate=true
- Each mantra includes a `listens` field with total listen count

### Parameters

Query parameters:

- `includePrivate` (boolean, optional): Set to "true" to include user's private mantras along with public mantras

### Sample Request

Without private mantras:

```bash
curl --location 'http://localhost:3000/mantras/all' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

With private mantras:

```bash
curl --location 'http://localhost:3000/mantras/all?includePrivate=true' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

```json
{
  "mantras": [
    {
      "id": 1,
      "mantraArray": [
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
      "visibility": "public",
      "createdAt": "2026-02-03T11:37:59.000Z",
      "updatedAt": "2026-02-03T11:37:59.000Z",
      "listens": 42
    },
    {
      "id": 2,
      "mantraArray": [...],
      "filename": "output_20260203_120000.mp3",
      "visibility": "private",
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

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to retrieve mantras",
    "status": 500
  }
}
```

### Notes

- Public mantras are those where `visibility` is not "private"
- When `includePrivate=false` or omitted, only public mantras are returned
- When `includePrivate=true`, all public mantras plus the authenticated user's private mantras are returned
- The `listens` field is calculated by summing all listen counts from the `ContractUserMantraListen` table for each mantra
- All fields from the Mantras table are included in the response

## DELETE /mantras/:id

Deletes a mantra and its associated MP3 file.

- Authentication: Required
- User must own the mantra (verified via ContractUsersMantras)
- Deletes both the database record and the physical file

### Parameters

URL parameters:

- `id` (number, required): The mantra ID to delete

### Sample Request

```bash
curl --location --request DELETE 'http://localhost:3000/mantras/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

```json
{
  "message": "Mantra deleted successfully",
  "mantraId": 5
}
```

### Error Responses

#### Invalid mantra ID (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid mantra ID",
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

#### Unauthorized access (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "You do not have permission to delete this mantra",
    "status": 403
  }
}
```

#### Mantra not found (404)

```json
{
  "error": {
    "code": "MANTRA_NOT_FOUND",
    "message": "Mantra not found",
    "status": 404
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to delete mantra",
    "status": 500
  }
}
```
