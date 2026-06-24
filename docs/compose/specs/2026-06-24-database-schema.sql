-- GameView Database Schema for Supabase
-- Run this SQL in the Supabase SQL Editor

-- Enums
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE follow_status AS ENUM ('pending', 'accepted');
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE review_recommended AS ENUM ('yes', 'no', 'mixed');
CREATE TYPE lfg_mode AS ENUM ('competitive', 'casual', 'story', 'coop');
CREATE TYPE library_status AS ENUM ('playing', 'completed', 'dropped', 'wishlist', 'backlog');
CREATE TYPE notification_type AS ENUM ('follow', 'like', 'comment', 'reply', 'lfg_match', 'review_featured');
CREATE TYPE report_reason AS ENUM ('spam', 'harassment', 'spoiler', 'off_topic', 'other');

-- Users & Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT DEFAULT '',
  country TEXT,
  favorite_genres TEXT[] DEFAULT '{}',
  gamer_tags TEXT[] DEFAULT '{}',
  social_links JSONB DEFAULT '{}',
  pronouns TEXT DEFAULT 'Prefiro não informar',
  level INT DEFAULT 1,
  xp INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Follow System
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status follow_status DEFAULT 'accepted',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Friendship Requests
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id),
  CHECK (requester_id != addressee_id)
);

-- Games
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rawg_id INT UNIQUE,
  igdb_id INT UNIQUE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_url TEXT,
  banner_url TEXT,
  release_date DATE,
  metacritic_score INT,
  average_score DECIMAL(3,1) DEFAULT 0,
  review_count INT DEFAULT 0,
  developer TEXT,
  publisher TEXT,
  website TEXT,
  external_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Platforms
CREATE TABLE platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE game_platforms (
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  platform_id UUID REFERENCES platforms(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, platform_id)
);

-- Genres
CREATE TABLE genres (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE game_genres (
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  genre_id UUID REFERENCES genres(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, genre_id)
);

-- Tags
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE game_tags (
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (game_id, tag_id)
);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT NOT NULL,
  score DECIMAL(3,1) NOT NULL CHECK (score >= 0 AND score <= 10),
  recommended review_recommended DEFAULT 'yes',
  hours_played INT DEFAULT 0,
  spoiler BOOLEAN DEFAULT false,
  likes_count INT DEFAULT 0,
  dislikes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, game_id)
);

-- Review Reactions
CREATE TABLE review_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('upvote', 'downvote', 'funny', 'helpful')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, review_id, reaction)
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Comment Reactions
CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('upvote', 'downvote', 'funny', 'helpful')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, comment_id, reaction)
);

-- Review Collections / Lists
CREATE TABLE review_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE review_list_items (
  list_id UUID REFERENCES review_lists(id) ON DELETE CASCADE,
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  position INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (list_id, review_id)
);

-- LFG (Looking for Group)
CREATE TABLE lfg_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  mode lfg_mode DEFAULT 'casual',
  schedule TEXT,
  mic_required BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'pt-BR',
  description TEXT,
  max_players INT DEFAULT 4,
  current_players INT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE lfg_interests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES lfg_posts(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- Personal Game Library
CREATE TABLE user_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  status library_status DEFAULT 'wishlist',
  personal_score DECIMAL(3,1) CHECK (personal_score >= 0 AND personal_score <= 10),
  hours_played INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, game_id)
);

-- Play Sessions
CREATE TABLE play_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  duration_minutes INT NOT NULL,
  played_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Review Reports
CREATE TABLE review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reason report_reason NOT NULL,
  description TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- API Cache
CREATE TABLE api_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('igdb', 'rawg')),
  external_id TEXT NOT NULL,
  raw_data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  UNIQUE(source, external_id)
);

