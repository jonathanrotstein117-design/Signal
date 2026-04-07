-- Existing projects should also run:
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minor TEXT;
-- ALTER TABLE profiles ADD COLUMN IF NOT EXISTS double_major TEXT;

CREATE TABLE briefs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  brief_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own briefs"
  ON briefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own briefs"
  ON briefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own briefs"
  ON briefs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own briefs"
  ON briefs FOR DELETE
  USING (auth.uid() = user_id);

CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  university TEXT DEFAULT 'Rutgers University',
  major TEXT,
  minor TEXT,
  double_major TEXT,
  graduation_year INTEGER,
  career_interests TEXT,
  resume_text TEXT,
  resume_filename TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS minor TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS double_major TEXT;

CREATE TABLE career_fairs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  fair_name TEXT NOT NULL,
  companies JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE career_fairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fairs"
  ON career_fairs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fairs"
  ON career_fairs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own fairs"
  ON career_fairs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own fairs"
  ON career_fairs FOR DELETE
  USING (auth.uid() = user_id);
