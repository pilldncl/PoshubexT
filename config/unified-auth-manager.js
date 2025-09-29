// Unified Authentication Manager for TrackHub
// Supports both Chrome Identity API and Custom Customer Authentication

// Authentication Types
export const AUTH_TYPES = {
  CHROME_IDENTITY: 'chrome_identity',
  CUSTOM_OAUTH: 'custom_oauth',
  CUSTOM_CREDENTIALS: 'custom_credentials'
};

// Chrome Identity Configuration (No client secret needed!)
const CHROME_IDENTITY_CONFIG = {
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', // Only client ID needed
    scopes: ['openid', 'email', 'profile']
  },
  storageKeys: {
    accessToken: 'trackhub_chrome_access_token',
    userInfo: 'trackhub_chrome_user_info',
    tokenExpiry: 'trackhub_chrome_token_expiry',
    authType: 'trackhub_auth_type'
  }
};

// Custom OAuth Configuration (For your backend)
const CUSTOM_OAUTH_CONFIG = {
  endpoints: {
    auth: 'https://your-backend.com/oauth/authorize',
    token: 'https://your-backend.com/oauth/token',
    userInfo: 'https://your-backend.com/api/user/profile'
  },
  storageKeys: {
    accessToken: 'trackhub_custom_access_token',
    refreshToken: 'trackhub_custom_refresh_token',
    userInfo: 'trackhub_custom_user_info',
    tokenExpiry: 'trackhub_custom_token_expiry',
    authType: 'trackhub_auth_type'
  }
};

// Custom Credentials Configuration (Email/Password)
const CUSTOM_CREDENTIALS_CONFIG = {
  endpoints: {
    login: 'https://your-backend.com/api/auth/login',
    register: 'https://your-backend.com/api/auth/register',
    userInfo: 'https://your-backend.com/api/user/profile'
  },
  storageKeys: {
    accessToken: 'trackhub_credentials_access_token',
    refreshToken: 'trackhub_credentials_refresh_token',
    userInfo: 'trackhub_credentials_user_info',
    tokenExpiry: 'trackhub_credentials_token_expiry',
    authType: 'trackhub_auth_type'
  }
};

// Chrome Identity Authentication Manager
class ChromeIdentityAuthManager {
  constructor() {
    this.config = CHROME_IDENTITY_CONFIG;
  }

