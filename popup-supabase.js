// TrackHub Chrome Extension - Supabase + Auth0 Popup
// Simplified authentication and real-time sync

import { supabaseAuth } from './config/supabase-auth.js';
import { supabaseData } from './config/supabase-data-comprehensive.js';

class TrackHubSupabasePopup {
  constructor() {
    this.currentUser = null;
    this.trackingItems = [];
    this.realtimeSubscription = null;
    this.init();
  }

  async init() {
    try {
      console.log('Initializing TrackHub with Supabase + Auth0...');
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Load carriers from database
      await this.loadCarriers();
      
      // Check authentication status
      await this.checkAuthStatus();
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      this.showMessage('Failed to initialize. Please try again.', 'error');
    }
  }

  setupEventListeners() {
    // Auth0 login button
    document.getElementById('auth0LoginBtn').addEventListener('click', (e) => {
      e.preventDefault();
      this.handleAuth0Login();
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

    // Tracking number input (no auto-detection)
    document.getElementById('trackingNumber').addEventListener('input', (e) => {
      // Just clean the input, no carrier prediction
      const cleaned = this.cleanTrackingNumber(e.target.value);
      if (cleaned !== e.target.value) {
        e.target.value = cleaned;
      }
    });

    // Sync data button
    document.getElementById('syncDataBtn').addEventListener('click', () => {
      this.syncData();
    });

    // Fix context menu button
    document.getElementById('fixContextMenuBtn').addEventListener('click', () => {
      this.fixContextMenu();
    });

    // Refresh data button
    document.getElementById('refreshDataBtn').addEventListener('click', () => {
      this.refreshData();
    });

    // Test data button (for debugging)
    const testDataBtn = document.getElementById('testDataBtn');
    if (testDataBtn) {
      testDataBtn.addEventListener('click', () => {
        this.testDataDisplay();
      });
    }

    // Test backend API button
    const testBackendBtn = document.getElementById('testBackendBtn');
    if (testBackendBtn) {
      testBackendBtn.addEventListener('click', () => {
        this.testBackendAPI();
      });
    }

    // Test GET request button
    const testGETBtn = document.getElementById('testGETBtn');
    if (testGETBtn) {
      testGETBtn.addEventListener('click', () => {
        this.testBackendGET();
      });
    }

    // Verify token button
    const verifyTokenBtn = document.getElementById('verifyTokenBtn');
    if (verifyTokenBtn) {
      verifyTokenBtn.addEventListener('click', () => {
        this.verifyBearerToken();
      });
    }

    // Test connection button (for debugging)
    const testConnectionBtn = document.getElementById('testConnectionBtn');
    if (testConnectionBtn) {
      testConnectionBtn.addEventListener('click', () => {
        this.testConnection();
      });
    }

    // Setup message listener for background script
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Popup received message:', request);
      
      switch (request.action) {
        case 'quickAddToSupabase':
          this.handleQuickAddFromBackground(request.data);
          sendResponse({ success: true });
          break;
          
        case 'trackingAdded':
          // Refresh the tracking list
          this.loadTrackingItems();
          sendResponse({ success: true });
          break;
          
        default:
          console.log('Unknown message action:', request.action);
          sendResponse({ success: false, error: 'Unknown action' });
      }
      
      return true; // Keep message channel open for async responses
    });
  }

  async handleQuickAddFromBackground(trackingData) {
    try {
      console.log('🚀 Handling quick add from background:', trackingData);
      
      // Add to Supabase
      const result = await supabaseData.addTrackingRequest(trackingData);
      
      if (result.success) {
        // Add to local state for immediate UI update
        this.trackingItems.push({
          id: result.id,
          ...trackingData,
          dateAdded: new Date().toISOString(),
          source: 'supabase'
        });
        
        // Refresh display
        await this.loadTrackingItems();
        this.showMessage('Tracking added from context menu!', 'success');
      }
    } catch (error) {
      console.error('Error handling quick add from background:', error);
      this.showMessage('Failed to add tracking from context menu', 'error');
    }
  }

