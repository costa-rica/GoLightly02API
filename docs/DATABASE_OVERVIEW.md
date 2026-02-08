# Database Overview

This document provides an overview of the database schema for the Meditation Meditation Creator Project.

Sequelize will handle the createdAt and updatedAt columns with timestamps: true.

## Using this package

### Installation

In your GoLightly01API or GoLightly01Queuer project, import the database package:

```javascript
import {
  initModels,
  sequelize,
  User,
  Meditation,
  Queue,
  SoundFiles,
  ElevenLabsFiles,
  ContractMeditationsElevenLabsFiles,
  ContractMeditationsSoundFiles,
} from "golightly02db";
```

### Environment Variables

Set the following environment variables to configure the database location:

- `PATH_DATABASE`: Directory path where the SQLite database file will be stored (default: current directory)
- `NAME_DB`: Database filename (default: "database.sqlite")

Example:

```bash
PATH_DATABASE=/path/to/your/data
NAME_DB=golightly.sqlite
```

### Initialize the Database

Before using any models, you must initialize them and sync the database:

```javascript
// Initialize all models and their associations
initModels();

// Create tables if they don't exist (use { force: true } to drop and recreate)
await sequelize.sync();
```

For development, you can use `sequelize.sync({ force: true })` to drop and recreate all tables. **Warning: This will delete all data!**

### Creating Records

```javascript
// Create a new user
const user = await User.create({
  email: "user@example.com",
  password: "hashedPasswordHere",
  isEmailVerified: false,
  isAdmin: false,
});

// Create a new meditation
const meditation = await Meditation.create({
  title: "Morning Meditation",
  description: "A peaceful morning meditation meditation",
  visibility: "public",
  filename: "morning-meditation.mp3",
  filePath: "/audio/meditations/morning-meditation.mp3",
});

// Create a sound file
const soundFile = await SoundFiles.create({
  name: "Ocean Waves",
  description: "Calming ocean wave sounds",
  filename: "ocean-waves.mp3",
});
```

### Reading Records

```javascript
// Find a user by email
const user = await User.findOne({
  where: { email: "user@example.com" },
});

// Find all meditations with public visibility
const publicMeditations = await Meditation.findAll({
  where: { visibility: "public" },
});

// Find by primary key
const meditation = await Meditation.findByPk(1);

// Count records
const userCount = await User.count();
```

### Updating Records

```javascript
// Update a specific user
await User.update(
  { isEmailVerified: true, emailVerifiedAt: new Date() },
  { where: { id: userId } },
);

// Update using an instance
const user = await User.findByPk(userId);
user.isAdmin = true;
await user.save();
```

### Deleting Records

```javascript
// Delete by condition
await Meditation.destroy({
  where: { visibility: "public", userId: userId },
});

// Delete using an instance
const user = await User.findByPk(userId);
await user.destroy();
```

### Working with Relationships

```javascript
// Associate a user with a meditation
const contract = await ContractUsersMeditations.create({
  userId: user.id,
  meditationId: meditation.id,
});

// Associate a meditation with an ElevenLabs file
const meditationFileContract = await ContractMeditationsElevenLabsFiles.create({
  meditationId: meditation.id,
  elevenLabsFilesId: elevenLabsFile.id,
});

// Associate a meditation with a sound file
const meditationSoundContract = await ContractMeditationsSoundFiles.create({
  meditationId: meditation.id,
  soundFilesId: soundFile.id,
});

// Track a listen event
const listen = await ContractUserMeditationsListen.create({
  userId: user.id,
  meditationId: meditation.id,
  listenCount: 1,
});

// Add to queue
const queueItem = await Queue.create({
  userId: user.id,
  status: "queued",
  jobFilename: "job_12345.csv",
});

// Find user with their meditations (using associations)
const userWithMeditations = await User.findByPk(userId, {
  include: [{ association: "meditations" }],
});

// Find meditation with associated ElevenLabs files
const meditationWithFiles = await Meditation.findByPk(meditationId, {
  include: [{ association: "elevenLabsFiles" }],
});

// Find meditation with associated sound files
const meditationWithSounds = await Meditation.findByPk(meditationId, {
  include: [{ association: "soundFiles" }],
});

// Find meditation with user listen records
const meditationWithListens = await Meditation.findByPk(meditationId, {
  include: [{ association: "contractUserMeditationListenCount" }],
});

// Find sound file with associated meditations
const soundFileWithMeditations = await SoundFiles.findByPk(soundFileId, {
  include: [{ association: "meditations" }],
});
```

### Transactions

For operations that need to be atomic:

```javascript
const t = await sequelize.transaction();

try {
  const user = await User.create(
    {
      email: "newuser@example.com",
      password: "hashedPassword",
    },
    { transaction: t },
  );

  const meditation = await Meditation.create(
    {
      title: "User's First Meditation",
      visibility: "public",
    },
    { transaction: t },
  );

  await ContractUsersMeditations.create(
    {
      userId: user.id,
      meditationId: meditation.id,
    },
    { transaction: t },
  );

  await t.commit();
} catch (error) {
  await t.rollback();
  throw error;
}
```

## Tables

### Table: `Users`

#### Columns

