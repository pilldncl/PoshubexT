// Tracking Service for TrackHub Chrome Extension
// Handles tracking item synchronization with backend

export const TRACKING_SERVICE_CONFIG = {
  // Use same base URL as auth service
  baseUrl: 'http://localhost:3000', // Should match auth-service.js
  
  endpoints: {
    addTracking: '/api/tracking/add',
    deleteTracking: '/api/tracking/delete',
    updateTracking: '/api/tracking/update',
    getUserTrackings: '/api/tracking/user',
    syncTrackings: '/api/tracking/sync'
  },
  
  storageKeys: {
    trackingItems: 'trackhub_tracking_items',
    lastSyncTime: 'trackhub_last_sync_time',
    syncInProgress: 'trackhub_sync_in_progress'
  }
};

export class TrackingService {
  constructor() {
    this.config = TRACKING_SERVICE_CONFIG;
  }

  // Get authentication token from auth service
  async getAuthToken() {
    try {
      const result = await chrome.storage.local.get(['trackhub_access_token']);
      const token = result.trackhub_access_token || null;
      console.log('🔑 Auth token retrieved:', token ? 'Present' : 'Missing');
      return token;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  // Get authentication headers
  async getAuthHeaders() {
    const token = await this.getAuthToken();
    
    // Try different token formats based on what backend expects
    let authHeader = '';
    if (token) {
      // Check if token already has Bearer prefix
      if (token.startsWith('Bearer ')) {
        authHeader = token;
      } else {
        // Try Bearer format first (most common)
        authHeader = `Bearer ${token}`;
      }
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'X-Extension-Version': '1.0.0'
    };
  }

  // Test different token formats with backend
  async testTokenFormats() {
    const token = await this.getAuthToken();
    if (!token) {
      console.log('🔴 No token available for testing');
      return;
    }

    const formats = [
      { name: 'Bearer Token', header: `Bearer ${token}` },
      { name: 'Raw Token', header: token },
      { name: 'Token Header', header: `Token ${token}` },
      { name: 'API Key', header: `Api-Key ${token}` }
    ];

    console.log('🧪 Testing different token formats...');
    
    for (const format of formats) {
      try {
        const response = await fetch(`${this.config.baseUrl}/api/user/profile`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': format.header,
            'X-Extension-Version': '1.0.0'
          }
        });

        console.log(`🔍 ${format.name}: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
          console.log(`✅ ${format.name} works! Backend expects this format.`);
          return format.header;
        }
      } catch (error) {
        console.log(`❌ ${format.name} failed:`, error.message);
      }
    }
    
    console.log('🔴 No token format worked. Check backend authentication requirements.');
    return null;
  }

  // Add tracking item to backend
  async addTrackingToBackend(trackingItem) {
    try {
      console.log('🔵 Adding tracking to backend:', trackingItem);
      
      const headers = await this.getAuthHeaders();
      const requestBody = {
        trackingNumber: trackingItem.trackingNumber,
        brand: trackingItem.brand,
        description: trackingItem.description || '',
        dateAdded: trackingItem.dateAdded,
        status: trackingItem.status || 'pending'
      };
      
      console.log('🔵 Request URL:', `${this.config.baseUrl}${this.config.endpoints.addTracking}`);
      console.log('🔵 Request headers:', headers);
      console.log('🔵 Request body:', requestBody);
      
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.addTracking}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log('🔵 Response status:', response.status);
      console.log('🔵 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🔴 Backend add tracking failed:', response.status, errorData);
        
        // Log detailed validation errors
        if (response.status === 400 && errorData.details) {
          console.error('🔴 Validation details:', errorData.details);
        }
        
        throw new Error(this.handleTrackingError(response, errorData, 'add'));
      }

      const data = await response.json();
      console.log('🟢 Tracking added to backend successfully:', data);
      
      // Return the backend response which should include the backend ID
      return {
        success: true,
        backendId: data.id || data.trackingId,
        data: data
      };

    } catch (error) {
      console.error('🔴 Error adding tracking to backend:', error);
      throw error;
    }
  }

  // Get user's tracking items from backend
  async getUserTrackingsFromBackend() {
    try {
      console.log('Fetching user trackings from backend...');
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.getUserTrackings}`, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.handleTrackingError(response, errorData, 'fetch'));
      }

      const data = await response.json();
      console.log('User trackings fetched from backend:', data);
      
      // Transform backend data to match local format
      const trackingItems = (data.trackings || data.trackingItems || data).map(item => ({
        id: item.id || item.trackingId,
        backendId: item.id || item.trackingId,
        trackingNumber: item.trackingNumber,
        brand: item.brand || item.carrier,
        description: item.description || '',
        dateAdded: item.dateAdded || item.createdAt,
        status: item.status || 'pending',
        lastUpdated: item.updatedAt || item.lastUpdated
      }));

      return {
        success: true,
        trackingItems
      };

    } catch (error) {
      console.error('Error fetching trackings from backend:', error);
      throw error;
    }
  }

