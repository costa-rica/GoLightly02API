# Users API

This router handles user registration, email verification, authentication, and password reset.

## POST /users/register

Creates a new user account and sends a verification email.

- Authentication: Not required
- Email addresses are normalized to lowercase
- Password must be at least 6 characters
- User account is created with `isEmailVerified: false`
- Verification token expires in 30 minutes

### Parameters

Request body:
- `email` (string, required): User's email address
- `password` (string, required): User's password (minimum 6 characters)

### Sample Request

```bash
curl --location 'http://localhost:3000/users/register' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com",
  "password": "securepassword123"
}'
```

### Sample Response

```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "userId": 1
}
```

### Error Responses

#### Missing required field (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email and password are required",
    "status": 400
  }
}
```

#### Invalid email format (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "status": 400
  }
}
```

#### Password too short (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must be at least 6 characters long",
    "status": 400
  }
}
```

#### User already exists (409)

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "User with this email already exists",
    "status": 409
  }
}
```

## GET /users/verify

Verifies a user's email address using the token sent during registration.

- Authentication: Not required
- Token must be provided as a query parameter
- Verification tokens expire after 30 minutes
- Already verified emails return success without changes

### Parameters

Query parameters:
- `token` (string, required): JWT verification token from registration email

### Sample Request

```bash
curl --location 'http://localhost:3000/users/verify?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```

### Sample Response

```json
{
  "message": "Email verified successfully. You can now log in."
}
```

### Error Responses

#### Missing token (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Verification token is required",
    "status": 400
  }
}
```

#### Expired token (401)

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Verification token has expired. Please request a new verification email.",
    "status": 401
  }
}
```

#### Invalid token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid verification token",
    "status": 401
  }
}
```

#### User not found (404)

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

## POST /users/login

Authenticates a user and returns an access token.

- Authentication: Not required
- Email must be verified before login
- Returns JWT access token with no expiration
- Email addresses are normalized to lowercase for lookup

### Parameters

Request body:
- `email` (string, required): User's email address
- `password` (string, required): User's password

### Sample Request

```bash
curl --location 'http://localhost:3000/users/login' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com",
  "password": "securepassword123"
}'
```

### Sample Response

```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "isAdmin": false
  }
}
```

### Error Responses

#### Missing required field (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email and password are required",
    "status": 400
  }
}
```

#### Invalid credentials (401)

```json
{
  "error": {
    "code": "AUTH_FAILED",
    "message": "Invalid email or password",
    "status": 401
  }
}
```

#### Email not verified (403)

```json
{
  "error": {
    "code": "EMAIL_NOT_VERIFIED",
    "message": "Please verify your email before logging in",
    "status": 403
  }
}
```

## POST /users/forgot-password

Initiates a password reset by sending a reset link to the user's email address.

- Authentication: Not required
- Email must exist in the system (returns error if not found)
- Password reset token expires in 30 minutes
- Reset link is sent to URL_BASE_WEBSITE/reset-password/:token

### Parameters

Request body:
- `email` (string, required): User's email address

### Sample Request

```bash
curl --location 'http://localhost:3000/users/forgot-password' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com"
}'
```

### Sample Response

```json
{
  "message": "Password reset link has been sent to your email address"
}
```

### Error Responses

#### Missing email (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "status": 400
  }
}
```

#### Email not found (404)

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "No account found with this email address",
    "status": 404
  }
}
```

## POST /users/reset-password

Resets a user's password using a valid reset token.

- Authentication: Not required
- Token must be valid and not expired (30-minute expiration)
- New password must be at least 6 characters
- Password is hashed before storage

### Parameters

Request body:
- `token` (string, required): JWT password reset token from email
- `newPassword` (string, required): New password (minimum 6 characters)

### Sample Request

```bash
curl --location 'http://localhost:3000/users/reset-password' \
--header 'Content-Type: application/json' \
--data-raw '{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "newsecurepassword456"
}'
```

### Sample Response

```json
{
  "message": "Password has been reset successfully. You can now log in with your new password."
}
```

### Error Responses

#### Missing required field (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Token and new password are required",
    "status": 400
  }
}
```

#### Password too short (400)

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Password must be at least 6 characters long",
    "status": 400
  }
}
```

#### Expired token (401)

```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Password reset token has expired. Please request a new password reset.",
    "status": 401
  }
}
```

#### Invalid token (401)

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid password reset token",
    "status": 401
  }
}
```

#### User not found (404)

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User not found",
    "status": 404
  }
}
```

### Using the access token

The access token returned from login should be included in the `Authorization` header for all protected endpoints:

```bash
curl --location 'http://localhost:3000/mantras/list' \
--header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
```
