# GoLightly Project

## Project Overview

This project is a web application that allows users to create and manage their own meditation meditations. The application is built using TypeScript, Express.js and will support a NextJS front end in the future.

## Build process

This requirements document will be the basis for the engineers "To Do" list to build out the application. Store the "To Do" list in the docs/REQUIREMENTS_TODO.md file. When building the application, use the todo list to build out the application each task should have a `[ ]` and once it is complete change it to `[x]`. Group tasks into phases and as each phase is completed then commit the changes to git.

## Codebase

We want the codebase to be modular and easy to maintain. Store the code in the src directory. Types can be stored in the src/types directory. But all other modules or helper functions should be stored in the src/modules directory. Make as many as needed to keep the code modularized so that if we need to replace a module or change a process it can be done by chaning a file and limit the effect on other parts of the codebase.

The router file for this first version will be meditations.ts (subdomain: meditations) and it will be located in the src/routes directory.

## Authentication

Use JWT for authentication. There is a .env variable called JWT_SECRET that will be used to sign the JWT.

## Database

The database is a sqlite / Sequlize database that uses the GoLightly02Db custom package to connect to it. Find the schema and how to use it in docs/DATABASE_OVERVIEW.md.

## Logging

Use the guidance in the docs/LOGGING_NODE_JS_V06.md file to implement logging.

## Error Responses

Use the guidance in the docs/ERROR_REQUIREMENTS.md file to implement error responses.

## README.md

Create a README.md file that follows the guidance in the docs/README-format.md file. It is important to not over use bold text. Never use it in section headings or the beginning of a listed item.

## Users Router

### POST /users/register

Users who register will recieve email verification. Unless the user goes to their email and clicks the verification link, they will not be able to log in.

This endpoint will recieve a json object with the following properties:

- email
- password

The password will be hashed using bcrypt.

### GET /users/verify

This endpoint will recieve a token as a query parameter. The token will be used to verify the user's email.

This will update the database users table with the isEmailVerified=true and emailVerifiedAt=Date.now().

### POST /users/login

User's will login with email and password. But if the user's isEmailVerified=false, they will not be able to log in.

## Meditations Router

All endpoints require authentication.

### GET /meditations/sound_files

This endpoint will return a list of sound files in the SoundFiles table. See database schema for more information.

### POST /meditations/create

This endpoint will recieve a json with a meditationArray property. Each element in the meditationArray will be one of three types:

- pause
- text
- sound_file

```json
{
  "meditationArray": [
    {
      "id": 1,
      "pause_duration": "3.0"
    },
    {
      "id": 2,
      "text": "This is my meditation",
      "voice_id": "Xb7hH8MSUJpSbSDYk0k2",
      "speed": "0.9"
    },
    {
      "id": 3,
      "sound_file": "filename.mp3"
    }
  ]
}
```

This endpoint will then send a request to the GoLightly02Queuer's POST /meditations/new endpoint with the meditationArray property. The queuer will be running locally with the base url found in the .env file's URL_MANTRIFY01QUERER variable.

### DELETE /meditations/:id

This endpoint will find the meditation in the meditations table and delete a meditation .mp3 file from the PATH_MP3_OUTPUT and after that delete the meditation from the database.
