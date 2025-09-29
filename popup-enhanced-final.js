// Enhanced TrackHub Chrome Extension - Popup Script
// Includes editable states, carrier detection, and unified authentication

// OAuth Configuration using Chrome Identity API (Recommended)
const OAUTH_CONFIG = {
  google: {
    clientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    scopes: ['openid', 'email', 'profile'],
    redirectUri: chrome.identity ? chrome.identity.getRedirectURL() : 'http://localhost:3000'
  },
  storageKeys: {
    accessToken: 'trackhub_access_token',
    userInfo: 'trackhub_user_info',
    tokenExpiry: 'trackhub_token_expiry'
  }
};

// Enhanced OAuth Manager with Chrome Identity API
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
      
      // Store tokens
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

// Enhanced Tracking State Manager
class TrackingStateManager {
  constructor() {
    this.editingItems = new Set();
    this.carrierPatterns = this.initializeCarrierPatterns();
  }

  initializeCarrierPatterns() {
    return {
      ups: [
        { pattern: /^1Z[0-9A-Z]{16}$/, confidence: 'high' },
        { pattern: /^[0-9]{10,}$/, confidence: 'medium' },
        { pattern: /^T[0-9]{10}$/, confidence: 'high' }
      ],
      fedex: [
        { pattern: /^[0-9]{12}$/, confidence: 'high' },
        { pattern: /^[0-9]{14}$/, confidence: 'high' },
        { pattern: /^[0-9]{15}$/, confidence: 'high' },
        { pattern: /^[0-9]{20}$/, confidence: 'high' }
      ],
      usps: [
        { pattern: /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/, confidence: 'high' },
        { pattern: /^[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/, confidence: 'high' },
        { pattern: /^[0-9]{20}$/, confidence: 'medium' }
      ],
      dhl: [
        { pattern: /^[0-9]{10,11}$/, confidence: 'medium' },
        { pattern: /^[0-9]{12}$/, confidence: 'medium' }
      ],
      amazon: [
        { pattern: /^TBA[0-9]{10}$/, confidence: 'high' },
        { pattern: /^TBA[0-9]{12}$/, confidence: 'high' }
      ]
    };
  }

  detectCarrier(trackingNumber) {
    const number = trackingNumber.trim();
    const results = [];

    Object.entries(this.carrierPatterns).forEach(([carrier, patterns]) => {
      patterns.forEach(({ pattern, confidence }) => {
        if (pattern.test(number)) {
          results.push({ carrier, confidence });
        }
      });
    });

    results.sort((a, b) => {
      const confidenceOrder = { high: 3, medium: 2, low: 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });

    return results.length > 0 ? results[0].carrier : 'other';
  }

  getAvailableCarriers() {
    return [
      { value: 'ups', label: 'UPS', icon: '🚚' },
      { value: 'fedex', label: 'FedEx', icon: '📦' },
      { value: 'usps', label: 'USPS', icon: '📮' },
      { value: 'dhl', label: 'DHL', icon: '🌍' },
      { value: 'amazon', label: 'Amazon', icon: '📱' },
      { value: 'other', label: 'Other', icon: '📦' }
    ];
  }

  suggestCarrier(trackingNumber) {
    const detectedCarrier = this.detectCarrier(trackingNumber);
    const availableCarriers = this.getAvailableCarriers();
    const carrierInfo = availableCarriers.find(c => c.value === detectedCarrier);

    return {
      suggested: detectedCarrier,
      confidence: this.getCarrierConfidence(trackingNumber, detectedCarrier),
      carrierInfo: carrierInfo || { value: 'other', label: 'Other', icon: '📦' }
    };
  }

  getCarrierConfidence(trackingNumber, carrier) {
    const patterns = this.carrierPatterns[carrier] || [];
    const number = trackingNumber.trim();

    for (const { pattern, confidence } of patterns) {
      if (pattern.test(number)) {
        return confidence;
      }
    }
    return 'low';
  }

  validateTrackingItem(data) {
    const errors = [];

    if (!data.trackingNumber || data.trackingNumber.trim().length === 0) {
      errors.push('Tracking number is required');
    }

    if (!data.brand || data.brand.trim().length === 0) {
      errors.push('Carrier is required');
    }

    if (data.description && data.description.trim().length > 200) {
      errors.push('Description too long (max 200 characters)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  formatTrackingNumber(trackingNumber, brand) {
    const number = trackingNumber.trim();
    
    switch (brand.toLowerCase()) {
      case 'ups':
        return number.startsWith('1Z') ? number.toUpperCase() : number;
      case 'usps':
        if (number.length === 20 && !number.includes(' ')) {
          return number.replace(/(.{4})/g, '$1 ').trim();
        }
        return number;
      default:
        return number;
    }
  }

  getCarrierIcon(brand) {
    const availableCarriers = this.getAvailableCarriers();
    const carrier = availableCarriers.find(c => c.value === brand);
    return carrier ? carrier.icon : '📦';
  }

  getCarrierLabel(brand) {
    const availableCarriers = this.getAvailableCarriers();
    const carrier = availableCarriers.find(c => c.value === brand);
    return carrier ? carrier.label : 'Other';
  }

  getTrackingUrl(brand, trackingNumber) {
    const urls = {
      'ups': `https://www.ups.com/track?trackingNumber=${trackingNumber}`,
      'fedex': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
      'usps': `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${trackingNumber}`,
      'dhl': `https://www.dhl.com/tracking?trackingNumber=${trackingNumber}`,
      'amazon': `https://www.amazon.com/progress-tracker/package/${trackingNumber}`,
      'other': null
    };
    return urls[brand.toLowerCase()] || null;
  }

  isEditing(itemId) {
    return this.editingItems.has(itemId);
  }

  setEditingState(itemId, isEditing) {
    if (isEditing) {
      this.editingItems.add(itemId);
    } else {
      this.editingItems.delete(itemId);
    }
  }
}

// Enhanced TrackHub Popup with Editable States
class TrackHubPopup {
    constructor() {
        this.currentUser = null;
        this.trackingItems = [];
        this.oauthManager = new OAuthManager();
        this.stateManager = new TrackingStateManager();
        this.init();
    }

    async init() {
        try {
            console.log('Initializing enhanced TrackHub popup...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Setup message listener for background script
            this.setupMessageListener();
            
            // Check authentication status
            await this.checkAuthStatus();
            
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showMessage('Failed to initialize. Please try again.', 'error');
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

        // Auto-detect carrier when tracking number changes
        document.getElementById('trackingNumber').addEventListener('input', (e) => {
            this.handleTrackingNumberChange(e.target.value);
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

    // Handle tracking number input change for auto-detection
    handleTrackingNumberChange(trackingNumber) {
        if (!trackingNumber || trackingNumber.trim().length === 0) {
            return;
        }

        // Auto-detect carrier
        const suggestion = this.stateManager.suggestCarrier(trackingNumber);
        
        if (suggestion.confidence === 'high' || suggestion.confidence === 'medium') {
            // Auto-select the detected carrier
            const brandSelect = document.getElementById('brand');
            brandSelect.value = suggestion.suggested;
            
            // Show suggestion to user
            this.showMessage(`Detected ${suggestion.carrierInfo.label} carrier`, 'info');
        }
    }

    async checkAuthStatus() {
        try {
            // Check OAuth authentication first
            const isOAuthAuthenticated = await this.oauthManager.isAuthenticated();
            if (isOAuthAuthenticated) {
                this.currentUser = await this.oauthManager.getCurrentUser();
                this.updateUserInfo(this.currentUser);
                this.showSection('dashboardSection');
                await this.loadTrackingItems();
                return;
            }

            // Fallback to local storage authentication
            const result = await chrome.storage.local.get(['user', 'isLoggedIn']);
            if (result.isLoggedIn && result.user) {
                this.currentUser = result.user;
                this.updateUserInfo(result.user);
                this.showSection('dashboardSection');
                await this.loadTrackingItems();
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
            
            // Use Chrome Identity API
            const userInfo = await this.oauthManager.authenticate();
            
            console.log('Google authentication successful:', userInfo);
            
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
            // Validate the tracking item data
            const validation = this.stateManager.validateTrackingItem({
                trackingNumber,
                brand,
                description
            });

            if (!validation.valid) {
                this.showMessage(`Validation error: ${validation.errors.join(', ')}`, 'error');
                return;
            }

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
            itemElement.setAttribute('data-item-id', item.id);
            itemElement.innerHTML = `
                <div class="tracking-item-locked">
                    <div class="tracking-info">
                        <div class="tracking-number">${this.stateManager.formatTrackingNumber(item.trackingNumber, item.brand)}</div>
                        <div class="tracking-brand">${this.stateManager.getCarrierIcon(item.brand)} ${this.stateManager.getCarrierLabel(item.brand)}</div>
                        ${item.description ? `<div class="tracking-description">${item.description}</div>` : ''}
                    </div>
                    <div class="tracking-actions">
                        <button class="btn-icon track-btn" title="Track Package">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                                <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
                                <line x1="12" y1="22.08" x2="12" y2="12"/>
                            </svg>
                        </button>
                        <button class="btn-icon copy-btn" title="Copy">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                            </svg>
                        </button>
                        <button class="btn-icon edit-btn" title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                        <button class="btn-icon delete-btn" title="Delete">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3,6 5,6 21,6"/>
                                <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
                                <line x1="10" y1="11" x2="10" y2="17"/>
                                <line x1="14" y1="11" x2="14" y2="17"/>
                            </svg>
                        </button>
                    </div>
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
                const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
                this.trackPackage(itemId);
            });
        });

        // Copy button event listeners
        document.querySelectorAll('.copy-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
                const item = this.trackingItems.find(i => i.id === itemId);
                if (item) {
                    this.copyTracking(item.trackingNumber);
                }
            });
        });

        // Edit button event listeners
        document.querySelectorAll('.edit-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
                this.enterEditMode(itemId);
            });
        });

        // Delete button event listeners
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
                this.deleteTracking(itemId);
            });
        });
    }

    // Enter edit mode for a tracking item
    enterEditMode(itemId) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!itemElement) return;

        const item = this.trackingItems.find(i => i.id === itemId);
        if (!item) return;

        // Create editable form
        const editableForm = document.createElement('div');
        editableForm.className = 'tracking-item-editable';
        editableForm.innerHTML = `
            <div class="edit-form">
                <div class="form-row">
                    <div class="input-group">
                        <label>Tracking Number</label>
                        <input type="text" class="edit-tracking-number" value="${item.trackingNumber}" required>
                    </div>
                    <div class="input-group">
                        <label>Carrier</label>
                        <select class="edit-brand" required>
                            <option value="">Select Carrier</option>
                            <option value="ups" ${item.brand === 'ups' ? 'selected' : ''}>🚚 UPS</option>
                            <option value="fedex" ${item.brand === 'fedex' ? 'selected' : ''}>📦 FedEx</option>
                            <option value="usps" ${item.brand === 'usps' ? 'selected' : ''}>📮 USPS</option>
                            <option value="dhl" ${item.brand === 'dhl' ? 'selected' : ''}>🌍 DHL</option>
                            <option value="amazon" ${item.brand === 'amazon' ? 'selected' : ''}>📱 Amazon</option>
                            <option value="other" ${item.brand === 'other' ? 'selected' : ''}>📦 Other</option>
                        </select>
                    </div>
                </div>
                <div class="input-group">
                    <label>Description</label>
                    <input type="text" class="edit-description" value="${item.description || ''}" placeholder="Package description">
                </div>
                <div class="edit-actions">
                    <button class="btn btn-primary btn-small save-btn">Save</button>
                    <button class="btn btn-secondary btn-small cancel-btn">Cancel</button>
                </div>
            </div>
        `;

        // Replace locked state with editable state
        const lockedState = itemElement.querySelector('.tracking-item-locked');
        lockedState.style.display = 'none';
        itemElement.appendChild(editableForm);

        // Add event listeners for save/cancel
        editableForm.querySelector('.save-btn').addEventListener('click', () => {
            this.saveTrackingItem(itemId);
        });

        editableForm.querySelector('.cancel-btn').addEventListener('click', () => {
            this.cancelEdit(itemId);
        });

        // Set editing state
        this.stateManager.setEditingState(itemId, true);
        
        // Focus on tracking number input
        const trackingInput = editableForm.querySelector('.edit-tracking-number');
        if (trackingInput) {
            trackingInput.focus();
            trackingInput.select();
        }
    }

    // Cancel edit mode
    cancelEdit(itemId) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!itemElement) return;

        // Remove editable state
        const editableState = itemElement.querySelector('.tracking-item-editable');
        if (editableState) {
            editableState.remove();
        }

        // Show locked state
        const lockedState = itemElement.querySelector('.tracking-item-locked');
        lockedState.style.display = 'flex';

        // Clear editing state
        this.stateManager.setEditingState(itemId, false);
    }

    // Save tracking item changes
    async saveTrackingItem(itemId) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!itemElement) return;

        try {
            // Get form data
            const editableState = itemElement.querySelector('.tracking-item-editable');
            const trackingNumber = editableState.querySelector('.edit-tracking-number').value;
            const brand = editableState.querySelector('.edit-brand').value;
            const description = editableState.querySelector('.edit-description').value;

            // Validate the data
            const validation = this.stateManager.validateTrackingItem({
                trackingNumber,
                brand,
                description
            });

            if (!validation.valid) {
                this.showMessage(`Validation error: ${validation.errors.join(', ')}`, 'error');
                return;
            }

            // Update the item
            const item = this.trackingItems.find(i => i.id === itemId);
            if (item) {
                item.trackingNumber = trackingNumber.trim();
                item.brand = brand;
                item.description = description.trim();
                item.updatedAt = new Date().toISOString();

                // Save to storage
                await this.saveTrackingItems();

                // Exit edit mode
                this.cancelEdit(itemId);

                // Refresh the display
                await this.loadTrackingItems();
                this.showMessage('Tracking item updated successfully!', 'success');
            }

        } catch (error) {
            console.error('Error saving tracking item:', error);
            this.showMessage('Failed to save changes', 'error');
        }
    }

    async trackPackage(itemId) {
        const item = this.trackingItems.find(i => i.id === itemId);
        if (!item) return;

        try {
            const trackingUrl = this.stateManager.getTrackingUrl(item.brand, item.trackingNumber);
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
            // Remove from local storage
            this.trackingItems = this.trackingItems.filter(item => item.id !== itemId);
            await this.saveTrackingItems();

            // Refresh display
            await this.loadTrackingItems();
            this.showMessage('Tracking item deleted successfully', 'success');
        } catch (error) {
            console.error('Error deleting tracking item:', error);
            this.showMessage('Failed to delete tracking item', 'error');
        }
    }

    async saveTrackingItems() {
        try {
            await chrome.storage.local.set({ trackingItems: this.trackingItems });
        } catch (error) {
            console.error('Error saving tracking items:', error);
        }
    }

    async syncData() {
        try {
            this.showMessage('Syncing data...', 'info');
            
            // Send all tracking data to external webapp
            chrome.runtime.sendMessage({
                action: 'syncAllData',
                data: this.trackingItems
            });
            
            this.showMessage('Data synced successfully!', 'success');
        } catch (error) {
            console.error('Error syncing data:', error);
            this.showMessage('Sync failed. Please try again.', 'error');
        }
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
