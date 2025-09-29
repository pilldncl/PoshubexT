# Custom OAuth Setup for TrackHub Chrome Extension

## Why Custom OAuth Instead of Chrome Identity API?

**Chrome Identity API Limitation:**
- ❌ Requires extension to be published on Chrome Web Store
- ❌ Creates chicken-and-egg problem for development
- ❌ Not practical for testing and development

**Custom OAuth Benefits:**
- ✅ Works immediately without Chrome Web Store
- ✅ Perfect for development and testing
- ✅ Full control over OAuth flow
- ✅ Can be used before publishing

---

## 🚀 Quick Setup Guide

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
   - **Application type**: `Web Application` (NOT Chrome App)

4. **Configure OAuth Client**
   - **Name**: TrackHub Extension
   - **Authorized JavaScript origins**: `chrome-extension://YOUR_EXTENSION_ID`
   - **Authorized redirect URIs**: `https://YOUR_EXTENSION_ID.chromiumapp.org/`

### Step 2: Get Extension ID

1. **Load Extension in Chrome**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select TRACKHUB folder

2. **Copy Extension ID**
   - Copy the long string (like: `abcdefghijklmnopqrstuvwxyz123456`)
   - Use this in your Google OAuth configuration

### Step 3: Configure Extension

1. **Update popup.js**
   ```javascript
   // Replace these placeholder values:
   clientId: 'YOUR_ACTUAL_CLIENT_ID.apps.googleusercontent.com',
   clientSecret: 'YOUR_ACTUAL_CLIENT_SECRET',
   ```

2. **Use Setup Script (Recommended)**
   ```powershell
   .\setup-credentials.ps1
   ```

### Step 4: Test OAuth

1. **Reload Extension**
   - Go to `chrome://extensions/`
   - Click reload on your extension

2. **Test Authentication**
   - Click extension icon
   - Click "Continue with Google"
   - Complete OAuth flow
   - Verify user info is displayed

---

## 🔧 Configuration Details

### Google Cloud Console Settings

**Application Type:** Web Application
**Authorized JavaScript origins:**
```
chrome-extension://YOUR_EXTENSION_ID
```

**Authorized redirect URIs:**
```
https://YOUR_EXTENSION_ID.chromiumapp.org/
```

### Extension Configuration

**Required Permissions:**
```json
{
  "permissions": [
    "identity",
    "storage"
  ]
}
```

**OAuth Scopes:**
- `openid` - Basic OpenID Connect
- `email` - User's email address
- `profile` - User's basic profile info

---

## 🛠️ Troubleshooting

### Common Issues:

1. **"Invalid client" error**
   - Check Client ID is correct
   - Verify Extension ID matches in Google Console

2. **"Redirect URI mismatch" error**
   - Ensure redirect URI format is correct
   - Should be: `https://YOUR_EXTENSION_ID.chromiumapp.org/`

3. **"Access blocked" error**
   - Configure OAuth consent screen
   - Add test users if using external user type

4. **Extension won't load**
   - Check manifest.json has required permissions
   - Verify all files are present

### Getting Help:
- Check browser console for detailed errors
- Verify Google Cloud Console configuration
- Test with setup script for automatic configuration

---

## ✅ Success Indicators

- Extension loads without errors
- OAuth flow opens Google login page
- After login, user info is displayed in popup
- No console errors related to OAuth
- Tokens are stored securely

---

## 🔒 Security Notes

- Client secret must be protected
- Use .gitignore to prevent credential exposure
- Never commit real credentials to Git
- Consider using environment variables for production

---

## 📚 Additional Resources

- `OAUTH_EXTENSION_GUIDE.md` - Complete comparison guide
- `get_extension_id.html` - Helper tool for Extension ID
- `setup-credentials.ps1` - Automated setup script

