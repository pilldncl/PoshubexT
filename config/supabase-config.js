// Supabase Configuration for TrackHub Chrome Extension
// Replace with your actual Supabase project details

export const SUPABASE_CONFIG = {
  // Your Supabase project URL
  url: 'https://gppiizstqxhkdumfrpef.supabase.co',
  
  // Your Supabase anon key (public key)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwcGlpenN0cXhoa2R1bWZycGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NTQ5MzIsImV4cCI6MjA3NDQzMDkzMn0.YQXXbcrxk5Hc4FM3UItADVZQMcVcnpoqLA8zgJeiC0w',
  
  // Auth0 Configuration
  auth0: {
    domain: 'dev-z4qhxop4r3bvs4cs.us.auth0.com',
    clientId: 'oTfvPjHSwzhs5DryWoKLCLmoNtML3aK3',
    audience: 'https://gppiizstqxhkdumfrpef.supabase.co', // Optional
    scope: 'openid profile email'
  },
  
  // Database tables
  tables: {
    userProfiles: 'user_profiles',
    carriers: 'carriers',
    trackingRequests: 'tracking_requests',
    shipments: 'shipments'
  },
  
  // Real-time channels
  channels: {
    trackingRequests: 'tracking-requests',
    shipments: 'shipments',
    userUpdates: 'user-updates'
  },
  
  // Storage configuration
  storage: {
    bucket: 'trackhub-assets',
    public: true
  }
};

// Supabase client configuration
export const SUPABASE_OPTIONS = {
  auth: {
    // Auto refresh tokens
    autoRefreshToken: true,
    // Persist session
    persistSession: true,
    // Detect session in URL
    detectSessionInUrl: true
  },
  realtime: {
    // Enable real-time
    enabled: true,
    // Connection parameters
    params: {
      eventsPerSecond: 10
    }
  },
  global: {
    headers: {
      // We'll add Auth0 token here dynamically
    }
  }
};

// Database schema for Supabase - Updated to match your comprehensive schema
export const DATABASE_SCHEMA = {
  userProfiles: `
    CREATE TABLE user_profiles (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      avatar_url TEXT,
      auth0_id TEXT UNIQUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `,
  
  carriers: `
    CREATE TABLE carriers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      api_endpoint TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `,
  
  trackingRequests: `
    CREATE TABLE tracking_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
      tracking_number TEXT NOT NULL,
      carrier_id TEXT REFERENCES carriers(id),
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      metadata JSONB
    );
  `,
  
  shipments: `
    CREATE TABLE shipments (
      id TEXT PRIMARY KEY,
      tracking_request_id TEXT REFERENCES tracking_requests(id) ON DELETE CASCADE,
      tracking_number TEXT NOT NULL,
      carrier TEXT NOT NULL,
      expected_delivery_date TIMESTAMP,
      current_status TEXT,
      current_location TEXT,
      shipped_date TIMESTAMP,
      raw_data JSONB,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `
};

// Row Level Security (RLS) policies - Updated for your comprehensive schema
export const RLS_POLICIES = {
  userProfiles: `
    -- Users can only see their own profile
    CREATE POLICY "Users can view own profile" ON user_profiles
      FOR SELECT USING (auth.uid()::text = id);
    
    CREATE POLICY "Users can update own profile" ON user_profiles
      FOR UPDATE USING (auth.uid()::text = id);
    
    CREATE POLICY "Users can insert own profile" ON user_profiles
      FOR INSERT WITH CHECK (auth.uid()::text = id);
  `,
  
  carriers: `
    -- Carriers are public (read-only for users)
    CREATE POLICY "Anyone can view carriers" ON carriers
      FOR SELECT USING (true);
  `,
  
  trackingRequests: `
    -- Users can only see their own tracking requests
    CREATE POLICY "Users can view own tracking requests" ON tracking_requests
      FOR SELECT USING (auth.uid()::text = user_id);
    
    CREATE POLICY "Users can insert own tracking requests" ON tracking_requests
      FOR INSERT WITH CHECK (auth.uid()::text = user_id);
    
    CREATE POLICY "Users can update own tracking requests" ON tracking_requests
      FOR UPDATE USING (auth.uid()::text = user_id);
    
    CREATE POLICY "Users can delete own tracking requests" ON tracking_requests
      FOR DELETE USING (auth.uid()::text = user_id);
  `,
  
  shipments: `
    -- Users can only see shipments for their tracking requests
    CREATE POLICY "Users can view own shipments" ON shipments
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM tracking_requests 
          WHERE tracking_requests.id = shipments.tracking_request_id 
          AND tracking_requests.user_id = auth.uid()::text
        )
      );
    
    CREATE POLICY "Users can insert own shipments" ON shipments
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM tracking_requests 
          WHERE tracking_requests.id = shipments.tracking_request_id 
          AND tracking_requests.user_id = auth.uid()::text
        )
      );
    
    CREATE POLICY "Users can update own shipments" ON shipments
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM tracking_requests 
          WHERE tracking_requests.id = shipments.tracking_request_id 
          AND tracking_requests.user_id = auth.uid()::text
        )
      );
  `
};

// Helper function to get Supabase URL for Chrome extension
export function getSupabaseUrl() {
  return SUPABASE_CONFIG.url;
}

// Helper function to get Auth0 configuration
export function getAuth0Config() {
  return SUPABASE_CONFIG.auth0;
}
