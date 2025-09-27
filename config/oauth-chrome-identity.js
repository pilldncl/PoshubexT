// Chrome Extension OAuth using Chrome Identity API (Recommended)
// This approach is more secure and doesn't require client secrets

// OAuth Configuration for Chrome Identity API
const OAUTH_CONFIG = {
  google: {
    // Only Client ID needed - no client secret required!
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    scopes: ['openid', 'email', 'profile'],
    // Chrome Identity API handles redirect URI automatically
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

  async clearCookies() {
    try {
      // Clear any Google-related cookies
      await chrome.cookies.remove({
        url: 'https://accounts.google.com',
        name: 'SAPISID'
      });
    } catch (error) {
      // Ignore cookie clearing errors
      console.log('Cookie clearing not available or not needed');
    }
  }

  // Get current user info without re-authentication
  async getCurrentUser() {
    try {
      const tokens = await this.getStoredTokens();
      return tokens[this.config.storageKeys.userInfo] || null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    return await this.isTokenValid();
  }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OAUTH_CONFIG, ChromeIdentityOAuthManager };
}
