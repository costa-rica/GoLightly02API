# Meditations Router

This router handles meditation creation, retrieval, streaming, favoriting, and deletion operations.

Most endpoints require authentication via JWT access token in the Authorization header. The streaming and all-meditations endpoints support optional authentication.

## POST /meditations/create

Creates a new meditation meditation by combining pauses, text-to-speech, and sound files.

- Authentication: Required
- Processes meditation through GoLightly02Queuer service
- Returns queue ID and final file path
- Meditation array supports three element types: pause, text, and sound_file

### Parameters

Request body:

- `meditationArray` (array, required): Array of meditation elements in sequence

Each element must have an `id` and one of the following:

- `pause_duration` (string): Duration in seconds (e.g., "3.0")
- `text` (string): Text to convert to speech with optional `voice_id` and `speed`
- `sound_file` (string): Filename of a sound file from the sound_files list

### Sample Request

```bash
curl --location 'http://localhost:3000/meditations/create' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data '{
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
  "message": "Meditation created successfully",
  "queueId": 1,
  "filePath": "/Users/nick/Documents/_project_resources/GoLightly/audio_concatenator_output/20260203/output_20260203_113759.mp3"
}
```

### Error Responses

#### Missing or invalid meditationArray (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "meditationArray is required and must be an array",
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

### Meditation element types

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

## GET /meditations/:id/stream

Streams a meditation MP3 file with automatic listen tracking.

- Authentication: Optional (private meditations require authentication and ownership verification)
- Supports HTTP range requests for audio seeking
- Automatically tracks listens in both Meditations table and ContractUserMeditationsListen table (if authenticated)
- Returns audio/mpeg stream

### Parameters

URL parameters:

- `id` (number, required): The meditation ID to stream

### Authorization Logic

- **Public meditations** (visibility != "private"): Can be streamed by anyone (authenticated or anonymous)
- **Private meditations** (visibility == "private"): Require authentication and user must own the meditation via ContractUsersMeditations

### Listen Tracking

When the endpoint is called:

- **If authenticated**:
  - Creates or increments `listenCount` in `ContractUserMeditationsListen` table for the user-meditation pair
  - Increments `listenCount` field in `Meditations` table by 1
- **If anonymous**:
  - Only increments `listenCount` field in `Meditations` table by 1

### Sample Request

Stream a public meditation (no authentication):

```bash
curl --location 'http://localhost:3000/meditations/1/stream'
```

Stream with authentication (for private meditations or to track user listens):

```bash
curl --location 'http://localhost:3000/meditations/1/stream' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

With range request (for audio seeking):

```bash
curl --location 'http://localhost:3000/meditations/1/stream' \
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

#### Authentication required for private meditation (401)

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Authentication required to access private meditations",
    "status": 401
  }
}
```

#### Unauthorized access to private meditation (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "You do not have permission to access this meditation",
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

#### Audio file not found (404)

```json
{
  "error": {
    "code": "MANTRA_NOT_FOUND",
    "message": "Meditation audio file not found",
    "status": 404
  }
}
```

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to stream meditation",
    "status": 500
  }
}
```

### Notes

- Supports HTTP range requests for audio player seeking functionality
- Listen tracking happens before streaming begins
- For authenticated users, each stream increments both the user-specific listen count and the total meditation listen count
- For anonymous users, only the total meditation listen count is incremented
- Private meditations cannot be accessed without proper authentication and ownership
- The endpoint uses optional authentication middleware, allowing both authenticated and anonymous access to public content

### Usage in NextJS

```javascript
// Simple audio player in NextJS
const AudioPlayer = ({ meditationId, authToken }) => {
  const streamUrl = `http://localhost:3000/meditations/${meditationId}/stream`;

  const headers = authToken
    ? {
        Authorization: `Bearer ${authToken}`,
      }
    : {};

  return (
    <audio controls>
      <source src={streamUrl} type="audio/mpeg" />
      Your browser does not support the audio element.
    </audio>
  );
};
```

## GET /meditations/all

Retrieves a list of meditations with total listen counts and favorite counts.

- Authentication: Optional
- Anonymous users receive only public meditations
- Authenticated users automatically receive public meditations plus their own private meditations
- Each meditation includes a `listenCount` field with total listen count and a `favoriteCount` field showing how many users have favorited it
- Behavior is determined by authentication state (no query parameters needed)

### Parameters

No parameters required. The response is automatically determined by authentication state.

### Sample Request

Anonymous access (public meditations only):

```bash
curl --location 'http://localhost:3000/meditations/all'
```

Authenticated access (public meditations + user's private meditations):

```bash
curl --location 'http://localhost:3000/meditations/all' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Anonymous user response (public meditations only):

