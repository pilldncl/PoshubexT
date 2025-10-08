-- Supabase Database Setup for TrackHub Chrome Extension
-- Run this SQL in your Supabase SQL editor

-- Enable Row Level Security
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tracking_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tracking_history ENABLE ROW LEVEL SECURITY;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auth0_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create tracking_items table
CREATE TABLE IF NOT EXISTS tracking_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,
  brand TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending',
  carrier TEXT,
  service TEXT,
  origin TEXT,
  destination TEXT,
  estimated_delivery TIMESTAMP,
  last_update TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create tracking_history table
CREATE TABLE IF NOT EXISTS tracking_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_item_id UUID REFERENCES tracking_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  location TEXT,
  description TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracking_items_user_id ON tracking_items(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_items_tracking_number ON tracking_items(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_history_tracking_item_id ON tracking_history(tracking_item_id);
CREATE INDEX IF NOT EXISTS idx_tracking_history_timestamp ON tracking_history(timestamp);

-- Row Level Security Policies

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only see their own tracking items
CREATE POLICY "Users can view own tracking items" ON tracking_items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tracking items" ON tracking_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tracking items" ON tracking_items
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracking items" ON tracking_items
  FOR DELETE USING (auth.uid() = user_id);

-- Users can only see history for their tracking items
CREATE POLICY "Users can view own tracking history" ON tracking_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tracking_items 
      WHERE tracking_items.id = tracking_history.tracking_item_id 
      AND tracking_items.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own tracking history" ON tracking_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tracking_items 
      WHERE tracking_items.id = tracking_history.tracking_item_id 
      AND tracking_items.user_id = auth.uid()
    )
  );

-- Enable real-time for tables
ALTER TABLE tracking_items REPLICA IDENTITY FULL;
ALTER TABLE tracking_history REPLICA IDENTITY FULL;

-- Create functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracking_items_updated_at BEFORE UPDATE ON tracking_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create a function to get user's tracking items with history
CREATE OR REPLACE FUNCTION get_user_tracking_items(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  tracking_number TEXT,
  brand TEXT,
  description TEXT,
  status TEXT,
  carrier TEXT,
  service TEXT,
  origin TEXT,
  destination TEXT,
  estimated_delivery TIMESTAMP,
  last_update TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  history JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.id,
    ti.tracking_number,
    ti.brand,
    ti.description,
    ti.status,
    ti.carrier,
    ti.service,
    ti.origin,
    ti.destination,
    ti.estimated_delivery,
    ti.last_update,
    ti.created_at,
    ti.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', th.id,
            'status', th.status,
            'location', th.location,
            'description', th.description,
            'timestamp', th.timestamp
          )
        )
        FROM tracking_history th
        WHERE th.tracking_item_id = ti.id
        ORDER BY th.timestamp DESC
      ),
      '[]'::jsonb
    ) as history
  FROM tracking_items ti
  WHERE ti.user_id = user_uuid
  ORDER BY ti.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Insert sample data (optional - for testing)
-- INSERT INTO users (auth0_id, email, name) VALUES 
-- ('auth0|123456789', 'test@example.com', 'Test User');

-- INSERT INTO tracking_items (user_id, tracking_number, brand, description) VALUES
-- ((SELECT id FROM users WHERE email = 'test@example.com'), '1Z999AA1234567890', 'ups', 'Test Package');

COMMIT;


