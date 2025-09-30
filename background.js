// TrackHub Chrome Extension - Background Script
class TrackHubBackground {
    constructor() {
        this.init();
    }

    init() {
        // Setup message listeners
        this.setupMessageListeners();
        
        // Setup context menu for quick add feature
        this.setupContextMenu();
        
        // Setup installation handler
        this.setupInstallationHandler();
    }

    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            this.handleMessage(request, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }

    async handleMessage(request, sender, sendResponse) {
        try {
            switch (request.action) {
                case 'addTracking':
                    await this.handleAddTracking(request.data);
                    sendResponse({ success: true });
                    break;
                    
                case 'syncAllData':
                    await this.handleSyncAllData(request.data);
                    sendResponse({ success: true });
                    break;
                    
                case 'getTrackingItems':
                    const items = await this.getTrackingItems();
                    sendResponse({ success: true, data: items });
                    break;
                    
                case 'quickAddTracking':
                    await this.handleQuickAddTracking(request.data);
                    sendResponse({ success: true });
                    break;
                    
                case 'deleteTracking':
                    await this.handleDeleteTracking(request.data);
                    sendResponse({ success: true });
                    break;
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('Background message handler error:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async handleAddTracking(trackingData) {
        try {
            // Store in local storage
            const result = await chrome.storage.local.get(['trackingItems']);
            const trackingItems = result.trackingItems || [];
            trackingItems.push(trackingData);
            await chrome.storage.local.set({ trackingItems });

            // Send to external webapp if configured
            await this.sendToExternalWebapp('addTracking', trackingData);

            // Show notification if enabled
            await this.showNotification('Tracking Added', `Added tracking for ${trackingData.brand.toUpperCase()}`);
        } catch (error) {
            console.error('Error handling add tracking:', error);
        }
    }

    async handleSyncAllData(trackingItems) {
        try {
            // Send all data to external webapp
            await this.sendToExternalWebapp('syncAllData', trackingItems);
            
            // Show notification
            await this.showNotification('Data Synced', `Synced ${trackingItems.length} tracking items`);
        } catch (error) {
            console.error('Error syncing all data:', error);
        }
    }

    async handleQuickAddTracking(trackingData) {
        try {
            console.log('Quick add tracking:', trackingData);
            
            // Auto-detect brand if not provided
            if (!trackingData.brand) {
                trackingData.brand = this.detectBrand(trackingData.trackingNumber);
            }

            // Store in local storage first
            const result = await chrome.storage.local.get(['trackingItems']);
            const trackingItems = result.trackingItems || [];
            trackingItems.push(trackingData);
            await chrome.storage.local.set({ trackingItems });

            console.log('Tracking item added to storage:', trackingData);
            
            // Prepare backend request data and send to popup
            try {
                const authToken = await this.getAuthToken();
                console.log('🔑 Background: Auth token retrieved:', authToken ? 'Present' : 'Missing');
                
                // Try different token formats based on what backend expects
                let authHeader = '';
                if (authToken) {
                    // Check if token already has Bearer prefix
                    if (authToken.startsWith('Bearer ')) {
                        authHeader = authToken;
                    } else {
                        // Try Bearer format first (most common)
                        authHeader = `Bearer ${authToken}`;
                    }
                }
                
                const backendRequestData = {
                    method: 'POST',
                    url: 'http://localhost:3000/api/tracking/add',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': authHeader,
                        'X-Extension-Version': '1.0.0'
                    },
                    body: {
                        trackingNumber: trackingData.trackingNumber,
                        brand: trackingData.brand,
                        description: trackingData.description || '',
                        dateAdded: trackingData.dateAdded,
                        status: trackingData.status || 'pending'
                    }
                };
                
                console.log('🔵 Background: Request headers prepared:', backendRequestData.headers);
                console.log('🔵 Background: Authorization header value:', backendRequestData.headers.Authorization);

                // Try to send message to popup
                chrome.runtime.sendMessage({
                    action: 'submitBackendRequest',
                    data: {
                        trackingItem: trackingData,
                        requestData: backendRequestData
                    }
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log('🔴 Background: Popup not open, message failed:', chrome.runtime.lastError.message);
                        // Store the request for when popup opens
                        this.storePendingBackendRequest(trackingData, backendRequestData);
                    } else {
                        console.log('🟢 Background: Message sent to popup successfully');
                    }
                });
                
                console.log('🟡 Background: Prepared backend request data for popup');
            } catch (error) {
                console.log('🔴 Background: Error preparing backend request:', error);
            }
            
            // Notify popup to refresh if it's open
            try {
                chrome.runtime.sendMessage({
                    action: 'trackingAdded',
                    data: trackingData
                });
            } catch (error) {
                // Popup might not be open, that's okay
                console.log('Popup not open, skipping refresh notification');
            }
            
            // Send to external webapp if configured
            await this.sendToExternalWebapp('addTracking', trackingData);

        } catch (error) {
            console.error('Error handling quick add tracking:', error);
            throw error;
        }
    }

    async getTrackingItems() {
        try {
            const result = await chrome.storage.local.get(['trackingItems']);
            return result.trackingItems || [];
        } catch (error) {
            console.error('Error getting tracking items:', error);
            return [];
        }
    }

    async getAuthToken() {
        try {
            const result = await chrome.storage.local.get(['trackhub_access_token']);
            return result.trackhub_access_token || null;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }

    async storePendingBackendRequest(trackingData, requestData) {
        try {
            const result = await chrome.storage.local.get(['pendingBackendRequests']);
            const pendingRequests = result.pendingBackendRequests || [];
            pendingRequests.push({
                trackingItem: trackingData,
                requestData: requestData,
                timestamp: Date.now()
            });
            await chrome.storage.local.set({ pendingBackendRequests: pendingRequests });
            console.log('🟡 Background: Stored pending backend request for later');
        } catch (error) {
            console.error('Error storing pending backend request:', error);
        }
    }

    async handleDeleteTracking(trackingData) {
        try {
            console.log('Deleting tracking:', trackingData);
            
            // Remove from local storage
            const result = await chrome.storage.local.get(['trackingItems']);
            const trackingItems = result.trackingItems || [];
            const updatedItems = trackingItems.filter(item => item.id !== trackingData.id);
            await chrome.storage.local.set({ trackingItems: updatedItems });

            console.log('Tracking item removed from storage');
            
            // Send to external webapp (optional)
            try {
                await this.sendToExternalWebapp('deleteTracking', trackingData);
            } catch (error) {
                console.log('External webapp delete failed, continuing with local deletion');
            }
            
            // Show notification
            await this.showNotification('Tracking Deleted', `Deleted ${trackingData.brand.toUpperCase()} tracking`);
        } catch (error) {
            console.error('Error handling delete tracking:', error);
            throw error;
        }
    }

    setupContextMenu() {
        // Create context menu for quick add feature
        chrome.contextMenus.create({
            id: 'quickAddTracking',
            title: 'Add to TrackHub',
            contexts: ['selection']
        });

        console.log('Context menu created: quickAddTracking');

        // Handle context menu clicks
        chrome.contextMenus.onClicked.addListener((info, tab) => {
            console.log('Context menu clicked:', info);
            if (info.menuItemId === 'quickAddTracking' && info.selectionText) {
                console.log('Processing quick add for text:', info.selectionText);
                this.handleContextMenuClick(info.selectionText, tab);
            }
        });
    }

    async handleContextMenuClick(selectedText, tab) {
        try {
            console.log('Context menu clicked with text:', selectedText);
            
            // Check if user is logged in (OAuth or local)
            const isOAuthAuthenticated = await this.checkOAuthAuth();
            const isLocalAuthenticated = await this.checkLocalAuth();
            
            if (!isOAuthAuthenticated && !isLocalAuthenticated) {
                await this.showNotification('Login Required', 'Please login to TrackHub first');
                return;
            }

            // Detect if selected text looks like a tracking number
            if (this.isTrackingNumber(selectedText)) {
                const trackingData = {
                    id: Date.now().toString(),
                    trackingNumber: selectedText.trim(),
                    brand: this.detectBrand(selectedText),
                    description: `Quick add from ${tab.title}`,
                    dateAdded: new Date().toISOString(),
                    status: 'pending'
                };

                await this.handleQuickAddTracking(trackingData);
                await this.showNotification('Tracking Added', `Added ${trackingData.brand.toUpperCase()} tracking`);
            } else {
                // Ask user to confirm if they want to add this text
                await this.showConfirmationDialog(selectedText, tab);
            }
        } catch (error) {
            console.error('Error handling context menu click:', error);
            await this.showNotification('Error', 'Failed to add tracking. Please try again.');
        }
    }

    async checkOAuthAuth() {
        try {
            const result = await chrome.storage.local.get(['trackhub_access_token', 'trackhub_token_expiry']);
            if (!result.trackhub_access_token) return false;
            
            const now = Date.now();
            const expiry = result.trackhub_token_expiry;
            return now < expiry;
        } catch (error) {
            return false;
        }
    }

    async checkLocalAuth() {
        try {
            const result = await chrome.storage.local.get(['isLoggedIn']);
            return result.isLoggedIn === true;
        } catch (error) {
            return false;
        }
    }

    isTrackingNumber(text) {
        // Basic tracking number patterns
        const patterns = [
            /^[0-9]{10,}$/, // UPS, FedEx numbers
            /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/, // USPS format
            /^[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/, // USPS format with spaces
            /^[A-Z0-9]{10,20}$/ // Generic alphanumeric
        ];

        return patterns.some(pattern => pattern.test(text.trim()));
    }

    detectBrand(trackingNumber) {
        const number = trackingNumber.trim();
        
        // UPS patterns
        if (/^1Z[0-9A-Z]{16}$/.test(number)) return 'ups';
        if (/^[0-9]{10,}$/.test(number) && number.length >= 10) return 'ups';
        
        // FedEx patterns
        if (/^[0-9]{12}$/.test(number)) return 'fedex';
        if (/^[0-9]{14}$/.test(number)) return 'fedex';
        
        // USPS patterns
        if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(number)) return 'usps';
        if (/^[0-9]{4}\s[0-9]{4}\s[0-9]{4}\s[0-9]{4}$/.test(number)) return 'usps';
        
        // DHL patterns
        if (/^[0-9]{10,11}$/.test(number)) return 'dhl';
        
        // Amazon patterns
        if (/^TBA[0-9]{10}$/.test(number)) return 'amazon';
        
        return 'other';
    }

    async showConfirmationDialog(text, tab) {
        // For now, just add the text as tracking
        // In a real implementation, you might want to show a more sophisticated dialog
        const trackingData = {
            id: Date.now().toString(),
            trackingNumber: text.trim(),
            brand: this.detectBrand(text),
            description: `Quick add from ${tab.title}`,
            dateAdded: new Date().toISOString(),
            status: 'pending'
        };

        await this.handleQuickAddTracking(trackingData);
        await this.showNotification('Tracking Added', `Added "${text.substring(0, 20)}..." as tracking`);
    }

    async sendToExternalWebapp(action, data) {
        try {
            console.log('Sending to external webapp:', { action, data });
            
            // Check if webapp URL is configured
            const webappUrl = await this.getWebappUrl();
            if (!webappUrl || webappUrl === 'https://your-webapp-url.com') {
                console.log('External webapp not configured yet, skipping sync');
                return; // Webapp not ready, just do local operations
            }
            
            // Get auth token
            const token = await this.getAuthToken();
            if (!token) {
                console.log('No auth token available, skipping webapp sync');
                return;
            }
            
            // Send request to external webapp
            const response = await fetch(`${webappUrl}/api/tracking`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Extension-Version': '1.0.0'
                },
                body: JSON.stringify({ action, data })
            });
            
            if (!response.ok) {
                throw new Error(`Webapp sync failed: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('Successfully synced with webapp:', result);
        } catch (error) {
            console.error('Error sending to external webapp:', error);
            throw error; // Re-throw so caller can handle it
        }
    }

    async getWebappUrl() {
        try {
            const result = await chrome.storage.local.get(['webappUrl']);
            return result.webappUrl || null;
        } catch (error) {
            console.error('Error getting webapp URL:', error);
            return null;
        }
    }

    async getAuthToken() {
        try {
            const result = await chrome.storage.local.get(['authToken']);
            return result.authToken || null;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    }

    async showNotification(title, message, buttons = null) {
        try {
            const options = {
                type: 'basic',
                iconUrl: 'icons/icon48.png',
                title: title,
                message: message
            };

            if (buttons) {
                options.buttons = buttons.map(text => ({ title: text }));
            }

            await chrome.notifications.create(options);
        } catch (error) {
            console.error('Error showing notification:', error);
            // Fallback to console log if notifications fail
            console.log(`TrackHub: ${title} - ${message}`);
        }
    }

    setupInstallationHandler() {
        chrome.runtime.onInstalled.addListener((details) => {
            if (details.reason === 'install') {
                // First time installation
                this.handleFirstInstall();
            } else if (details.reason === 'update') {
                // Extension update
                this.handleUpdate(details.previousVersion);
            }
        });
    }

    async handleFirstInstall() {
        try {
            // Set default settings
            await chrome.storage.local.set({
                enableQuickAdd: true,
                enableNotifications: true,
                autoDetectTracking: true,
                webappUrl: 'https://your-webapp-url.com' // Replace with actual URL
            });

            // Show welcome notification
            await this.showNotification(
                'Welcome to TrackHub!',
                'Right-click on any text to quickly add tracking numbers.'
            );
        } catch (error) {
            console.error('Error handling first install:', error);
        }
    }

    async handleUpdate(previousVersion) {
        try {
            // Handle version-specific updates
            console.log('TrackHub updated from version:', previousVersion);
            
            // Show update notification
            await this.showNotification(
                'TrackHub Updated!',
                'New features and improvements are available.'
            );
        } catch (error) {
            console.error('Error handling update:', error);
        }
    }
}

// Initialize background script
new TrackHubBackground();
