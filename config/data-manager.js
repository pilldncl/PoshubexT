// Data Manager for TrackHub - Handles data flow from authentication to UI
// This is what "pulls the data up" from authentication

import { UnifiedAuthManager, AUTH_TYPES } from './unified-auth-manager.js';

export class DataManager {
  constructor() {
    this.authManager = new UnifiedAuthManager();
    this.currentUser = null;
    this.userData = null;
    this.trackingItems = [];
    this.syncStatus = 'idle'; // 'idle', 'syncing', 'success', 'error'
  }

  // Main data initialization - this is what "pulls the data up"
  async initializeUserData() {
    try {
      console.log('Initializing user data...');
      
      // Step 1: Check authentication status
      const authStatus = await this.authManager.getCurrentAuthStatus();
      console.log('Auth status:', authStatus);
      
      if (!authStatus.isAuthenticated) {
        console.log('User not authenticated');
        return { authenticated: false, user: null, data: null };
      }

      // Step 2: Get user information
      this.currentUser = authStatus.user;
      console.log('Current user:', this.currentUser);

      // Step 3: Load user-specific data
      await this.loadUserData();
      
      // Step 4: Load tracking items
      await this.loadTrackingItems();
      
      // Step 5: Sync with backend if needed
      await this.syncWithBackend();

      return {
        authenticated: true,
        user: this.currentUser,
        data: this.userData,
        trackingItems: this.trackingItems,
        authType: authStatus.authType
      };

    } catch (error) {
      console.error('Error initializing user data:', error);
      throw error;
    }
  }

  // Load user-specific data based on authentication type
  async loadUserData() {
    try {
      const authStatus = await this.authManager.getCurrentAuthStatus();
      
      switch (authStatus.authType) {
        case AUTH_TYPES.CHROME_IDENTITY:
          this.userData = await this.loadChromeIdentityData();
          break;
          
        case AUTH_TYPES.CUSTOM_OAUTH:
          this.userData = await this.loadCustomOAuthData();
          break;
          
        case AUTH_TYPES.CUSTOM_CREDENTIALS:
          this.userData = await this.loadCustomCredentialsData();
          break;
          
        default:
          this.userData = await this.loadLocalData();
      }
      
      console.log('User data loaded:', this.userData);
      return this.userData;
      
    } catch (error) {
      console.error('Error loading user data:', error);
      throw error;
    }
  }

