// OAuth Configuration for TrackHub Chrome Extension
// Replace the placeholder values with your actual Google OAuth credentials

export const OAUTH_CONFIG = {
  google: {
    // Replace with your actual Google Client ID from Google Cloud Console
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    clientSecret: 'YOUR_GOOGLE_CLIENT_SECRET',
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

// Helper function to get the current extension ID
export function getExtensionId() {
  return chrome.runtime.id;
}

// Helper function to get redirect URI
export function getRedirectUri() {
  return chrome.identity.getRedirectURL();
}

// OAuth Manager Class
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
