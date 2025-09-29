# TrackHub OAuth Credentials Setup Script
# This script helps you securely set up OAuth credentials

Write-Host "TrackHub OAuth Setup" -ForegroundColor Green
Write-Host "=========================" -ForegroundColor Green

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

Write-Host "`nPlease provide your Google OAuth credentials:" -ForegroundColor Cyan

# Get Client ID
do {
    $clientId = Read-Host "Enter your Google Client ID (format: 123456789-abcdefghijklmnop.apps.googleusercontent.com)"
    if ($clientId -match '^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$') {
        break
    } else {
        Write-Host "Invalid Client ID format. Please try again." -ForegroundColor Red
    }
} while ($true)

# Get Client Secret
do {
    $clientSecret = Read-Host "Enter your Google Client Secret (format: GOCSPX-abcdefghijklmnopqrstuvwxyz)"
    if ($clientSecret -match '^GOCSPX-[a-zA-Z0-9_-]+$') {
        break
    } else {
        Write-Host "Invalid Client Secret format. Please try again." -ForegroundColor Red
    }
} while ($true)

# Create credentials file
$credentialsContent = @"
// OAuth Configuration for TrackHub Chrome Extension
// SECURITY: This file contains sensitive credentials and is in .gitignore

export const OAUTH_CONFIG = {
  google: {
    clientId: '$clientId',
    clientSecret: '$clientSecret',
    scopes: ['openid', 'email', 'profile'],
    redirectUri: chrome.identity ? chrome.identity.getRedirectURL() : 'http://localhost:3000'
  },
  endpoints: {
    auth: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    userInfo: 'https://www.googleapis.com/oauth2/v2/userinfo'
  },
  storageKeys: {
    accessToken: 'trackhub_access_token',
    refreshToken: 'trackhub_refresh_token',
    userInfo: 'trackhub_user_info',
    tokenExpiry: 'trackhub_token_expiry'
  }
};

// OAuth Manager Class (same as template)
export class OAuthManager {
  constructor() {
    this.config = OAUTH_CONFIG;
  }

  generateAuthUrl() {
    const params = new URLSearchParams({
      client_id: this.config.google.clientId,
      redirect_uri: this.config.google.redirectUri,
      response_type: 'code',
      scope: this.config.google.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });
    return `${this.config.endpoints.auth}?${params.toString()}`;
  }

  async launchAuthFlow() {
    try {
      const authUrl = this.generateAuthUrl();
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      if (!code) {
        throw new Error('No authorization code received');
      }
      return code;
    } catch (error) {
      console.error('OAuth flow error:', error);
      throw error;
    }
  }

  async exchangeCodeForTokens(code) {
    try {
      const response = await fetch(this.config.endpoints.token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.google.clientId,
          client_secret: this.config.google.clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.google.redirectUri
        })
      });
      if (!response.ok) {
        throw new Error('Failed to exchange code for tokens');
      }
      return await response.json();
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  async getUserInfo(accessToken) {
    try {
      const response = await fetch(this.config.endpoints.userInfo, {
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
        [this.config.storageKeys.refreshToken]: tokens.refresh_token,
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
        this.config.storageKeys.refreshToken,
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
      
      return Date.now() < expiry;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async clearTokens() {
    try {
      await chrome.storage.local.remove([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.refreshToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry
      ]);
    } catch (error) {
      console.error('Clear tokens error:', error);
      throw error;
    }
  }

  async authenticate() {
    try {
      // Check if we already have a valid token
      if (await this.isTokenValid()) {
        const tokens = await this.getStoredTokens();
        return tokens[this.config.storageKeys.userInfo];
      }

      // Launch OAuth flow
      const code = await this.launchAuthFlow();
      const tokens = await this.exchangeCodeForTokens(code);
      const userInfo = await this.getUserInfo(tokens.access_token);
      
      // Store tokens
      await this.storeTokens(tokens, userInfo);
      
      return userInfo;
    } catch (error) {
      console.error('Authentication error:', error);
      throw error;
    }
  }
}
"@

# Ensure config directory exists
if (!(Test-Path "config")) {
    New-Item -ItemType Directory -Path "config" | Out-Null
}

# Write credentials file
$credentialsContent | Out-File -FilePath $credentialsFile -Encoding UTF8

Write-Host "`nOAuth credentials configured successfully!" -ForegroundColor Green
Write-Host "Credentials saved to: $credentialsFile" -ForegroundColor Cyan
Write-Host "This file is protected by .gitignore and will NOT be committed to Git" -ForegroundColor Yellow

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Load your extension in Chrome (chrome://extensions/)" -ForegroundColor White
Write-Host "2. Get your Extension ID using get_extension_id.html" -ForegroundColor White
Write-Host "3. Configure Google OAuth with your Extension ID" -ForegroundColor White
Write-Host "4. Test the OAuth flow in your extension" -ForegroundColor White

Write-Host "`nYou're ready to go!" -ForegroundColor Green
