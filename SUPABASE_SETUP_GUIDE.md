# TrackHub Supabase + Auth0 Setup Guide

This guide will help you set up the Supabase + Auth0 integration for your TrackHub Chrome extension.

## **Step 1: Supabase Setup**

### 1.1 Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login with your account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `trackhub`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
6. Click "Create new project"
7. Wait for project to be ready (2-3 minutes)

### 1.2 Get Supabase Credentials
1. Go to **Settings** → **API**
2. Copy the following:
   - **Project URL**: `https://your-project-id.supabase.co`
   - **Anon Key**: `your-anon-key`

### 1.3 Set up Database Schema
1. Go to **SQL Editor** in your Supabase dashboard
2. Copy and paste the contents of `setup-supabase.sql`
3. Click **Run** to execute the SQL
4. Verify tables are created in **Table Editor**

## **Step 2: Auth0 Setup**

### 2.1 Create Auth0 Account
1. Go to [auth0.com](https://auth0.com)
2. Sign up for a free account
3. Choose "Personal" account type
4. Complete the setup wizard

### 2.2 Create Auth0 Application
1. Go to **Applications** → **Applications**
2. Click **Create Application**
3. Enter details:
   - **Name**: `TrackHub Chrome Extension`
   - **Type**: **Single Page Application**
4. Click **Create**

### 2.3 Configure Auth0 Application
1. Go to your application settings
2. Update **Allowed Callback URLs**:
   ```
   https://your-extension-id.chromiumapp.org/
   ```
3. Update **Allowed Web Origins**:
   ```
   chrome-extension://your-extension-id
   ```
4. Update **Allowed Logout URLs**:
   ```
   https://your-extension-id.chromiumapp.org/
   ```
5. **Save Changes**

### 2.4 Get Auth0 Credentials
1. Go to **Applications** → **Applications** → **TrackHub Chrome Extension**
2. Copy the following:
   - **Domain**: `your-domain.auth0.com`
   - **Client ID**: `your-client-id`

## **Step 3: Chrome Extension Configuration**

### 3.1 Update Supabase Configuration
Edit `config/supabase-config.js`:

```javascript
export const SUPABASE_CONFIG = {
  // Replace with your actual Supabase project URL
  url: 'https://your-project-id.supabase.co',
  
  // Replace with your actual Supabase anon key
  anonKey: 'your-supabase-anon-key',
  
  // Replace with your actual Auth0 credentials
  auth0: {
    domain: 'your-domain.auth0.com',
    clientId: 'your-auth0-client-id',
    audience: 'your-auth0-audience', // Optional
    scope: 'openid profile email'
  }
};
```

### 3.2 Get Chrome Extension ID
1. Load your extension in Chrome
2. Go to `chrome://extensions/`
3. Find your extension and copy the **ID**
4. Update Auth0 callback URLs with your actual extension ID

### 3.3 Update Manifest
The manifest.json has been updated to include necessary permissions for Supabase integration.

## **Step 4: Install Dependencies**

### 4.1 Install Supabase Client
You'll need to include the Supabase client in your extension. Since Chrome extensions don't support npm directly, you have a few options:

**Option A: Use CDN (Recommended)**
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```

**Option B: Download and include locally**
1. Download `@supabase/supabase-js` from npm
2. Include the built file in your extension

### 4.2 Update HTML
Update your popup HTML to use the Supabase version:

```html
<!-- Replace popup.html with popup-supabase.html -->
<script type="module" src="popup-supabase.js"></script>
```

## **Step 5: Test the Integration**

### 5.1 Test Supabase Connection
1. Open your Chrome extension
2. Click **Test Connection** button
3. Verify both Auth and Data connections work

### 5.2 Test Authentication
1. Click **Continue with Auth0**
2. Complete the Auth0 login flow
3. Verify you're redirected back to the extension
4. Check that user info is displayed

### 5.3 Test Real-time Sync
1. Add a tracking item
2. Open the extension in another browser/device
3. Verify the item appears in real-time
4. Test updates and deletions

## **Step 6: Deploy and Monitor**

### 6.1 Production Considerations
- **Supabase**: Upgrade to Pro plan for production
- **Auth0**: Configure production domain
- **Security**: Review RLS policies
- **Monitoring**: Set up Supabase monitoring

### 6.2 Environment Variables
For production, consider using environment variables:

```javascript
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'your-anon-key';
```

## **Troubleshooting**

### Common Issues

**1. "Invalid redirect URI" error**
- Check Auth0 callback URLs match your extension ID
- Ensure the URL format is correct

**2. "Supabase connection failed"**
- Verify your Supabase URL and anon key
- Check if your Supabase project is active

**3. "Real-time not working"**
- Ensure RLS policies are set up correctly
- Check if real-time is enabled in Supabase

**4. "Authentication not persisting"**
- Check Chrome storage permissions
- Verify session handling in Supabase

### Debug Steps
1. Open Chrome DevTools
2. Check Console for errors
3. Verify network requests in Network tab
4. Check Chrome storage in Application tab

## **Benefits of Supabase + Auth0 Integration**

### ✅ **Simplified Architecture**
- **Before**: 2,500+ lines of auth code
- **After**: ~200 lines with Supabase

### ✅ **Real-time Sync**
- Automatic data synchronization
- Multi-device support
- Offline-first with sync

### ✅ **Managed Services**
- No server maintenance
- Automatic scaling
- Built-in security

### ✅ **Better User Experience**
- Faster authentication
- Real-time updates
- Seamless sync

## **Next Steps**

1. **Complete the setup** following this guide
2. **Test thoroughly** with multiple devices
3. **Monitor performance** in Supabase dashboard
4. **Consider upgrading** to paid plans for production

## **Support**

- **Supabase Docs**: [supabase.com/docs](https://supabase.com/docs)
- **Auth0 Docs**: [auth0.com/docs](https://auth0.com/docs)
- **Chrome Extension Docs**: [developer.chrome.com/docs/extensions](https://developer.chrome.com/docs/extensions)

---

**🎉 Congratulations!** You now have a modern, scalable authentication and data sync system for your TrackHub Chrome extension.


