// Supabase Data Service for TrackHub Chrome Extension
// Comprehensive schema support with tracking requests and shipments

import { supabaseAuth } from './supabase-auth.js';
import { SUPABASE_CONFIG } from './supabase-config.js';

export class SupabaseDataService {
  constructor() {
    this.supabase = supabaseAuth.supabase;
    this.currentUser = null;
  }

  // Initialize data service
  async initialize() {
    try {
      this.currentUser = await supabaseAuth.getCurrentUser();
      if (!this.currentUser) {
        throw new Error('User not authenticated');
      }
      console.log('Supabase data service initialized for user:', this.currentUser.email);
      return true;
    } catch (error) {
      console.error('Error initializing data service:', error);
      return false;
    }
  }

  // Add tracking request
  async addTrackingRequest(trackingData) {
    try {
      console.log('Adding tracking request to Supabase:', trackingData);
      console.log('🔍 Current user in data service:', this.currentUser);
      console.log('🔍 User ID being used:', this.currentUser?.id);
      
      // Get Auth0 access token
      const accessToken = await supabaseAuth.getAccessToken();
      console.log('🔑 Access token retrieved:', accessToken ? 'YES (length: ' + accessToken.length + ')' : 'NO');
      
      if (!accessToken) {
        console.error('❌ No access token found!');
        // Let's check what's in storage
        const storedTokens = await chrome.storage.local.get([
          'auth0_access_token',
          'auth0_token_expiry',
          'auth0_user_info'
        ]);
        console.log('📦 Stored tokens:', storedTokens);
        throw new Error('No valid access token found. Please log in again.');
      }
      
      if (!this.currentUser?.id) {
        console.error('❌ No current user ID found!');
        throw new Error('No current user found. Please log in again.');
      }
      
      console.log('🌐 Making API request to:', `${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.tables.trackingRequests}`);
      console.log('📋 Request headers:', {
        'Authorization': `Bearer ${accessToken.substring(0, 20)}...`,
        'apikey': SUPABASE_CONFIG.anonKey.substring(0, 20) + '...'
      });
      
      // Make direct API call with Authorization header
      const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.tables.trackingRequests}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_CONFIG.anonKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          user_id: this.currentUser.id,
          tracking_number: trackingData.trackingNumber,
          carrier_id: trackingData.carrierId,
          status: trackingData.status || 'active',
          metadata: trackingData.metadata || {}
        })
      });

      console.log('📡 Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ API Error:', errorData);
        throw new Error(`Failed to add tracking request: ${errorData.message || response.statusText}`);
      }

      const data = await response.json();
      console.log('✅ Tracking request added successfully:', data[0]);
      
      return {
        success: true,
        data: data[0],
        id: data[0].id
      };
    } catch (error) {
      console.error('❌ Error adding tracking request:', error);
      throw error;
    }
  }

  // Get user's tracking requests with shipments
  async getTrackingItems() {
    try {
      console.log('Fetching tracking requests from Supabase...');
      console.log('🔍 Current user ID:', this.currentUser?.id);
      
      // Get Auth0 access token
      const accessToken = await supabaseAuth.getAccessToken();
      
      if (!accessToken) {
        throw new Error('No valid access token found. Please log in again.');
      }
      
      // First, let's try to get all tracking requests to see what's available
      console.log('🔍 Fetching all tracking requests to debug...');
      const allResponse = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.tables.trackingRequests}?order=created_at.desc&limit=10`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_CONFIG.anonKey
        }
      });

      if (!allResponse.ok) {
        const errorData = await allResponse.json();
        console.error('❌ Failed to fetch all tracking requests:', errorData);
        throw new Error(`Failed to fetch tracking requests: ${errorData.message || allResponse.statusText}`);
      }

      const allData = await allResponse.json();
      console.log('🔍 All tracking requests found:', allData.length);
      console.log('🔍 Sample data:', allData.slice(0, 2));
      
      // Now filter by user ID if we have one
      let filteredData = allData;
      if (this.currentUser?.id) {
        filteredData = allData.filter(item => item.user_id === this.currentUser.id);
        console.log(`🔍 Filtered by user ID ${this.currentUser.id}:`, filteredData.length);
      } else {
        console.log('⚠️ No current user ID, returning all data');
      }
      
      const data = filteredData;
      console.log(`✅ Fetched ${data.length} tracking requests`);
      
      return {
        success: true,
        data: data,
        count: data.length
      };
    } catch (error) {
      console.error('❌ Error fetching tracking requests:', error);
      throw error;
    }
  }

  // Update tracking request
  async updateTrackingRequest(requestId, updateData) {
    try {
      console.log('Updating tracking request in Supabase:', requestId, updateData);
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingRequests)
        .update({
          status: updateData.status,
          metadata: updateData.metadata,
          updated_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .eq('user_id', this.currentUser.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tracking request: ${error.message}`);
      }

      console.log('✅ Tracking request updated successfully:', data);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error updating tracking request:', error);
      throw error;
    }
  }

  // Delete tracking request
  async deleteTrackingRequest(requestId) {
    try {
      console.log('Deleting tracking request from Supabase:', requestId);
      
      // Get Auth0 access token
      const accessToken = await supabaseAuth.getAccessToken();
      
      if (!accessToken) {
        throw new Error('No valid access token found. Please log in again.');
      }
      
      // Make direct API call with Authorization header
      const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/${SUPABASE_CONFIG.tables.trackingRequests}?id=eq.${requestId}&user_id=eq.${this.currentUser.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          'apikey': SUPABASE_CONFIG.anonKey
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to delete tracking request: ${errorData.message || response.statusText}`);
      }

      console.log('✅ Tracking request deleted successfully');
      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Error deleting tracking request:', error);
      throw error;
    }
  }

  // Add shipment to tracking request
  async addShipment(trackingRequestId, shipmentData) {
    try {
      console.log('Adding shipment to tracking request:', trackingRequestId, shipmentData);
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.shipments)
        .insert({
          tracking_request_id: trackingRequestId,
          tracking_number: shipmentData.trackingNumber,
          carrier: shipmentData.carrier,
          expected_delivery_date: shipmentData.expectedDeliveryDate,
          current_status: shipmentData.currentStatus,
          current_location: shipmentData.currentLocation,
          shipped_date: shipmentData.shippedDate,
          raw_data: shipmentData.rawData || {}
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add shipment: ${error.message}`);
      }

      console.log('✅ Shipment added successfully:', data);
      return {
        success: true,
        data: data,
        id: data.id
      };
    } catch (error) {
      console.error('❌ Error adding shipment:', error);
      throw error;
    }
  }

  // Update shipment
  async updateShipment(shipmentId, updateData) {
    try {
      console.log('Updating shipment in Supabase:', shipmentId, updateData);
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.shipments)
        .update({
          current_status: updateData.currentStatus,
          current_location: updateData.currentLocation,
          expected_delivery_date: updateData.expectedDeliveryDate,
          raw_data: updateData.rawData,
          updated_at: new Date().toISOString()
        })
        .eq('id', shipmentId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update shipment: ${error.message}`);
      }

      console.log('✅ Shipment updated successfully:', data);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error updating shipment:', error);
      throw error;
    }
  }

  // Get carriers
  async getCarriers() {
    try {
      console.log('Fetching carriers from Supabase...');
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.carriers)
        .select('*')
        .eq('is_active', true)
        .order('display_name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch carriers: ${error.message}`);
      }

      console.log(`✅ Fetched ${data.length} carriers`);
      return {
        success: true,
        data: data,
        count: data.length
      };
    } catch (error) {
      console.error('❌ Error fetching carriers:', error);
      throw error;
    }
  }

  // Sync local data with Supabase
  async syncWithSupabase(localItems) {
    try {
      console.log('Syncing local data with Supabase...');
      
      // Get remote items
      const remoteResult = await this.getTrackingItems();
      const remoteItems = remoteResult.data;
      
      // Merge local and remote data
      const mergedItems = this.mergeTrackingItems(localItems, remoteItems);
      
      // Update local storage with merged data
      await chrome.storage.local.set({
        trackingItems: mergedItems,
        lastSyncTime: Date.now()
      });
      
      console.log(`✅ Sync completed: ${mergedItems.length} items`);
      return {
        success: true,
        localCount: localItems.length,
        remoteCount: remoteItems.length,
        mergedCount: mergedItems.length,
        data: mergedItems
      };
    } catch (error) {
      console.error('❌ Error syncing with Supabase:', error);
      throw error;
    }
  }

  // Merge local and remote tracking items
  mergeTrackingItems(localItems, remoteItems) {
    const merged = [];
    const processedIds = new Set();

    // Add remote items first (they have Supabase IDs)
    remoteItems.forEach(remoteItem => {
      merged.push({
        id: remoteItem.id,
        supabaseId: remoteItem.id,
        trackingNumber: remoteItem.tracking_number,
        carrierId: remoteItem.carrier_id,
        status: remoteItem.status,
        dateAdded: remoteItem.created_at,
        updatedAt: remoteItem.updated_at,
        source: 'supabase',
        metadata: remoteItem.metadata,
        carrier: remoteItem.carriers,
        shipments: remoteItem.shipments || []
      });
      processedIds.add(remoteItem.tracking_number);
    });

    // Add local items that don't exist remotely
    localItems.forEach(localItem => {
      if (!processedIds.has(localItem.trackingNumber)) {
        merged.push({
          ...localItem,
          source: 'local'
        });
      }
    });

    return merged;
  }

  // Setup real-time sync
  async setupRealtimeSync(callback) {
    try {
      console.log('Setting up real-time sync...');
      
      const subscription = this.supabase
        .channel(SUPABASE_CONFIG.channels.trackingRequests)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: SUPABASE_CONFIG.tables.trackingRequests,
            filter: `user_id=eq.${this.currentUser.id}`
          },
          async (payload) => {
            console.log('Real-time update received:', payload);
            
            // Handle different event types
            switch (payload.eventType) {
              case 'INSERT':
                await this.handleTrackingInsert(payload.new, callback);
                break;
              case 'UPDATE':
                await this.handleTrackingUpdate(payload.new, callback);
                break;
              case 'DELETE':
                await this.handleTrackingDelete(payload.old, callback);
                break;
            }
          }
        )
        .subscribe();

      console.log('✅ Real-time sync established');
      return subscription;
    } catch (error) {
      console.error('❌ Error setting up real-time sync:', error);
      throw error;
    }
  }

  // Handle tracking request insert
  async handleTrackingInsert(newItem, callback) {
    console.log('Handling tracking request insert:', newItem);
    callback({
      type: 'insert',
      data: newItem
    });
  }

  // Handle tracking request update
  async handleTrackingUpdate(updatedItem, callback) {
    console.log('Handling tracking request update:', updatedItem);
    callback({
      type: 'update',
      data: updatedItem
    });
  }

  // Handle tracking request delete
  async handleTrackingDelete(deletedItem, callback) {
    console.log('Handling tracking request delete:', deletedItem);
    callback({
      type: 'delete',
      data: deletedItem
    });
  }


  // Test Supabase connection
  async testConnection() {
    try {
      console.log('Testing Supabase data connection...');
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingRequests)
        .select('count')
        .limit(1);
      
      if (error) {
        console.error('Supabase data connection test failed:', error);
        return { success: false, message: error.message };
      }
      
      console.log('✅ Supabase data connection successful');
      return { success: true, message: 'Supabase data service is reachable' };
    } catch (error) {
      console.error('❌ Supabase data connection failed:', error);
      return { 
        success: false, 
        message: `Data connection failed: ${error.message}` 
      };
    }
  }
}

// Export singleton instance
export const supabaseData = new SupabaseDataService();
