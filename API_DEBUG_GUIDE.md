# API Debug Guide

## Overview
Comprehensive debugging tool to verify API communication between Chrome extension and backend.

## Quick Start

### Option 1: Using the Debug UI (Recommended)
1. Open the extension popup
2. Login to your account
3. Click the **"Debug API"** button (purple button at bottom)
4. Click **"Run Tests"** in the debug modal
5. Review the results to see:
   - ✅ Backend connectivity status
   - ✅ Whether API requests were sent
   - ✅ What responses were received
   - ✅ Authentication status
   - ✅ GET/POST request tests

### Option 2: Using Browser Console
1. Open Chrome DevTools (F12)
2. Go to the Console tab
3. Run this command:
```javascript
(async () => {
  const { APIDebugger } = await import(chrome.runtime.getURL('config/api-debugger.js'));
  const debugger = new APIDebugger();
  const results = await debugger.runAllTests();
  console.log(debugger.formatResults(results));
})();
```

## What the Debugger Tests

### Test 1: Backend Connectivity
- **Purpose**: Verify backend server is running and reachable
- **Endpoint**: `http://localhost:3000/api/health`
- **Success**: Backend responds with 200 OK
- **Failure**: Connection timeout or server error

### Test 2: Authentication Status
- **Purpose**: Check if auth token exists and is valid
- **Tests**: Auth0 token, TrackHub token, token expiry
- **Success**: Valid token found
- **Failure**: No token or expired token

### Test 3: GET Request Test
- **Purpose**: Verify extension can fetch data from backend
- **Endpoint**: `/api/tracking/user`
- **Success**: Returns tracking items array
- **Failure**: 401 (auth issue), 404 (endpoint missing), 500 (server error)

### Test 4: POST Request Test
- **Purpose**: Verify extension can send data to backend
- **Endpoint**: `/api/tracking/add`
- **Payload**: Test tracking item
- **Success**: Backend creates item and returns ID
- **Failure**: 400 (validation), 401 (auth), 409 (duplicate)

## Common Issues & Solutions

### Issue: Backend Not Reachable
**Symptoms**: 
```
❌ Backend unreachable
error: "Failed to fetch"
```

**Solutions**:
1. Check if backend server is running:
   ```bash
   # Check if process is listening on port 3000
   netstat -ano | findstr :3000
   ```
2. Start your backend server
3. Verify backend URL in `config/auth-service.js` and `config/tracking-service.js`
4. Check firewall settings

### Issue: Authentication Failed
**Symptoms**:
```
❌ GET request failed: 401 Unauthorized
```

**Solutions**:
1. Login again through the popup
2. Check token in Chrome storage:
   - Open DevTools > Application > Storage > Local Storage
   - Look for `trackhub_access_token`
3. Verify backend authentication middleware is working
4. Check token format (should be JWT)

### Issue: CORS Error
**Symptoms**:
```
Access to fetch at 'http://localhost:3000' has been blocked by CORS policy
```

**Solutions**:
1. Add CORS middleware to your backend:
```javascript
app.use(cors({
  origin: ['chrome-extension://*'],
  credentials: true
}));
```
2. Or add `host_permissions` in `manifest.json` (already done)

### Issue: API Not Sending Data
**Symptoms**:
```
✅ Backend reachable
✅ Requests sent
❌ POST request failed
```

**Solutions**:
1. Check request payload format
2. Verify backend expects correct field names
3. Check backend validation rules
4. Review backend logs for errors

## Understanding Results

### Example Success Output
```
==========================================================
SUMMARY:
Overall Status: All systems operational
Backend Reachable: ✅
Requests Sent: ✅
Responses Received: ✅
Authentication: ✅
GET Requests: ✅
POST Requests: ✅
==========================================================
```

### Example Partial Failure
```
==========================================================
SUMMARY:
Overall Status: Backend reachable but authentication issue
Backend Reachable: ✅
Authentication: ❌
GET Requests: ❌ (401 Unauthorized)
POST Requests: ❌ (401 Unauthorized)
==========================================================
```

## Verifying Specific Issues

### Check if API was sent
Look for log entries like:
```
[REQUEST] Sending GET request
  url: http://localhost:3000/api/tracking/user
  hasToken: true
```

### Check what was received
Look for log entries like:
```
[RESPONSE] GET request response received
  status: 200
  duration: 145ms
  
[SUCCESS] GET request successful
  dataReceived: true
  itemCount: 5
```

### Check response data
The full response data is logged in the `data` field:
```
[SUCCESS] GET request successful
  data: {
    trackings: [
      { id: 1, trackingNumber: "1Z999...", ... }
    ]
  }
```

## Backend Requirements

Your backend should have these endpoints:

### Health Check (Optional but Recommended)
```
GET /api/health
Response: { status: "ok" }
```

### Get User Trackings
```
GET /api/tracking/user
Headers: Authorization: Bearer <token>
Response: { trackings: [...] }
```

### Add Tracking
```
POST /api/tracking/add
Headers: Authorization: Bearer <token>
Body: {
  trackingNumber: string,
  brand: string,
  description: string,
  dateAdded: string,
  status: string
}
Response: { id: number, ...tracking data }
```

## Advanced Debugging

### Enable Detailed Logging
The debugger logs everything to browser console. Open DevTools Console to see:
- 🔑 Auth token retrieval
- 🌐 Request details (URL, headers, body)
- 📡 Response details (status, headers, data)
- ✅ Success messages
- ❌ Error messages with details

### Export Results
1. Run the debug tests
2. Click "Copy Results" button
3. Paste into a text file or share with your team
4. All logs are included with timestamps

### Test Individual Components
You can test specific parts by importing the debugger:

```javascript
const { APIDebugger } = await import('./config/api-debugger.js');
const debugger = new APIDebugger();

// Test only connectivity
const connectivityResult = await debugger.testBackendConnectivity();

// Test only GET requests
const getResult = await debugger.testGetRequest();

// Test only POST requests
const postResult = await debugger.testPostRequest();
```

## Files Modified/Created

- `config/api-debugger.js` - Main debugging tool
- `popup.html` - Added debug button and modal
- `popup.js` - Added debug modal handlers
- `styles/popup.css` - Added modal styles

## Notes

- The debugger creates a test tracking item when running POST tests
- All tests are non-destructive except the POST test (which adds one item)
- Results are stored in memory only (not persisted)
- Debug modal shows formatted results for easy reading
- Console logs show more detailed technical information

