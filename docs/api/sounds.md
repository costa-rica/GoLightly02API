# Sounds Router

This router handles sound file management including retrieval and upload of .mp3 files.

Authentication is required for upload and delete endpoints, but the sound_files endpoint is public.

## GET /sounds/sound_files

Retrieves a list of all available sound files that can be used in mantra creation.

- Authentication: Not Required (public endpoint)
- Returns all sound files with their metadata

### Parameters

None

### Sample Request

```bash
curl --location 'http://localhost:3000/sounds/sound_files'
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

## POST /sounds/upload

Uploads a new .mp3 sound file to the server and registers it in the database.

- Authentication: Required
- Content-Type: multipart/form-data
- File size limit: 50MB
- Validates file extension and sanitizes filename for security
- Prevents duplicate filenames in both database and filesystem

### Parameters

Form data:

- `file` (file, required): The .mp3 audio file to upload
- `name` (string, optional): Display name for the sound file (defaults to filename without extension)
- `description` (string, optional): Description of the sound file

### Sample Request

```bash
curl --location 'http://localhost:3000/sounds/upload' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
--form 'file=@"/path/to/ocean_waves.mp3"' \
--form 'name="Ocean Waves"' \
--form 'description="Gentle ocean waves for relaxation"'
```

### Sample Response

Success (201):

```json
{
  "message": "Sound file uploaded successfully",
  "soundFile": {
    "id": 3,
    "name": "Ocean Waves",
    "description": "Gentle ocean waves for relaxation",
    "filename": "ocean_waves.mp3"
  }
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

#### No file uploaded (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "No file uploaded",
    "status": 400
  }
}
```

#### Invalid file type (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Only .mp3 files are allowed",
    "status": 400
  }
}
```

#### Duplicate filename in database (409)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A sound file with the name \"ocean_waves.mp3\" already exists",
    "status": 409
  }
}
```

#### Duplicate filename on server (409)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A file with the name \"ocean_waves.mp3\" already exists on the server",
    "status": 409
  }
}
```

#### File too large (413)

Multer will automatically reject files larger than 50MB.

#### Internal server error (500)

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Failed to upload sound file",
    "status": 500
  }
}
```

### Notes

- Filenames are automatically sanitized to remove unsafe characters
- If database insert fails after file upload, the uploaded file is automatically cleaned up
- The uploaded file is saved to the path specified by the `PATH_MP3_SOUND_FILES` environment variable
- Filenames must be unique; attempting to upload a file with an existing name will fail
