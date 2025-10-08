// TrackHub Chrome Extension - Background Script
class TrackHubBackground {
    constructor() {
        this.contextMenuListenerAdded = false;
        this.initialized = false;
        this.init();
    }

    init() {
        if (this.initialized) {
            console.log('⚠️ Background script already initialized, skipping...');
            return;
        }
        
        console.log('🚀 Initializing TrackHub background script...');
        
        // Setup message listeners
        this.setupMessageListeners();
        
        // Setup context menu for quick add feature
        this.setupContextMenu();
        
        // Setup installation handler
        this.setupInstallationHandler();
        
        this.initialized = true;
        console.log('✅ Background script initialization completed');
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
                    
                case 'ensureContextMenu':
                    this.setupContextMenu();
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
            
            // Try to send to backend API first, then Supabase as backup
            try {
                const authToken = await this.getAuthToken();
                console.log('🔑 Background: Auth token retrieved:', authToken ? 'Present' : 'Missing');
                console.log('📦 Background: Tracking data to send:', trackingData);
                
                if (authToken) {
                    // Try backend API first
                    console.log('🚀 Background: Attempting backend API call...');
                    console.log('🌐 Background: Backend URL: http://localhost:3000/api/tracking/add');
                    
                    // Quick connectivity test first
                    try {
                        console.log('🔍 Background: Testing backend connectivity...');
                        const healthResponse = await fetch('http://localhost:3000/api/health', {
                            method: 'GET',
                            headers: { 'Content-Type': 'application/json' }
                        });
                        console.log('🔗 Background: Backend health check:', healthResponse.status, healthResponse.statusText);
                    } catch (healthError) {
                        console.log('❌ Background: Backend health check failed:', healthError.message);
                        console.log('💡 Background: Is your backend server running on http://localhost:3000?');
                    }
                    
                    try {
                        const backendApiResult = await this.sendToBackendAPI(trackingData, authToken);
                        console.log('✅ Background: Backend API completed successfully:', backendApiResult);
                        await this.showNotification('Tracking Added', `Successfully added ${trackingData.brand.toUpperCase()} tracking to backend`);
                    } catch (backendError) {
                        console.log('❌ Background: Backend API failed:', backendError.message);
                        console.log('🔍 Background: Full error details:', backendError);
                        
                        // Handle specific error types with user-friendly messages
                        if (backendError.message.includes('TRACKING_EXISTS')) {
                            await this.showNotification('Already Tracked', 'This tracking number is already in your account');
                        } else if (backendError.message.includes('AUTH_FAILED')) {
                            await this.showNotification('Login Required', 'Please log in again to sync with backend');
                        } else if (backendError.message.includes('INVALID_DATA')) {
                            await this.showNotification('Invalid Data', 'Please check your tracking number format');
                        } else if (backendError.message.includes('SERVER_ERROR')) {
                            await this.showNotification('Server Error', 'Backend server is having issues, but tracking saved locally');
                        } else if (backendError.message.includes('Failed to fetch')) {
                            await this.showNotification('Connection Failed', 'Cannot connect to backend server, but tracking saved locally');
                        } else {
                            await this.showNotification('Backend Error', 'Failed to sync with backend, but tracking saved locally');
                        }
                    }
                } else {
                    console.log('❌ Background: No auth token available for backend API');
                }
                    
                    // Also send to Supabase for sync
                    console.log('🚀 Background: Sending to popup for Supabase...');
                    chrome.runtime.sendMessage({
                        action: 'quickAddToSupabase',
                        data: {
                            trackingNumber: trackingData.trackingNumber,
                            carrierId: trackingData.brand,
                            description: trackingData.description || '',
                            status: trackingData.status || 'active',
                            metadata: {
                                description: trackingData.description || '',
                                addedVia: 'context_menu',
                                source: 'Unknown'
                            }
                        }
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.log('🔴 Background: Popup not open, storing for later:', chrome.runtime.lastError.message);
                            // Store the tracking data for when popup opens
                            this.storePendingTrackingData(trackingData);
                        } else {
                            console.log('🟢 Background: Quick add sent to popup successfully');
                        }
                    });
                
                console.log('🟡 Background: Processed quick add tracking');
            } catch (error) {
                console.log('🔴 Background: Error processing quick add:', error);}
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
            // Check for Auth0 token first (new system)
            const auth0Result = await chrome.storage.local.get(['auth0_access_token', 'auth0_token_expiry']);
            if (auth0Result.auth0_access_token && auth0Result.auth0_token_expiry) {
                // Check if token is expired
                if (Date.now() < auth0Result.auth0_token_expiry) {
                    console.log('🔑 Background: Using Auth0 token');
                    return auth0Result.auth0_access_token;
                } else {
                    console.log('🔑 Background: Auth0 token expired');
                }
            }
            
