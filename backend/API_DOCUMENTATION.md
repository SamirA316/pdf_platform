# PDF Platform - Authentication API Documentation

Base URL: `http://localhost:3001`

**Important Note for Frontend Team:** 
All requests must include `credentials: 'include'` in the fetch/axios configuration. The backend uses HTTP-only cookies (`token`) for secure session management. Without this flag, the session will not persist and subsequent requests to `/me` will fail.

---

## 1. User Registration (Step 1)
Creates a new account and sends a 6-digit OTP to the user's email.

- **Endpoint:** `/api/auth/register`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

### Request Body
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "strongpassword123"
}
```

### Success Response (201 Created)
```json
{
  "message": "OTP sent to your email",
  "userId": "uuid-string-here"
}
```

### Error Responses
- `400 Bad Request`: `{"error": "All fields are required"}`
- `400 Bad Request`: `{"error": "Email already in use"}`

---

## 2. Verify OTP (Step 2)
Verifies the OTP sent to the email. On success, it logs the user in (sets HTTP-only cookie).

- **Endpoint:** `/api/auth/verify-otp`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Required to set the login cookie)

### Request Body
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Success Response (200 OK)
```json
{
  "user": {
    "id": "uuid-string-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Responses
- `400 Bad Request`: `{"error": "Invalid OTP"}`
- `400 Bad Request`: `{"error": "OTP has expired"}`
- `400 Bad Request`: `{"error": "User is already verified"}`
- `404 Not Found`: `{"error": "User not found"}`

---

## 3. User Login
Logs in an already verified user. Sets the HTTP-only cookie.

- **Endpoint:** `/api/auth/login`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Required to set the login cookie)

### Request Body
```json
{
  "email": "john@example.com",
  "password": "strongpassword123"
}
```

### Success Response (200 OK)
```json
{
  "user": {
    "id": "uuid-string-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Responses
- `401 Unauthorized`: `{"error": "Invalid credentials"}`
- `403 Forbidden`: `{"error": "Please verify your email before logging in"}`

---

## 4. Get Current User (Session Check)
Verifies the HTTP-only cookie and returns the logged-in user's details. Call this on app initialization/page refresh.

- **Endpoint:** `/api/auth/me`
- **Method:** `GET`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Mandatory - sends the secure cookie to the server)

### Success Response (200 OK)
```json
{
  "user": {
    "id": "uuid-string-here",
    "name": "John Doe",
    "email": "john@example.com"
  }
}
```

### Error Responses
- `401 Unauthorized`: `{"error": "Authentication required"}`
- `401 Unauthorized`: `{"error": "Invalid or expired token"}`
- `404 Not Found`: `{"error": "User not found"}`

---

## 5. Logout
Clears the HTTP-only cookie, logging the user out.

- **Endpoint:** `/api/auth/logout`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Credentials:** `include` (Mandatory)

### Success Response (200 OK)
```json
{
  "message": "Logged out successfully"
}
```
