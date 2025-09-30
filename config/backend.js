// Backend API Configuration for TrackHub Chrome Extension

export const BACKEND_CONFIG = {
  // API Base URL - Update this with your actual backend URL
  baseUrl: 'https://your-backend-api.com', // Replace with your actual backend URL
  
  // API Endpoints
  endpoints: {
    // Tracking endpoints
    addTracking: '/api/tracking/add',
    deleteTracking: '/api/tracking/delete',
    updateTracking: '/api/tracking/update',
    getTrackings: '/api/tracking/list',
    syncTrackings: '/api/tracking/sync',
    getUserTrackings: '/api/tracking/user',
    
    // User endpoints
    getUser: '/api/user/profile',
    updateUser: '/api/user/update',
    
    // Auth endpoints
    validateToken: '/api/auth/validate',
    refreshToken: '/api/auth/refresh'
  },
  
  // Request timeout (milliseconds)
  timeout: 10000,
  
  // Retry configuration
  retry: {
    attempts: 3,
    delay: 1000
  }
};

// Backend API Helper Class
export class BackendAPI {
  constructor() {
    this.config = BACKEND_CONFIG;
  }

  // Get authentication headers
  async getAuthHeaders() {
    try {
      const token = await this.getAuthToken();
      return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Extension-Version': '1.0.0'
      };
    } catch (error) {
      console.error('Error getting auth headers:', error);
      return {
        'Content-Type': 'application/json',
        'X-Extension-Version': '1.0.0'
      };
    }
  }

  // Get authentication token
  async getAuthToken() {
    try {
      // Try OAuth token first
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

  // Make API request with retry logic
  async makeRequest(endpoint, options = {}) {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = await this.getAuthHeaders();
    
    const requestOptions = {
      method: 'GET',
      headers,
      timeout: this.config.timeout,
      ...options
    };

    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retry.attempts; attempt++) {
      try {
        console.log(`API Request (attempt ${attempt}): ${requestOptions.method} ${url}`);
        
        const response = await fetch(url, requestOptions);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log(`API Response: ${requestOptions.method} ${url}`, data);
        return data;
        
      } catch (error) {
        lastError = error;
        console.error(`API Request failed (attempt ${attempt}):`, error);
        
        if (attempt < this.config.retry.attempts) {
          await this.delay(this.config.retry.delay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  // Add tracking item
  async addTracking(trackingData) {
    try {
      const response = await this.makeRequest(this.config.endpoints.addTracking, {
        method: 'POST',
        body: JSON.stringify(trackingData)
      });
      return response;
    } catch (error) {
      console.error('Error adding tracking:', error);
      throw error;
    }
  }

  // Delete tracking item
  async deleteTracking(trackingId, trackingNumber) {
    try {
      const response = await this.makeRequest(this.config.endpoints.deleteTracking, {
        method: 'DELETE',
        body: JSON.stringify({
          trackingId,
          trackingNumber
        })
      });
      return response;
    } catch (error) {
      console.error('Error deleting tracking:', error);
      throw error;
    }
  }

  // Update tracking item
  async updateTracking(trackingId, updateData) {
    try {
      const response = await this.makeRequest(this.config.endpoints.updateTracking, {
        method: 'PUT',
        body: JSON.stringify({
          trackingId,
          ...updateData
        })
      });
      return response;
    } catch (error) {
      console.error('Error updating tracking:', error);
      throw error;
    }
  }

  // Get all tracking items
  async getTrackings() {
    try {
      const response = await this.makeRequest(this.config.endpoints.getTrackings);
      return response;
    } catch (error) {
      console.error('Error getting trackings:', error);
      throw error;
    }
  }

  // Sync tracking items
  async syncTrackings(trackingItems) {
    try {
      const response = await this.makeRequest(this.config.endpoints.syncTrackings, {
        method: 'POST',
        body: JSON.stringify({ trackings: trackingItems })
      });
      return response;
    } catch (error) {
      console.error('Error syncing trackings:', error);
      throw error;
    }
  }

  // Validate authentication token
  async validateToken() {
    try {
      const response = await this.makeRequest(this.config.endpoints.validateToken);
      return response;
    } catch (error) {
      console.error('Error validating token:', error);
      throw error;
    }
  }

  // Utility function for delays
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Example usage:
// const api = new BackendAPI();
// await api.addTracking(trackingData);
// await api.deleteTracking(trackingId, trackingNumber);
