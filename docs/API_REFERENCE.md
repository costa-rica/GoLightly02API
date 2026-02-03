# Mantrify01 API Reference

This API is an ExpressJS TypeScript API that provides a RESTful interface for interacting with the SQLite database using Sequelize ORM.

This file serves as the top-level API index.

Each resource has its own documentation under the [`/api`](./api) folder:

- [users](./api/users.md)
- [mantras](./api/mantras.md)

File names should be in lower case and follow the pattern of their router subdomain. This means routers that have two words will have a hyphen between them. If we make a router for the subdomain "contract-users-mantra" the file will be named docs/api/contract-users-mantra.md.

## Endpoint documentation format

Each file should be a router file.
Include an example of the reqeust in curl and the response in json.

Minimize the user of bold text. Never use it in section headings or the beginning of a listed item.

Each endpoint should have its own section with a heading that follows the pattern of the endpoint.

## [METHOD] /[router-file-name]/[endpoint]

[description]

- include if authentication is required

### parameters

- list in bullet format

### Sample Request

```bash
curl --location 'http://localhost:3000/users/login' \
--header 'Content-Type: application/json' \
--data-raw '{"email":"nrodrig1@gmail.com", "password": "test"}'
```

### Sample Response

```json
{
  "message": "User successfully registered"
}
```

### Error responses

#### Missing required field (400)

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid email or password",
    "status": 401
  }
}
```

### [Optional seciton for additional information]

- This section should be used sparingly
