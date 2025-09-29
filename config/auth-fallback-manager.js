// Authentication Fallback Manager for TrackHub
// Handles complex user scenarios and fallback strategies

import { UnifiedAuthManager, AUTH_TYPES } from './unified-auth-manager.js';

export class AuthFallbackManager {
  constructor() {
    this.authManager = new UnifiedAuthManager();
    this.fallbackHistory = [];
    this.userPreferences = null;
  }

  // Main authentication entry point with intelligent fallback
  async authenticateWithFallback(preferredMethod = null) {
    try {
      // Load user preferences
      await this.loadUserPreferences();
      
      // Determine authentication order based on preferences and availability
      const authOrder = this.determineAuthOrder(preferredMethod);
      
      // Try each authentication method in order
      for (const authMethod of authOrder) {
        try {
          console.log(`Attempting authentication with: ${authMethod}`);
          const result = await this.attemptAuthentication(authMethod);
          
          if (result.success) {
            // Record successful authentication
            await this.recordSuccessfulAuth(authMethod, result);
            return result;
          }
        } catch (error) {
          console.log(`Authentication failed for ${authMethod}:`, error.message);
          await this.recordFailedAuth(authMethod, error);
          
          // Continue to next method unless it's a critical error
          if (this.isCriticalError(error)) {
            throw error;
          }
        }
      }
      
      // All authentication methods failed
      throw new Error('All authentication methods failed. Please check your connection and try again.');
      
    } catch (error) {
      console.error('Authentication fallback failed:', error);
      throw error;
    }
  }

  // Determine authentication order based on user preferences and system capabilities
  determineAuthOrder(preferredMethod) {
    const availableMethods = this.getAvailableAuthMethods();
    const userPrefs = this.userPreferences;
    
    // Start with preferred method if specified and available
    if (preferredMethod && availableMethods.includes(preferredMethod)) {
      return [preferredMethod, ...availableMethods.filter(m => m !== preferredMethod)];
    }
    
    // Use user's last successful method if available
    if (userPrefs?.lastSuccessfulMethod && availableMethods.includes(userPrefs.lastSuccessfulMethod)) {
      return [userPrefs.lastSuccessfulMethod, ...availableMethods.filter(m => m !== userPrefs.lastSuccessfulMethod)];
    }
    
    // Default order: Chrome Identity (most secure) → Custom OAuth → Email/Password
    return [
      AUTH_TYPES.CHROME_IDENTITY,
      AUTH_TYPES.CUSTOM_OAUTH,
      AUTH_TYPES.CUSTOM_CREDENTIALS
    ].filter(method => availableMethods.includes(method));
  }

  // Get available authentication methods based on system capabilities
  getAvailableAuthMethods() {
    const methods = [];
    
    // Chrome Identity API is always available in Chrome extensions
    if (chrome.identity && chrome.identity.getAuthToken) {
      methods.push(AUTH_TYPES.CHROME_IDENTITY);
    }
    
    // Custom OAuth requires backend configuration
    if (this.isCustomOAuthConfigured()) {
      methods.push(AUTH_TYPES.CUSTOM_OAUTH);
    }
    
    // Email/Password requires backend configuration
    if (this.isCustomCredentialsConfigured()) {
      methods.push(AUTH_TYPES.CUSTOM_CREDENTIALS);
    }
    
    return methods;
  }

  // Check if custom OAuth is properly configured
  isCustomOAuthConfigured() {
    // Check if backend endpoints are configured
    const config = this.authManager.customOAuthAuth?.config;
    return config && 
           config.endpoints.auth !== 'https://your-backend.com/oauth/authorize' &&
           config.endpoints.token !== 'https://your-backend.com/oauth/token';
  }

  // Check if custom credentials are properly configured
  isCustomCredentialsConfigured() {
    // Check if backend endpoints are configured
    const config = this.authManager.customCredentialsAuth?.config;
    return config && 
           config.endpoints.login !== 'https://your-backend.com/api/auth/login' &&
           config.endpoints.register !== 'https://your-backend.com/api/auth/register';
  }

  // Attempt authentication with specific method
  async attemptAuthentication(authMethod) {
    switch (authMethod) {
      case AUTH_TYPES.CHROME_IDENTITY:
        return await this.attemptChromeIdentityAuth();
        
      case AUTH_TYPES.CUSTOM_OAUTH:
        return await this.attemptCustomOAuthAuth();
        
      case AUTH_TYPES.CUSTOM_CREDENTIALS:
        return await this.attemptCustomCredentialsAuth();
        
      default:
        throw new Error(`Unknown authentication method: ${authMethod}`);
    }
  }

