# Database Overview

This document provides an overview of the database schema for the Meditation Mantra Creator Project.

Sequelize will handle the createdAt and updatedAt columns with timestamps: true.

## Using this package

### Installation

In your Mantrify01API or Mantrify01Queuer project, import the database package:

```javascript
import {
  initModels,
  sequelize,
  User,
  Mantra,
  Queue,
  SoundFiles,
  ElevenLabsFiles,
  ContractMantrasElevenLabsFiles,
  ContractMantrasSoundFiles,
} from "mantrify01db";
```

### Environment Variables

Set the following environment variables to configure the database location:

- `PATH_DATABASE`: Directory path where the SQLite database file will be stored (default: current directory)
- `NAME_DB`: Database filename (default: "database.sqlite")

Example:

```bash
PATH_DATABASE=/path/to/your/data
NAME_DB=mantrify.sqlite
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

// Create a new mantra
const mantra = await Mantra.create({
  title: "Morning Meditation",
  description: "A peaceful morning meditation mantra",
  visibility: "private",
  filename: "morning-meditation.mp3",
  filePath: "/audio/mantras/morning-meditation.mp3",
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

// Find all mantras with public visibility
const publicMantras = await Mantra.findAll({
  where: { visibility: "public" },
});

// Find by primary key
const mantra = await Mantra.findByPk(1);

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
await Mantra.destroy({
  where: { visibility: "private", userId: userId },
});

// Delete using an instance
const user = await User.findByPk(userId);
await user.destroy();
```

### Working with Relationships

```javascript
// Associate a user with a mantra
const contract = await ContractUsersMantras.create({
  userId: user.id,
  mantraId: mantra.id,
});

// Associate a mantra with an ElevenLabs file
const mantraFileContract = await ContractMantrasElevenLabsFiles.create({
  mantraId: mantra.id,
  elevenLabsFilesId: elevenLabsFile.id,
});

// Associate a mantra with a sound file
const mantraSoundContract = await ContractMantrasSoundFiles.create({
  mantraId: mantra.id,
  soundFilesId: soundFile.id,
});

// Track a listen event
const listen = await ContractUserMantraListen.create({
  userId: user.id,
  mantraId: mantra.id,
  listenCount: 1,
});

// Add to queue
const queueItem = await Queue.create({
  userId: user.id,
  status: "queued",
  jobFilename: "job_12345.csv",
});

// Find user with their mantras (using associations)
const userWithMantras = await User.findByPk(userId, {
  include: [{ association: "mantras" }],
});

// Find mantra with associated ElevenLabs files
const mantraWithFiles = await Mantra.findByPk(mantraId, {
  include: [{ association: "elevenLabsFiles" }],
});

// Find mantra with associated sound files
const mantraWithSounds = await Mantra.findByPk(mantraId, {
  include: [{ association: "soundFiles" }],
});

// Find mantra with user listen records
const mantraWithListens = await Mantra.findByPk(mantraId, {
  include: [{ association: "contractUserMantraListenCount" }],
});

// Find sound file with associated mantras
const soundFileWithMantras = await SoundFiles.findByPk(soundFileId, {
  include: [{ association: "mantras" }],
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

  const mantra = await Mantra.create(
    {
      title: "User's First Mantra",
      visibility: "private",
    },
    { transaction: t },
  );

  await ContractUsersMantras.create(
    {
      userId: user.id,
      mantraId: mantra.id,
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

- belongsToMany Mantra through ContractUsersMantras (as "mantras")
- hasMany ContractUsersMantras (as "userMantras")
- hasMany ContractUserMantraListen (as "mantraListens")
- hasMany Queue (as "queueItems")

### Table: `Mantras`

#### Columns

| Column      | Type        | Null | Notes                                                              |
| ----------- | ----------- | ---- | ------------------------------------------------------------------ |
| id          | id          | NO   | PK                                                                 |
| title       | title       | NO   | name shown in UI                                                   |
| description | description | YES  | public listing summary                                             |
| visibility  | visibility  | NO   | default `'private'`                                                |
| filename    | filename    | YES  | filename of the audio file                                         |
| filePath    | filePath    | YES  | path to the audio file                                             |
| listenCount | integer     | NO   | default `0`, tracks non-registered user listens for public mantras |

#### Relationships

- belongsToMany User through ContractUsersMantras (as "users")
- hasMany ContractUsersMantras (as "contractUsersMantras")
- hasMany ContractUserMantraListen (as "contractUserMantraListenCount")
- belongsToMany ElevenLabsFiles through ContractMantrasElevenLabsFiles (as "elevenLabsFiles")
- belongsToMany SoundFiles through ContractMantrasSoundFiles (as "soundFiles")

### Table: `ContractUsersMantras`

#### Columns

| Column   | Type     | Null | Notes           |
| -------- | -------- | ---- | --------------- |
| id       | id       | NO   | PK              |
| userId   | userId   | NO   | FK → users.id   |
| mantraId | mantraId | NO   | FK → mantras.id |

#### Relationships

- belongsTo User (as "user")
- belongsTo Mantra (as "mantra")

### Table: `ElevenLabsFiles`

#### Columns

| Column   | Type     | Null | Notes                      |
| -------- | -------- | ---- | -------------------------- |
| id       | id       | NO   | PK                         |
| filename | filename | YES  | filename of the audio file |
| filePath | filePath | YES  | path to the audio file     |
| text     | string   | YES  | text content               |

#### Relationships

- belongsToMany Mantra through ContractMantrasElevenLabsFiles (as "mantras")

### Table: `ContractMantrasElevenLabsFiles`

#### Columns

| Column            | Type              | Null | Notes                    |
| ----------------- | ----------------- | ---- | ------------------------ |
| id                | id                | NO   | PK                       |
| mantraId          | mantraId          | NO   | FK → mantras.id          |
| elevenLabsFilesId | elevenLabsFilesId | NO   | FK → elevenlabs_files.id |

#### Relationships

- belongsTo Mantra (as "mantra")
- belongsTo ElevenLabsFiles (as "elevenLabsFile")

### Table: `ContractUserMantraListens`

#### Columns

| Column      | Type        | Null | Notes                           |
| ----------- | ----------- | ---- | ------------------------------- |
| id          | id          | NO   | PK                              |
| userId      | userId      | NO   | FK → users.id                   |
| mantraId    | mantraId    | NO   | FK → mantras.id                 |
| listenCount | listenCount | NO   | set upon listen                 |
| favorite    | boolean     | NO   | default `false`, user favorited |

#### Relationships

- belongsTo User (as "user")
- belongsTo Mantra (as "mantra")

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

- belongsToMany Mantra through ContractMantrasSoundFiles (as "mantras")

### Table: `ContractMantrasSoundFiles`

#### Columns

| Column       | Type         | Null | Notes               |
| ------------ | ------------ | ---- | ------------------- |
| id           | id           | NO   | PK                  |
| mantraId     | mantraId     | NO   | FK → mantras.id     |
| soundFilesId | soundFilesId | NO   | FK → sound_files.id |

#### Relationships

- belongsTo Mantra (as "mantra")
- belongsTo SoundFiles (as "soundFile")