-- Indexes
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_games_rawg_id ON games(rawg_id);
CREATE INDEX idx_games_slug ON games(slug);
CREATE INDEX idx_games_release_date ON games(release_date);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_game_id ON reviews(game_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_review_reactions_review ON review_reactions(review_id);
CREATE INDEX idx_comments_review_id ON comments(review_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);
CREATE INDEX idx_lfg_posts_user_id ON lfg_posts(user_id);
CREATE INDEX idx_lfg_posts_game_id ON lfg_posts(game_id);
CREATE INDEX idx_lfg_posts_active ON lfg_posts(is_active) WHERE is_active = true;
CREATE INDEX idx_user_library_user_id ON user_library(user_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = false;
CREATE INDEX idx_api_cache_source_external ON api_cache(source, external_id);
CREATE INDEX idx_api_cache_expires ON api_cache(expires_at);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE lfg_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lfg_interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE play_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cache ENABLE ROW LEVEL SECURITY;

-- Profiles: public read, owner write
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Games: public read, authenticated write
CREATE POLICY "Games are viewable by everyone" ON games FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Authenticated users can insert games" ON games FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update games" ON games FOR UPDATE USING (auth.role() = 'authenticated');

-- Reviews: public read, owner write
CREATE POLICY "Reviews are viewable by everyone" ON reviews FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Authenticated users can create reviews" ON reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON reviews FOR DELETE USING (auth.uid() = user_id);

-- Comments: public read, owner write
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "Authenticated users can create comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Review reactions: authenticated CRUD
CREATE POLICY "Authenticated users can view reactions" ON review_reactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage own reactions" ON review_reactions FOR ALL USING (auth.uid() = user_id);

-- Comment reactions: authenticated CRUD
CREATE POLICY "Authenticated users can view comment reactions" ON comment_reactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can manage own comment reactions" ON comment_reactions FOR ALL USING (auth.uid() = user_id);

-- Follows: authenticated CRUD
CREATE POLICY "Authenticated users can view follows" ON follows FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Users can follow others" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Friendships: owner read/write
CREATE POLICY "Users can view own friendships" ON friendships FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "Users can request friendship" ON friendships FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "Users can update own friendships" ON friendships FOR UPDATE USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- LFG: public read, owner write
CREATE POLICY "LFG posts are viewable by everyone" ON lfg_posts FOR SELECT USING (is_active = true AND deleted_at IS NULL);
CREATE POLICY "Authenticated users can create LFG posts" ON lfg_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own LFG posts" ON lfg_posts FOR UPDATE USING (auth.uid() = user_id);

-- LFG interests: owner read/write
CREATE POLICY "Users can view interests on own posts" ON lfg_interests FOR SELECT USING (
  auth.uid() = user_id OR auth.uid() = (SELECT user_id FROM lfg_posts WHERE id = post_id)
);
CREATE POLICY "Users can express interest" ON lfg_interests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User library: owner only
CREATE POLICY "Users can view own library" ON user_library FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own library" ON user_library FOR ALL USING (auth.uid() = user_id);

-- Play sessions: owner only
CREATE POLICY "Users can view own play sessions" ON play_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own play sessions" ON play_sessions FOR ALL USING (auth.uid() = user_id);

-- Notifications: owner only
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can create notifications" ON notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- Review lists: public if public, owner if private
CREATE POLICY "Public lists are viewable by everyone" ON review_lists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Authenticated users can create lists" ON review_lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lists" ON review_lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists" ON review_lists FOR DELETE USING (auth.uid() = user_id);

-- Review list items: follow list visibility
CREATE POLICY "List items follow list visibility" ON review_list_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM review_lists WHERE id = list_id AND (is_public = true OR auth.uid() = user_id))
);
CREATE POLICY "Users can manage own list items" ON review_list_items FOR ALL USING (
  EXISTS (SELECT 1 FROM review_lists WHERE id = list_id AND auth.uid() = user_id)
);

-- Game platforms/genres/tags: public read, authenticated write
CREATE POLICY "Game relations viewable by everyone" ON game_platforms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage game platforms" ON game_platforms FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Genres viewable by everyone" ON genres FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage genres" ON genres FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Game genres viewable by everyone" ON game_genres FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage game genres" ON game_genres FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Tags viewable by everyone" ON tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage tags" ON tags FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Game tags viewable by everyone" ON game_tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage game tags" ON game_tags FOR ALL USING (auth.role() = 'authenticated');

-- Review reports: authenticated
CREATE POLICY "Authenticated users can create reports" ON review_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Authenticated users can view reports" ON review_reports FOR SELECT USING (auth.role() = 'authenticated');

-- API cache: service role only
CREATE POLICY "Service role manages API cache" ON api_cache FOR ALL USING (auth.role() = 'service_role');

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_games_updated_at BEFORE UPDATE ON games FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_lfg_posts_updated_at BEFORE UPDATE ON lfg_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_user_library_updated_at BEFORE UPDATE ON user_library FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_friendships_updated_at BEFORE UPDATE ON friendships FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_review_lists_updated_at BEFORE UPDATE ON review_lists FOR EACH ROW EXECUTE FUNCTION update_updated_at();
