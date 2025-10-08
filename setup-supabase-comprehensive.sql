-- Supabase Database Setup for TrackHub Chrome Extension
-- Comprehensive schema matching your existing database structure
-- Run this SQL in your Supabase SQL editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS carriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tracking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS shipments ENABLE ROW LEVEL SECURITY;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  auth0_id TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  api_endpoint TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create tracking_requests table
CREATE TABLE IF NOT EXISTS tracking_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES user_profiles(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  carrier_id TEXT REFERENCES carriers(id),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Create shipments table
CREATE TABLE IF NOT EXISTS shipments (
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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracking_requests_user_id ON tracking_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_requests_tracking_number ON tracking_requests(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_request_id ON shipments(tracking_request_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_carriers_is_active ON carriers(is_active);

-- Row Level Security Policies

-- User profiles: Users can only see their own data
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid()::text = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid()::text = id);

-- Carriers: Public read-only access
CREATE POLICY "Anyone can view carriers" ON carriers
  FOR SELECT USING (true);

-- Tracking requests: Users can only see their own requests
CREATE POLICY "Users can view own tracking requests" ON tracking_requests
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own tracking requests" ON tracking_requests
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own tracking requests" ON tracking_requests
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own tracking requests" ON tracking_requests
  FOR DELETE USING (auth.uid()::text = user_id);

-- Shipments: Users can only see shipments for their tracking requests
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

-- Enable real-time for tables
ALTER TABLE tracking_requests REPLICA IDENTITY FULL;
ALTER TABLE shipments REPLICA IDENTITY FULL;

-- Create functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracking_requests_updated_at BEFORE UPDATE ON tracking_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON shipments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default carriers
INSERT INTO carriers (id, name, display_name, api_endpoint, is_active) VALUES
  ('ups', 'ups', 'UPS', 'https://www.ups.com/track', true),
  ('fedex', 'fedex', 'FedEx', 'https://www.fedex.com/fedextrack', true),
  ('usps', 'usps', 'USPS', 'https://tools.usps.com/go/TrackConfirmAction', true),
  ('dhl', 'dhl', 'DHL', 'https://www.dhl.com/tracking', true),
  ('amazon', 'amazon', 'Amazon', 'https://www.amazon.com/progress-tracker', true)
ON CONFLICT (id) DO NOTHING;

-- Create a function to get user's tracking requests with shipments
CREATE OR REPLACE FUNCTION get_user_tracking_requests(user_uuid TEXT)
RETURNS TABLE (
  id TEXT,
  tracking_number TEXT,
  carrier_id TEXT,
  status TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  metadata JSONB,
  shipments JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tr.id,
    tr.tracking_number,
    tr.carrier_id,
    tr.status,
    tr.created_at,
    tr.updated_at,
    tr.metadata,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'tracking_number', s.tracking_number,
            'carrier', s.carrier,
            'expected_delivery_date', s.expected_delivery_date,
            'current_status', s.current_status,
            'current_location', s.current_location,
            'shipped_date', s.shipped_date,
            'raw_data', s.raw_data,
            'created_at', s.created_at,
            'updated_at', s.updated_at
          )
        )
        FROM shipments s
        WHERE s.tracking_request_id = tr.id
        ORDER BY s.created_at DESC
      ),
      '[]'::jsonb
    ) as shipments
  FROM tracking_requests tr
  WHERE tr.user_id = user_uuid
  ORDER BY tr.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

COMMIT;


