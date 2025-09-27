// TrackHub Chrome Extension - Popup Script

// OAuth Configuration using Chrome Identity API
// ⚠️  SECURITY: Only Client ID needed - no client secret required!
const OAUTH_CONFIG = {
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
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

// Chrome Identity OAuth Manager Class
class OAuthManager {
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
      return true;
    } catch (error) {
      console.error('Store tokens error:', error);
      throw error;
    }
  }

  async isAuthenticated() {
    try {
      const result = await chrome.storage.local.get([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.tokenExpiry
      ]);
      if (!result[this.config.storageKeys.accessToken]) {
        return false;
      }
      const now = Date.now();
      const expiry = result[this.config.storageKeys.tokenExpiry];
      if (now >= expiry) {
        return await this.refreshToken();
      }
      return true;
    } catch (error) {
      console.error('Check authentication error:', error);
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
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
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

  async getCurrentUser() {
    try {
      const tokens = await this.getStoredTokens();
      return tokens[this.config.storageKeys.userInfo] || null;
    } catch (error) {
      console.error('Get current user error:', error);
      return null;
    }
  }

}

class TrackHubPopup {
    constructor() {
        this.currentUser = null;
        this.trackingItems = [];
        this.oauthManager = new OAuthManager();
        this.init();
    }

    async init() {
        // Check if user is logged in
        await this.checkAuthStatus();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup message listener for background script
        this.setupMessageListener();
        
        // Load tracking items if logged in
        if (this.currentUser) {
            await this.loadTrackingItems();
        }
    }

    setupEventListeners() {
        // Google OAuth login
        document.getElementById('googleLoginBtn').addEventListener('click', (e) => {
            console.log('Google login button clicked!');
            e.preventDefault();
            this.handleGoogleLogin();
        });

        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Register button
        document.getElementById('registerBtn').addEventListener('click', () => {
            this.handleRegister();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Tracking form
        document.getElementById('trackingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddTracking();
        });

        // External webapp access
        document.getElementById('openWebappBtn').addEventListener('click', () => {
            this.openExternalWebapp();
        });

        // Sync data button
        document.getElementById('syncDataBtn').addEventListener('click', () => {
            this.syncData();
        });

        // Settings navigation
        document.getElementById('backToDashboardBtn').addEventListener('click', () => {
            this.showSection('dashboardSection');
        });
    }

    setupMessageListener() {
        // Listen for messages from background script
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === 'trackingAdded') {
                console.log('Tracking added via context menu:', request.data);
                // Refresh the tracking list
                this.loadTrackingItems();
                this.showMessage('Tracking added via context menu!', 'success');
            }
            sendResponse({ received: true });
        });
    }

    async checkAuthStatus() {
        try {
            // Check OAuth authentication first
            const isOAuthAuthenticated = await this.oauthManager.isAuthenticated();
            if (isOAuthAuthenticated) {
                this.currentUser = await this.oauthManager.getCurrentUser();
                this.updateUserInfo(this.currentUser);
                this.showSection('dashboardSection');
                return;
            }

            // Fallback to local storage authentication
            const result = await chrome.storage.local.get(['user', 'isLoggedIn']);
            if (result.isLoggedIn && result.user) {
                this.currentUser = result.user;
                this.updateUserInfo(result.user);
                this.showSection('dashboardSection');
            } else {
                this.showSection('loginSection');
            }
        } catch (error) {
            console.error('Error checking auth status:', error);
            this.showSection('loginSection');
        }
    }

    async handleGoogleLogin() {
        try {
            console.log('Starting Google OAuth flow...');
            this.showMessage('Authenticating with Google...', 'info');
            
            // Launch OAuth flow
            console.log('Launching OAuth flow...');
            const authCode = await this.oauthManager.launchAuthFlow();
            console.log('Received auth code:', authCode);
            
            // Exchange code for tokens
            console.log('Exchanging code for tokens...');
            const tokens = await this.oauthManager.exchangeCodeForTokens(authCode);
            console.log('Received tokens:', tokens);
            
            // Get user info
            console.log('Getting user info...');
            const userInfo = await this.oauthManager.getUserInfo(tokens.access_token);
            console.log('User info:', userInfo);
            
            // Store tokens and user info
            console.log('Storing tokens...');
            await this.oauthManager.storeTokens(tokens, userInfo);
            
            // Update current user
            this.currentUser = userInfo;
            
            // Update UI with user info
            this.updateUserInfo(userInfo);
            
            // Show dashboard
            this.showSection('dashboardSection');
            await this.loadTrackingItems();
            this.showMessage('Successfully authenticated with Google!', 'success');
            
        } catch (error) {
            console.error('Google OAuth error:', error);
            this.showMessage(`Google authentication failed: ${error.message}`, 'error');
        }
    }

    async handleLogin() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        try {
            // Simulate login - in real implementation, this would call your API
            const user = await this.authenticateUser(email, password);
            
            if (user) {
                this.currentUser = user;
                await chrome.storage.local.set({
                    user: user,
                    isLoggedIn: true
                });
                
                this.showSection('dashboardSection');
                await this.loadTrackingItems();
                this.showMessage('Login successful!', 'success');
            } else {
                this.showMessage('Invalid credentials', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    async handleRegister() {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            this.showMessage('Please fill in all fields', 'error');
            return;
        }

        try {
            // Simulate registration - in real implementation, this would call your API
            const user = await this.registerUser(email, password);
            
            if (user) {
                this.currentUser = user;
                await chrome.storage.local.set({
                    user: user,
                    isLoggedIn: true
                });
                
                this.showSection('dashboardSection');
                this.showMessage('Registration successful!', 'success');
            } else {
                this.showMessage('Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    async handleLogout() {
        try {
            // Logout from OAuth if authenticated
            if (await this.oauthManager.isAuthenticated()) {
                await this.oauthManager.logout();
            }
            
            // Clear local storage
            await chrome.storage.local.remove(['user', 'isLoggedIn']);
            this.currentUser = null;
            this.trackingItems = [];
            this.showSection('loginSection');
            this.showMessage('Logged out successfully', 'info');
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    async handleAddTracking() {
        const trackingNumber = document.getElementById('trackingNumber').value;
        const brand = document.getElementById('brand').value;
        const description = document.getElementById('description').value;

        if (!trackingNumber || !brand) {
            this.showMessage('Please fill in tracking number and brand', 'error');
            return;
        }

        try {
            const trackingItem = {
                id: Date.now().toString(),
                trackingNumber: trackingNumber.trim(),
                brand: brand,
                description: description.trim(),
                dateAdded: new Date().toISOString(),
                status: 'pending'
            };

            // Add to local storage
            this.trackingItems.push(trackingItem);
            await this.saveTrackingItems();

            // Send to background script for external webapp sync
            chrome.runtime.sendMessage({
                action: 'addTracking',
                data: trackingItem
            });

            // Clear form
            document.getElementById('trackingForm').reset();
            
            // Refresh display
            await this.loadTrackingItems();
            this.showMessage('Tracking added successfully!', 'success');
        } catch (error) {
            console.error('Error adding tracking:', error);
            this.showMessage('Failed to add tracking', 'error');
        }
    }

    async loadTrackingItems() {
        try {
            const result = await chrome.storage.local.get(['trackingItems']);
            this.trackingItems = result.trackingItems || [];
            this.displayTrackingItems();
        } catch (error) {
            console.error('Error loading tracking items:', error);
        }
    }

    displayTrackingItems() {
        const container = document.getElementById('trackingItems');
        const countElement = document.getElementById('trackingCount');
        container.innerHTML = '';

        // Update count
        const count = this.trackingItems.length;
        countElement.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;

        if (this.trackingItems.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <h3>No tracking items yet</h3>
                    <p>Add your first tracking number above to get started!</p>
                </div>
            `;
            return;
        }

        this.trackingItems.forEach(item => {
            const itemElement = document.createElement('div');
            itemElement.className = 'tracking-item';
            itemElement.innerHTML = `
                <div class="tracking-info">
                    <div class="tracking-number">${item.trackingNumber}</div>
                    <div class="tracking-brand">${item.brand.toUpperCase()}</div>
                    ${item.description ? `<div class="tracking-description">${item.description}</div>` : ''}
                </div>
                <div class="tracking-actions">
                    <button class="btn-icon track-btn" data-item-id="${item.id}" title="Track Package">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                            <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                            <line x1="12" y1="22.08" x2="12" y2="12"/>
                        </svg>
                    </button>
                    <button class="btn-icon copy-btn" data-tracking-number="${item.trackingNumber}" title="Copy">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <button class="btn-icon delete-btn" data-item-id="${item.id}" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3,6 5,6 21,6"/>
                            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                            <line x1="10" y1="11" x2="10" y2="17"/>
                            <line x1="14" y1="11" x2="14" y2="17"/>
                        </svg>
                    </button>
                </div>
            `;
            container.appendChild(itemElement);
        });

        // Add event listeners for the action buttons
        this.addTrackingItemEventListeners();
    }

    addTrackingItemEventListeners() {
        // Track button event listeners
        document.querySelectorAll('.track-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.getAttribute('data-item-id');
                this.trackPackage(itemId);
            });
        });

        // Copy button event listeners
        document.querySelectorAll('.copy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const trackingNumber = button.getAttribute('data-tracking-number');
                this.copyTracking(trackingNumber);
            });
        });

        // Delete button event listeners
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.getAttribute('data-item-id');
                console.log('Delete button clicked for item:', itemId);
                this.deleteTracking(itemId);
            });
        });
    }

    async trackPackage(itemId) {
        const item = this.trackingItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            // Open tracking URL based on brand
            const trackingUrl = this.getTrackingUrl(item.brand, item.trackingNumber);
            if (trackingUrl) {
                chrome.tabs.create({ url: trackingUrl });
            } else {
                this.showMessage('Tracking URL not available for this carrier', 'error');
            }
        } catch (error) {
            console.error('Error opening tracking:', error);
        }
    }

    async copyTracking(trackingNumber) {
        try {
            await navigator.clipboard.writeText(trackingNumber);
            this.showMessage('Tracking number copied!', 'success');
        } catch (error) {
            console.error('Error copying tracking number:', error);
        }
    }

    async deleteTracking(itemId) {
        try {
            console.log('deleteTracking called with itemId:', itemId);
            console.log('Current tracking items:', this.trackingItems);
            
            // Find the item to delete
            const itemToDelete = this.trackingItems.find(item => item.id === itemId);
            console.log('Item to delete:', itemToDelete);
            
            if (!itemToDelete) {
                console.error('Tracking item not found for ID:', itemId);
                this.showMessage('Tracking item not found', 'error');
                return;
            }

            console.log('Showing delete confirmation dialog...');
            // Show confirmation dialog
            const confirmed = await this.showDeleteConfirmation(itemToDelete);
            console.log('Delete confirmation result:', confirmed);
            
            if (!confirmed) {
                console.log('User cancelled delete operation');
                return; // User cancelled
            }

            // Remove from local storage
            this.trackingItems = this.trackingItems.filter(item => item.id !== itemId);
            await this.saveTrackingItems();

            // Send delete request to external backend (optional)
            try {
                await this.deleteFromBackend(itemToDelete);
            } catch (error) {
                console.log('Backend delete failed, continuing with local deletion');
            }

            // Refresh the UI
            await this.loadTrackingItems();
            this.showMessage('Tracking item deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting tracking item:', error);
            this.showMessage('Failed to delete tracking item', 'error');
        }
    }

    async showDeleteConfirmation(item) {
        return new Promise((resolve) => {
            // Create confirmation dialog
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;

            dialog.innerHTML = `
                <div style="
                    background: white;
                    border-radius: 12px;
                    padding: 24px;
                    max-width: 400px;
                    width: 90%;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                ">
                    <div style="
                        display: flex;
                        align-items: center;
                        margin-bottom: 16px;
                    ">
                        <div style="
                            width: 40px;
                            height: 40px;
                            background: #fef2f2;
                            border-radius: 50%;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            margin-right: 12px;
                        ">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </div>
                        <h3 style="
                            margin: 0;
                            font-size: 18px;
                            font-weight: 600;
                            color: #1f2937;
                        ">Delete Tracking Item</h3>
                    </div>
                    <p style="
                        margin: 0 0 20px 0;
                        color: #6b7280;
                        line-height: 1.5;
                    ">Are you sure you want to delete this tracking item?</p>
                    <div style="
                        background: #f9fafb;
                        border: 1px solid #e5e7eb;
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 20px;
                    ">
                        <div style="
                            font-weight: 600;
                            color: #1f2937;
                            margin-bottom: 4px;
                        ">${item.trackingNumber}</div>
                        <div style="
                            font-size: 14px;
                            color: #6b7280;
                        ">${item.brand.toUpperCase()}</div>
                        ${item.description ? `<div style="font-size: 14px; color: #6b7280; margin-top: 4px;">${item.description}</div>` : ''}
                    </div>
                    <div style="
                        display: flex;
                        gap: 12px;
                        justify-content: flex-end;
                    ">
                        <button id="cancelDelete" style="
                            padding: 10px 20px;
                            border: 1px solid #d1d5db;
                            background: white;
                            color: #374151;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 500;
                            transition: all 0.2s;
                        ">Cancel</button>
                        <button id="confirmDelete" style="
                            padding: 10px 20px;
                            border: none;
                            background: #dc2626;
                            color: white;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 500;
                            transition: all 0.2s;
                        ">Delete</button>
                    </div>
                </div>
            `;

            document.body.appendChild(dialog);

            // Add event listeners
            const cancelBtn = dialog.querySelector('#cancelDelete');
            const confirmBtn = dialog.querySelector('#confirmDelete');

            cancelBtn.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(false);
            });

            confirmBtn.addEventListener('click', () => {
                document.body.removeChild(dialog);
                resolve(true);
            });

            // Close on backdrop click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) {
                    document.body.removeChild(dialog);
                    resolve(false);
                }
            });

            // Close on Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    document.body.removeChild(dialog);
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    async deleteFromBackend(item) {
        try {
            console.log('Attempting to delete from backend:', item);
            
            // Check if backend API is configured
            const backendUrl = 'https://your-backend-api.com'; // This will be updated when backend is ready
            if (backendUrl === 'https://your-backend-api.com') {
                console.log('Backend API not configured yet, skipping backend delete');
                return false; // Backend not ready, just do local deletion
            }
            
            // Get auth token
            const token = await this.getAuthToken();
            if (!token) {
                console.log('No auth token available, skipping backend delete');
                return false;
            }
            
            // Send delete request to external backend
            const response = await fetch(`${backendUrl}/api/tracking/delete`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Extension-Version': '1.0.0'
                },
                body: JSON.stringify({
                    trackingId: item.id,
                    trackingNumber: item.trackingNumber,
                    brand: item.brand,
                    description: item.description
                })
            });

            if (!response.ok) {
                throw new Error(`Backend delete failed: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log('Successfully deleted from backend:', result);
            return true;
        } catch (error) {
            console.error('Error deleting from backend:', error);
            // Don't throw error - allow local deletion even if backend fails
            return false;
        }
    }

    async getAuthToken() {
        try {
            // Try to get OAuth token first
            const oauthResult = await chrome.storage.local.get(['trackhub_access_token']);
            if (oauthResult.trackhub_access_token) {
                return oauthResult.trackhub_access_token;
            }

            // Fallback to local auth token
            const localResult = await chrome.storage.local.get(['authToken']);
            return localResult.authToken || null;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }

    getTrackingUrl(brand, trackingNumber) {
        const urls = {
            'ups': `https://www.ups.com/track?trackingNumber=${trackingNumber}`,
            'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
            'usps': `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`,
            'dhl': `https://www.dhl.com/tracking?trackingNumber=${trackingNumber}`,
            'amazon': `https://www.amazon.com/progress-tracker/package/${trackingNumber}`
        };
        return urls[brand.toLowerCase()] || null;
    }

    async openExternalWebapp() {
        try {
            // Open the main webapp - replace with your actual webapp URL
            const webappUrl = 'https://your-webapp-url.com'; // Replace with actual URL
            chrome.tabs.create({ url: webappUrl });
        } catch (error) {
            console.error('Error opening webapp:', error);
            this.showMessage('Failed to open webapp', 'error');
        }
    }

    async syncData() {
        try {
            // Send all tracking data to external webapp
            chrome.runtime.sendMessage({
                action: 'syncAllData',
                data: this.trackingItems
            });
            this.showMessage('Data sync initiated', 'info');
        } catch (error) {
            console.error('Error syncing data:', error);
            this.showMessage('Sync failed', 'error');
        }
    }

    async saveTrackingItems() {
        try {
            await chrome.storage.local.set({ trackingItems: this.trackingItems });
        } catch (error) {
            console.error('Error saving tracking items:', error);
        }
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show target section
        document.getElementById(sectionId).classList.remove('hidden');
    }

    updateUserInfo(userInfo) {
        const userEmailElement = document.getElementById('userEmail');
        if (userEmailElement && userInfo) {
            userEmailElement.textContent = userInfo.email || userInfo.name || 'User';
        }
    }

    showMessage(message, type) {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.status-message');
        existingMessages.forEach(msg => msg.remove());

        // Create new message
        const messageElement = document.createElement('div');
        messageElement.className = `status-message status-${type}`;
        messageElement.textContent = message;

        // Insert at top of current section
        const currentSection = document.querySelector('.section:not(.hidden)');
        currentSection.insertBefore(messageElement, currentSection.firstChild);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            messageElement.remove();
        }, 3000);
    }

    // Simulated authentication methods - replace with real API calls
    async authenticateUser(email, password) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simple validation for demo
        if (email.includes('@') && password.length >= 6) {
            return {
                id: Date.now().toString(),
                email: email,
                name: email.split('@')[0]
            };
        }
        return null;
    }

    async registerUser(email, password) {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Simple validation for demo
        if (email.includes('@') && password.length >= 6) {
            return {
                id: Date.now().toString(),
                email: email,
                name: email.split('@')[0]
            };
        }
        return null;
    }
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.trackHubPopup = new TrackHubPopup();
});