| Column          | Type            | Null | Notes                          |
| --------------- | --------------- | ---- | ------------------------------ |
| id              | id              | NO   | PK                             |
| email           | email           | NO   | unique, normalized (lowercase) |
| password        | password        | NO   | store bcrypt hash              |
| isEmailVerified | isEmailVerified | NO   | default `false`                |
| emailVerifiedAt | emailVerifiedAt | YES  | set upon verification          |
| isAdmin         | isAdmin         | NO   | default `false`                |

#### Relationships

- belongsToMany Meditation through ContractUsersMeditations (as "meditations")
- hasMany ContractUsersMeditations (as "userMeditations")
- hasMany ContractUserMeditationsListen (as "meditationListens")
- hasMany Queue (as "queueItems")

### Table: `Meditations`

#### Columns

| Column      | Type        | Null | Notes                                                                  |
| ----------- | ----------- | ---- | ---------------------------------------------------------------------- |
| id          | id          | NO   | PK                                                                     |
| title       | title       | NO   | name shown in UI                                                       |
| description | description | YES  | public listing summary                                                 |
| visibility  | visibility  | NO   | default `'public'`                                                     |
| filename    | filename    | YES  | filename of the audio file                                             |
| filePath    | filePath    | YES  | path to the audio file                                                 |
| listenCount | integer     | NO   | default `0`, tracks non-registered user listens for public meditations |

#### Relationships

- belongsToMany User through ContractUsersMeditations (as "users")
- hasMany ContractUsersMeditations (as "contractUsersMeditations")
- hasMany ContractUserMeditationsListen (as "contractUserMeditationListenCount")
- belongsToMany ElevenLabsFiles through ContractMeditationsElevenLabsFiles (as "elevenLabsFiles")
- belongsToMany SoundFiles through ContractMeditationsSoundFiles (as "soundFiles")

### Table: `ContractUsersMeditations`

#### Columns

| Column       | Type         | Null | Notes               |
| ------------ | ------------ | ---- | ------------------- |
| id           | id           | NO   | PK                  |
| userId       | userId       | NO   | FK → users.id       |
| meditationId | meditationId | NO   | FK → meditations.id |

#### Relationships

- belongsTo User (as "user")
- belongsTo Meditation (as "meditation")

### Table: `ElevenLabsFiles`

#### Columns

| Column   | Type     | Null | Notes                      |
| -------- | -------- | ---- | -------------------------- |
| id       | id       | NO   | PK                         |
| filename | filename | YES  | filename of the audio file |
| filePath | filePath | YES  | path to the audio file     |
| text     | string   | YES  | text content               |

#### Relationships

- belongsToMany Meditation through ContractMeditationsElevenLabsFiles (as "meditations")

### Table: `ContractMeditationsElevenLabsFiles`

#### Columns

| Column            | Type              | Null | Notes                    |
| ----------------- | ----------------- | ---- | ------------------------ |
| id                | id                | NO   | PK                       |
| meditationId      | meditationId      | NO   | FK → meditations.id      |
| elevenLabsFilesId | elevenLabsFilesId | NO   | FK → elevenlabs_files.id |

#### Relationships

- belongsTo Meditation (as "meditation")
- belongsTo ElevenLabsFiles (as "elevenLabsFile")

### Table: `ContractUserMeditationsListens`

#### Columns

| Column       | Type         | Null | Notes                           |
| ------------ | ------------ | ---- | ------------------------------- |
| id           | id           | NO   | PK                              |
| userId       | userId       | NO   | FK → users.id                   |
| meditationId | meditationId | NO   | FK → meditations.id             |
| listenCount  | listenCount  | NO   | set upon listen                 |
| favorite     | boolean      | NO   | default `false`, user favorited |

#### Relationships

- belongsTo User (as "user")
- belongsTo Meditation (as "meditation")

### Table: `Queue`

#### Columns

| Column      | Type   | Null | Notes                                                                     |
| ----------- | ------ | ---- | ------------------------------------------------------------------------- |
| id          | id     | NO   | PK                                                                        |
| userId      | userId | NO   | FK → users.id                                                             |
| status      | string | NO   | "queued", "started", "elevenlabs", "concatenator" or "done"               |
| jobFilename | string | NO   | csv filename of the job file stored in PATH_QUEUER/user_request_csv_files |

#### Relationships

- belongsTo User (as "user")

### Table: `SoundFiles`

#### Columns

| Column      | Type   | Null | Notes                      |
| ----------- | ------ | ---- | -------------------------- |
| id          | id     | NO   | PK                         |
| name        | string | NO   |                            |
| description | string | YES  |                            |
| filename    | string | NO   | filename of the sound file |

#### Relationships

- belongsToMany Meditation through ContractMeditationsSoundFiles (as "meditations")

### Table: `ContractMeditationsSoundFiles`

#### Columns

| Column       | Type         | Null | Notes               |
| ------------ | ------------ | ---- | ------------------- |
| id           | id           | NO   | PK                  |
| meditationId | meditationId | NO   | FK → meditations.id |
| soundFilesId | soundFilesId | NO   | FK → sound_files.id |

#### Relationships

- belongsTo Meditation (as "meditation")
- belongsTo SoundFiles (as "soundFile")
