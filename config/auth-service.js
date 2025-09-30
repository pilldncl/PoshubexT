// Authentication Service for TrackHub Chrome Extension
// Handles login/signup with your backend API

export const AUTH_SERVICE_CONFIG = {
  // Update this with your actual backend URL
  baseUrl: 'http://localhost:3000', // Replace with your actual backend URL
  
  endpoints: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    userProfile: '/api/user/profile',
    refreshToken: '/api/auth/refresh',
    logout: '/api/auth/logout'
  },
  
  storageKeys: {
    accessToken: 'trackhub_access_token',
    refreshToken: 'trackhub_refresh_token',
    userInfo: 'trackhub_user_info',
    tokenExpiry: 'trackhub_token_expiry',
    isLoggedIn: 'trackhub_is_logged_in'
  }
};

export class AuthService {
  constructor() {
    this.config = AUTH_SERVICE_CONFIG;
  }

  // Login with email and password
  async login(email, password) {
    try {
      console.log('Attempting login with backend...');
      
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.login}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Version': '1.0.0'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific HTTP status codes
        const errorMessage = this.handleHttpError(response, errorData, 'login');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Login successful:', data);

      // Store authentication data
      await this.storeAuthData(data);

      return {
        success: true,
        user: data.user || {
          id: data.userId || data.id,
          email: data.email,
          name: data.name || data.email.split('@')[0]
        },
        token: data.accessToken || data.token
      };

    } catch (error) {
      console.error('Login error:', error);
      throw new Error(`Login failed: ${error.message}`);
    }
  }

  // Register new user
  async register(email, password, name = null) {
    try {
      console.log('Attempting registration with backend...');
      
      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.register}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Version': '1.0.0'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
          name: name || email.split('@')[0]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific HTTP status codes
        const errorMessage = this.handleHttpError(response, errorData, 'register');
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Registration successful:', data);

      // Store authentication data
      await this.storeAuthData(data);

      return {
        success: true,
        user: data.user || {
          id: data.userId || data.id,
          email: data.email,
          name: data.name || data.email.split('@')[0]
        },
        token: data.accessToken || data.token
      };

    } catch (error) {
      console.error('Registration error:', error);
      throw new Error(`Registration failed: ${error.message}`);
    }
  }

  // Store authentication data in Chrome storage
  async storeAuthData(authData) {
    try {
      const tokenExpiry = Date.now() + ((authData.expiresIn || 3600) * 1000);
      
      await chrome.storage.local.set({
        [this.config.storageKeys.accessToken]: authData.accessToken || authData.token,
        [this.config.storageKeys.refreshToken]: authData.refreshToken || null,
        [this.config.storageKeys.userInfo]: authData.user || {
          id: authData.userId || authData.id,
          email: authData.email,
          name: authData.name || authData.email.split('@')[0]
        },
        [this.config.storageKeys.tokenExpiry]: tokenExpiry,
        [this.config.storageKeys.isLoggedIn]: true
      });

      console.log('Auth data stored successfully');
    } catch (error) {
      console.error('Error storing auth data:', error);
      throw error;
    }
  }

  // Get stored authentication data
  async getStoredAuthData() {
    try {
      const result = await chrome.storage.local.get([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.refreshToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry,
        this.config.storageKeys.isLoggedIn
      ]);
      return result;
    } catch (error) {
      console.error('Error getting stored auth data:', error);
      return {};
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    try {
      const authData = await this.getStoredAuthData();
      
      if (!authData[this.config.storageKeys.isLoggedIn] || 
          !authData[this.config.storageKeys.accessToken]) {
        return false;
      }

      // Check token expiry
      const expiry = authData[this.config.storageKeys.tokenExpiry];
      if (expiry && Date.now() >= expiry) {
        // Token expired, try to refresh
        if (authData[this.config.storageKeys.refreshToken]) {
          return await this.refreshToken();
        }
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  // Get current user info
  async getCurrentUser() {
    try {
      const authData = await this.getStoredAuthData();
      return authData[this.config.storageKeys.userInfo] || null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Get access token
  async getAccessToken() {
    try {
      const authData = await this.getStoredAuthData();
      return authData[this.config.storageKeys.accessToken] || null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  // Refresh access token
  async refreshToken() {
    try {
      const authData = await this.getStoredAuthData();
      const refreshToken = authData[this.config.storageKeys.refreshToken];
      
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.config.baseUrl}${this.config.endpoints.refreshToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Version': '1.0.0'
        },
        body: JSON.stringify({
          refreshToken: refreshToken
        })
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      await this.storeAuthData(data);
      return true;

    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Logout user
  async logout() {
    try {
      const token = await this.getAccessToken();
      
      // Call backend logout endpoint if token exists
      if (token) {
        try {
          await fetch(`${this.config.baseUrl}${this.config.endpoints.logout}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
              'X-Extension-Version': '1.0.0'
            }
          });
        } catch (error) {
          console.log('Backend logout failed, continuing with local logout');
        }
      }

      // Clear local storage
      await chrome.storage.local.remove([
        this.config.storageKeys.accessToken,
        this.config.storageKeys.refreshToken,
        this.config.storageKeys.userInfo,
        this.config.storageKeys.tokenExpiry,
        this.config.storageKeys.isLoggedIn
      ]);

      console.log('Logout successful');
      return true;

    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  validatePassword(password) {
    if (password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters long' };
    }
    return { valid: true };
  }

  // Handle HTTP error responses with user-friendly messages
  handleHttpError(response, errorData, operation = 'operation') {
    switch (response.status) {
      case 400:
        return errorData.message || `Invalid request. Please check your input data.`;
      case 401:
        return operation === 'login' 
          ? 'Invalid email or password. Please check your credentials and try again.'
          : 'Unauthorized. Please check your credentials.';
      case 403:
        return 'Access forbidden. You do not have permission to perform this action.';
      case 404:
        return 'Service not found. Please check if the backend is running correctly.';
      case 409:
        return operation === 'register'
          ? 'Email already registered. Please use the login option instead.'
          : 'Conflict. The resource already exists.';
      case 422:
        return errorData.message || 'Validation failed. Please check your input data.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please try again later.';
      case 502:
        return 'Bad gateway. The backend service may be temporarily unavailable.';
      case 503:
        return 'Service unavailable. Please try again later.';
      default:
        return errorData.message || `${operation} failed: ${response.status} ${response.statusText}`;
    }
  }

  // Test backend connection
  async testConnection() {
    try {
      console.log('Testing backend connection to:', this.config.baseUrl);
      
      const response = await fetch(`${this.config.baseUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ Backend connection successful');
        return { success: true, message: 'Backend is reachable' };
      } else {
        console.log('❌ Backend responded with error:', response.status);
        return { success: false, message: `Backend error: ${response.status}` };
      }
    } catch (error) {
      console.error('❌ Backend connection failed:', error);
      return { 
        success: false, 
        message: `Connection failed: ${error.message}. Make sure your backend is running on ${this.config.baseUrl}` 
      };
    }
  }
}
