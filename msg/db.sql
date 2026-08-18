-- 1. TABEL ROOM
CREATE TABLE IF NOT EXISTS rooms (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code VARCHAR(32) NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expired_at TIMESTAMPTZ NOT NULL
);

-- 2. TABEL MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  room_code VARCHAR(32) NOT NULL REFERENCES rooms(room_code) ON DELETE CASCADE,
  sender_name VARCHAR(50) NOT NULL,
  sender_token VARCHAR(64) NOT NULL,
  message TEXT NOT NULL,
  reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 4. KEBIJAKAN KEAMANAN (RLS POLICIES)

-- Kebijakan Room:
-- Siapa saja (anon/authenticated) bisa membaca room
CREATE POLICY "Public read rooms" 
ON rooms FOR SELECT 
USING (true);

-- Hanya user yang terautentikasi (login) yang bisa membuat room baru
CREATE POLICY "Authenticated users create rooms" 
ON rooms FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = created_by);

-- Kebijakan Messages:
-- Siapa saja bisa membaca pesan di room
CREATE POLICY "Public read messages" 
ON messages FOR SELECT 
USING (true);

-- Siapa saja (bahkan tanpa login, berbekal sender_token) bisa mengirim pesan
CREATE POLICY "Public insert messages" 
ON messages FOR INSERT 
WITH CHECK (true);