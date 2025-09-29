// Updated TrackHub Popup with Data Manager
// This shows how to "pull data up" from authentication

import { UnifiedAuthManager, AUTH_TYPES } from './config/unified-auth-manager.js';
import DataManager from './config/data-manager.js';

class TrackHubPopup {
    constructor() {
        this.currentUser = null;
        this.trackingItems = [];
        this.dataManager = new DataManager();
        this.authManager = new UnifiedAuthManager();
        this.init();
    }

    async init() {
        try {
            console.log('Initializing TrackHub popup...');
            
            // Setup event listeners first
            this.setupEventListeners();
            
            // Setup message listener for background script
            this.setupMessageListener();
            
            // Initialize user data - this is what "pulls the data up"
            await this.initializeUserData();
            
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showMessage('Failed to initialize. Please try again.', 'error');
        }
    }

    // This is the main function that "pulls data up" from authentication
    async initializeUserData() {
        try {
            console.log('Initializing user data...');
            
            // Use the data manager to pull all data up from authentication
            const result = await this.dataManager.initializeUserData();
            
            if (result.authenticated) {
                console.log('User authenticated, loading dashboard');
                this.currentUser = result.user;
                this.trackingItems = result.trackingItems;
                
                // Update UI with user data
                this.updateUserInfo(result.user);
                this.showSection('dashboardSection');
                
                // Load tracking items in UI
                await this.loadTrackingItems();
                
                console.log('Dashboard loaded with data:', {
                    user: result.user,
                    trackingCount: result.trackingItems.length,
                    authType: result.authType
                });
                
            } else {
                console.log('User not authenticated, showing login');
                this.showSection('loginSection');
            }
            
        } catch (error) {
            console.error('Error initializing user data:', error);
            this.showMessage('Failed to load user data. Please try again.', 'error');
            this.showSection('loginSection');
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

    async handleGoogleLogin() {
        try {
            console.log('Starting Google OAuth flow...');
            this.showMessage('Authenticating with Google...', 'info');
            
            // Use the unified auth manager
            const result = await this.authManager.authenticateWithChromeIdentity();
            
            console.log('Google authentication successful:', result);
            
            // Re-initialize user data to pull everything up
            await this.initializeUserData();
            
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
            this.showMessage('Authenticating...', 'info');
            
            // Use the unified auth manager for credentials
            const result = await this.authManager.authenticateWithCredentials(email, password);
            
            console.log('Credentials authentication successful:', result);
            
            // Re-initialize user data to pull everything up
            await this.initializeUserData();
            
            this.showMessage('Login successful!', 'success');
            
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
            this.showMessage('Creating account...', 'info');
            
            // Use the unified auth manager for registration
            const result = await this.authManager.registerWithCredentials(email, password, email.split('@')[0]);
            
            console.log('Registration successful:', result);
            
            // Re-initialize user data to pull everything up
            await this.initializeUserData();
            
            this.showMessage('Registration successful!', 'success');
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    async handleLogout() {
        try {
            console.log('Logging out...');
            
            // Use the data manager to clear all data
            await this.dataManager.clearAllData();
            
            // Reset local state
            this.currentUser = null;
            this.trackingItems = [];
            
            // Show login section
            this.showSection('loginSection');
            this.showMessage('Logged out successfully', 'info');
            
        } catch (error) {
            console.error('Logout error:', error);
            this.showMessage('Logout failed. Please try again.', 'error');
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

            // Use the data manager to add tracking item
            await this.dataManager.addTrackingItem(trackingItem);
            
            // Update local state
            this.trackingItems.push(trackingItem);

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
            // Get tracking items from data manager
            const items = await this.dataManager.loadTrackingItems();
            this.trackingItems = items;
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
                this.deleteTracking(itemId);
            });
        });
    }

    async trackPackage(itemId) {
        const item = this.trackingItems.find(i => i.id === itemId);
        if (!item) return;

        try {
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
            // Use the data manager to remove tracking item
            await this.dataManager.removeTrackingItem(itemId);
            
            // Update local state
            this.trackingItems = this.trackingItems.filter(item => item.id !== itemId);
            
            // Refresh display
            await this.loadTrackingItems();
            this.showMessage('Tracking item deleted successfully', 'success');
            
        } catch (error) {
            console.error('Error deleting tracking item:', error);
            this.showMessage('Failed to delete tracking item', 'error');
        }
    }

    async syncData() {
        try {
            this.showMessage('Syncing data...', 'info');
            
            // Use the data manager to sync with backend
            await this.dataManager.syncWithBackend();
            
            this.showMessage('Data synced successfully!', 'success');
            
        } catch (error) {
            console.error('Error syncing data:', error);
            this.showMessage('Sync failed. Please try again.', 'error');
        }
    }

    async openExternalWebapp() {
        try {
            // Get user data to pass to webapp
            const userData = this.dataManager.getCurrentState();
            
            // Open the main webapp with user context
            const webappUrl = 'https://your-webapp-url.com'; // Replace with actual URL
            chrome.tabs.create({ url: webappUrl });
            
        } catch (error) {
            console.error('Error opening webapp:', error);
            this.showMessage('Failed to open webapp', 'error');
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
}

// Initialize the popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.trackHubPopup = new TrackHubPopup();
});
