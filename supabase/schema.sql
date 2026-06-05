-- ==========================================================================
-- Courseundo — Complete Database Schema
-- Run this in Supabase SQL Editor → New Query → Paste → Run
-- ==========================================================================
-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- ==========================================================================
-- 2. COURSES TABLE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (
    length(title) BETWEEN 5 AND 200
  ),
  link TEXT NOT NULL UNIQUE CHECK (link ~* '^https?://'),
  platform TEXT,
  category TEXT,
  institution TEXT,
  instructor TEXT,
  difficulty TEXT CHECK (
    difficulty IN ('Beginner', 'Intermediate', 'Advanced')
  ),
  duration TEXT,
  mode TEXT CHECK (mode IN ('Self-paced', 'Instructor-led')),
  format TEXT CHECK (
    format IN ('Video', 'Text', 'Interactive', 'Mixed')
  ),
  cost TEXT CHECK (
    cost IN ('Free', 'Paid', 'Subscription', 'Freemium')
  ),
  certification TEXT CHECK (certification IN ('Yes', 'No')),
  cert_type TEXT,
  validation TEXT,
  job_available TEXT CHECK (job_available IN ('Yes', 'No')),
  job_country TEXT,
  job_salary TEXT,
  job_mode TEXT CHECK (job_mode IN ('Remote', 'On-site', 'Hybrid')),
  language TEXT,
  rating_avg NUMERIC(2, 1) DEFAULT 0 CHECK (
    rating_avg BETWEEN 0 AND 5
  ),
  rating_count INTEGER DEFAULT 0 CHECK (rating_count >= 0),
  extra_fields JSONB DEFAULT '{}',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'broken')),
  embedding VECTOR(768),
  last_verified TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- Indexes
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_category ON courses(category);
CREATE INDEX IF NOT EXISTS idx_courses_platform ON courses(platform);
CREATE INDEX IF NOT EXISTS idx_courses_difficulty ON courses(difficulty);
CREATE INDEX IF NOT EXISTS idx_courses_cost ON courses(cost);
CREATE INDEX IF NOT EXISTS idx_courses_rating ON courses(rating_avg DESC);
CREATE INDEX IF NOT EXISTS idx_courses_created ON courses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_courses_language ON courses(language);
-- Full-text search index
CREATE INDEX IF NOT EXISTS idx_courses_fts ON courses USING gin(
  to_tsvector(
    'english',
    coalesce(title, '') || ' ' || coalesce(platform, '') || ' ' || coalesce(institution, '') || ' ' || coalesce(instructor, '')
  )
);
-- Vector similarity index (IVFFlat)
-- Note: requires at least some rows to build effectively.
-- Rebuild after inserting data: REINDEX INDEX idx_courses_embedding;
CREATE INDEX IF NOT EXISTS idx_courses_embedding ON courses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS courses_updated_at ON courses;
CREATE TRIGGER courses_updated_at BEFORE
UPDATE ON courses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ==========================================================================
-- 3. SUGGESTIONS TABLE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (
    length(title) BETWEEN 5 AND 200
  ),
  link TEXT NOT NULL CHECK (link ~* '^https?://'),
  platform TEXT,
  notes TEXT CHECK (length(notes) <= 2000),
  user_name TEXT CHECK (length(user_name) <= 100),
  user_email TEXT CHECK (
    user_email IS NULL
    OR user_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  ),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_address TEXT,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status);
CREATE INDEX IF NOT EXISTS idx_suggestions_created ON suggestions(created_at DESC);
-- ==========================================================================
-- 4. RATINGS TABLE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (
    rating BETWEEN 1 AND 5
  ),
  ip_hash TEXT NOT NULL,
  fingerprint TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, ip_hash)
);
CREATE INDEX IF NOT EXISTS idx_ratings_course ON ratings(course_id);
CREATE INDEX IF NOT EXISTS idx_ratings_created ON ratings(created_at DESC);
-- Auto-recalculate rating_avg and rating_count on courses
CREATE OR REPLACE FUNCTION recalculate_rating() RETURNS TRIGGER AS $$
DECLARE target_course_id UUID;
BEGIN target_course_id := COALESCE(NEW.course_id, OLD.course_id);
UPDATE courses
SET rating_avg = (
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
    FROM ratings
    WHERE course_id = target_course_id
  ),
  rating_count = (
    SELECT COUNT(*)
    FROM ratings
    WHERE course_id = target_course_id
  )
WHERE id = target_course_id;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS rating_changed ON ratings;
CREATE TRIGGER rating_changed
AFTER
INSERT
  OR
