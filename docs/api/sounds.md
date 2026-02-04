# Sounds API

This router handles mantra creation, retrieval, and deletion operations.

All endpoints require authentication via JWT access token in the Authorization header.

## GET /sounds/sound_files

Retrieves a list of all available sound files that can be used in mantra creation.

- Authentication: Required
- Returns all sound files with their metadata

### Parameters

None

### Sample Request

```bash
curl --location 'http://localhost:3000/sounds/sound_files' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

```json
{
  "soundFiles": [
    {
      "id": 1,
      "name": "Calm Meditation",
      "description": "A calm and meditative background sound",
      "filename": "FOLYMisc-A_calm_meditative_-Elevenlabs.mp3"
    },
    {
      "id": 2,
      "name": "Ocean Waves",
      "description": "Gentle ocean waves for relaxation",
      "filename": "ocean_waves.mp3"
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
    "message": "Failed to retrieve sound files",
    "status": 500
  }
}
```