            // Fallback to old system
            const result = await chrome.storage.local.get(['trackhub_access_token']);
            if (result.trackhub_access_token) {
                console.log('🔑 Background: Using legacy token');
                return result.trackhub_access_token;
            }
            
            console.log('🔑 Background: No valid token found');
            return null;
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

    async storePendingTrackingData(trackingData) {
        try {
            const result = await chrome.storage.local.get(['pendingTrackingData']);
            const pendingData = result.pendingTrackingData || [];
            pendingData.push({
                ...trackingData,
                timestamp: Date.now()
            });
            await chrome.storage.local.set({ pendingTrackingData: pendingData });
            console.log('🟡 Background: Stored pending tracking data for later');
        } catch (error) {
            console.error('Error storing pending tracking data:', error);
        }
    }


    async sendToBackendAPI(trackingData, authToken) {
        try {
            console.log('🌐 Background: Sending to backend API...');
            console.log('🔑 Background: Auth token provided:', authToken ? `Present (length: ${authToken.length})` : 'NULL');
            
            if (!authToken) {
                throw new Error('No auth token provided to background script');
            }
            
            // Prepare backend request data
            const backendRequestData = {
                method: 'POST',
                url: 'http://localhost:3000/api/tracking/add',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                    'X-Extension-Version': '1.0.0'
                },
                body: {
                    trackingNumber: trackingData.trackingNumber,
                    ...(trackingData.brand && { brand: trackingData.brand }),
                    ...(trackingData.description && { description: trackingData.description }),
                    ...(trackingData.dateAdded && { dateAdded: trackingData.dateAdded }),
                    ...(trackingData.status && { status: trackingData.status })
                }
            };
            
            console.log('🔵 Background: Backend API request prepared:', {
                url: backendRequestData.url,
                method: backendRequestData.method,
                hasAuth: !!backendRequestData.headers.Authorization,
                authHeader: backendRequestData.headers.Authorization.substring(0, 20) + '...'
            });

            // Send to backend API
            const response = await fetch(backendRequestData.url, {
                method: backendRequestData.method,
                headers: backendRequestData.headers,
                body: JSON.stringify(backendRequestData.body)
            });

            console.log('📡 Background: Backend API response status:', response.status, response.statusText);
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Background: Backend API success:', result);
                return result;
            } else {
                const errorText = await response.text();
                console.log('❌ Background: Backend API error:', response.status, errorText);
                
                // Handle specific error codes with better messages
                if (response.status === 409) {
                    throw new Error('TRACKING_EXISTS: This tracking number already exists in your account');
                } else if (response.status === 401) {
                    throw new Error('AUTH_FAILED: Please log in again to continue');
                } else if (response.status === 400) {
                    throw new Error('INVALID_DATA: Please check your tracking number and try again');
                } else if (response.status === 500) {
                    throw new Error('SERVER_ERROR: Backend server is experiencing issues');
                } else {
                    throw new Error(`Backend API failed: ${response.status} ${response.statusText}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Background: Error sending to backend API:', error);
            throw error;
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
        console.log('🔧 Setting up context menu...');
        
        try {
            // Remove existing context menu first to avoid duplicates
            chrome.contextMenus.removeAll(() => {
                console.log('🧹 Context menus removed');
                
                // Wait a moment before creating new menu
                setTimeout(() => {
                    // Create context menu for quick add feature
                    chrome.contextMenus.create({
                        id: 'quickAddTracking',
                        title: 'Add to TrackHub',
                        contexts: ['selection']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.error('❌ Context menu creation failed:', chrome.runtime.lastError);
                        } else {
                            console.log('✅ Context menu created successfully: quickAddTracking');
                        }
                    });
                }, 100);
            });

            // Handle context menu clicks (only add once)
            if (!this.contextMenuListenerAdded) {
                chrome.contextMenus.onClicked.addListener((info, tab) => {
                    console.log('🖱️ Context menu clicked:', info);
                    if (info.menuItemId === 'quickAddTracking' && info.selectionText) {
                        console.log('📝 Processing quick add for text:', info.selectionText);
                        this.handleContextMenuClick(info.selectionText, tab);
                    }
                });
                this.contextMenuListenerAdded = true;
                console.log('✅ Context menu click listener added');
            }
            
            console.log('✅ Context menu setup completed');
        } catch (error) {
            console.error('❌ Context menu setup failed:', error);
        }
    }

    // Clean and filter tracking number input
    cleanTrackingNumber(input) {
        if (!input) return '';
        
        // Remove common delimiters and unwanted characters
        let cleaned = input
            .trim()
            .replace(/[\s\-_.,;:|\\/]+/g, '') // Remove spaces, hyphens, underscores, dots, commas, semicolons, colons, pipes, backslashes, forward slashes
            .replace(/[^\w]/g, '') // Remove any remaining non-alphanumeric characters
            .toUpperCase(); // Convert to uppercase for consistency
        
        console.log('🧹 Background: Input cleaned:', { original: input, cleaned: cleaned });
        return cleaned;
    }

    async handleContextMenuClick(selectedText, tab) {
        try {
            console.log('Context menu clicked with text:', selectedText);
            
            // Clean the selected text first
            const cleanedText = this.cleanTrackingNumber(selectedText);
            console.log('🧹 Background: Cleaned text:', cleanedText);
            
            // Check if user is logged in (OAuth or local)
            const isOAuthAuthenticated = await this.checkOAuthAuth();
            const isLocalAuthenticated = await this.checkLocalAuth();
            
            if (!isOAuthAuthenticated && !isLocalAuthenticated) {
                await this.showNotification('Login Required', 'Please login to TrackHub first');
                return;
            }

            // Detect if selected text looks like a tracking number
            if (this.isTrackingNumber(cleanedText)) {
                // Simple brand detection (no API prediction)
                const detectedBrand = this.detectBrand(cleanedText);
                console.log('Detected brand:', detectedBrand);

                const trackingData = {
                    id: Date.now().toString(),
                    trackingNumber: cleanedText,
                    brand: detectedBrand,
                    description: `Quick add from ${tab.title}`,
                    dateAdded: new Date().toISOString(),
                    status: 'pending'
                };

                await this.handleQuickAddTracking(trackingData);
                await this.showNotification('Tracking Added', `Added ${trackingData.brand.toUpperCase()} tracking`);
            } else {
                // Ask user to confirm if they want to add this text
                await this.showConfirmationDialog(cleanedText, tab);
            }
        } catch (error) {
            console.error('Error handling context menu click:', error);
            await this.showNotification('Error', 'Failed to add tracking. Please try again.');
        }
    }

    async checkOAuthAuth() {
        try {
            // Check Auth0 token first (new system)
            const auth0Result = await chrome.storage.local.get(['auth0_access_token', 'auth0_token_expiry']);
            if (auth0Result.auth0_access_token && auth0Result.auth0_token_expiry) {
                const now = Date.now();
                const expiry = auth0Result.auth0_token_expiry;
                console.log('🔍 Background: Auth0 auth check:', now < expiry ? 'VALID' : 'EXPIRED');
                return now < expiry;
            }
            
            // Fallback to old system
            const result = await chrome.storage.local.get(['trackhub_access_token', 'trackhub_token_expiry']);
            if (result.trackhub_access_token) {
                const now = Date.now();
                const expiry = result.trackhub_token_expiry;
                return now < expiry;
            }
            
            return false;
        } catch (error) {
            console.error('Error checking OAuth auth:', error);
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
            const token = await this.getWebappAuthToken();
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

    async getWebappAuthToken() {
        try {
            const result = await chrome.storage.local.get(['authToken']);
            return result.authToken || null;
        } catch (error) {
            console.error('Error getting webapp auth token:', error);
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