  // Load data for Chrome Identity users
  async loadChromeIdentityData() {
    try {
      // Get stored tokens
      const tokens = await this.authManager.chromeIdentityAuth.getStoredTokens();
      
      // Get user info from tokens
      const userInfo = tokens[this.authManager.chromeIdentityAuth.config.storageKeys.userInfo];
      
      // Get additional user data from Chrome storage
      const additionalData = await chrome.storage.local.get([
        'userPreferences',
        'userSettings',
        'lastSyncTime'
      ]);
      
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        authType: 'chrome_identity',
        preferences: additionalData.userPreferences || {},
        settings: additionalData.userSettings || {},
        lastSyncTime: additionalData.lastSyncTime || null,
        tokenInfo: {
          accessToken: tokens[this.authManager.chromeIdentityAuth.config.storageKeys.accessToken],
          tokenExpiry: tokens[this.authManager.chromeIdentityAuth.config.storageKeys.tokenExpiry]
        }
      };
      
    } catch (error) {
      console.error('Error loading Chrome Identity data:', error);
      throw error;
    }
  }

  // Load data for Custom OAuth users
  async loadCustomOAuthData() {
    try {
      // Get stored tokens
      const tokens = await this.authManager.customOAuthAuth.getStoredTokens();
      
      // Get user info from tokens
      const userInfo = tokens[this.authManager.customOAuthAuth.config.storageKeys.userInfo];
      
      // Get additional user data from Chrome storage
      const additionalData = await chrome.storage.local.get([
        'userPreferences',
        'userSettings',
        'lastSyncTime'
      ]);
      
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        authType: 'custom_oauth',
        preferences: additionalData.userPreferences || {},
        settings: additionalData.userSettings || {},
        lastSyncTime: additionalData.lastSyncTime || null,
        tokenInfo: {
          accessToken: tokens[this.authManager.customOAuthAuth.config.storageKeys.accessToken],
          refreshToken: tokens[this.authManager.customOAuthAuth.config.storageKeys.refreshToken],
          tokenExpiry: tokens[this.authManager.customOAuthAuth.config.storageKeys.tokenExpiry]
        }
      };
      
    } catch (error) {
      console.error('Error loading Custom OAuth data:', error);
      throw error;
    }
  }

  // Load data for Custom Credentials users
  async loadCustomCredentialsData() {
    try {
      // Get stored tokens
      const tokens = await this.authManager.customCredentialsAuth.getStoredTokens();
      
      // Get user info from tokens
      const userInfo = tokens[this.authManager.customCredentialsAuth.config.storageKeys.userInfo];
      
      // Get additional user data from Chrome storage
      const additionalData = await chrome.storage.local.get([
        'userPreferences',
        'userSettings',
        'lastSyncTime'
      ]);
      
      return {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        authType: 'custom_credentials',
        preferences: additionalData.userPreferences || {},
        settings: additionalData.userSettings || {},
        lastSyncTime: additionalData.lastSyncTime || null,
        tokenInfo: {
          accessToken: tokens[this.authManager.customCredentialsAuth.config.storageKeys.accessToken],
          refreshToken: tokens[this.authManager.customCredentialsAuth.config.storageKeys.refreshToken],
          tokenExpiry: tokens[this.authManager.customCredentialsAuth.config.storageKeys.tokenExpiry]
        }
      };
      
    } catch (error) {
      console.error('Error loading Custom Credentials data:', error);
      throw error;
    }
  }

  // Load data from local storage (fallback)
  async loadLocalData() {
    try {
      const result = await chrome.storage.local.get([
        'user',
        'userPreferences',
        'userSettings',
        'lastSyncTime'
      ]);
      
      return {
        id: result.user?.id || 'local_user',
        email: result.user?.email || 'local@example.com',
        name: result.user?.name || 'Local User',
        picture: result.user?.picture || null,
        authType: 'local',
        preferences: result.userPreferences || {},
        settings: result.userSettings || {},
        lastSyncTime: result.lastSyncTime || null,
        tokenInfo: null
      };
      
    } catch (error) {
      console.error('Error loading local data:', error);
      throw error;
    }
  }

  // Load tracking items from storage
  async loadTrackingItems() {
    try {
      const result = await chrome.storage.local.get(['trackingItems']);
      this.trackingItems = result.trackingItems || [];
      console.log('Tracking items loaded:', this.trackingItems.length);
      return this.trackingItems;
      
    } catch (error) {
      console.error('Error loading tracking items:', error);
      throw error;
    }
  }

  // Sync with backend if user is authenticated
  async syncWithBackend() {
    try {
      if (!this.currentUser) {
        console.log('No user authenticated, skipping sync');
        return;
      }

      this.syncStatus = 'syncing';
      console.log('Syncing with backend...');

      // Get auth token for backend requests
      const authToken = await this.getAuthToken();
      if (!authToken) {
        console.log('No auth token available, skipping sync');
        this.syncStatus = 'idle';
        return;
      }

      // Sync user data
      await this.syncUserData(authToken);
      
      // Sync tracking items
      await this.syncTrackingItems(authToken);
      
      // Update last sync time
      await chrome.storage.local.set({ lastSyncTime: Date.now() });
      
      this.syncStatus = 'success';
      console.log('Sync completed successfully');
      
    } catch (error) {
      console.error('Error syncing with backend:', error);
      this.syncStatus = 'error';
      throw error;
    }
  }

  // Get authentication token for backend requests
  async getAuthToken() {
    try {
      const authStatus = await this.authManager.getCurrentAuthStatus();
      
      if (!authStatus.isAuthenticated) {
        return null;
      }

      // Get token based on authentication type
      switch (authStatus.authType) {
        case AUTH_TYPES.CHROME_IDENTITY:
          const chromeTokens = await this.authManager.chromeIdentityAuth.getStoredTokens();
          return chromeTokens[this.authManager.chromeIdentityAuth.config.storageKeys.accessToken];
          
        case AUTH_TYPES.CUSTOM_OAUTH:
          const customTokens = await this.authManager.customOAuthAuth.getStoredTokens();
          return customTokens[this.authManager.customOAuthAuth.config.storageKeys.accessToken];
          
        case AUTH_TYPES.CUSTOM_CREDENTIALS:
          const credTokens = await this.authManager.customCredentialsAuth.getStoredTokens();
          return credTokens[this.authManager.customCredentialsAuth.config.storageKeys.accessToken];
          
        default:
          return null;
      }
      
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Sync user data with backend
  async syncUserData(authToken) {
    try {
      // This would make API calls to your backend
      // For now, just log what would happen
      console.log('Syncing user data with backend:', {
        user: this.currentUser,
        token: authToken ? 'present' : 'missing'
      });
      
      // Example API call:
      // const response = await fetch('https://your-backend.com/api/user/sync', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${authToken}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify(this.userData)
      // });
      
    } catch (error) {
      console.error('Error syncing user data:', error);
      throw error;
    }
  }

  // Sync tracking items with backend
  async syncTrackingItems(authToken) {
    try {
      // This would make API calls to your backend
      // For now, just log what would happen
      console.log('Syncing tracking items with backend:', {
        count: this.trackingItems.length,
        token: authToken ? 'present' : 'missing'
      });
      
      // Example API call:
      // const response = await fetch('https://your-backend.com/api/tracking/sync', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${authToken}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify(this.trackingItems)
      // });
      
    } catch (error) {
      console.error('Error syncing tracking items:', error);
      throw error;
    }
  }

  // Update user data
  async updateUserData(updates) {
    try {
      // Update local data
      this.userData = { ...this.userData, ...updates };
      
      // Save to Chrome storage
      await chrome.storage.local.set({
        userPreferences: this.userData.preferences,
        userSettings: this.userData.settings
      });
      
      // Sync with backend if authenticated
      if (this.currentUser) {
        const authToken = await this.getAuthToken();
        if (authToken) {
          await this.syncUserData(authToken);
        }
      }
      
      console.log('User data updated:', updates);
      
    } catch (error) {
      console.error('Error updating user data:', error);
      throw error;
    }
  }

  // Add tracking item
  async addTrackingItem(trackingItem) {
    try {
      // Add to local storage
      this.trackingItems.push(trackingItem);
      await chrome.storage.local.set({ trackingItems: this.trackingItems });
      
      // Sync with backend if authenticated
      if (this.currentUser) {
        const authToken = await this.getAuthToken();
        if (authToken) {
          await this.syncTrackingItems(authToken);
        }
      }
      
      console.log('Tracking item added:', trackingItem);
      
    } catch (error) {
      console.error('Error adding tracking item:', error);
      throw error;
    }
  }

  // Remove tracking item
  async removeTrackingItem(itemId) {
    try {
      // Remove from local storage
      this.trackingItems = this.trackingItems.filter(item => item.id !== itemId);
      await chrome.storage.local.set({ trackingItems: this.trackingItems });
      
      // Sync with backend if authenticated
      if (this.currentUser) {
        const authToken = await this.getAuthToken();
        if (authToken) {
          await this.syncTrackingItems(authToken);
        }
      }
      
      console.log('Tracking item removed:', itemId);
      
    } catch (error) {
      console.error('Error removing tracking item:', error);
      throw error;
    }
  }

  // Get current data state
  getCurrentState() {
    return {
      user: this.currentUser,
      userData: this.userData,
      trackingItems: this.trackingItems,
      syncStatus: this.syncStatus
    };
  }

  // Clear all data (logout)
  async clearAllData() {
    try {
      // Clear authentication
      await this.authManager.logout();
      
      // Clear local data
      this.currentUser = null;
      this.userData = null;
      this.trackingItems = [];
      this.syncStatus = 'idle';
      
      // Clear Chrome storage
      await chrome.storage.local.remove([
        'user',
        'isLoggedIn',
        'userPreferences',
        'userSettings',
        'trackingItems',
        'lastSyncTime'
      ]);
      
      console.log('All data cleared');
      
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }
}

// Export for use in other files
export default DataManager;
