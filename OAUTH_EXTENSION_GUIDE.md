# 🔐 OAuth Setup for Chrome Extension Service Apps

## **Overview: Two OAuth Approaches**

Chrome extensions can use OAuth in two ways:

### **Option 1: Chrome Identity API (Recommended) ✅**
- **Security**: No client secret needed
- **Simplicity**: Built into Chrome
- **Compliance**: Chrome Web Store approved
- **Use Case**: Public Chrome Web Store extensions

### **Option 2: Custom OAuth Flow ⚙️**
- **Security**: Requires client secret
- **Complexity**: Manual implementation
- **Compliance**: Enterprise/internal apps
- **Use Case**: Private/enterprise extensions

---

## **🚀 Option 1: Chrome Identity API (Recommended)**

### **Step 1: Google Cloud Console Setup**

1. **Create OAuth 2.0 Credentials**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - APIs & Services > Credentials
   - Create Credentials > OAuth 2.0 Client IDs
   - **Application type**: `Chrome App` (not Web Application!)

2. **Configure Chrome App**
   - **Application ID**: Leave empty initially
   - **Application name**: TrackHub Extension

3. **Get Extension ID**
   - Load your extension in Chrome (`chrome://extensions/`)
   - Copy the Extension ID
   - Go back to Google Cloud Console
   - Edit your OAuth 2.0 Client ID
   - **Application ID**: Paste your Extension ID
   - Save

### **Step 2: Extension Configuration**

#### **2.1 Update manifest.json**
```json
{
  "manifest_version": 3,
  "permissions": [
    "identity",
    "storage"
  ],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
    "scopes": ["openid", "email", "profile"]
  }
}
```

#### **2.2 Use Chrome Identity API**
```javascript
// Simple authentication
const token = await chrome.identity.getAuthToken({
  interactive: true,
  scopes: ['openid', 'email', 'profile']
});

// Get user info
const userInfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

### **Step 3: Implementation**
Use the `config/oauth-chrome-identity.js` file which provides:
- ✅ Automatic token management
- ✅ User info retrieval
- ✅ Token refresh handling
- ✅ Secure logout
- ✅ No client secret needed

---

## **⚙️ Option 2: Custom OAuth Flow**

### **Step 1: Google Cloud Console Setup**

1. **Create OAuth 2.0 Credentials**
   - Application type: `Web Application`
   - **Authorized JavaScript origins**: `chrome-extension://YOUR_EXTENSION_ID`
   - **Authorized redirect URIs**: `https://YOUR_EXTENSION_ID.chromiumapp.org/`

2. **Get Credentials**
   - Client ID
   - Client Secret (keep this secure!)

### **Step 2: Extension Configuration**

#### **2.1 Update manifest.json**
```json
{
  "manifest_version": 3,
  "permissions": [
    "identity",
    "storage",
    "activeTab"
  ]
}
```

#### **2.2 Use Custom OAuth Flow**
Use the existing `config/oauth-template.js` or `config/oauth.js` files.

---

## **🔧 Implementation Examples**

### **Chrome Identity API Usage**
```javascript
// Initialize OAuth manager
const oauthManager = new ChromeIdentityOAuthManager();

// Authenticate user
try {
  const userInfo = await oauthManager.authenticate();
  console.log('User authenticated:', userInfo);
} catch (error) {
  console.error('Authentication failed:', error);
}

// Check authentication status
const isAuthenticated = await oauthManager.isAuthenticated();

// Get current user
const currentUser = await oauthManager.getCurrentUser();

// Logout
await oauthManager.logout();
```

### **Custom OAuth Usage**
```javascript
// Initialize OAuth manager
const oauthManager = new OAuthManager();

// Authenticate user
try {
  const userInfo = await oauthManager.authenticate();
  console.log('User authenticated:', userInfo);
} catch (error) {
  console.error('Authentication failed:', error);
}
```

---

## **📋 Which Option Should You Choose?**

### **Choose Chrome Identity API if:**
- ✅ Publishing to Chrome Web Store
- ✅ Want maximum security (no client secret)
- ✅ Need simple implementation
- ✅ Building a public extension

### **Choose Custom OAuth if:**
- ✅ Building enterprise/internal extension
- ✅ Need full control over OAuth flow
- ✅ Already have existing OAuth infrastructure
- ✅ Require specific OAuth features

---

## **🚨 Security Best Practices**

### **Chrome Identity API**
- ✅ No client secret to manage
- ✅ Tokens handled by Chrome
- ✅ Automatic token refresh
- ✅ Secure by default

### **Custom OAuth**
- ⚠️ Client secret must be protected
- ⚠️ Manual token management required
- ⚠️ Must implement secure storage
- ⚠️ Handle token refresh manually

---

## **🛠️ Quick Setup Commands**

### **For Chrome Identity API:**
```powershell
# Copy the Chrome Identity config
copy config\oauth-chrome-identity.js config\oauth-credentials.js

# Edit the credentials file
notepad config\oauth-credentials.js
# Replace YOUR_GOOGLE_CLIENT_ID with your actual Client ID
```

### **For Custom OAuth:**
```powershell
# Use the setup script
.\setup-credentials.ps1
```

---

## **✅ Testing Your Setup**

1. **Load Extension**
   - Go to `chrome://extensions/`
   - Load unpacked extension
   - Enable developer mode

2. **Test Authentication**
   - Click extension icon
   - Try "Continue with Google"
   - Verify OAuth flow works

3. **Check Console**
   - Open Developer Tools
   - Look for OAuth-related errors
   - Verify token storage

---

## **🔍 Troubleshooting**

### **Common Issues:**

1. **"Invalid client" error**
   - Check Application ID in Google Console
   - Ensure it matches your Extension ID

2. **"Redirect URI mismatch"**
   - Verify redirect URI format
   - Should be: `https://YOUR_EXTENSION_ID.chromiumapp.org/`

3. **"Access blocked" error**
   - Configure OAuth consent screen
   - Add test users if needed

4. **Extension won't load**
   - Check manifest.json permissions
   - Verify all files are present

### **Getting Help:**
- Check browser console for detailed errors
- Verify Google Cloud Console configuration
- Test with Chrome Identity API first (simpler)