```json
{
  "meditationsArray": [
    {
      "id": 1,
      "title": "output_20260203_222033",
      "description": "Morning meditation session",
      "visibility": "public",
      "filename": "output_20260203_222033.mp3",
      "filePath": "/Users/nick/Documents/_project_resources/GoLightly/audio_concatenator_output/20260203/",
      "listenCount": 42,
      "favoriteCount": 8,
      "ownerUserId": 5,
      "createdAt": "2026-02-03T22:20:33.925Z",
      "updatedAt": "2026-02-03T22:28:55.436Z"
    }
  ]
}
```

Authenticated user response (public meditations + user's private meditations):

```json
{
  "meditationsArray": [
    {
      "id": 1,
      "title": "output_20260203_222033",
      "description": "Morning meditation session",
      "visibility": "public",
      "filename": "output_20260203_222033.mp3",
      "filePath": "/Users/nick/Documents/_project_resources/GoLightly/audio_concatenator_output/20260203/",
      "listenCount": 42,
      "favoriteCount": 8,
      "ownerUserId": 5,
      "createdAt": "2026-02-03T22:20:33.925Z",
      "updatedAt": "2026-02-03T22:28:55.436Z"
    },
    {
      "id": 2,
      "title": "output_20260204_103015",
      "description": null,
      "visibility": "private",
      "filename": "output_20260204_103015.mp3",
      "filePath": "/Users/nick/Documents/_project_resources/GoLightly/audio_concatenator_output/20260204/",
      "listenCount": 5,
      "favoriteCount": 2,
      "ownerUserId": 3,
      "createdAt": "2026-02-04T10:30:15.125Z",
      "updatedAt": "2026-02-04T10:35:22.789Z"
    }
  ]
}
```

### Error Responses

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

- Public meditations are those where `visibility` is not "private"
- Anonymous users can access the endpoint and will only receive public meditations
- Authenticated users automatically receive:
  - All public meditations
  - Their own private meditations (verified via ContractUsersMeditations)
- No query parameters are needed - authentication state determines the response
- The `listenCount` field is read directly from the `Meditations` table for each meditation
- The `favoriteCount` field is calculated by counting records in `ContractUserMeditationsListen` table where `favorite` is true for that meditation
- Listen counts and favorite counts are shown for all users (authenticated and anonymous)
- All fields from the Meditations table are included in the response:
  - `id`: Unique identifier for the meditation
  - `title`: Name/title of the meditation
  - `description`: Optional description text (can be null)
  - `visibility`: "public" or "private"
  - `filename`: Name of the MP3 file
  - `filePath`: Full directory path to the meditation file
  - `listenCount`: Total listen count across all users
  - `favoriteCount`: Total number of users who have favorited this meditation
  - `ownerUserId`: User ID of the meditation owner (from ContractUsersMeditations table), or "missing" if no owner exists
  - `createdAt`: Timestamp when meditation was created
  - `updatedAt`: Timestamp when meditation was last updated
- Uses optional authentication middleware, allowing both authenticated and anonymous access
- Ownership information is fetched efficiently using a Sequelize LEFT JOIN
- Favorite counts are fetched efficiently with a single grouped COUNT query

## POST /meditations/favorite/:meditationId/:trueOrFalse

Marks a meditation as favorited or unfavorited for the authenticated user.

- Authentication: Required
- Creates or updates the ContractUserMeditationsListen record for the user-meditation pair
- If the user has never listened to the meditation, creates a new record with listenCount=0
- If a record exists, updates only the favorite field

### Parameters

URL parameters:

- `meditationId` (number, required): The ID of the meditation to favorite/unfavorite
- `trueOrFalse` (string, required): Must be "true" to favorite or "false" to unfavorite

### Sample Request

Favorite a meditation:

```bash
curl --location --request POST 'http://localhost:3000/meditations/favorite/5/true' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

Unfavorite a meditation:

```bash
curl --location --request POST 'http://localhost:3000/meditations/favorite/5/false' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

Success (200):

```json
{
  "message": "Meditation favorited successfully",
  "meditationId": 5,
  "favorite": true
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
    "message": "Failed to update favorite status",
    "status": 500
  }
}
```

### Notes

- If the user has never listened to the meditation, a new ContractUserMeditationsListen record is created with `listenCount=0` and `favorite` set to the requested value
- If a record already exists, only the `favorite` field is updated
- The user does not need to own the meditation to favorite it
- Favoriting works for both public and private meditations (as long as they exist in the database)
- This endpoint does not verify ownership, allowing users to favorite any meditation

## PATCH /meditations/update/:id

Updates metadata for an existing meditation.

- Authentication: Required
- User must own the meditation (verified via ContractUsersMeditations)
- Supports partial updates (any combination of title, description, and/or visibility)
- Returns the complete updated meditation object

### Parameters

URL parameters:

- `id` (number, required): The meditation ID to update

Request body (at least one field required):

- `title` (string, optional): New title for the meditation (must be non-empty if provided)
- `description` (string, optional): New description for the meditation (can be null)
- `visibility` (string, optional): Must be exactly "public" or "private" (lowercase)

### Sample Request

Update only the title:

```bash
curl --location --request PATCH 'http://localhost:3000/meditations/update/5' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data '{
  "title": "Morning Meditation"
}'
```

Update multiple fields:

```bash
curl --location --request PATCH 'http://localhost:3000/meditations/update/5' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data '{
  "title": "Evening Relaxation",
  "description": "A calming meditation for evening wind-down",
  "visibility": "public"
}'
```

Update only visibility:

```bash
curl --location --request PATCH 'http://localhost:3000/meditations/update/5' \
--header 'Content-Type: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--data '{
  "visibility": "private"
}'
```

### Sample Response

Success (200):

```json
{
  "message": "Meditation updated successfully",
  "meditation": {
    "id": 5,
    "title": "Evening Relaxation",
    "description": "A calming meditation for evening wind-down",
    "visibility": "public",
    "filename": "output_20260203_222033.mp3",
    "filePath": "/Users/nick/Documents/_project_resources/GoLightly/audio_concatenator_output/20260203/",
    "listenCount": 42,
    "createdAt": "2026-02-03T22:20:33.925Z",
    "updatedAt": "2026-02-06T14:32:18.456Z"
  }
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

#### No fields provided (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "At least one field (title, description, or visibility) must be provided",
    "status": 400
  }
}
```

#### Invalid visibility value (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Visibility must be either 'public' or 'private'",
    "status": 400
  }
}
```

#### Invalid title (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title must be a non-empty string",
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
    "message": "You do not have permission to update this meditation",
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
    "message": "Failed to update meditation",
    "status": 500
  }
}
```

### Notes

- At least one field (title, description, or visibility) must be provided in the request body
- Fields set to `null` are ignored and will not update the database value
- Only fields that are provided and not null will be updated
- Title is trimmed of whitespace if provided
- Visibility must be exactly "public" or "private" (lowercase) - case-sensitive validation
- User must own the meditation via ContractUsersMeditations table to update it
- The endpoint returns the complete meditation object after update, including all fields
- The `updatedAt` timestamp is automatically updated by Sequelize

## DELETE /meditations/:id

Deletes a meditation and its associated MP3 file.

- Authentication: Required
- User must own the meditation (verified via ContractUsersMeditations)
- Deletes both the database record and the physical file

### Parameters

URL parameters:

- `id` (number, required): The meditation ID to delete

### Sample Request

```bash
curl --location --request DELETE 'http://localhost:3000/meditations/5' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

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

#### Unauthorized access (403)

```json
{
  "error": {
    "code": "UNAUTHORIZED_ACCESS",
    "message": "You do not have permission to delete this meditation",
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
