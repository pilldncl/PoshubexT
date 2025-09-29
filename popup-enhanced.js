// Enhanced TrackHub Popup with Editable States
// Handles locked/editable states and carrier detection

import { UnifiedAuthManager, AUTH_TYPES } from './config/unified-auth-manager.js';
import DataManager from './config/data-manager.js';
import TrackingStateManager from './config/tracking-state-manager.js';

class TrackHubPopup {
    constructor() {
        this.currentUser = null;
        this.trackingItems = [];
        this.dataManager = new DataManager();
        this.authManager = new UnifiedAuthManager();
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
            
            // Initialize user data - this is what "pulls the data up"
            await this.initializeUserData();
            
        } catch (error) {
            console.error('Error initializing popup:', error);
            this.showMessage('Failed to initialize. Please try again.', 'error');
        }
    }

    // Main function that "pulls data up" from authentication
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
                status: 'pending',
                isEditable: false // Default to locked state
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

        // Create tracking items using template
        this.trackingItems.forEach(item => {
            const itemElement = this.createTrackingItemElement(item);
            container.appendChild(itemElement);
        });

        // Add event listeners for the action buttons
        this.addTrackingItemEventListeners();
    }

    createTrackingItemElement(item) {
        // Get the template
        const template = document.getElementById('trackingItemTemplate');
        const clone = template.content.cloneNode(true);
        
        // Set item ID
        const itemElement = clone.querySelector('.tracking-item');
        itemElement.setAttribute('data-item-id', item.id);
        
        // Populate locked state
        const lockedState = clone.querySelector('.tracking-item-locked');
        const trackingNumber = lockedState.querySelector('.tracking-number');
        const trackingBrand = lockedState.querySelector('.tracking-brand');
        const trackingDescription = lockedState.querySelector('.tracking-description');
        
        trackingNumber.textContent = this.stateManager.formatTrackingNumber(item.trackingNumber, item.brand);
        trackingBrand.textContent = `${this.stateManager.getCarrierIcon(item.brand)} ${this.stateManager.getCarrierLabel(item.brand)}`;
        
        if (item.description) {
            trackingDescription.textContent = item.description;
        } else {
            trackingDescription.style.display = 'none';
        }
        
        // Populate editable state
        const editableState = clone.querySelector('.tracking-item-editable');
        const editTrackingNumber = editableState.querySelector('#edit-tracking-number');
        const editBrand = editableState.querySelector('#edit-brand');
        const editDescription = editableState.querySelector('#edit-description');
        
        editTrackingNumber.value = item.trackingNumber;
        editBrand.value = item.brand;
        editDescription.value = item.description || '';
        
        // Set unique IDs for form elements
        const uniqueId = `edit-${item.id}`;
        editTrackingNumber.id = `${uniqueId}-tracking-number`;
        editBrand.id = `${uniqueId}-brand`;
        editDescription.id = `${uniqueId}-description`;
        
        return clone;
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

        // Save button event listeners
        document.querySelectorAll('.save-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
                this.saveTrackingItem(itemId);
            });
        });

        // Cancel button event listeners
        document.querySelectorAll('.cancel-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
                this.cancelEdit(itemId);
            });
        });
    }

    // Enter edit mode for a tracking item
    enterEditMode(itemId) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!itemElement) return;

        // Hide locked state, show editable state
        const lockedState = itemElement.querySelector('.tracking-item-locked');
        const editableState = itemElement.querySelector('.tracking-item-editable');
        
        lockedState.classList.add('hidden');
        editableState.classList.remove('hidden');
        
        // Set editing state
        this.stateManager.setEditingState(itemId, true);
        
        // Focus on tracking number input
        const trackingInput = editableState.querySelector('input[type="text"]');
        if (trackingInput) {
            trackingInput.focus();
            trackingInput.select();
        }
    }

    // Cancel edit mode
    cancelEdit(itemId) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (!itemElement) return;

        // Show locked state, hide editable state
        const lockedState = itemElement.querySelector('.tracking-item-locked');
        const editableState = itemElement.querySelector('.tracking-item-editable');
        
        lockedState.classList.remove('hidden');
        editableState.classList.add('hidden');
        
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
            const trackingNumber = editableState.querySelector('input[type="text"]').value;
            const brand = editableState.querySelector('select').value;
            const description = editableState.querySelector('input[placeholder="Package description"]').value;

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

                // Save to data manager
                await this.dataManager.updateTrackingItem(item);

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