UPDATE
  OR DELETE ON ratings FOR EACH ROW EXECUTE FUNCTION recalculate_rating();
-- ==========================================================================
-- 5. ACTIVITY LOG TABLE
-- ==========================================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT now(),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  ip_country TEXT,
  ip_city TEXT,
  device_type TEXT CHECK (
    device_type IN ('Desktop', 'Mobile', 'Tablet', 'Unknown')
  ),
  browser TEXT,
  os TEXT,
  screen_size TEXT,
  referrer TEXT,
  session_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_log_action ON activity_log(action);
CREATE INDEX IF NOT EXISTS idx_log_timestamp ON activity_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_log_ip ON activity_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_log_session ON activity_log(session_id);
-- ==========================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================================
-- Enable RLS on all tables
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
-- ---- COURSES ----
-- Public can read active courses
DROP POLICY IF EXISTS "Public can read active courses" ON courses;
CREATE POLICY "Public can read active courses" ON courses FOR
SELECT USING (status = 'active');
-- Authenticated users (admins) can do everything
DROP POLICY IF EXISTS "Admins can manage courses" ON courses;
CREATE POLICY "Admins can manage courses" ON courses FOR ALL USING (auth.role() = 'authenticated');
-- ---- SUGGESTIONS ----
-- Anyone can insert suggestions
DROP POLICY IF EXISTS "Anyone can submit suggestions" ON suggestions;
CREATE POLICY "Anyone can submit suggestions" ON suggestions FOR
INSERT WITH CHECK (true);
-- Public can read pending suggestions
DROP POLICY IF EXISTS "Public can read pending suggestions" ON suggestions;
CREATE POLICY "Public can read pending suggestions" ON suggestions FOR
SELECT USING (status = 'pending');
-- Authenticated users can read all suggestions
DROP POLICY IF EXISTS "Admins can read all suggestions" ON suggestions;
CREATE POLICY "Admins can read all suggestions" ON suggestions FOR
SELECT USING (auth.role() = 'authenticated');
-- Authenticated users can update suggestions
DROP POLICY IF EXISTS "Admins can manage suggestions" ON suggestions;
CREATE POLICY "Admins can manage suggestions" ON suggestions FOR
UPDATE USING (auth.role() = 'authenticated');
-- Authenticated users can delete suggestions
DROP POLICY IF EXISTS "Admins can delete suggestions" ON suggestions;
CREATE POLICY "Admins can delete suggestions" ON suggestions FOR DELETE USING (auth.role() = 'authenticated');
-- ---- RATINGS ----
-- Anyone can insert ratings
DROP POLICY IF EXISTS "Anyone can submit ratings" ON ratings;
CREATE POLICY "Anyone can submit ratings" ON ratings FOR
INSERT WITH CHECK (true);
-- Public can read ratings
DROP POLICY IF EXISTS "Public can read ratings" ON ratings;
CREATE POLICY "Public can read ratings" ON ratings FOR
SELECT USING (true);
-- Authenticated users can delete ratings
DROP POLICY IF EXISTS "Admins can delete ratings" ON ratings;
CREATE POLICY "Admins can delete ratings" ON ratings FOR DELETE USING (auth.role() = 'authenticated');
-- ---- ACTIVITY LOG ----
-- Only authenticated users can read
DROP POLICY IF EXISTS "Admins can read activity log" ON activity_log;
CREATE POLICY "Admins can read activity log" ON activity_log FOR
SELECT USING (auth.role() = 'authenticated');
-- Anyone can insert (for frontend logging)
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON activity_log;
CREATE POLICY "Anyone can insert activity logs" ON activity_log FOR
INSERT WITH CHECK (true);
-- ==========================================================================
-- 7. OPTIONAL: AUTO-DELETE OLD LOGS (run as scheduled cron)
-- ==========================================================================
-- Uncomment below if you want automatic 90-day log cleanup.
-- Requires the pg_cron extension (available on Supabase Pro).
--
-- SELECT cron.schedule(
--   'delete-old-logs',
--   '0 3 * * *',  -- every day at 3 AM
--   $$DELETE FROM activity_log WHERE timestamp < now() - INTERVAL '90 days'$$
-- );
-- ==========================================================================
-- 8. SEED / VERIFICATION
-- ==========================================================================
-- Verify tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'courses',
    'suggestions',
    'ratings',
    'activity_log'
  );
-- Verify pgvector extension
SELECT *
FROM pg_extension
WHERE extname = 'vector';
-- Verify RLS is enabled
SELECT tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'courses',
    'suggestions',
    'ratings',
    'activity_log'
  );