  // Chrome Identity authentication with error handling
  async attemptChromeIdentityAuth() {
    try {
      const result = await this.authManager.authenticateWithChromeIdentity();
      return {
        success: true,
        user: result.user,
        authType: result.authType,
        method: 'chrome_identity'
      };
    } catch (error) {
      // Handle specific Chrome Identity errors
      if (error.message.includes('User cancelled')) {
        throw new Error('User cancelled Google sign-in');
      } else if (error.message.includes('network')) {
        throw new Error('Network error. Please check your connection.');
      } else if (error.message.includes('permission')) {
        throw new Error('Chrome privacy settings blocking authentication. Try TrackHub account instead.');
      } else {
        throw new Error(`Google sign-in failed: ${error.message}`);
      }
    }
  }

  // Custom OAuth authentication with error handling
  async attemptCustomOAuthAuth() {
    try {
      const result = await this.authManager.authenticateWithCustomOAuth();
      return {
        success: true,
        user: result.user,
        authType: result.authType,
        method: 'custom_oauth'
      };
    } catch (error) {
      // Handle specific Custom OAuth errors
      if (error.message.includes('network')) {
        throw new Error('TrackHub service temporarily unavailable. Try Google sign-in instead.');
      } else if (error.message.includes('invalid_client')) {
        throw new Error('TrackHub authentication not configured. Try Google sign-in.');
      } else {
        throw new Error(`TrackHub sign-in failed: ${error.message}`);
      }
    }
  }

  // Custom credentials authentication with error handling
  async attemptCustomCredentialsAuth() {
    try {
      // This would be called with user-provided credentials
      // For now, return a placeholder
      throw new Error('Email/Password authentication requires user input');
    } catch (error) {
      throw new Error(`Email/Password sign-in failed: ${error.message}`);
    }
  }

  // Handle specific user scenarios
  async handleUserScenario(scenario, userInput = null) {
    switch (scenario) {
      case 'first_time_user':
        return await this.handleFirstTimeUser();
        
      case 'returning_user':
        return await this.handleReturningUser();
        
      case 'enterprise_user':
        return await this.handleEnterpriseUser();
        
      case 'privacy_conscious_user':
        return await this.handlePrivacyConsciousUser();
        
      case 'network_issues':
        return await this.handleNetworkIssues();
        
      case 'authentication_failed':
        return await this.handleAuthenticationFailed();
        
      default:
        throw new Error(`Unknown user scenario: ${scenario}`);
    }
  }

  // First-time user: Guide through authentication options
  async handleFirstTimeUser() {
    const availableMethods = this.getAvailableAuthMethods();
    const recommendations = this.getAuthenticationRecommendations();
    
    return {
      scenario: 'first_time_user',
      availableMethods,
      recommendations,
      message: 'Welcome to TrackHub! Choose your preferred sign-in method.',
      suggestedOrder: this.determineAuthOrder()
    };
  }

  // Returning user: Use last successful method
  async handleReturningUser() {
    const authStatus = await this.authManager.getCurrentAuthStatus();
    
    if (authStatus.isAuthenticated) {
      return {
        scenario: 'returning_user',
        authenticated: true,
        user: authStatus.user,
        authType: authStatus.authType
      };
    }
    
    // Try to re-authenticate with last successful method
    const lastMethod = this.userPreferences?.lastSuccessfulMethod;
    if (lastMethod) {
      try {
        const result = await this.authenticateWithFallback(lastMethod);
        return {
          scenario: 'returning_user',
          authenticated: true,
          user: result.user,
          authType: result.authType,
          method: result.method
        };
      } catch (error) {
        console.log('Last successful method failed, trying alternatives');
      }
    }
    
    // Fall back to first-time user flow
    return await this.handleFirstTimeUser();
  }

  // Enterprise user: Prefer custom authentication
  async handleEnterpriseUser() {
    const enterpriseMethods = [
      AUTH_TYPES.CUSTOM_OAUTH,
      AUTH_TYPES.CUSTOM_CREDENTIALS,
      AUTH_TYPES.CHROME_IDENTITY
    ];
    
    return {
      scenario: 'enterprise_user',
      recommendedMethods: enterpriseMethods,
      message: 'Enterprise users should use TrackHub accounts for enhanced security.',
      suggestedOrder: enterpriseMethods
    };
  }

