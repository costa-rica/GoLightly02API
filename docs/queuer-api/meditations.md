# Meditations

## POST /meditations/new

Creates a new meditation by orchestrating text-to-speech generation and audio concatenation. Accepts either a CSV filename or a meditation array defining the audio elements to create.

Authentication is not required.

### Parameters

Request body (JSON):

- userId (required): Positive integer identifying the user creating the meditation
- filenameCsv (optional): String filename of CSV file in PATH_QUEUER/user_request_csv_files directory
- meditationArray (optional): Array of meditation element objects (see structure below)
- title (optional): String title for the meditation (overrides auto-generated title from filename)
- description (optional): String description for the meditation

Note: Either filenameCsv or meditationArray must be provided, but not both.

#### Meditation Array Element Structure

Each element in meditationArray must contain:

- id (required): Unique identifier for the element (string or number)
- One of the following (mutually exclusive with sound_file):
  - text (optional): Text to convert to speech via ElevenLabs
  - voice_id (optional): ElevenLabs voice ID (string, used with text)
  - speed (optional): Speech speed (number, used with text)
  - pause_duration (optional): Duration of silence in seconds (number)
- sound_file (optional): Filename of pre-existing MP3 in PATH_MP3_SOUND_FILES directory (cannot be used with text, voice_id, speed, or pause_duration)

### Sample Request (with meditationArray)

```bash
curl --location 'http://localhost:3000/meditations/new' \
--header 'Content-Type: application/json' \
--data-raw '{
  "userId": 1,
  "title": "Morning Relaxation",
  "description": "A calming meditation to start your day",
  "meditationArray": [
    {
      "id": 1,
      "text": "Welcome to your meditation session",
      "voice_id": "nPczCjzI2devNBz1zQrb",
      "speed": 0.85
    },
    {
      "id": 2,
      "pause_duration": 3
    },
    {
      "id": 3,
      "sound_file": "ocean-waves.mp3"
    },
    {
      "id": 4,
      "text": "Take a deep breath and relax"
    }
  ]
}'
```

### Sample Request (with filenameCsv)

```bash
curl --location 'http://localhost:3000/meditations/new' \
--header 'Content-Type: application/json' \
--data-raw '{
  "userId": 1,
  "filenameCsv": "meditation_20260203.csv",
  "title": "Evening Wind Down",
  "description": "A peaceful meditation for bedtime"
}'
```

### Sample Response

```json
{
  "success": true,
  "queueId": 42,
  "finalFilePath": "/path/to/output/20260203/output_20260203_153045.mp3",
  "message": "Meditation created successfully"
}
```

### Error Responses

#### Missing userId (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "userId is required",
    "status": 400
  }
}
```

#### Invalid userId (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "userId must be a positive number",
    "status": 400
  }
}
```

#### Missing both filenameCsv and meditationArray (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Either filenameCsv or meditationArray must be provided",
    "status": 400
  }
}
```

#### Providing both filenameCsv and meditationArray (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Cannot provide both filenameCsv and meditationArray",
    "status": 400
  }
}
```

#### Empty meditationArray (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "meditationArray cannot be empty",
    "status": 400
  }
}
```

#### Invalid meditationArray element (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "meditationArray validation failed",
    "status": 400,
    "details": [
      {
        "index": 0,
        "message": "Element is missing required field: id"
      },
      {
        "index": 2,
        "message": "sound_file cannot be used with text, voice_id, speed, or pause_duration in the same element"
      }
    ]
  }
}
```

#### CSV file not found (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "CSV file not found: meditation_20260203.csv",
    "status": 400
  }
}
```

#### Workflow failure (500)

```json
{
  "success": false,
  "queueId": 42,
  "error": {
    "code": "WORKFLOW_FAILED",
    "message": "ElevenLabs process failed with exit code: 1",
    "status": 500
  }
}
```

### Processing Pipeline

The endpoint triggers a multi-stage asynchronous workflow:

1. Request validation and input parsing
2. Queue record creation with status "queued"
3. Status update to "started"
4. ElevenLabs text-to-speech generation (status: "elevenlabs")
5. ElevenLabsFiles database records creation
6. AudioConcatenator file merging (status: "concatenator")
7. Meditation database record creation (saves title and description if provided; otherwise auto-generates title from filename)
8. ContractUsersMeditations and ContractMeditationsElevenLabsFiles linking
9. Queue status update to "done"

The queueId returned in the response can be used to track the job status in the Queue table.
