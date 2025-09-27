# TrackHub Chrome Identity OAuth Setup Script
# This script sets up OAuth using Chrome Identity API (recommended for Chrome extensions)

Write-Host "TrackHub Chrome Identity OAuth Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Check if credentials file already exists
$credentialsFile = "config/oauth-credentials.js"
if (Test-Path $credentialsFile) {
    Write-Host "Credentials file already exists!" -ForegroundColor Yellow
    $overwrite = Read-Host "Do you want to overwrite it? (y/N)"
    if ($overwrite -ne "y" -and $overwrite -ne "Y") {
        Write-Host "Setup cancelled." -ForegroundColor Red
        exit
    }
}

Write-Host "`nChrome Identity API OAuth Setup:" -ForegroundColor Cyan
Write-Host "This method is more secure and doesn't require client secrets!" -ForegroundColor Green

# Get Client ID
do {
    $clientId = Read-Host "Enter your Google Client ID (format: 123456789-abcdefghijklmnop.apps.googleusercontent.com)"
    if ($clientId -match '^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$') {
        break
    } else {
        Write-Host "Invalid Client ID format. Please try again." -ForegroundColor Red
    }
} while ($true)

Write-Host "`nSetting up Chrome Identity OAuth..." -ForegroundColor Cyan

# Create credentials file for Chrome Identity API
$credentialsContent = @"
// OAuth Configuration for TrackHub Chrome Extension (Chrome Identity API)
// SECURITY: This file contains sensitive credentials and is in .gitignore

const OAUTH_CONFIG = {
  google: {
    clientId: '$clientId',
    scopes: ['openid', 'email', 'profile'],
    redirectUri: chrome.identity.getRedirectURL()
  },
  storageKeys: {
    accessToken: 'trackhub_access_token',
    refreshToken: 'trackhub_refresh_token', 
    userInfo: 'trackhub_user_info',
    tokenExpiry: 'trackhub_token_expiry'
  }
};

// Chrome Identity OAuth Manager
class ChromeIdentityOAuthManager {
  constructor() {
    this.config = OAUTH_CONFIG;
  }

  async authenticate() {
    try {
      // Check if we already have a valid token
      if (await this.isTokenValid()) {
        const tokens = await this.getStoredTokens();
        return tokens[this.config.storageKeys.userInfo];
      }

      // Use Chrome Identity API for OAuth
      const token = await chrome.identity.getAuthToken({
        interactive: true,
        scopes: this.config.google.scopes
      });

      if (!token) {
        throw new Error('Failed to get authentication token');
      }

      // Get user info using the token
      const userInfo = await this.getUserInfo(token);
      
      // Store tokens (Chrome Identity API provides access token only)
      await this.storeTokens({
        access_token: token,
        expires_in: 3600 // Chrome Identity tokens typically last 1 hour
      }, userInfo);

      return userInfo;
    } catch (error) {
      console.error('Chrome Identity authentication error:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to get user info');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Get user info error:', error);
      throw error;
    }
  }

  async storeTokens(tokens, userInfo) {
    try {
      const tokenExpiry = Date.now() + (tokens.expires_in * 1000);
      await chrome.storage.local.set({
        [this.config.storageKeys.accessToken]: tokens.access_token,
        [this.config.storageKeys.userInfo]: userInfo,
        [this.config.storageKeys.tokenExpiry]: tokenExpiry
      });
    } catch (error) {
      console.error('Store tokens error:', error);
      throw error;
    }
  }

  async getStoredTokens() {
    try {
      const result = await chrome.storage.local.get([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry
      ]);
      return result;
    } catch (error) {
      console.error('Get stored tokens error:', error);
      throw error;
    }
  }

  async isTokenValid() {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens[this.config.storageKeys.accessToken]) {
        return false;
      }
      
      const expiry = tokens[this.config.storageKeys.tokenExpiry];
      if (!expiry) {
        return false;
      }
      
      // Check if token is still valid (with 5-minute buffer)
      return Date.now() < (expiry - 300000);
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async refreshToken() {
    try {
      // Chrome Identity API handles token refresh automatically
      // We just need to get a new token
      const token = await chrome.identity.getAuthToken({
        interactive: false,
        scopes: this.config.google.scopes
      });

      if (token) {
        const userInfo = await this.getUserInfo(token);
        await this.storeTokens({
          access_token: token,
          expires_in: 3600
        }, userInfo);
        return userInfo;
      }
      
      return null;
    } catch (error) {
      console.error('Token refresh error:', error);
      return null;
    }
  }

  async logout() {
    try {
      const tokens = await this.getStoredTokens();
      const accessToken = tokens[this.config.storageKeys.accessToken];
      
      if (accessToken) {
        // Remove token from Chrome Identity
        await chrome.identity.removeCachedAuthToken({ token: accessToken });
      }
      
      // Clear stored data
      await chrome.storage.local.remove([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry
      ]);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      const tokens = await this.getStoredTokens();
      return tokens[this.config.storageKeys.userInfo] || null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  async isAuthenticated() {
    return await this.isTokenValid();
  }
}
"@

# Ensure config directory exists
if (!(Test-Path "config")) {
    New-Item -ItemType Directory -Path "config" | Out-Null
}

# Write credentials file
$credentialsContent | Out-File -FilePath $credentialsFile -Encoding UTF8

# Update manifest.json with the client ID
$manifestPath = "manifest.json"
if (Test-Path $manifestPath) {
    $manifestContent = Get-Content $manifestPath -Raw
    $updatedManifest = $manifestContent -replace 'YOUR_GOOGLE_CLIENT_ID\.apps\.googleusercontent\.com', $clientId
    $updatedManifest | Out-File -FilePath $manifestPath -Encoding UTF8
    Write-Host "✅ Updated manifest.json with your Client ID" -ForegroundColor Green
}

Write-Host "`n✅ Chrome Identity OAuth configured successfully!" -ForegroundColor Green
Write-Host "📁 Credentials saved to: $credentialsFile" -ForegroundColor Cyan
Write-Host "📄 Manifest updated with Client ID" -ForegroundColor Cyan
Write-Host "🔒 No client secret needed - more secure!" -ForegroundColor Yellow

Write-Host "`n📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Load your extension in Chrome (chrome://extensions/)" -ForegroundColor White
Write-Host "2. Get your Extension ID using get_extension_id.html" -ForegroundColor White
Write-Host "3. Update Google Cloud Console with your Extension ID" -ForegroundColor White
Write-Host "4. Test the OAuth flow in your extension" -ForegroundColor White

Write-Host "`n🔧 Google Cloud Console Configuration:" -ForegroundColor Cyan
Write-Host "- Application type: Chrome App" -ForegroundColor White
Write-Host "- Application ID: Your Extension ID (get from chrome://extensions/)" -ForegroundColor White
Write-Host "- No redirect URIs needed for Chrome Identity API" -ForegroundColor White

Write-Host "`n🚀 You're ready to go with Chrome Identity API!" -ForegroundColor Green