  async checkAuthStatus() {
    try {
      console.log('Checking authentication status...');
      
      // Initialize Supabase
      const authResult = await supabaseAuth.initialize();
      
      if (authResult.authenticated) {
        console.log('User is authenticated:', authResult.user.email);
        this.currentUser = authResult.user;
        this.updateUserInfo(authResult.user);
        this.showSection('dashboardSection');
        
        // Initialize data service
        await supabaseData.initialize();
        
        // Load tracking items
        await this.loadTrackingItems();
        
        // Setup real-time sync
        await this.setupRealtimeSync();
        
      } else {
        console.log('User not authenticated, showing login');
        this.showSection('loginSection');
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.showSection('loginSection');
    }
  }

  async handleAuth0Login() {
    try {
      console.log('Starting Auth0 authentication...');
      this.showMessage('Authenticating with Auth0...', 'info');
      
      // Authenticate with Auth0
      const result = await supabaseAuth.authenticateWithAuth0();
      
      if (result.success) {
        console.log('Auth0 authentication successful:', result.user.email);
        this.currentUser = result.user;
        this.updateUserInfo(result.user);
        this.showSection('dashboardSection');
        
        // Initialize data service
        await supabaseData.initialize();
        
        // Load tracking items
        await this.loadTrackingItems();
        
        // Setup real-time sync
        await this.setupRealtimeSync();
        
        this.showMessage('Successfully authenticated with Auth0!', 'success');
      }
    } catch (error) {
      console.error('Auth0 authentication error:', error);
      this.showMessage(`Authentication failed: ${error.message}`, 'error');
    }
  }

  async handleLogout() {
    try {
      console.log('Logging out...');
      
      // Stop real-time sync
      if (this.realtimeSubscription) {
        await supabaseAuth.stopRealtimeSubscription();
        this.realtimeSubscription = null;
      }
      
      // Logout from Supabase
      await supabaseAuth.logout();
      
      // Clear local state
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
    const carrierId = document.getElementById('carrierId').value;
    const description = document.getElementById('description').value;
    const status = document.getElementById('status').value;

    if (!trackingNumber || trackingNumber.trim().length === 0) {
      this.showMessage('Please enter a tracking number', 'error');
      return;
    }

    // Clean the tracking number before processing
    const cleanedTrackingNumber = this.cleanTrackingNumber(trackingNumber);
    if (cleanedTrackingNumber !== trackingNumber) {
      document.getElementById('trackingNumber').value = cleanedTrackingNumber;
    }

    try {
      const trackingRequest = {
        trackingNumber: cleanedTrackingNumber,
        carrierId: carrierId,
        description: description.trim(),
        status: status || 'active',
        metadata: {
          description: description.trim(),
          addedVia: 'chrome_extension'
        }
      };

      // Send to both backend API and Supabase
      let backendResult = null;
      let supabaseResult = null;
      
      // Try backend API first
      try {
        console.log('🌐 Popup: Sending to backend API...');
        console.log('📋 Popup: Tracking request data:', trackingRequest);
        backendResult = await this.sendToBackendAPI(trackingRequest);
        console.log('✅ Popup: Backend API success:', backendResult);
      } catch (error) {
        console.log('❌ Popup: Backend API failed:', error.message);
        console.log('🔍 Popup: Backend API error details:', error);
        
        // Show specific error messages to user
        if (error.message.includes('TRACKING_EXISTS')) {
          this.showMessage('This tracking number already exists in your account', 'warning');
        } else if (error.message.includes('AUTH_FAILED')) {
          this.showMessage('Please log in again to sync with backend', 'error');
        } else if (error.message.includes('INVALID_DATA')) {
          this.showMessage('Invalid tracking number format', 'error');
        } else if (error.message.includes('SERVER_ERROR')) {
          this.showMessage('Backend server error, but saved locally', 'warning');
        } else if (error.message.includes('Failed to fetch')) {
          this.showMessage('Cannot connect to backend server, but saved locally', 'warning');
        } else {
          this.showMessage('Backend sync failed, but saved locally', 'warning');
        }
      }
      
      // Try Supabase as well
      try {
        console.log('☁️ Popup: Sending to Supabase...');
        supabaseResult = await supabaseData.addTrackingRequest(trackingRequest);
        console.log('✅ Popup: Supabase success');
      } catch (error) {
        console.log('❌ Popup: Supabase failed:', error.message);
      }
      
      // Check if at least one succeeded
      if (backendResult || supabaseResult) {
        // Add to local state for immediate UI update
        this.trackingItems.push({
          id: supabaseResult?.id || Date.now().toString(),
          ...trackingRequest,
          dateAdded: new Date().toISOString(),
          source: backendResult ? 'backend_api' : 'supabase'
        });
        
        // Clear form
        document.getElementById('trackingForm').reset();
        
        // Refresh display
        await this.loadTrackingItems();
        
        // Show success message with details
        let successMsg = 'Tracking added successfully!';
        let messageType = 'success';
        
        if (backendResult && supabaseResult) {
          successMsg += ' (Synced to both backend and Supabase)';
        } else if (backendResult) {
          successMsg += ' (Backend API)';
        } else if (supabaseResult) {
          successMsg += ' (Supabase only - backend sync failed)';
          messageType = 'warning';
        } else {
          successMsg = 'Tracking saved locally (backend and Supabase sync failed)';
          messageType = 'warning';
        }
        this.showMessage(successMsg, messageType);
      } else {
        this.showMessage('Failed to add tracking to both systems', 'error');
      }
    } catch (error) {
      console.error('Error adding tracking request:', error);
      this.showMessage('Failed to add tracking request', 'error');
    }
  }

  async loadTrackingItems() {
    try {
      console.log('🔄 Loading tracking items from multiple sources...');
      console.log('🔍 Current user:', this.currentUser);
      
      let supabaseItems = [];
      let backendItems = [];
      let localItems = [];
      
      // Try Supabase first
      try {
        console.log('☁️ Loading from Supabase...');
        const supabaseResult = await supabaseData.getTrackingItems();
        console.log('🔍 Supabase result:', supabaseResult);
        
        if (supabaseResult.success) {
          supabaseItems = supabaseResult.data || [];
          console.log(`✅ Supabase: Loaded ${supabaseItems.length} items`);
        } else {
          console.log('❌ Supabase failed:', supabaseResult);
        }
      } catch (supabaseError) {
        console.log('❌ Supabase error:', supabaseError.message);
      }
      
      // Try Backend API
      try {
        console.log('🌐 Loading from Backend API...');
        const accessToken = await supabaseAuth.getAccessToken();
        console.log('🔑 Auth0 token for backend API:', accessToken ? `Present (${accessToken.length} chars)` : 'MISSING');
        
        if (accessToken) {
          const endpoint = 'http://localhost:3000/api/tracking/user';
          console.log(`🌐 Making GET request to: ${endpoint}`);
          console.log(`🔑 Authorization header: Bearer ${accessToken.substring(0, 20)}...`);
          
          const startTime = Date.now();
          const backendResponse = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'User-Agent': 'TrackHub-Chrome-Extension/1.0'
            }
          });
          const endTime = Date.now();
          
          console.log(`⏱️ Backend API request took: ${endTime - startTime}ms`);
          console.log(`📡 Backend API response status: ${backendResponse.status} ${backendResponse.statusText}`);
          console.log(`📡 Backend API response headers:`, Object.fromEntries(backendResponse.headers.entries()));
          
          if (backendResponse.ok) {
            const backendData = await backendResponse.json();
            backendItems = Array.isArray(backendData) ? backendData : [];
            console.log(`✅ Backend API: Loaded ${backendItems.length} items`);
            console.log(`✅ Backend API data:`, backendData);
          } else {
            const errorText = await backendResponse.text();
            console.log('❌ Backend API failed:', backendResponse.status, backendResponse.statusText, errorText);
          }
        } else {
          console.log('❌ No auth token for backend API');
        }
      } catch (backendError) {
        console.log('❌ Backend API error:', backendError.message);
        console.log('❌ Backend API error details:', backendError);
      }
      
      // Try local storage as fallback
      try {
        console.log('💾 Loading from local storage...');
        const localResult = await chrome.storage.local.get(['trackingItems']);
        localItems = localResult.trackingItems || [];
        console.log(`✅ Local storage: Loaded ${localItems.length} items`);
      } catch (localError) {
        console.log('❌ Local storage error:', localError.message);
      }
      
      // Merge and deduplicate items
      const allItems = [...supabaseItems, ...backendItems, ...localItems];
      const uniqueItems = this.deduplicateItems(allItems);
      
      console.log('🔍 Final merged items:', uniqueItems.length);
      console.log('🔍 Items breakdown:', {
        supabase: supabaseItems.length,
        backend: backendItems.length,
        local: localItems.length,
        unique: uniqueItems.length
      });
      
      this.trackingItems = uniqueItems;
      this.displayTrackingItems();
      
      // Show summary
      let sourceInfo = [];
      if (supabaseItems.length > 0) sourceInfo.push(`Supabase: ${supabaseItems.length}`);
      if (backendItems.length > 0) sourceInfo.push(`Backend: ${backendItems.length}`);
      if (localItems.length > 0) sourceInfo.push(`Local: ${localItems.length}`);
      
      console.log(`✅ Loaded ${uniqueItems.length} tracking items from: ${sourceInfo.join(', ')}`);
      
    } catch (error) {
      console.error('❌ Error loading tracking items:', error);
      this.trackingItems = [];
      this.displayTrackingItems();
    }
  }

  // Deduplicate items by tracking number
  deduplicateItems(items) {
    const seen = new Set();
    return items.filter(item => {
      const key = item.trackingNumber || item.tracking_number;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  displayTrackingItems() {
    console.log('🔄 Displaying tracking items...');
    console.log('🔍 Tracking items count:', this.trackingItems.length);
    console.log('🔍 Tracking items data:', this.trackingItems);
    
    const container = document.getElementById('trackingItems');
    const countElement = document.getElementById('trackingCount');
    container.innerHTML = '';

    // Update count
    const count = this.trackingItems.length;
    countElement.textContent = `${count} ${count === 1 ? 'request' : 'requests'}`;

    if (this.trackingItems.length === 0) {
      console.log('📦 No tracking items, showing empty state');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <h3>No tracking requests yet</h3>
          <p>Add your first tracking number above to start tracking packages with real-time updates!</p>
          <div class="empty-state-features">
            <p>✨ Auto-detects carrier from tracking number</p>
            <p>🔄 Real-time sync across devices</p>
            <p>☁️ Secure cloud storage</p>
          </div>
        </div>
      `;
      return;
    }

    // Create tracking requests
    this.trackingItems.forEach(item => {
      const itemElement = document.createElement('div');
      itemElement.className = 'tracking-item';
      itemElement.setAttribute('data-item-id', item.id);
      
      // Get carrier info
      const carrier = item.carrier || { display_name: item.carrierId || 'Unknown' };
      const carrierIcon = this.getCarrierIcon(item.carrierId);
      const carrierLabel = carrier.display_name || this.getCarrierLabel(item.carrierId);
      
      // Get latest shipment status
      const latestShipment = item.shipments && item.shipments.length > 0 ? item.shipments[0] : null;
      const currentStatus = latestShipment?.current_status || item.status || 'pending';
      const currentLocation = latestShipment?.current_location || '';
      
      itemElement.innerHTML = `
        <div class="tracking-info">
          <div class="tracking-number">${item.tracking_number || item.trackingNumber}</div>
          <div class="tracking-brand">${carrierIcon} ${carrierLabel}</div>
          <div class="tracking-status">Status: ${currentStatus}</div>
          ${currentLocation ? `<div class="tracking-location">📍 ${currentLocation}</div>` : ''}
          ${item.metadata?.description ? `<div class="tracking-description">${item.metadata.description}</div>` : ''}
          ${item.source === 'supabase' ? '<div class="sync-indicator">🔄 Synced</div>' : ''}
        </div>
        <div class="tracking-actions">
          <button class="btn-icon track-btn" title="Track Package">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span>Track</span>
          </button>
          <button class="btn-icon copy-btn" title="Copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy</span>
          </button>
          <button class="btn-icon delete-btn" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"/>
              <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
            </svg>
            <span>Delete</span>
          </button>
        </div>
      `;
      container.appendChild(itemElement);
    });

    // Add event listeners
    this.addTrackingItemEventListeners();
  }

  addTrackingItemEventListeners() {
    // Track button
    document.querySelectorAll('.track-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
        this.trackPackage(itemId);
      });
    });

    // Copy button
    document.querySelectorAll('.copy-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
        const item = this.trackingItems.find(i => i.id === itemId);
        if (item) {
          this.copyTracking(item.tracking_number || item.trackingNumber);
        }
      });
    });

    // Delete button
    document.querySelectorAll('.delete-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const itemId = button.closest('.tracking-item').getAttribute('data-item-id');
        this.deleteTracking(itemId);
      });
    });
  }

  async trackPackage(itemId) {
    const item = this.trackingItems.find(i => i.id === itemId);
    if (!item) return;

    try {
      const trackingUrl = this.getTrackingUrl(item.brand, item.tracking_number || item.trackingNumber);
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
      // Delete from Supabase
      await supabaseData.deleteTrackingRequest(itemId);
      
      // Remove from local state
      this.trackingItems = this.trackingItems.filter(item => item.id !== itemId);
      
      // Refresh display
      await this.loadTrackingItems();
      this.showMessage('Tracking request deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting tracking request:', error);
      this.showMessage('Failed to delete tracking request', 'error');
    }
  }

  async setupRealtimeSync() {
    try {
      console.log('Setting up real-time sync...');
      
      this.realtimeSubscription = await supabaseData.setupRealtimeSync((payload) => {
        console.log('Real-time update received:', payload);
        this.handleRealtimeUpdate(payload);
      });
      
      console.log('✅ Real-time sync established');
    } catch (error) {
      console.error('Error setting up real-time sync:', error);
    }
  }

  async handleRealtimeUpdate(payload) {
    try {
      console.log('Handling real-time update:', payload);
      
      switch (payload.type) {
        case 'insert':
          // Add new item to local state
          this.trackingItems.unshift(payload.data);
          this.displayTrackingItems();
          this.showMessage('New tracking item synced!', 'info');
          break;
          
        case 'update':
          // Update existing item
          const index = this.trackingItems.findIndex(item => item.id === payload.data.id);
          if (index !== -1) {
            this.trackingItems[index] = payload.data;
            this.displayTrackingItems();
            this.showMessage('Tracking item updated!', 'info');
          }
          break;
          
        case 'delete':
          // Remove item from local state
          this.trackingItems = this.trackingItems.filter(item => item.id !== payload.data.id);
          this.displayTrackingItems();
          this.showMessage('Tracking item deleted!', 'info');
          break;
      }
    } catch (error) {
      console.error('Error handling real-time update:', error);
    }
  }

  async syncData() {
    try {
      this.showMessage('Syncing data from all sources...', 'info');
      console.log('🔄 SYNC: Starting full data sync...');
      
      // Force reload from all sources (Supabase, Backend API, Local)
      await this.loadTrackingItems();
      
      this.showMessage(`✅ Data synced successfully! Loaded ${this.trackingItems.length} items`, 'success');
    } catch (error) {
      console.error('Error syncing data:', error);
      this.showMessage('Sync failed. Please try again.', 'error');
    }
  }

  async testConnection() {
    try {
      this.showMessage('Testing connection...', 'info');
      
      // Test Auth0 token retrieval
      console.log('🔍 Testing Auth0 token retrieval...');
      const accessToken = await supabaseAuth.getAccessToken();
      console.log('🔑 Token test result:', accessToken ? 'SUCCESS' : 'FAILED');
      
      // Test storage
      console.log('📦 Testing Chrome storage...');
      const storageTest = await chrome.storage.local.get(['auth0_access_token', 'auth0_token_expiry']);
      console.log('📦 Storage test result:', storageTest);
      
      // Test backend API connectivity
      console.log('🌐 Testing backend API connectivity...');
      try {
        const backendResponse = await fetch('http://localhost:3000/api/health', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('🔗 Backend API connectivity:', backendResponse.status === 200 ? 'SUCCESS' : 'FAILED');
        console.log('🔗 Backend response:', backendResponse.status, backendResponse.statusText);
      } catch (backendError) {
        console.log('🔗 Backend API connectivity: FAILED -', backendError.message);
      }
      
      const authTest = await supabaseAuth.testConnection();
      const dataTest = await supabaseData.testConnection();
      
      if (authTest.success && dataTest.success && accessToken) {
        this.showMessage('✅ Connection test successful!', 'success');
      } else {
        let errorMsg = '❌ Connection test failed: ';
        if (!accessToken) errorMsg += 'No token; ';
        if (!authTest.success) errorMsg += 'Auth failed; ';
        if (!dataTest.success) errorMsg += 'Data failed; ';
        this.showMessage(errorMsg, 'error');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      this.showMessage('Connection test failed', 'error');
    }
  }

  // Fix context menu
  async fixContextMenu() {
    try {
      this.showMessage('Fixing context menu...', 'info');
      
      chrome.runtime.sendMessage({ action: 'ensureContextMenu' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error fixing context menu:', chrome.runtime.lastError);
          this.showMessage('Failed to fix context menu', 'error');
        } else {
          console.log('Context menu fix response:', response);
          this.showMessage('✅ Context menu fixed! Try right-clicking on text now.', 'success');
        }
      });
    } catch (error) {
      console.error('Error fixing context menu:', error);
      this.showMessage('Failed to fix context menu', 'error');
    }
  }

  // Refresh data from Supabase
  async refreshData() {
    try {
      this.showMessage('Refreshing data from Supabase...', 'info');
      console.log('🔄 Manual data refresh requested');
      
      // Force reload tracking items
      await this.loadTrackingItems();
      
      this.showMessage('✅ Data refreshed successfully!', 'success');
    } catch (error) {
      console.error('Error refreshing data:', error);
      this.showMessage('Failed to refresh data', 'error');
    }
  }

  // Test backend API data retrieval
  async testBackendAPI() {
    try {
      this.showMessage('Testing backend API data retrieval...', 'info');
      console.log('🧪 Testing backend API data retrieval...');
      
      // Get Auth0 token
      const accessToken = await supabaseAuth.getAccessToken();
      console.log('🔑 Auth0 token:', accessToken ? `Present (${accessToken.length} chars)` : 'MISSING');
      
      if (!accessToken) {
        throw new Error('No Auth0 token found');
      }
      
      // Test backend API endpoints
      const endpoints = [
        'http://localhost:3000/api/tracking/user',
        'http://localhost:3000/api/tracking/requests',
        'http://localhost:3000/api/user/dashboard'
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🌐 Testing endpoint: ${endpoint}`);
          console.log(`🔑 Using token: Bearer ${accessToken.substring(0, 20)}...`);
          
          const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log(`📡 Response status: ${response.status} ${response.statusText}`);
          console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
          
          if (response.ok) {
            const data = await response.json();
            console.log(`✅ Success for ${endpoint}:`, data);
            this.showMessage(`✅ Backend API working! Retrieved ${Array.isArray(data) ? data.length : 'data'} from ${endpoint}`, 'success');
          } else {
            const errorText = await response.text();
            console.log(`❌ Error for ${endpoint}:`, response.status, errorText);
            this.showMessage(`❌ Backend API error: ${response.status} - ${errorText}`, 'error');
          }
        } catch (endpointError) {
          console.log(`❌ Network error for ${endpoint}:`, endpointError.message);
          this.showMessage(`❌ Network error for ${endpoint}: ${endpointError.message}`, 'error');
        }
      }
      
    } catch (error) {
      console.error('❌ Backend API test failed:', error);
      this.showMessage(`❌ Backend API test failed: ${error.message}`, 'error');
    }
  }

  // Test specific GET request to backend
  async testBackendGET() {
    try {
      this.showMessage('Testing specific GET request...', 'info');
      console.log('🧪 Testing specific GET request to backend...');
      
      // Get Auth0 token
      const accessToken = await supabaseAuth.getAccessToken();
      console.log('🔑 Auth0 token available:', !!accessToken);
      
      if (!accessToken) {
        this.showMessage('❌ No Auth0 token found. Please log in first.', 'error');
        return;
      }
      
      // Verify token format
      console.log('🔍 Token format verification:');
      console.log('🔍 Token length:', accessToken.length);
      console.log('🔍 Token starts with:', accessToken.substring(0, 10));
      console.log('🔍 Token ends with:', accessToken.substring(accessToken.length - 10));
      console.log('🔍 Token contains dots:', (accessToken.match(/\./g) || []).length);
      
      const endpoint = 'http://localhost:3000/api/tracking/user';
      console.log(`🌐 Making GET request to: ${endpoint}`);
      console.log(`🔑 Authorization header: Bearer ${accessToken.substring(0, 20)}...`);
      
      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'TrackHub-Chrome-Extension/1.0'
        }
      });
      const endTime = Date.now();
      
      console.log(`⏱️ Request took: ${endTime - startTime}ms`);
      console.log(`📡 Response status: ${response.status} ${response.statusText}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ GET request successful! Data:`, data);
        this.showMessage(`✅ GET request successful! Retrieved ${Array.isArray(data) ? data.length : 'data'} items`, 'success');
      } else {
        const errorText = await response.text();
        console.log(`❌ GET request failed:`, response.status, errorText);
        this.showMessage(`❌ GET request failed: ${response.status} - ${errorText}`, 'error');
      }
      
    } catch (error) {
      console.error('❌ GET request test failed:', error);
      this.showMessage(`❌ GET request test failed: ${error.message}`, 'error');
    }
  }

  // Verify Bearer token format and validity
  async verifyBearerToken() {
    try {
      this.showMessage('Verifying Bearer token...', 'info');
      console.log('🔍 Verifying Bearer token format and validity...');
      
      // Get Auth0 token
      const accessToken = await supabaseAuth.getAccessToken();
      
      if (!accessToken) {
        this.showMessage('❌ No Auth0 token found. Please log in first.', 'error');
        return;
      }
      
      console.log('🔍 Token Analysis:');
      console.log('🔍 Token length:', accessToken.length);
      console.log('🔍 Token type:', typeof accessToken);
      console.log('🔍 Token preview:', accessToken.substring(0, 50) + '...');
      
      // Check if it looks like a JWT
      const parts = accessToken.split('.');
      console.log('🔍 JWT parts count:', parts.length);
      
      if (parts.length === 3) {
        try {
          // Decode JWT header
          const header = JSON.parse(atob(parts[0]));
          console.log('🔍 JWT header:', header);
          
          // Decode JWT payload
          const payload = JSON.parse(atob(parts[1]));
          console.log('🔍 JWT payload:', payload);
          
          // Check expiry
          if (payload.exp) {
            const expiry = new Date(payload.exp * 1000);
            const now = new Date();
            console.log('🔍 Token expires at:', expiry.toISOString());
            console.log('🔍 Current time:', now.toISOString());
            console.log('🔍 Token expired:', now > expiry);
          }
          
          this.showMessage(`✅ Bearer token is valid JWT format. Expires: ${payload.exp ? new Date(payload.exp * 1000).toLocaleString() : 'Unknown'}`, 'success');
        } catch (jwtError) {
          console.log('❌ JWT decode error:', jwtError);
          this.showMessage('❌ Token is not valid JWT format', 'error');
        }
      } else {
        this.showMessage('❌ Token is not JWT format (should have 3 parts separated by dots)', 'error');
      }
      
    } catch (error) {
      console.error('❌ Token verification failed:', error);
      this.showMessage(`❌ Token verification failed: ${error.message}`, 'error');
    }
  }

  // Test data display (for debugging)
  testDataDisplay() {
    console.log('🧪 Testing data display...');
    
    // Add some test data
    this.trackingItems = [
      {
        id: 'test-1',
        trackingNumber: '1Z0X0Y950493254848',
        carrierId: 'ups',
        status: 'active',
        description: 'Test package',
        createdAt: new Date().toISOString()
      }
    ];
    
    console.log('🧪 Test data added:', this.trackingItems);
    this.displayTrackingItems();
    this.showMessage('🧪 Test data added for debugging', 'info');
  }

  // Load carriers from database
  async loadCarriers() {
    try {
      console.log('Loading carriers from database...');
      
      // For now, use static carriers. In production, load from Supabase
      const carriers = [
        { id: 'ups', name: 'ups', display_name: 'UPS', icon: '🚚' },
        { id: 'fedex', name: 'fedex', display_name: 'FedEx', icon: '📦' },
        { id: 'usps', name: 'usps', display_name: 'USPS', icon: '📮' },
        { id: 'dhl', name: 'dhl', display_name: 'DHL', icon: '🌍' },
        { id: 'amazon', name: 'amazon', display_name: 'Amazon', icon: '📱' },
        { id: 'other', name: 'other', display_name: 'Other', icon: '📦' }
      ];
      
      // Populate carrier select
      const carrierSelect = document.getElementById('carrierId');
      carrierSelect.innerHTML = '<option value="">Select Carrier</option>';
      
      carriers.forEach(carrier => {
        const option = document.createElement('option');
        option.value = carrier.id;
        option.textContent = `${carrier.icon} ${carrier.display_name}`;
        carrierSelect.appendChild(option);
      });
      
      console.log('✅ Carriers loaded successfully');
    } catch (error) {
      console.error('Error loading carriers:', error);
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
    
    console.log('🧹 Input cleaned:', { original: input, cleaned: cleaned });
    return cleaned;
  }


  // Helper method to get current tab
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      return tab;
    } catch (error) {
      console.log('Could not get current tab:', error);
      return null;
    }
  }

  getCarrierIcon(brand) {
    const icons = {
      'ups': '🚚',
      'fedex': '📦',
      'usps': '📮',
      'dhl': '🌍',
      'amazon': '📱',
      'other': '📦'
    };
    return icons[brand] || '📦';
  }

  getCarrierLabel(brand) {
    const labels = {
      'ups': 'UPS',
      'fedex': 'FedEx',
      'usps': 'USPS',
      'dhl': 'DHL',
      'amazon': 'Amazon',
      'other': 'Other'
    };
    return labels[brand] || 'Other';
  }

  getStatusColor(status) {
    const colors = {
      'active': 'green',
      'pending': 'yellow',
      'completed': 'blue',
      'delivered': 'green',
      'in_transit': 'blue',
      'paused': 'orange',
      'cancelled': 'red'
    };
    return colors[status] || 'gray';
  }

  async sendToBackendAPI(trackingData) {
    try {
      console.log('🌐 Popup: Sending to backend API...');
      
      // Get Auth0 token with detailed debugging
      console.log('🔍 Popup: Getting Auth0 token...');
      const authToken = await supabaseAuth.getAccessToken();
      console.log('🔑 Popup: Auth token result:', authToken ? `Present (length: ${authToken.length})` : 'NULL');
      
      if (!authToken) {
        console.error('❌ Popup: No auth token found!');
        // Let's check what's in storage
        const storageCheck = await chrome.storage.local.get([
          'auth0_access_token',
          'auth0_token_expiry',
          'auth0_user_info'
        ]);
        console.log('📦 Popup: Storage check:', storageCheck);
        throw new Error('No valid access token found');
      }
      
      // Prepare backend request
      const backendRequest = {
        method: 'POST',
        url: 'http://localhost:3000/api/tracking/add',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'X-Extension-Version': '1.0.0'
        },
          body: {
            trackingNumber: trackingData.trackingNumber,
            ...(trackingData.carrierId && { brand: trackingData.carrierId }),
            ...(trackingData.description && { description: trackingData.description }),
            ...(trackingData.status && { status: trackingData.status })
          }
      };
      
      console.log('🔵 Popup: Backend API request prepared:', {
        url: backendRequest.url,
        method: backendRequest.method,
        hasAuth: !!backendRequest.headers.Authorization,
        authHeader: backendRequest.headers.Authorization.substring(0, 20) + '...'
      });

      // Send to backend API
      const response = await fetch(backendRequest.url, {
        method: backendRequest.method,
        headers: backendRequest.headers,
        body: JSON.stringify(backendRequest.body)
      });

      console.log('📡 Popup: Backend API response status:', response.status, response.statusText);
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Popup: Backend API success:', result);
        return result;
      } else {
        const errorText = await response.text();
        console.log('❌ Popup: Backend API error:', response.status, errorText);
        throw new Error(`Backend API failed: ${response.status} ${response.statusText}`);
      }
      
    } catch (error) {
      console.error('❌ Popup: Error sending to backend API:', error);
      throw error;
    }
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
  window.trackHubPopup = new TrackHubSupabasePopup();
});
