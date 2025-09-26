# OAuth Setup for TrackHub Chrome Extension

## 🔐 Google OAuth Configuration

### Step 1: Create Google OAuth Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/
   - Create a new project or select existing one

2. **Enable Google+ API**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Application type: "Chrome App"
   - Application ID: Your Chrome Extension ID (get from chrome://extensions/)

### Step 2: Configure Extension

1. **Update OAuth Configuration**
   - Open `config/oauth.js`
   - Replace `YOUR_GOOGLE_CLIENT_ID` with your actual Client ID
   - Replace `YOUR_GOOGLE_CLIENT_SECRET` with your actual Client Secret

2. **Get Chrome Extension ID**
   - Load your extension in Chrome
   - Go to `chrome://extensions/`
   - Copy the Extension ID
   - Add this ID to your Google OAuth credentials

### Step 3: Test OAuth Flow

1. **Load Extension**
   - Reload the extension in Chrome
   - Click the TrackHub icon

2. **Test Google Login**
   - Click "Continue with Google"
   - Complete OAuth flow
   - Verify user info is displayed

## 🔧 Configuration Details

### Required Permissions
```json
{
  "permissions": [
    "identity",
    "storage"
  ]
}
```

### OAuth Scopes
- `openid` - Basic OpenID Connect
- `email` - User's email address
- `profile` - User's basic profile info

### Token Storage
- Access tokens stored securely in Chrome storage
- Automatic token refresh
- Secure logout functionality

## 🚨 Security Notes

1. **Client Secret Security**
   - Never commit client secret to version control
   - Use environment variables in production
   - Consider using PKCE for public clients

2. **Token Management**
   - Tokens are stored in Chrome's secure storage
   - Automatic refresh prevents token expiration
   - Logout clears all stored tokens

3. **Extension ID**
   - Keep your extension ID secure
   - Don't share it publicly
   - Use it only in OAuth configuration

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid Client" Error**
   - Check that Extension ID matches Google OAuth config
   - Verify OAuth credentials are correct

2. **"Redirect URI Mismatch"**
   - Ensure redirect URI is set correctly in Google Console
   - Use Chrome's identity API redirect URL

3. **Token Exchange Fails**
   - Verify client secret is correct
   - Check that Google+ API is enabled

### Debug Steps

1. **Check Console**
   - Open DevTools in extension popup
   - Look for OAuth-related errors

2. **Verify Permissions**
   - Ensure `identity` permission is in manifest
   - Check that extension is properly loaded

3. **Test OAuth Flow**
   - Try OAuth flow in incognito mode
   - Clear extension data and retry

## 📝 Production Deployment

### Before Publishing

1. **Update OAuth Settings**
   - Add production redirect URIs
   - Configure authorized domains
   - Set up proper CORS policies

2. **Security Review**
   - Audit token storage
   - Test logout functionality
   - Verify token refresh works

3. **User Experience**
   - Test OAuth flow on different browsers
   - Ensure popup works correctly
   - Verify error handling

## 🔄 Alternative OAuth Providers

### GitHub OAuth
```javascript
// Add to oauth.js
github: {
  clientId: 'YOUR_GITHUB_CLIENT_ID',
  scopes: ['user:email'],
  authUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token'
}
```

### Microsoft OAuth
```javascript
// Add to oauth.js
microsoft: {
  clientId: 'YOUR_MICROSOFT_CLIENT_ID',
  scopes: ['openid', 'email', 'profile'],
  authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
  tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
}
```

## 📚 Additional Resources

- [Chrome Identity API Documentation](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Chrome Extension Security Best Practices](https://developer.chrome.com/docs/extensions/mv3/security/)
