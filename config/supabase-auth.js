// Supabase + Auth0 Authentication Service for TrackHub Chrome Extension
// This replaces the complex multi-layered auth system with a simple Supabase + Auth0 approach

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG, SUPABASE_OPTIONS } from './supabase-config.js';

export class SupabaseAuthService {
  constructor() {
    this.supabase = createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      SUPABASE_OPTIONS
    );
    this.currentUser = null;
    this.realtimeSubscription = null;
    this.auth0Token = null;
  }

  // Initialize Supabase client
  async initialize() {
    try {
      console.log('Initializing Supabase client...');
      
      // Check for stored Auth0 tokens first
      const storedTokens = await this.getStoredAuth0Tokens();
      
      if (storedTokens && !this.isTokenExpired(storedTokens.expiry)) {
        console.log('Valid Auth0 tokens found, loading user profile...');
        
        // Load user profile from Supabase
        const userProfile = await this.loadUserProfile(storedTokens.userInfo.sub);
        
        if (userProfile) {
          this.currentUser = userProfile;
          return { authenticated: true, user: userProfile };
        }
      }
      
      // Clear expired tokens
      if (storedTokens && this.isTokenExpired(storedTokens.expiry)) {
        await this.clearStoredTokens();
      }
      
      return { authenticated: false, user: null };
    } catch (error) {
      console.error('Error initializing Supabase:', error);
      return { authenticated: false, user: null };
    }
  }

  // Authenticate with Auth0
  async authenticateWithAuth0() {
    try {
      console.log('Starting Auth0 authentication...');
      
      // Use Chrome Identity API to get Auth0 token
      const authUrl = this.buildAuth0Url();
      
      // Launch Auth0 flow
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      
      // Extract authorization code
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      
      if (!code) {
        throw new Error('No authorization code received from Auth0');
      }
      
      // Exchange code for tokens
      const tokens = await this.exchangeCodeForTokens(code);
      
      // Store Auth0 tokens in Chrome storage
      await this.storeAuth0Tokens(tokens);
      
      // Create or update user profile in Supabase
      const userProfile = await this.createUserProfile(tokens);
      
      this.currentUser = userProfile;
      console.log('Auth0 authentication successful:', userProfile.email);
      
      return {
        success: true,
        user: userProfile,
        tokens: tokens
      };
      
    } catch (error) {
      console.error('Auth0 authentication error:', error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Build Auth0 authorization URL
  buildAuth0Url() {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: SUPABASE_CONFIG.auth0.clientId,
      redirect_uri: chrome.identity.getRedirectURL(),
      scope: SUPABASE_CONFIG.auth0.scope,
      audience: SUPABASE_CONFIG.auth0.audience || '',
      state: 'trackhub_auth_' + Date.now()
    });
    
    return `https://${SUPABASE_CONFIG.auth0.domain}/authorize?${params.toString()}`;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code) {
    try {
      const response = await fetch(`https://${SUPABASE_CONFIG.auth0.domain}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          client_id: SUPABASE_CONFIG.auth0.clientId,
          code: code,
          redirect_uri: chrome.identity.getRedirectURL()
        })
      });
      
      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Token exchange error:', error);
      throw error;
    }
  }

  // Store Auth0 tokens in Chrome storage
  async storeAuth0Tokens(tokens) {
    try {
      console.log('💾 Storing Auth0 tokens...');
      console.log('🔑 Access token length:', tokens.access_token ? tokens.access_token.length : 'NO TOKEN');
      console.log('⏰ Expires in:', tokens.expires_in, 'seconds');
      
      this.auth0Token = tokens.access_token;
      
      const expiryTime = Date.now() + (tokens.expires_in * 1000);
      console.log('📅 Token expires at:', new Date(expiryTime).toISOString());
      
      await chrome.storage.local.set({
        'auth0_access_token': tokens.access_token,
        'auth0_id_token': tokens.id_token,
        'auth0_refresh_token': tokens.refresh_token,
        'auth0_token_expiry': expiryTime,
        'auth0_user_info': tokens.user_info || {}
      });
      
      console.log('✅ Auth0 tokens stored successfully');
      
      // Verify storage
      const verification = await chrome.storage.local.get(['auth0_access_token', 'auth0_token_expiry']);
      console.log('✅ Storage verification:', {
        hasToken: !!verification.auth0_access_token,
        tokenLength: verification.auth0_access_token ? verification.auth0_access_token.length : 0,
        expiry: verification.auth0_token_expiry ? new Date(verification.auth0_token_expiry).toISOString() : 'NO EXPIRY'
      });
    } catch (error) {
      console.error('Error storing Auth0 tokens:', error);
      throw error;
    }
  }

  // Create or update user profile in Supabase
  async createUserProfile(tokens) {
    try {
      // Decode JWT token to get user info
      const userInfo = this.decodeJWT(tokens.id_token);
      
      // Create user profile data
      const userProfile = {
        id: userInfo.sub, // Auth0 user ID
        auth0_id: userInfo.sub,
        email: userInfo.email,
        full_name: userInfo.name || userInfo.nickname,
        avatar_url: userInfo.picture
      };
      
      // Upsert user profile in Supabase
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.userProfiles)
        .upsert(userProfile, { onConflict: 'auth0_id' })
        .select()
        .single();
      
      if (error) {
        throw new Error(`Failed to create user profile: ${error.message}`);
      }
      
      console.log('User profile created/updated:', data.email);
      return data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  // Decode JWT token (simple base64 decode)
  decodeJWT(token) {
    try {
      const parts = token.split('.');
      const payload = parts[1];
      const decoded = atob(payload);
      return JSON.parse(decoded);
    } catch (error) {
      console.error('Error decoding JWT:', error);
      throw error;
    }
  }

  // Get stored Auth0 tokens from Chrome storage
  async getStoredAuth0Tokens() {
    try {
      const result = await chrome.storage.local.get([
        'auth0_access_token',
        'auth0_id_token',
        'auth0_refresh_token',
        'auth0_token_expiry',
        'auth0_user_info'
      ]);
      
      if (result.auth0_access_token && result.auth0_token_expiry) {
        return {
          accessToken: result.auth0_access_token,
          idToken: result.auth0_id_token,
          refreshToken: result.auth0_refresh_token,
          expiry: result.auth0_token_expiry,
          userInfo: result.auth0_user_info
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting stored Auth0 tokens:', error);
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(expiry) {
    return Date.now() >= expiry;
  }

  // Load user profile from Supabase
  async loadUserProfile(auth0Id) {
    try {
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.userProfiles)
        .select('*')
        .eq('auth0_id', auth0Id)
        .single();
      
      if (error) {
        console.error('Error loading user profile:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  // Clear stored tokens
  async clearStoredTokens() {
    try {
      await chrome.storage.local.remove([
        'auth0_access_token',
        'auth0_id_token',
        'auth0_refresh_token',
        'auth0_token_expiry',
        'auth0_user_info'
      ]);
      console.log('Stored tokens cleared');
    } catch (error) {
      console.error('Error clearing stored tokens:', error);
    }
  }

  // Get current user
  async getCurrentUser() {
    try {
      if (this.currentUser) {
        return this.currentUser;
      }
      
      // Try to load from stored tokens
      const storedTokens = await this.getStoredAuth0Tokens();
      if (storedTokens && !this.isTokenExpired(storedTokens.expiry)) {
        const userProfile = await this.loadUserProfile(storedTokens.userInfo.sub);
        if (userProfile) {
          this.currentUser = userProfile;
          return userProfile;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  // Check if user is authenticated
  async isAuthenticated() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error || !session) {
        return false;
      }
      
      // Check if session is expired
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && now >= session.expires_at) {
        console.log('Session expired, attempting refresh...');
        return await this.refreshSession();
      }
      
      return true;
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  // Refresh session
  async refreshSession() {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        console.error('Session refresh failed:', error);
        return false;
      }
      
      this.currentUser = data.user;
      console.log('Session refreshed successfully');
      return true;
    } catch (error) {
      console.error('Error refreshing session:', error);
      return false;
    }
  }

  // Logout user
  async logout() {
    try {
      console.log('Logging out user...');
      
      // Stop real-time subscriptions
      if (this.realtimeSubscription) {
        await this.supabase.removeChannel(this.realtimeSubscription);
        this.realtimeSubscription = null;
      }
      
      // Sign out from Supabase
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        console.error('Supabase logout error:', error);
      }
      
      // Clear local state
      this.currentUser = null;
      
      // Clear Chrome storage
      await chrome.storage.local.remove([
        'supabase_session',
        'supabase_user',
        'trackhub_access_token',
        'trackhub_user_info'
      ]);
      
      console.log('Logout successful');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  // Get access token
  async getAccessToken() {
    try {
      console.log('🔍 Getting access token...');
      
      if (this.auth0Token) {
        console.log('✅ Using cached token');
        return this.auth0Token;
      }
      
      console.log('📦 Checking stored tokens...');
      const storedTokens = await this.getStoredAuth0Tokens();
      console.log('📦 Stored tokens found:', !!storedTokens);
      
      if (storedTokens) {
        console.log('⏰ Token expiry:', new Date(storedTokens.expiry).toISOString());
        console.log('⏰ Current time:', new Date().toISOString());
        console.log('⏰ Token expired:', this.isTokenExpired(storedTokens.expiry));
        
        if (!this.isTokenExpired(storedTokens.expiry)) {
          this.auth0Token = storedTokens.accessToken;
          console.log('✅ Using stored token');
          return storedTokens.accessToken;
        } else {
          console.log('❌ Token expired');
        }
      } else {
        console.log('❌ No stored tokens found');
      }
      
      return null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  // Get Supabase client with Auth0 token headers
  getAuthenticatedSupabaseClient() {
    return this.supabase;
  }

  // Test Supabase connection
  async testConnection() {
    try {
      console.log('Testing Supabase connection...');
      
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Supabase connection test failed:', error);
        return { success: false, message: error.message };
      }
      
      console.log('✅ Supabase connection successful');
      return { success: true, message: 'Supabase is reachable' };
    } catch (error) {
      console.error('❌ Supabase connection failed:', error);
      return { 
        success: false, 
        message: `Connection failed: ${error.message}` 
      };
    }
  }

  // Setup real-time subscriptions
  async setupRealtimeSubscription(callback) {
    try {
      if (this.realtimeSubscription) {
        await this.supabase.removeChannel(this.realtimeSubscription);
      }
      
      this.realtimeSubscription = this.supabase
        .channel(SUPABASE_CONFIG.channels.trackingItems)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: SUPABASE_CONFIG.tables.trackingItems 
          },
          (payload) => {
            console.log('Real-time update received:', payload);
            callback(payload);
          }
        )
        .subscribe();
      
      console.log('Real-time subscription established');
      return true;
    } catch (error) {
      console.error('Error setting up real-time subscription:', error);
      return false;
    }
  }

  // Stop real-time subscriptions
  async stopRealtimeSubscription() {
    try {
      if (this.realtimeSubscription) {
        await this.supabase.removeChannel(this.realtimeSubscription);
        this.realtimeSubscription = null;
        console.log('Real-time subscription stopped');
      }
    } catch (error) {
      console.error('Error stopping real-time subscription:', error);
    }
  }
}

// Export singleton instance
export const supabaseAuth = new SupabaseAuthService();
