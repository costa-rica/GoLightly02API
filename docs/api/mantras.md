# Mantras Router

This router handles mantra creation, retrieval, streaming, favoriting, and deletion operations.

Most endpoints require authentication via JWT access token in the Authorization header. The streaming and all-mantras endpoints support optional authentication.

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

## GET /mantras/:id/stream

Streams a mantra MP3 file with automatic listen tracking.

- Authentication: Optional (private mantras require authentication and ownership verification)
- Supports HTTP range requests for audio seeking
- Automatically tracks listens in both Mantras table and ContractUserMantraListen table (if authenticated)
- Returns audio/mpeg stream

### Parameters

URL parameters:

- `id` (number, required): The mantra ID to stream

### Authorization Logic

- **Public mantras** (visibility != "private"): Can be streamed by anyone (authenticated or anonymous)
- **Private mantras** (visibility == "private"): Require authentication and user must own the mantra via ContractUsersMantras

### Listen Tracking

When the endpoint is called:

- **If authenticated**:
  - Creates or increments `listenCount` in `ContractUserMantraListen` table for the user-mantra pair
  - Increments `listens` field in `Mantras` table by 1
- **If anonymous**:
  - Only increments `listens` field in `Mantras` table by 1

### Sample Request

Stream a public mantra (no authentication):

```bash
curl --location 'http://localhost:3000/mantras/1/stream'
```

Stream with authentication (for private mantras or to track user listens):

```bash
curl --location 'http://localhost:3000/mantras/1/stream' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

With range request (for audio seeking):

```bash
curl --location 'http://localhost:3000/mantras/1/stream' \
--header 'Range: bytes=0-1023'
```

### Sample Response

Success (200 - Full file):

- Content-Type: audio/mpeg
- Content-Length: <file size>
- Accept-Ranges: bytes
- Body: MP3 audio stream

Success (206 - Partial content with range):

- Content-Type: audio/mpeg
- Content-Range: bytes 0-1023/5242880
- Accept-Ranges: bytes
- Content-Length: 1024
- Body: MP3 audio stream (partial)

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

#### Authentication required for private mantra (401)

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication required to access private mantras",
    "status": 401
  }
}
```

#### Unauthorized access to private mantra (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "You do not have permission to access this mantra",
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

#### Audio file not found (404)

```json
{
  "error": {
    "code": "MANTRA_NOT_FOUND",
    "message": "Mantra audio file not found",
    "status": 404
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to stream mantra",
    "status": 500
  }
}
```

### Notes

- Supports HTTP range requests for audio player seeking functionality
- Listen tracking happens before streaming begins
- For authenticated users, each stream increments both the user-specific listen count and the total mantra listen count
- For anonymous users, only the total mantra listen count is incremented
- Private mantras cannot be accessed without proper authentication and ownership
- The endpoint uses optional authentication middleware, allowing both authenticated and anonymous access to public content

### Usage in NextJS

```javascript
// Simple audio player in NextJS
const AudioPlayer = ({ mantraId, authToken }) => {
  const streamUrl = `http://localhost:3000/mantras/${mantraId}/stream`;

  const headers = authToken ? {
    'Authorization': `Bearer ${authToken}`
  } : {};

  return (
    <audio controls>
      <source src={streamUrl} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
};
```

## GET /mantras/all

Retrieves a list of mantras with aggregated listen counts.

- Authentication: Optional (required only if includePrivate=true)
- Returns all public mantras by default
- Optionally includes user's private mantras when includePrivate=true (requires authentication)
- Each mantra includes a `listens` field with total listen count
- Works for both authenticated and anonymous users

### Parameters

Query parameters:

- `includePrivate` (boolean, optional): Set to "true" to include user's private mantras along with public mantras. Requires authentication.

### Sample Request

Anonymous access (public mantras only):

```bash
curl --location 'http://localhost:3000/mantras/all'
```

Authenticated access without private mantras:

```bash
curl --location 'http://localhost:3000/mantras/all' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

Authenticated access with private mantras:

```bash
curl --location 'http://localhost:3000/mantras/all?includePrivate=true' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

```json
{
  "mantrasArray": [
    {
      "id": 1,
      "title": "output_20260203_222033",
      "description": "Morning meditation session",
      "visibility": "public",
      "filename": "output_20260203_222033.mp3",
      "filePath": "/Users/nick/Documents/_project_resources/Mantrify/audio_concatenator_output/20260203/",
      "listens": 42,
      "createdAt": "2026-02-03T22:20:33.925Z",
      "updatedAt": "2026-02-03T22:28:55.436Z"
    },
    {
      "id": 2,
      "title": "output_20260204_103015",
      "description": null,
      "visibility": "private",
      "filename": "output_20260204_103015.mp3",
      "filePath": "/Users/nick/Documents/_project_resources/Mantrify/audio_concatenator_output/20260204/",
      "listens": 5,
      "createdAt": "2026-02-04T10:30:15.125Z",
      "updatedAt": "2026-02-04T10:35:22.789Z"
    }
  ]
}
```

### Error Responses

#### Authentication required for includePrivate (401)

When `includePrivate=true` is requested without authentication:

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication required to include private mantras",
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
- Anonymous users can access the endpoint and will only receive public mantras
- When `includePrivate=false` or omitted, only public mantras are returned (works for both authenticated and anonymous users)
- When `includePrivate=true`:
  - Requires authentication
  - Returns all public mantras plus the authenticated user's private mantras
  - Anonymous users will receive a 401 error
- The `listens` field is calculated by summing all listen counts from the `ContractUserMantraListen` table for each mantra
- Listen counts are shown for all users (authenticated and anonymous)
- All fields from the Mantras table are included in the response:
  - `id`: Unique identifier for the mantra
  - `title`: Name/title of the mantra
  - `description`: Optional description text (can be null)
  - `visibility`: "public" or "private"
  - `filename`: Name of the MP3 file
  - `filePath`: Full directory path to the mantra file
  - `listens`: Total listen count (calculated)
  - `createdAt`: Timestamp when mantra was created
  - `updatedAt`: Timestamp when mantra was last updated
- Uses optional authentication middleware, allowing both authenticated and anonymous access

## POST /mantras/favorite/:mantraId/:trueOrFalse

Marks a mantra as favorited or unfavorited for the authenticated user.

- Authentication: Required
- Creates or updates the ContractUserMantraListen record for the user-mantra pair
- If the user has never listened to the mantra, creates a new record with listenCount=0
- If a record exists, updates only the favorite field

### Parameters

URL parameters:

- `mantraId` (number, required): The ID of the mantra to favorite/unfavorite
- `trueOrFalse` (string, required): Must be "true" to favorite or "false" to unfavorite

### Sample Request

Favorite a mantra:

```bash
curl --location --request POST 'http://localhost:3000/mantras/favorite/5/true' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

Unfavorite a mantra:

```bash
curl --location --request POST 'http://localhost:3000/mantras/favorite/5/false' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Success (200):

```json
{
  "message": "Mantra favorited successfully",
  "mantraId": 5,
  "favorite": true
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

#### Invalid trueOrFalse parameter (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "trueOrFalse parameter must be 'true' or 'false'",
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
    "message": "Failed to update favorite status",
    "status": 500
  }
}
```

### Notes

- If the user has never listened to the mantra, a new ContractUserMantraListen record is created with `listenCount=0` and `favorite` set to the requested value
- If a record already exists, only the `favorite` field is updated
- The user does not need to own the mantra to favorite it
- Favoriting works for both public and private mantras (as long as they exist in the database)
- This endpoint does not verify ownership, allowing users to favorite any mantra

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