  // Privacy-conscious user: Prefer Chrome Identity
  async handlePrivacyConsciousUser() {
    const privacyMethods = [
      AUTH_TYPES.CHROME_IDENTITY,
      AUTH_TYPES.CUSTOM_OAUTH,
      AUTH_TYPES.CUSTOM_CREDENTIALS
    ];
    
    return {
      scenario: 'privacy_conscious_user',
      recommendedMethods: privacyMethods,
      message: 'Google sign-in is the most secure option with no password required.',
      suggestedOrder: privacyMethods
    };
  }

  // Network issues: Provide offline alternatives
  async handleNetworkIssues() {
    return {
      scenario: 'network_issues',
      message: 'Network connection issues detected. Please check your internet connection and try again.',
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Contact support if the issue persists'
      ],
      retryAfter: 30000 // 30 seconds
    };
  }

  // Authentication failed: Provide clear next steps
  async handleAuthenticationFailed() {
    const availableMethods = this.getAvailableAuthMethods();
    const failedMethods = this.fallbackHistory.filter(h => h.failed);
    
    return {
      scenario: 'authentication_failed',
      availableMethods,
      failedMethods,
      message: 'Authentication failed. Please try an alternative sign-in method.',
      suggestions: this.getAlternativeSuggestions(failedMethods)
    };
  }

  // Get authentication recommendations based on user context
  getAuthenticationRecommendations() {
    return {
      [AUTH_TYPES.CHROME_IDENTITY]: {
        priority: 1,
        reason: 'Most secure and convenient',
        benefits: ['No password required', 'Automatic token refresh', 'Google security'],
        icon: '🔐'
      },
      [AUTH_TYPES.CUSTOM_OAUTH]: {
        priority: 2,
        reason: 'Full control and customization',
        benefits: ['Custom business logic', 'Data ownership', 'Enterprise features'],
        icon: '🏢'
      },
      [AUTH_TYPES.CUSTOM_CREDENTIALS]: {
        priority: 3,
        reason: 'Traditional and familiar',
        benefits: ['Familiar interface', 'No external dependencies', 'Full control'],
        icon: '📧'
      }
    };
  }

  // Get alternative suggestions when methods fail
  getAlternativeSuggestions(failedMethods) {
    const suggestions = [];
    
    if (failedMethods.some(m => m.method === 'chrome_identity')) {
      suggestions.push('Try TrackHub account sign-in instead');
    }
    
    if (failedMethods.some(m => m.method === 'custom_oauth')) {
      suggestions.push('Try Google sign-in instead');
    }
    
    if (failedMethods.some(m => m.method === 'custom_credentials')) {
      suggestions.push('Try Google or TrackHub account sign-in');
    }
    
    return suggestions;
  }

  // Check if error is critical (should stop fallback attempts)
  isCriticalError(error) {
    const criticalErrors = [
      'User cancelled',
      'Invalid credentials',
      'Account locked',
      'Service unavailable'
    ];
    
    return criticalErrors.some(criticalError => 
      error.message.toLowerCase().includes(criticalError.toLowerCase())
    );
  }

  // Record successful authentication
  async recordSuccessfulAuth(method, result) {
    this.fallbackHistory.push({
      method,
      success: true,
      timestamp: Date.now(),
      user: result.user?.email || 'unknown'
    });
    
    // Update user preferences
    await this.updateUserPreferences({
      lastSuccessfulMethod: method,
      lastSuccessfulAuth: Date.now()
    });
  }

  // Record failed authentication
  async recordFailedAuth(method, error) {
    this.fallbackHistory.push({
      method,
      success: false,
      timestamp: Date.now(),
      error: error.message
    });
  }

  // Load user preferences
  async loadUserPreferences() {
    try {
      const result = await chrome.storage.local.get(['authPreferences']);
      this.userPreferences = result.authPreferences || {};
    } catch (error) {
      console.error('Error loading user preferences:', error);
      this.userPreferences = {};
    }
  }

  // Update user preferences
  async updateUserPreferences(preferences) {
    try {
      const currentPrefs = this.userPreferences || {};
      const updatedPrefs = { ...currentPrefs, ...preferences };
      
      await chrome.storage.local.set({ authPreferences: updatedPrefs });
      this.userPreferences = updatedPrefs;
    } catch (error) {
      console.error('Error updating user preferences:', error);
    }
  }

  // Get fallback history for debugging
  getFallbackHistory() {
    return this.fallbackHistory;
  }

  // Clear fallback history
  clearFallbackHistory() {
    this.fallbackHistory = [];
  }
}

// Export for use in other files
export default AuthFallbackManager;