  async authenticate() {
    try {
      // Check if we already have a valid token
      if (await this.isTokenValid()) {
        const tokens = await this.getStoredTokens();
        return {
          user: tokens[this.config.storageKeys.userInfo],
          authType: AUTH_TYPES.CHROME_IDENTITY
        };
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
      
      // Store tokens
      await this.storeTokens({
        access_token: token,
        expires_in: 3600 // Chrome Identity tokens typically last 1 hour
      }, userInfo);

      return {
        user: userInfo,
        authType: AUTH_TYPES.CHROME_IDENTITY
      };
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
        [this.config.storageKeys.tokenExpiry]: tokenExpiry,
        [this.config.storageKeys.authType]: AUTH_TYPES.CHROME_IDENTITY
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
      
      return Date.now() < (expiry - 300000); // 5-minute buffer
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async logout() {
    try {
      const tokens = await this.getStoredTokens();
      const accessToken = tokens[this.config.storageKeys.accessToken];
      
      if (accessToken) {
        await chrome.identity.removeCachedAuthToken({ token: accessToken });
      }
      
      await chrome.storage.local.remove([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry,
        this.config.storageKeys.authType
      ]);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async isAuthenticated() {
    return await this.isTokenValid();
  }
}

// Custom OAuth Authentication Manager
class CustomOAuthAuthManager {
  constructor() {
    this.config = CUSTOM_OAUTH_CONFIG;
  }

  async authenticate() {
    try {
      if (await this.isTokenValid()) {
        const tokens = await this.getStoredTokens();
        return {
          user: tokens[this.config.storageKeys.userInfo],
          authType: AUTH_TYPES.CUSTOM_OAUTH
        };
      }

      // Launch custom OAuth flow
      const code = await this.launchAuthFlow();
      const tokens = await this.exchangeCodeForTokens(code);
      const userInfo = await this.getUserInfo(tokens.access_token);
      
      await this.storeTokens(tokens, userInfo);
      
      return {
        user: userInfo,
        authType: AUTH_TYPES.CUSTOM_OAUTH
      };
    } catch (error) {
      console.error('Custom OAuth authentication error:', error);
      throw error;
    }
  }

  generateAuthUrl() {
    const params = new URLSearchParams({
      client_id: 'YOUR_CUSTOM_CLIENT_ID', // Replace with your actual client ID
      redirect_uri: chrome.identity.getRedirectURL(),
      response_type: 'code',
      scope: 'read write',
      state: 'trackhub_auth'
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
          client_id: 'YOUR_CUSTOM_CLIENT_ID',
          client_secret: 'YOUR_CUSTOM_CLIENT_SECRET', // This should be server-side only!
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: chrome.identity.getRedirectURL()
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
        [this.config.storageKeys.tokenExpiry]: tokenExpiry,
        [this.config.storageKeys.authType]: AUTH_TYPES.CUSTOM_OAUTH
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
      
      return Date.now() < (expiry - 300000);
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async logout() {
    try {
      await chrome.storage.local.remove([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.refreshToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry,
        this.config.storageKeys.authType
      ]);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async isAuthenticated() {
    return await this.isTokenValid();
  }
}

// Custom Credentials Authentication Manager
class CustomCredentialsAuthManager {
  constructor() {
    this.config = CUSTOM_CREDENTIALS_CONFIG;
  }

  async authenticate(email, password) {
    try {
      const response = await fetch(this.config.endpoints.login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const userInfo = await this.getUserInfo(data.access_token);
      
      await this.storeTokens(data, userInfo);
      
      return {
        user: userInfo,
        authType: AUTH_TYPES.CUSTOM_CREDENTIALS
      };
    } catch (error) {
      console.error('Custom credentials authentication error:', error);
      throw error;
    }
  }

  async register(email, password, name) {
    try {
      const response = await fetch(this.config.endpoints.register, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name })
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const data = await response.json();
      const userInfo = await this.getUserInfo(data.access_token);
      
      await this.storeTokens(data, userInfo);
      
      return {
        user: userInfo,
        authType: AUTH_TYPES.CUSTOM_CREDENTIALS
      };
    } catch (error) {
      console.error('Custom credentials registration error:', error);
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
        [this.config.storageKeys.tokenExpiry]: tokenExpiry,
        [this.config.storageKeys.authType]: AUTH_TYPES.CUSTOM_CREDENTIALS
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
      
      return Date.now() < (expiry - 300000);
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  async logout() {
    try {
      await chrome.storage.local.remove([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.refreshToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry,
        this.config.storageKeys.authType
      ]);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async isAuthenticated() {
    return await this.isTokenValid();
  }
}

// Unified Authentication Manager
export class UnifiedAuthManager {
  constructor() {
    this.chromeIdentityAuth = new ChromeIdentityAuthManager();
    this.customOAuthAuth = new CustomOAuthAuthManager();
    this.customCredentialsAuth = new CustomCredentialsAuthManager();
  }

  // Get current authentication status
  async getCurrentAuthStatus() {
    try {
      // Check Chrome Identity first (most secure)
      if (await this.chromeIdentityAuth.isAuthenticated()) {
        const tokens = await this.chromeIdentityAuth.getStoredTokens();
        return {
          isAuthenticated: true,
          user: tokens[this.chromeIdentityAuth.config.storageKeys.userInfo],
          authType: AUTH_TYPES.CHROME_IDENTITY,
          manager: this.chromeIdentityAuth
        };
      }

      // Check Custom OAuth
      if (await this.customOAuthAuth.isAuthenticated()) {
        const tokens = await this.customOAuthAuth.getStoredTokens();
        return {
          isAuthenticated: true,
          user: tokens[this.customOAuthAuth.config.storageKeys.userInfo],
          authType: AUTH_TYPES.CUSTOM_OAUTH,
          manager: this.customOAuthAuth
        };
      }

      // Check Custom Credentials
      if (await this.customCredentialsAuth.isAuthenticated()) {
        const tokens = await this.customCredentialsAuth.getStoredTokens();
        return {
          isAuthenticated: true,
          user: tokens[this.customCredentialsAuth.config.storageKeys.userInfo],
          authType: AUTH_TYPES.CUSTOM_CREDENTIALS,
          manager: this.customCredentialsAuth
        };
      }

      return { isAuthenticated: false };
    } catch (error) {
      console.error('Error checking auth status:', error);
      return { isAuthenticated: false };
    }
  }

  // Authenticate with Chrome Identity
  async authenticateWithChromeIdentity() {
    return await this.chromeIdentityAuth.authenticate();
  }

  // Authenticate with Custom OAuth
  async authenticateWithCustomOAuth() {
    return await this.customOAuthAuth.authenticate();
  }

  // Authenticate with Custom Credentials
  async authenticateWithCredentials(email, password) {
    return await this.customCredentialsAuth.authenticate(email, password);
  }

  // Register with Custom Credentials
  async registerWithCredentials(email, password, name) {
    return await this.customCredentialsAuth.register(email, password, name);
  }

  // Logout from current authentication
  async logout() {
    try {
      const authStatus = await this.getCurrentAuthStatus();
      if (authStatus.isAuthenticated && authStatus.manager) {
        await authStatus.manager.logout();
      }
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Get available authentication methods
  getAvailableAuthMethods() {
    return [
      {
        type: AUTH_TYPES.CHROME_IDENTITY,
        name: 'Google Account',
        description: 'Sign in with your Google account',
        icon: '🔐',
        secure: true,
        recommended: true
      },
      {
        type: AUTH_TYPES.CUSTOM_OAUTH,
        name: 'TrackHub Account',
        description: 'Sign in with your TrackHub account',
        icon: '🏢',
        secure: true,
        recommended: false
      },
      {
        type: AUTH_TYPES.CUSTOM_CREDENTIALS,
        name: 'Email & Password',
        description: 'Sign in with email and password',
        icon: '📧',
        secure: false,
        recommended: false
      }
    ];
  }
}

// Export everything
export {
  ChromeIdentityAuthManager,
  CustomOAuthAuthManager,
  CustomCredentialsAuthManager
};
