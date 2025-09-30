# TrackHub Token Authentication Debug Guide

## Overview
This guide covers the token authentication flow and debugging steps for the TrackHub Chrome extension backend integration.

## Token Flow

### 1. Login Process
```
User Login → Backend API → Token Storage → API Requests
```

**Login Request:**
```json
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Expected Backend Response:**
```json
{
  "success": true,
  "user": {
    "id": "user123",
    "email": "user@example.com",
    "name": "User Name"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "expiresIn": 3600
}
```

### 2. Token Storage
- **Storage Key:** `trackhub_access_token`
- **Format:** JWT (JSON Web Token)
- **Usage:** `Authorization: Bearer <token>`

### 3. API Request Flow
```
Background Script → Get Token → Add Bearer Prefix → Send to Popup → Submit to Backend
```

## Current Implementation

### Files Modified
- `config/auth-service.js` - Authentication service
- `config/tracking-service.js` - Backend API calls
- `background.js` - Context menu handling
- `popup.js` - UI and request submission

### Key Functions
- `AuthService.login()` - User authentication
- `AuthService.storeAuthData()` - Token storage
- `TrackingService.getAuthToken()` - Token retrieval
- `TrackingService.addTrackingToBackend()` - Backend API calls

## Debugging Steps

### 1. Check Token Storage
```javascript
// In browser console:
chrome.storage.local.get(['trackhub_access_token', 'trackhub_is_logged_in'], (result) => {
  console.log('Token:', result.trackhub_access_token);
  console.log('Logged in:', result.trackhub_is_logged_in);
});
```

### 2. Test Token Formats
```javascript
// In browser console:
const { TrackingService } = await import('./config/tracking-service.js');
const trackingService = new TrackingService();
await trackingService.testTokenFormats();
```

### 3. Debug Token Status
```javascript
// In browser console:
const { TrackHubPopup } = await import('./popup.js');
const popup = new TrackHubPopup();
await popup.debugTokenStatus();
```

### 4. Check Request Headers
- Right-click tracking number → "Add to TrackHub"
- Check console for: `🔵 Background: Authorization header value: Bearer <token>`

## Common Issues

### 1. 401 Unauthorized - "No token provided"
**Causes:**
- Token not stored during login
- Token not retrieved correctly
- Token format mismatch
- Backend validation failure

**Solutions:**
- Check login response format
- Verify token storage
- Test different token formats
- Check backend JWT validation

### 2. Token Format Issues
**Supported Formats:**
- `Bearer <token>` (most common)
- `<token>` (raw token)
- `Token <token>`
- `Api-Key <token>`

### 3. Service Worker Limitations
**Issue:** Background scripts can't use `import()`
**Solution:** Background prepares request, popup submits it

## Backend Requirements

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/user/profile` - User profile
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/logout` - User logout

### Tracking Endpoints
- `POST /api/tracking/add` - Add tracking item
- `GET /api/tracking/user` - Get user trackings
- `PUT /api/tracking/update` - Update tracking
- `DELETE /api/tracking/delete` - Delete tracking

### Expected Request Format
```http
POST /api/tracking/add
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "trackingNumber": "1Z123456789",
  "brand": "ups",
  "description": "Package description",
  "dateAdded": "2024-01-01T00:00:00Z",
  "status": "pending"
}
```

## Testing Checklist

- [ ] User can login successfully
- [ ] Token is stored in Chrome storage
- [ ] Token is retrieved correctly
- [ ] Authorization header is formatted properly
- [ ] Backend receives and validates token
- [ ] Tracking items sync to backend
- [ ] Cross-device sync works

## Next Steps

1. Run debug functions to identify token issues
2. Test different token formats with backend
3. Verify backend JWT validation
4. Implement token refresh if needed
5. Add error handling for expired tokens

## Files to Review
- `config/auth-service.js` - Authentication logic
- `config/tracking-service.js` - Backend API calls
- `background.js` - Context menu and request preparation
- `popup.js` - UI and request submission
- `TOKEN_DEBUG_GUIDE.md` - This guide