  // Update tracking item in backend
  async updateTrackingInBackend(trackingItem) {
    try {
      console.log('Updating tracking in backend:', trackingItem);
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.updateTracking}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          id: trackingItem.backendId || trackingItem.id,
          trackingNumber: trackingItem.trackingNumber,
          brand: trackingItem.brand,
          description: trackingItem.description || '',
          status: trackingItem.status
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.handleTrackingError(response, errorData, 'update'));
      }

      const data = await response.json();
      console.log('Tracking updated in backend successfully:', data);
      
      return {
        success: true,
        data: data
      };

    } catch (error) {
      console.error('Error updating tracking in backend:', error);
      throw error;
    }
  }

  // Delete tracking item from backend
  async deleteTrackingFromBackend(trackingItem) {
    try {
      console.log('Deleting tracking from backend:', trackingItem);
      
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.deleteTracking}`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({
          id: trackingItem.backendId || trackingItem.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(this.handleTrackingError(response, errorData, 'delete'));
      }

      console.log('Tracking deleted from backend successfully');
      
      return {
        success: true
      };

    } catch (error) {
      console.error('Error deleting tracking from backend:', error);
      throw error;
    }
  }

  // Sync local tracking items with backend
  async syncWithBackend() {
    try {
      console.log('Starting sync with backend...');
      
      // Check if sync is already in progress
      const syncStatus = await chrome.storage.local.get([this.config.storageKeys.syncInProgress]);
      if (syncStatus[this.config.storageKeys.syncInProgress]) {
        console.log('Sync already in progress, skipping...');
        return { success: true, message: 'Sync already in progress' };
      }

      // Mark sync as in progress
      await chrome.storage.local.set({ [this.config.storageKeys.syncInProgress]: true });

      // Get local tracking items
      const localResult = await chrome.storage.local.get([this.config.storageKeys.trackingItems]);
      const localTrackings = localResult[this.config.storageKeys.trackingItems] || [];

      // Get backend tracking items
      const backendResult = await this.getUserTrackingsFromBackend();
      const backendTrackings = backendResult.trackingItems || [];

      // Merge and resolve conflicts
      const mergedTrackings = this.mergeTrackingItems(localTrackings, backendTrackings);

      // Save merged items locally
      await chrome.storage.local.set({ 
        [this.config.storageKeys.trackingItems]: mergedTrackings,
        [this.config.storageKeys.lastSyncTime]: Date.now()
      });

      // Mark sync as complete
      await chrome.storage.local.remove([this.config.storageKeys.syncInProgress]);

      console.log('Sync completed successfully');
      return {
        success: true,
        localCount: localTrackings.length,
        backendCount: backendTrackings.length,
        mergedCount: mergedTrackings.length
      };

    } catch (error) {
      console.error('Error syncing with backend:', error);
      // Mark sync as complete even on error
      await chrome.storage.local.remove([this.config.storageKeys.syncInProgress]);
      throw error;
    }
  }

  // Merge local and backend tracking items
  mergeTrackingItems(localTrackings, backendTrackings) {
    const merged = [];
    const processedIds = new Set();

    // Add backend items first (they have backend IDs)
    backendTrackings.forEach(backendItem => {
      merged.push({
        ...backendItem,
        backendId: backendItem.id,
        source: 'backend'
      });
      processedIds.add(backendItem.trackingNumber);
    });

    // Add local items that don't exist in backend
    localTrackings.forEach(localItem => {
      if (!processedIds.has(localItem.trackingNumber)) {
        merged.push({
          ...localItem,
          source: 'local'
        });
      }
    });

    return merged;
  }

  // Handle tracking-specific errors
  handleTrackingError(response, errorData, operation) {
    switch (response.status) {
      case 400:
        return `Invalid tracking data. Please check your input.`;
      case 401:
        return `Authentication required. Please login again.`;
      case 403:
        return `Access denied. You don't have permission to ${operation} tracking items.`;
      case 404:
        return `Tracking item not found.`;
      case 409:
        return `Tracking number already exists.`;
      case 422:
        return errorData.message || `Validation failed for tracking data.`;
      case 500:
        return `Server error. Please try again later.`;
      default:
        return errorData.message || `${operation} tracking failed: ${response.status}`;
    }
  }

  // Load tracking items (local first, then sync with backend)
  async loadTrackingItems() {
    try {
      // Get local items first for immediate display
      const localResult = await chrome.storage.local.get([this.config.storageKeys.trackingItems]);
      const localTrackings = localResult[this.config.storageKeys.trackingItems] || [];

      // Try to sync with backend in background
      try {
        await this.syncWithBackend();
        // After sync, get the updated items
        const updatedResult = await chrome.storage.local.get([this.config.storageKeys.trackingItems]);
        return updatedResult[this.config.storageKeys.trackingItems] || [];
      } catch (syncError) {
        console.log('Background sync failed, using local items:', syncError.message);
        return localTrackings;
      }

    } catch (error) {
      console.error('Error loading tracking items:', error);
      return [];
    }
  }

  // Save tracking items locally
  async saveTrackingItemsLocally(trackingItems) {
    try {
      await chrome.storage.local.set({ 
        [this.config.storageKeys.trackingItems]: trackingItems 
      });
    } catch (error) {
      console.error('Error saving tracking items locally:', error);
      throw error;
    }
  }
}
