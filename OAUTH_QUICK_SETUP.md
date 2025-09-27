# 🚀 Quick OAuth Setup Guide

## **Step 1: Get Google OAuth Credentials**

### 1.1 Go to Google Cloud Console
- Visit: https://console.cloud.google.com/
- Sign in with your Google account

### 1.2 Create or Select Project
- Click "Select a project" at the top
- Click "New Project" or select existing project
- Name it "TrackHub Extension" (or any name you prefer)

### 1.3 Enable Google+ API
- Go to "APIs & Services" > "Library"
- Search for "Google+ API" and click on it
- Click "Enable"

### 1.4 Create OAuth 2.0 Credentials
- Go to "APIs & Services" > "Credentials"
- Click "Create Credentials" > "OAuth 2.0 Client IDs"
- If prompted, configure OAuth consent screen:
  - Choose "External" user type
  - Fill in required fields (App name, User support email, Developer contact)
  - Add your email to test users
- Application type: **"Chrome App"**
- Name: "TrackHub Extension"
- **Application ID**: Leave empty for now (we'll get this after loading the extension)

### 1.5 Get Extension ID
- Load your extension in Chrome:
  - Go to `chrome://extensions/`
  - Enable "Developer mode" (toggle in top right)
  - Click "Load unpacked" and select your TRACKHUB folder
- Copy the Extension ID (long string like: `abcdefghijklmnopqrstuvwxyz123456`)

### 1.6 Complete OAuth Setup
- Go back to Google Cloud Console > Credentials
- Click on your OAuth 2.0 Client ID
- In "Authorized JavaScript origins", add:
  - `chrome-extension://YOUR_EXTENSION_ID`
- In "Authorized redirect URIs", add:
  - `https://YOUR_EXTENSION_ID.chromiumapp.org/`
- Click "Save"

### 1.7 Get Your Credentials
- Copy the **Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
- Copy the **Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

## **Step 2: Configure Credentials (SECURE METHOD)**

### 2.1 Use the Setup Script (Recommended)
Run the PowerShell setup script:

```powershell
.\setup-credentials.ps1
```

This script will:
- Prompt you for your credentials securely
- Create a protected credentials file
- Ensure credentials are never committed to Git

### 2.2 Manual Configuration (Alternative)
If you prefer manual setup:

1. **Create credentials file:**
   - Copy `config/oauth-template.js` to `config/oauth-credentials.js`
   - Replace placeholder values with your actual credentials

2. **Update popup.js:**
   - Replace the placeholder values in `popup.js` with your actual credentials
   - **⚠️ WARNING: This method puts credentials in the main code file**

### 2.2 Test the Setup
1. Reload the extension in Chrome
2. Click the TrackHub icon
3. Click "Continue with Google"
4. Complete the OAuth flow
5. You should see your user info displayed

## **🔧 Troubleshooting**

### Common Issues:

1. **"Invalid client" error**
   - Check that your Client ID is correct
   - Ensure the extension ID in Google Console matches your actual extension ID

2. **"Redirect URI mismatch" error**
   - Make sure you added the correct redirect URI format
   - Should be: `https://YOUR_EXTENSION_ID.chromiumapp.org/`

3. **"Access blocked" error**
   - Check OAuth consent screen is configured
   - Add your email to test users if using external user type

4. **Extension won't load**
   - Check manifest.json has `"identity"` permission
   - Verify all file paths are correct

### Getting Help:
- Check browser console for detailed error messages
- Verify all steps in this guide are completed
- Make sure Google+ API is enabled in your project

## **✅ Success Indicators**
- Extension loads without errors
- OAuth flow opens Google login page
- After login, user info is displayed in popup
- No console errors related to OAuth
