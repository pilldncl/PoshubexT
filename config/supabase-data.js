// Supabase Data Service for TrackHub Chrome Extension
// Handles all database operations with real-time sync

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
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingRequests)
        .insert({
          user_id: this.currentUser.id,
          tracking_number: trackingData.trackingNumber,
          carrier_id: trackingData.carrierId,
          status: trackingData.status || 'active',
          metadata: trackingData.metadata || {}
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add tracking request: ${error.message}`);
      }

      console.log('✅ Tracking request added successfully:', data);
      return {
        success: true,
        data: data,
        id: data.id
      };
    } catch (error) {
      console.error('❌ Error adding tracking request:', error);
      throw error;
    }
  }

  // Get user's tracking items
  async getTrackingItems() {
    try {
      console.log('Fetching tracking items from Supabase...');
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingItems)
        .select(`
          *,
          tracking_history (
            id,
            status,
            location,
            description,
            timestamp
          )
        `)
        .eq('user_id', this.currentUser.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch tracking items: ${error.message}`);
      }

      console.log(`✅ Fetched ${data.length} tracking items`);
      return {
        success: true,
        data: data,
        count: data.length
      };
    } catch (error) {
      console.error('❌ Error fetching tracking items:', error);
      throw error;
    }
  }

  // Update tracking item
  async updateTrackingItem(itemId, updateData) {
    try {
      console.log('Updating tracking item in Supabase:', itemId, updateData);
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingItems)
        .update({
          tracking_number: updateData.trackingNumber,
          brand: updateData.brand,
          description: updateData.description,
          status: updateData.status,
          carrier: updateData.carrier,
          service: updateData.service,
          origin: updateData.origin,
          destination: updateData.destination,
          estimated_delivery: updateData.estimatedDelivery,
          last_update: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .eq('user_id', this.currentUser.id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update tracking item: ${error.message}`);
      }

      console.log('✅ Tracking item updated successfully:', data);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error updating tracking item:', error);
      throw error;
    }
  }

  // Delete tracking item
  async deleteTrackingItem(itemId) {
    try {
      console.log('Deleting tracking item from Supabase:', itemId);
      
      const { error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingItems)
        .delete()
        .eq('id', itemId)
        .eq('user_id', this.currentUser.id);

      if (error) {
        throw new Error(`Failed to delete tracking item: ${error.message}`);
      }

      console.log('✅ Tracking item deleted successfully');
      return {
        success: true
      };
    } catch (error) {
      console.error('❌ Error deleting tracking item:', error);
      throw error;
    }
  }

  // Add tracking history entry
  async addTrackingHistory(trackingItemId, historyData) {
    try {
      console.log('Adding tracking history entry:', historyData);
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingHistory)
        .insert({
          tracking_item_id: trackingItemId,
          status: historyData.status,
          location: historyData.location,
          description: historyData.description,
          timestamp: historyData.timestamp || new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add tracking history: ${error.message}`);
      }

      console.log('✅ Tracking history added successfully:', data);
      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('❌ Error adding tracking history:', error);
      throw error;
    }
  }

  // Get tracking history for an item
  async getTrackingHistory(trackingItemId) {
    try {
      console.log('Fetching tracking history for item:', trackingItemId);
      
      const { data, error } = await this.supabase
        .from(SUPABASE_CONFIG.tables.trackingHistory)
        .select('*')
        .eq('tracking_item_id', trackingItemId)
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch tracking history: ${error.message}`);
      }

      console.log(`✅ Fetched ${data.length} history entries`);
      return {
        success: true,
        data: data,
        count: data.length
      };
    } catch (error) {
      console.error('❌ Error fetching tracking history:', error);
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
        brand: remoteItem.brand,
        description: remoteItem.description,
        status: remoteItem.status,
        carrier: remoteItem.carrier,
        service: remoteItem.service,
        origin: remoteItem.origin,
        destination: remoteItem.destination,
        estimatedDelivery: remoteItem.estimated_delivery,
        lastUpdate: remoteItem.last_update,
        dateAdded: remoteItem.created_at,
        updatedAt: remoteItem.updated_at,
        source: 'supabase',
        history: remoteItem.tracking_history || []
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
        .channel(SUPABASE_CONFIG.channels.trackingItems)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: SUPABASE_CONFIG.tables.trackingItems,
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

  // Handle tracking item insert
  async handleTrackingInsert(newItem, callback) {
    console.log('Handling tracking insert:', newItem);
    callback({
      type: 'insert',
      data: newItem
    });
  }

  // Handle tracking item update
  async handleTrackingUpdate(updatedItem, callback) {
    console.log('Handling tracking update:', updatedItem);
    callback({
      type: 'update',
      data: updatedItem
    });
  }

  // Handle tracking item delete
  async handleTrackingDelete(deletedItem, callback) {
    console.log('Handling tracking delete:', deletedItem);
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
        .from(SUPABASE_CONFIG.tables.trackingItems)
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
