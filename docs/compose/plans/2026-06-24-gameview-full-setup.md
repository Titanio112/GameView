# GameView Full Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform GameView from a frontend-only prototype with mock data into a full-stack social gaming platform backed by Supabase, with external game API integration and properly modularized code.

**Architecture:** Supabase for auth, database, and RLS; RAWG/IGDB for game metadata; ES modules for JS organization; split CSS for maintainability.

**Tech Stack:** Vanilla JS (ES6+ modules), Supabase (auth + Postgres), RAWG.io API, CSS custom properties

## Global Constraints

- UUID primary keys on all tables
- created_at/updated_at timestamps on all tables
- snake_case naming, plural table names
- RLS enabled on every table
- Soft deletes (deleted_at) on critical tables
- All existing UI behavior preserved — enhance, never replace
- Only split what actually exists — no empty placeholder files

---

## File Structure

```
GameView/
├── index.html (modified)
├── css/
│   ├── base.css       (from styles.css: variables, reset, scrollbar)
│   ├── layout.css     (from styles.css: header, app layout, section titles)
│   ├── components.css (from styles.css: game cards, tags, modals, buttons, forms)
│   └── pages.css      (from styles.css: carousel, showcases, game page, publisher, profile, responsive)
├── js/
│   ├── config.js      (Supabase client, API keys, constants)
│   ├── auth.js        (login, register, logout, session management)
│   ├── api.js         (Supabase queries + RAWG API calls)
│   ├── ui.js          (DOM manipulation, render helpers, toasts, skeletons)
│   ├── games.js       (game catalog, search, metadata fetching)
│   ├── reviews.js     (review creation, display, voting, comments)
│   ├── social.js      (follow system, connections, activity feed)
│   ├── lfg.js         (looking for group posts and matching)
│   ├── library.js     (personal game collection management)
│   ├── notifications.js (notification fetching and display)
│   └── main.js        (app initialization, routing, event delegation)
├── script.js          (DELETED after refactor)
└── styles.css         (DELETED after refactor)
```

---

### Task 1: Configure Supabase MCP

**Covers:** STEP 1

**Files:**
- Create: `~/.config/mimocode/mimocode.json`

**Steps:**

- [ ] **Step 1: Create mimocode.json config**

```bash
mkdir -p ~/.config/mimocode
```

Write the file with content:
```json
{
  "mcp": {
    "supabase": {
      "type": "remote",
      "url": "https://mcp.supabase.com/mcp?project_ref=jdhqgrnhfitsxxlmyhvk",
      "enabled": true
    }
  }
}
```

- [ ] **Step 2: Authenticate Supabase MCP**

Run: `mimocode mcp auth supabase`
Expected: Browser opens for auth, or credentials provided

- [ ] **Step 3: Install Supabase agent skills**

Run: `npx skills add supabase/agent-skills`
Expected: Skills installed successfully

- [ ] **Step 4: Verify MCP is working**

Run a test query via MCP to confirm connection to Supabase.

- [ ] **Step 5: Commit**

```bash
git add ~/.config/mimocode/mimocode.json
git commit -m "chore: configure Supabase MCP"
```

---

### Task 2: Design Database Schema

**Covers:** STEP 3

**Files:**
- Create: `docs/compose/specs/2026-06-24-database-schema.sql`

**Schema:**

```sql
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
```

**Steps:**

- [ ] **Step 1: Write the schema SQL file**

Create `docs/compose/specs/2026-06-24-database-schema.sql` with the full SQL above.

- [ ] **Step 2: Commit**

```bash
git add docs/compose/specs/2026-06-24-database-schema.sql
git commit -m "docs: add complete Supabase database schema"
```

---

### Task 3: Create All Tables on Supabase via MCP

**Covers:** STEP 4

**Steps:**

- [ ] **Step 1: Execute SQL schema via MCP**

Use the Supabase MCP to execute the full SQL schema from Task 2 against the connected project. Run in dependency order.

- [ ] **Step 2: Verify tables exist**

Query `information_schema.tables` to confirm all tables were created.

- [ ] **Step 3: Verify RLS is enabled**

Query `pg_tables` where `rowsecurity = true` for all expected tables.

- [ ] **Step 4: Verify indexes exist**

Query `pg_indexes` to confirm all indexes were created.

- [ ] **Step 5: Commit schema file changes if any**

```bash
git add docs/compose/specs/2026-06-24-database-schema.sql
git commit -m "chore: create all Supabase tables with RLS and indexes"
```

---

### Task 4: Create js/config.js — Supabase Client & Constants

**Covers:** STEP 5, STEP 6

**Files:**
- Create: `js/config.js`

**Interfaces:**
- Produces: `supabaseClient`, `RAWG_CONFIG`, `APP_CONFIG`

- [ ] **Step 1: Create js/config.js**

```javascript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jdhqgrnhfitsxxlmyhvk.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const RAWG_CONFIG = {
  apiKey: '545d12ebff47427884e845df333d251f',
  baseUrl: 'https://api.rawg.io/api',
};

export const APP_CONFIG = {
  maxReviewLength: 800,
  maxFavoriteGames: 4,
  carouselInterval: 5200,
  searchDebounce: 450,
  reviewExcerptLength: 200,
};
```

- [ ] **Step 2: Commit**

```bash
git add js/config.js
git commit -m "feat: add config module with Supabase client and constants"
```

---

### Task 5: Create js/api.js — Supabase + RAWG API Layer

**Covers:** STEP 5, STEP 6

**Files:**
- Create: `js/api.js`

**Interfaces:**
- Consumes: `supabase`, `RAWG_CONFIG` from config.js
- Produces: `rawgApiGet`, `fetchFeaturedGames`, `fetchPopularGames`, `fetchNewReleases`, `fetchGameDetails`, `searchAPI`, `fetchPublisher`, `fetchPublisherGames`, `supabaseQuery`

- [ ] **Step 1: Create js/api.js**

```javascript
import { supabase, RAWG_CONFIG } from './config.js';

// RAWG API
export async function rawgApiGet(endpoint, params = {}) {
  const url = new URL(`${RAWG_CONFIG.baseUrl}/${endpoint}`);
  url.searchParams.set('key', RAWG_CONFIG.apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (e) {
    console.warn('RAWG API error:', endpoint, e);
    return null;
  }
}

export const fetchFeaturedGames = () =>
  rawgApiGet('games', { ordering: '-rating', page_size: 6, metacritic: '85,100', dates: '2015-01-01,2025-12-31' })
    .then(d => d?.results || []);

export const fetchPopularGames = () =>
  rawgApiGet('games', { ordering: '-added', page_size: 18, dates: '2018-01-01,2025-12-31' })
    .then(d => d?.results || []);

export const fetchNewReleases = () => {
  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  return rawgApiGet('games', { ordering: '-released', page_size: 18, dates: `${from},${to}` })
    .then(d => d?.results || []);
};

export async function fetchGameDetails(id) {
  const d = await rawgApiGet(`games/${id}`);
  return d;
}

export async function fetchPublisher(id) {
  const d = await rawgApiGet(`publishers/${id}`);
  return d;
}

export const fetchPublisherGames = id =>
  rawgApiGet('games', { publishers: id, page_size: 20 }).then(d => d?.results || []);

export const searchAPI = q =>
  rawgApiGet('games', { search: q, page_size: 7 }).then(d => d?.results || []);

// Supabase helpers
export async function supabaseQuery(table, { select = '*', filters = {}, order = null, limit = null } = {}) {
  let query = supabase.from(table).select(select);
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined) {
      query = query.eq(key, value);
    }
  }
  if (order) query = query.order(order.column, { ascending: order.ascending ?? false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) console.warn('Supabase query error:', table, error);
  return data || [];
}

// API Cache
export async function getCachedGameData(source, externalId) {
  const { data } = await supabase
    .from('api_cache')
    .select('raw_data, fetched_at')
    .eq('source', source)
    .eq('external_id', String(externalId))
    .gt('expires_at', new Date().toISOString())
    .single();
  return data?.raw_data || null;
}

export async function setCachedGameData(source, externalId, rawData) {
  await supabase.from('api_cache').upsert({
    source,
    external_id: String(externalId),
    raw_data: rawData,
    fetched_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
  }, { onConflict: 'source,external_id' });
}

// Game operations
export async function getGameByRawgId(rawgId) {
  const { data } = await supabase
    .from('games')
    .select('*')
    .eq('rawg_id', rawgId)
    .single();
  return data;
}

export async function upsertGame(gameData) {
  const { data, error } = await supabase
    .from('games')
    .upsert(gameData, { onConflict: 'rawg_id' })
    .select()
    .single();
  if (error) console.warn('Game upsert error:', error);
  return data;
}

// Profile operations
export async function getProfile(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  return data;
}

export async function upsertProfile(profileData) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert(profileData, { onConflict: 'id' })
    .select()
    .single();
  if (error) console.warn('Profile upsert error:', error);
  return data;
}

// Review operations
export async function getReviews({ gameId = null, userId = null, limit = 20, offset = 0 } = {}) {
  let query = supabase
    .from('reviews')
    .select('*, profiles:user_id(username, display_name, avatar_url), games:game_id(title, cover_url, release_date)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (gameId) query = query.eq('game_id', gameId);
  if (userId) query = query.eq('user_id', userId);

  const { data, error } = await query;
  if (error) console.warn('Get reviews error:', error);
  return data || [];
}

export async function createReview(reviewData) {
  const { data, error } = await supabase
    .from('reviews')
    .insert(reviewData)
    .select()
    .single();
  if (error) console.warn('Create review error:', error);
  return data;
}

export async function toggleReviewReaction(reviewId, userId, reaction) {
  const { data: existing } = await supabase
    .from('review_reactions')
    .select('id')
    .eq('review_id', reviewId)
    .eq('user_id', userId)
    .eq('reaction', reaction)
    .single();

  if (existing) {
    await supabase.from('review_reactions').delete().eq('id', existing.id);
    return false;
  } else {
    await supabase.from('review_reactions').insert({ review_id: reviewId, user_id: userId, reaction });
    return true;
  }
}

// Comments
export async function getComments(reviewId) {
  const { data } = await supabase
    .from('comments')
    .select('*, profiles:user_id(username, display_name, avatar_url)')
    .eq('review_id', reviewId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  return data || [];
}

export async function createComment(commentData) {
  const { data, error } = await supabase
    .from('comments')
    .insert(commentData)
    .select()
    .single();
  if (error) console.warn('Create comment error:', error);
  return data;
}

// Follow system
export async function followUser(followerId, followingId) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  return !error;
}

export async function unfollowUser(followerId, followingId) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  return !error;
}

export async function isFollowing(followerId, followingId) {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .single();
  return !!data;
}

// LFG
export async function getLfgPosts({ gameId = null, limit = 20 } = {}) {
  let query = supabase
    .from('lfg_posts')
    .select('*, profiles:user_id(username, display_name, avatar_url), games:game_id(title, cover_url)')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (gameId) query = query.eq('game_id', gameId);

  const { data, error } = await query;
  if (error) console.warn('Get LFG posts error:', error);
  return data || [];
}

// Library
export async function getUserLibrary(userId) {
  const { data } = await supabase
    .from('user_library')
    .select('*, games:game_id(title, cover_url, release_date)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

export async function addToLibrary(libraryData) {
  const { data, error } = await supabase
    .from('user_library')
    .upsert(libraryData, { onConflict: 'user_id,game_id' })
    .select()
    .single();
  if (error) console.warn('Add to library error:', error);
  return data;
}

// Notifications
export async function getNotifications(userId, { unreadOnly = false, limit = 20 } = {}) {
  let query = supabase
    .from('notifications')
    .select('*, actor:actor_id(username, avatar_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq('read', false);

  const { data, error } = await query;
  if (error) console.warn('Get notifications error:', error);
  return data || [];
}

export async function markNotificationsRead(userId) {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/api.js
git commit -m "feat: add API module with Supabase + RAWG integration"
```

---

### Task 6: Create js/auth.js — Authentication Module

**Covers:** STEP 6

**Files:**
- Create: `js/auth.js`

**Interfaces:**
- Consumes: `supabase` from config.js
- Produces: `initAuth`, `getCurrentUser`, `signIn`, `signUp`, `signOut`, `requireAuth`

- [ ] **Step 1: Create js/auth.js**

```javascript
import { supabase } from './config.js';
import { getProfile, upsertProfile } from './api.js';

let currentUser = null;
let currentProfile = null;

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function requireAuth() {
  if (currentUser) return true;
  return false;
}

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    currentProfile = await getProfile(currentUser.id);
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await getProfile(currentUser.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
  });
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  currentProfile = await getProfile(currentUser.id);
  return { user: currentUser, profile: currentProfile };
}

export async function signUp(email, password, username) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  if (data.user) {
    currentUser = data.user;
    currentProfile = await upsertProfile({
      id: currentUser.id,
      username,
      display_name: username,
      avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    });
  }
  return { user: currentUser, profile: currentProfile };
}

export async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add js/auth.js
git commit -m "feat: add auth module with Supabase auth integration"
```

---

### Task 7: Create js/ui.js — DOM Helpers & Utilities

**Covers:** STEP 6

**Files:**
- Create: `js/ui.js`

**Interfaces:**
- Produces: `showPage`, `openModal`, `closeModal`, `stars`, `skeletons`, `imgUrl`, `year`, `trunc`, `nowDate`, `showToast`

- [ ] **Step 1: Create js/ui.js**

```javascript
export const year = s => s ? new Date(s).getFullYear() : '';
export const trunc = (s, n) => s && s.length > n ? s.slice(0, n).trim() + '...' : (s || '');
export const imgUrl = g => g?.background_image || g?.cover_url || 'https://placehold.co/148x198/111318/5328e8?text=GameView';
export const nowDate = () => {
  const d = new Date();
  const months = ['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.'];
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export function stars(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) {
    const full = i <= n;
    const half = !full && (i - 0.5) <= n;
    if (full) h += '<span class="rv-star">\u2605</span>';
    else if (half) h += '<span class="rv-star half">\u2605</span>';
    else h += '<span class="rv-star off">\u2605</span>';
  }
  return h;
}

export function skeletons(el, n) {
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'skeleton';
    d.style.cssText = 'width:148px;height:198px;flex-shrink:0;border-radius:6px';
    el.appendChild(d);
  }
}

export function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('is-active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('is-active');
}

export function openModal(id) {
  document.getElementById(id).classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('is-open');
  document.body.style.overflow = '';
}

export function showToast(message) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    background:var(--purple-700);color:#fff;
    padding:10px 22px;border-radius:20px;
    font-size:.85rem;font-weight:700;z-index:9999;
    border:1px solid var(--purple-500);
    animation:fadeUp 300ms ease;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
```

- [ ] **Step 2: Commit**

```bash
git add js/ui.js
git commit -m "feat: add UI utilities module"
```

---

### Task 8: Create js/games.js — Game Catalog Module

**Covers:** STEP 6

**Files:**
- Create: `js/games.js`

**Interfaces:**
- Consumes: rawgApiGet, fetchGameDetails, getGameByRawgId, upsertGame, getCachedGameData, setCachedGameData from api.js
- Produces: `makeGameCard`, `makeCarouselSlide`, `initCarousel`, `goSlide`, `searchGames`

- [ ] **Step 1: Create js/games.js**

```javascript
import { imgUrl, year } from './ui.js';

export function makeGameCard(game) {
  const el = document.createElement('div');
  el.className = 'game-card fade-up';
  el.dataset.action = 'go-game';
  el.dataset.gameId = game.id;

  const genreTags = (game.genres || []).slice(0, 2)
    .map(g => `<span class="tag">${g.name || g}</span>`).join('');
  const scoreHtml = game.metacritic
    ? `<div class="gc-score">${game.metacritic}</div>` : '';

  el.innerHTML = `
    <div class="gc-cover">
      <img src="${imgUrl(game)}" alt="${game.name}" loading="lazy">
      ${scoreHtml}
    </div>
    <div class="gc-title">${game.name}</div>
    <div class="gc-tags">${genreTags}</div>
  `;
  return el;
}

export function makeCarouselSlide(game) {
  const el = document.createElement('div');
  el.className = 'carousel-slide';
  el.dataset.action = 'go-game';
  el.dataset.gameId = game.id;

  const genre = game.genres?.[0]?.name || 'Destaque';
  const yr = year(game.released);
  const score = game.metacritic ? `<span class="c-score">${game.metacritic}</span><span class="c-meta-sep">&middot;</span>` : '';
  const plats = (game.platforms || []).slice(0, 3).map(p => p.platform?.name || p).join(', ');

  el.innerHTML = `
    <img src="${imgUrl(game)}" alt="${game.name}" loading="lazy">
    <div class="c-fade-bottom"></div>
    <div class="c-fade-left"></div>
    <div class="c-info">
      <div class="c-genre-badge">${genre}</div>
      <div class="c-title">${game.name}</div>
      <div class="c-meta">
        ${score}
        ${yr ? `<span>${yr}</span><span class="c-meta-sep">&middot;</span>` : ''}
        <span>${plats || 'Multi-plataforma'}</span>
      </div>
      <button class="c-btn" data-action="go-game" data-game-id="${game.id}">
        Ver detalhes
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  `;
  return el;
}

let carouselGames = [];
let carouselIndex = 0;
let carouselTimer = null;

export function initCarousel(games, { onDotClick, onSlideClick } = {}) {
  carouselGames = games;
  carouselIndex = 0;
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  if (!track || !dots) return;
  track.innerHTML = '';
  dots.innerHTML = '';

  games.forEach((g, i) => {
    const slide = makeCarouselSlide(g);
    if (onSlideClick) slide.addEventListener('click', () => onSlideClick(g.id));
    track.appendChild(slide);

    const d = document.createElement('button');
    d.className = `c-dot${i === 0 ? ' is-active' : ''}`;
    d.setAttribute('aria-label', `Slide ${i + 1}`);
    d.dataset.action = 'carousel-dot';
    d.dataset.slideIdx = i;
    d.addEventListener('click', () => {
      goSlide(i);
      resetCarouselTimer();
    });
    dots.appendChild(d);
  });

  updateCarousel();
  resetCarouselTimer();
}

export function goSlide(idx) {
  const len = carouselGames.length;
  carouselIndex = ((idx % len) + len) % len;
  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById('carousel-track');
  if (track) track.style.transform = `translateX(-${carouselIndex * 100}%)`;
  document.querySelectorAll('.c-dot').forEach((d, i) => {
    d.classList.toggle('is-active', i === carouselIndex);
  });
  document.querySelectorAll('.carousel-slide').forEach((s, i) => {
    s.classList.toggle('is-active', i === carouselIndex);
  });
}

export function resetCarouselTimer() {
  clearInterval(carouselTimer);
  carouselTimer = setInterval(() => goSlide(carouselIndex + 1), 5200);
}

export function scrollShowcase(scrollId, dir) {
  const el = document.getElementById(scrollId);
  if (el) el.scrollBy({ left: dir * 580, behavior: 'smooth' });
}
```

- [ ] **Step 2: Commit**

```bash
git add js/games.js
git commit -m "feat: add games module with card/carousel components"
```

---

### Task 9: Create js/reviews.js — Review System Module

**Covers:** STEP 6

**Files:**
- Create: `js/reviews.js`

**Interfaces:**
- Consumes: stars, imgUrl from ui.js; getReviews, createReview, getComments, createComment, toggleReviewReaction from api.js
- Produces: `makeReviewCard`, `renderReviews`, `renderTagCloud`, `filterGenre`, `renderTrending`, `openReviewModal`, `initWriteReview`

- [ ] **Step 1: Create js/reviews.js**

This module contains all review-related rendering and interactions. It will be created with all the review card rendering, modal rendering, write review form, and interaction handlers.

```javascript
import { stars, imgUrl, trunc, nowDate, openModal, closeModal, showToast } from './ui.js';
import { getReviews, createReview, getComments, createComment, toggleReviewReaction, supabaseQuery } from './api.js';
import { getCurrentUser, requireAuth } from './auth.js';
import { APP_CONFIG } from './config.js';

let activeGenre = null;
let MOCK_REVIEWS = [];
let GENRES = [];

export async function loadReviews() {
  MOCK_REVIEWS = await supabaseQuery('reviews', {
    select: '*, profiles:user_id(username, display_name, avatar_url), games:game_id(title, cover_url, release_date)',
    order: { column: 'created_at', ascending: false },
    limit: 50,
  });
  return MOCK_REVIEWS;
}

export async function loadGenres() {
  GENRES = await supabaseQuery('genres', { select: 'name', order: { column: 'name' } });
  return GENRES.map(g => g.name);
}

export function makeReviewCard(rv) {
  const el = document.createElement('article');
  el.className = 'review-card fade-up';
  el.dataset.action = 'open-review';
  el.dataset.reviewId = rv.id;

  const gameName = rv.games?.title || rv.gameName || 'Jogo';
  const gameCover = rv.games?.cover_url || rv.gameCover || '';
  const authorName = rv.profiles?.display_name || rv.author?.name || 'Anonimo';
  const authorAvatar = rv.profiles?.avatar_url || rv.author?.avatar || '';
  const score = rv.score || rv.rating || 0;
  const excerpt = rv.body || rv.excerpt || '';

  el.innerHTML = `
    <div class="rv-cover">
      <img src="${gameCover}" alt="${gameName}" loading="lazy">
    </div>
    <div class="rv-body">
      <div class="rv-top">
        <span class="rv-game">${gameName}</span>
        <div class="rv-stars">${stars(score / 2)}</div>
      </div>
      <div class="rv-author-row">
        <img class="rv-avatar" src="${authorAvatar}" alt="${authorName}">
        <span class="rv-author">${authorName}</span>
        <span class="rv-date">${new Date(rv.created_at).toLocaleDateString('pt-BR')}</span>
      </div>
      <p class="rv-excerpt">${trunc(excerpt, 200)}</p>
      <div class="rv-actions" data-stop-propagation>
        <button class="rv-btn" data-action="like-review" data-review-id="${rv.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
            <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
          </svg>
          ${rv.likes_count || 0}
        </button>
        <button class="rv-btn" data-action="comment-click" data-review-id="${rv.id}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          ${rv.comments_count || 0}
        </button>
      </div>
    </div>
  `;
  return el;
}

export function renderReviews(containerId, list) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">
      <strong>Nenhuma resenha encontrada</strong>
      Tente remover o filtro ou selecione outra categoria.
    </div>`;
    return;
  }
  list.forEach(rv => el.appendChild(makeReviewCard(rv)));
}

export function renderTagCloud(genres) {
  const el = document.getElementById('tag-cloud');
  if (!el) return;
  el.innerHTML = '';
  genres.forEach(g => {
    const t = document.createElement('span');
    t.className = `tag${activeGenre === g ? ' is-active' : ''}`;
    t.dataset.action = 'filter-genre';
    t.dataset.genre = g;
    t.textContent = g;
    el.appendChild(t);
  });
}

export function filterGenre(genre) {
  activeGenre = activeGenre === genre ? null : genre;
  document.querySelectorAll('#tag-cloud .tag').forEach(t =>
    t.classList.toggle('is-active', t.dataset.genre === activeGenre));
  const filtered = activeGenre
    ? MOCK_REVIEWS.filter(r => r.genre === activeGenre || r.games?.genres?.some(g => g.name === activeGenre))
    : MOCK_REVIEWS;
  renderReviews('review-list', filtered);
}

export async function renderTrending() {
  const el = document.getElementById('trending-list');
  if (!el) return;
  const trending = [...MOCK_REVIEWS].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 5);
  el.innerHTML = '';
  trending.forEach((rv, i) => {
    const d = document.createElement('div');
    d.className = 'trending-item';
    d.dataset.action = 'go-game';
    d.dataset.gameId = rv.game_id;
    d.innerHTML = `
      <div class="trending-rank">${i + 1}</div>
      <img class="trending-cover" src="${rv.games?.cover_url || ''}" alt="${rv.games?.title || ''}">
      <div>
        <div class="trending-name">${rv.games?.title || ''}</div>
        <div class="trending-score">\u2605 ${(rv.score / 2).toFixed(1)}</div>
      </div>
    `;
    el.appendChild(d);
  });
}

// Write Review Modal
let writeState = { selectedGame: null, rating: 0 };

export function initWriteReview() {
  document.getElementById('btn-write-review-header')?.addEventListener('click', openWriteReviewModal);
  document.getElementById('btn-wm-cancel')?.addEventListener('click', () => closeModal('write-review-modal-overlay'));
  document.getElementById('btn-wm-save')?.addEventListener('click', publishReview);

  document.getElementById('wm-game-search')?.addEventListener('input', handleGameSearch);
  document.getElementById('wm-sel-clear')?.addEventListener('click', clearSelectedGame);
  document.getElementById('wm-textarea')?.addEventListener('input', handleCharCount);

  buildStarPicker(0);
}

function openWriteReviewModal() {
  if (!requireAuth()) return openModal('auth-modal-overlay');

  writeState = { selectedGame: null, rating: 0 };
  document.getElementById('wm-game-search').value = '';
  document.getElementById('wm-game-dropdown').classList.remove('open');
  document.getElementById('wm-selected-game').classList.remove('visible');
  document.getElementById('wm-textarea').value = '';
  document.getElementById('wm-char-counter').textContent = '800';
  document.getElementById('btn-wm-save').disabled = true;
  document.getElementById('star-display-label').textContent = '\u2014';

  openModal('write-review-modal-overlay');
}

function buildStarPicker(currentRating) {
  const picker = document.getElementById('star-picker');
  if (!picker) return;
  picker.innerHTML = '';

  for (let star = 1; star <= 5; star++) {
    const leftHalf = document.createElement('span');
    leftHalf.className = 'star-picker-half';
    leftHalf.dataset.value = star - 0.5;
    leftHalf.textContent = '\u2605';
    if (currentRating >= star - 0.5) leftHalf.classList.add('filled');

    const rightHalf = document.createElement('span');
    rightHalf.className = 'star-picker-half';
    rightHalf.dataset.value = star;
    rightHalf.textContent = '\u2605';
    if (currentRating >= star) rightHalf.classList.add('filled');

    [leftHalf, rightHalf].forEach(half => {
      half.addEventListener('mouseenter', () => highlightStars(parseFloat(half.dataset.value)));
      half.addEventListener('mouseleave', () => highlightStars(writeState.rating));
      half.addEventListener('click', () => {
        writeState.rating = parseFloat(half.dataset.value);
        highlightStars(writeState.rating);
        document.getElementById('star-display-label').textContent = `${writeState.rating} \u2605`;
        validateWriteForm();
      });
    });

    picker.appendChild(leftHalf);
    picker.appendChild(rightHalf);
  }
}

function highlightStars(rating) {
  document.querySelectorAll('.star-picker-half').forEach(h => {
    h.classList.toggle('filled', parseFloat(h.dataset.value) <= rating);
  });
}

let searchTimeout;
function handleGameSearch(e) {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim().toLowerCase();
  const dd = document.getElementById('wm-game-dropdown');
  if (!q) { dd.classList.remove('open'); return; }

  searchTimeout = setTimeout(async () => {
    const { searchAPI } = await import('./api.js');
    const results = await searchAPI(q);
    dd.innerHTML = '';
    if (!results?.length) {
      dd.innerHTML = '<div style="padding:10px 12px;font-size:.82rem;color:var(--text-3)">Nenhum jogo encontrado.</div>';
    } else {
      results.slice(0, 8).forEach(g => {
        const opt = document.createElement('div');
        opt.className = 'wm-game-option';
        opt.innerHTML = `
          <img src="${imgUrl(g)}" alt="${g.name}">
          <div>
            <div class="wm-game-option-name">${g.name}</div>
            <div class="wm-game-option-year">${year(g.released) || ''}</div>
          </div>
        `;
        opt.addEventListener('click', () => selectWriteGame(g));
        dd.appendChild(opt);
      });
    }
    dd.classList.add('open');
  }, 350);
}

function selectWriteGame(g) {
  writeState.selectedGame = g;
  document.getElementById('wm-sel-cover').src = imgUrl(g);
  document.getElementById('wm-sel-name').textContent = g.name;
  document.getElementById('wm-selected-game').classList.add('visible');
  document.getElementById('wm-game-search').value = '';
  document.getElementById('wm-game-dropdown').classList.remove('open');
  validateWriteForm();
}

function clearSelectedGame() {
  writeState.selectedGame = null;
  document.getElementById('wm-selected-game').classList.remove('visible');
  validateWriteForm();
}

function handleCharCount(e) {
  const remaining = APP_CONFIG.maxReviewLength - e.target.value.length;
  const counter = document.getElementById('wm-char-counter');
  counter.textContent = remaining;
  counter.className = 'wm-char-counter' +
    (remaining <= 50 ? ' danger' : remaining <= 150 ? ' warn' : '');
  validateWriteForm();
}

function validateWriteForm() {
  const hasGame = !!writeState.selectedGame;
  const hasRating = writeState.rating > 0;
  const text = document.getElementById('wm-textarea').value.trim();
  const hasText = text.length >= 10;
  document.getElementById('btn-wm-save').disabled = !(hasGame && hasRating && hasText);
}

async function publishReview() {
  const user = getCurrentUser();
  if (!user) return;

  const game = writeState.selectedGame;
  const rating = writeState.rating;
  const text = document.getElementById('wm-textarea').value.trim();
  if (!game || !rating || !text) return;

  const reviewData = {
    user_id: user.id,
    game_id: game.id,
    score: rating * 2,
    body: text,
    title: game.name,
  };

  const result = await createReview(reviewData);
  if (result) {
    closeModal('write-review-modal-overlay');
    showToast('Resenha publicada com sucesso!');
  }
}

// Review Modal (read)
export async function openReview(id) {
  const rv = MOCK_REVIEWS.find(r => r.id === id);
  if (!rv) return;

  const comments = await getComments(id);
  const user = getCurrentUser();

  const commentList = comments.map(c => `
    <div class="comment-item">
      <div class="ci-avatar"><img src="${c.profiles?.avatar_url || ''}" alt=""></div>
      <div>
        <div class="ci-author">${c.profiles?.display_name || ''}</div>
        <p class="ci-text">${c.body}</p>
      </div>
    </div>
  `).join('');

  const avHtml = user
    ? `<div class="comment-input-av"><img src="${user.user_metadata?.avatar_url || ''}" alt=""></div>`
    : `<div class="comment-input-av" style="background:var(--bg-raised)"></div>`;

  document.getElementById('review-modal-content').innerHTML = `
    <div class="rm-banner">
      <img src="${rv.games?.cover_url || ''}" alt="${rv.games?.title || ''}">
      <div class="rm-banner-fade"></div>
    </div>
    <div class="rm-body">
      <div class="rm-game-row">
        <img class="rm-cover" src="${rv.games?.cover_url || ''}" alt="${rv.games?.title || ''}">
        <div>
          <div class="rm-game-name" data-action="go-game" data-game-id="${rv.game_id}">${rv.games?.title || ''}</div>
          <div class="rm-game-year">${rv.games?.release_date ? new Date(rv.games.release_date).getFullYear() : ''}</div>
        </div>
      </div>
      <div class="rm-reviewer">
        <img class="rm-rv-avatar" src="${rv.profiles?.avatar_url || ''}" alt="">
        <div style="flex:1">
          <div class="rm-rv-name">${rv.profiles?.display_name || ''}</div>
          <div class="rm-rv-date">${new Date(rv.created_at).toLocaleDateString('pt-BR')}</div>
        </div>
        <div class="rm-stars">${stars(rv.score / 2)}</div>
      </div>
      <p class="rm-text">${rv.body}</p>
      <div class="rm-actions">
        <button class="rm-btn" data-action="like-review" data-review-id="${rv.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
          </svg>
          Curtir (${rv.likes_count || 0})
        </button>
      </div>
      <div class="comments-head">${comments.length} Comentario${comments.length !== 1 ? 's' : ''}</div>
      <div class="comment-input-row">
        ${avHtml}
        <div class="comment-input-wrap">
          <textarea class="comment-input" id="comment-ta-${rv.id}"
            placeholder="${user ? 'Adicione um comentario...' : 'Faca login para comentar...'}"></textarea>
          <button class="btn-post-comment" data-action="post-comment" data-review-id="${rv.id}">Comentar</button>
        </div>
      </div>
      <div id="comment-list-${rv.id}">${commentList}</div>
    </div>
  `;

  openModal('review-modal-overlay');
}

export async function postComment(id) {
  const user = getCurrentUser();
  if (!user) return openModal('auth-modal-overlay');

  const ta = document.getElementById(`comment-ta-${id}`);
  if (!ta || !ta.value.trim()) return;

  const comment = await createComment({
    user_id: user.id,
    review_id: id,
    body: ta.value.trim(),
  });

  if (comment) {
    ta.value = '';
    showToast('Comentario publicado!');
    openReview(id);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add js/reviews.js
git commit -m "feat: add reviews module with creation, display, and interactions"
```

---

### Task 10: Create js/social.js, js/lfg.js, js/library.js, js/notifications.js

**Covers:** STEP 6

**Files:**
- Create: `js/social.js`, `js/lfg.js`, `js/library.js`, `js/notifications.js`

**Steps:**

- [ ] **Step 1: Create js/social.js**

```javascript
import { supabase } from './config.js';
import { followUser, unfollowUser, isFollowing, supabaseQuery } from './api.js';
import { getCurrentUser } from './auth.js';

export async function toggleFollow(targetUserId) {
  const user = getCurrentUser();
  if (!user) return false;

  const following = await isFollowing(user.id, targetUserId);
  if (following) {
    await unfollowUser(user.id, targetUserId);
    return false;
  } else {
    await followUser(user.id, targetUserId);
    return true;
  }
}

export async function getFollowers(userId) {
  return supabaseQuery('follows', {
    select: '*, profiles:follower_id(username, display_name, avatar_url)',
    filters: { following_id: userId },
  });
}

export async function getFollowing(userId) {
  return supabaseQuery('follows', {
    select: '*, profiles:following_id(username, display_name, avatar_url)',
    filters: { follower_id: userId },
  });
}

export async function getFollowCounts(userId) {
  const followers = await supabaseQuery('follows', {
    select: 'id',
    filters: { following_id: userId },
  });
  const following = await supabaseQuery('follows', {
    select: 'id',
    filters: { follower_id: userId },
  });
  return { followers: followers.length, following: following.length };
}
```

- [ ] **Step 2: Create js/lfg.js**

```javascript
import { supabase } from './config.js';
import { getLfgPosts, supabaseQuery } from './api.js';
import { getCurrentUser } from './auth.js';
import { openModal, closeModal, showToast } from './ui.js';

export async function loadLfgPosts(gameId = null) {
  return getLfgPosts({ gameId });
}

export async function createLfgPost(postData) {
  const user = getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('lfg_posts')
    .insert({ ...postData, user_id: user.id })
    .select()
    .single();

  if (error) console.warn('Create LFG post error:', error);
  return data;
}

export async function expressInterest(postId, message = '') {
  const user = getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('lfg_interests')
    .insert({ user_id: user.id, post_id: postId, message })
    .select()
    .single();

  if (error) console.warn('Express interest error:', error);
  return data;
}

export async function getUserLfgPosts(userId) {
  return supabaseQuery('lfg_posts', {
    select: '*',
    filters: { user_id: userId, is_active: true },
    order: { column: 'created_at', ascending: false },
  });
}
```

- [ ] **Step 3: Create js/library.js**

```javascript
import { getUserLibrary, addToLibrary, supabaseQuery } from './api.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './ui.js';

export async function loadLibrary() {
  const user = getCurrentUser();
  if (!user) return [];
  return getUserLibrary(user.id);
}

export async function addToUserLibrary(gameId, status = 'wishlist', personalScore = null) {
  const user = getCurrentUser();
  if (!user) return null;

  const result = await addToLibrary({
    user_id: user.id,
    game_id: gameId,
    status,
    personal_score: personalScore,
  });

  if (result) showToast('Jogo adicionado a biblioteca!');
  return result;
}

export async function removeFromLibrary(gameId) {
  const user = getCurrentUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_library')
    .delete()
    .eq('user_id', user.id)
    .eq('game_id', gameId);

  return !error;
}

export async function updateLibraryStatus(gameId, status) {
  const user = getCurrentUser();
  if (!user) return false;

  const { error } = await supabase
    .from('user_library')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('game_id', gameId);

  return !error;
}
```

- [ ] **Step 4: Create js/notifications.js**

```javascript
import { getNotifications, markNotificationsRead } from './api.js';
import { getCurrentUser } from './auth.js';

let notifications = [];
let unreadCount = 0;

export async function loadNotifications() {
  const user = getCurrentUser();
  if (!user) return [];
  notifications = await getNotifications(user.id);
  unreadCount = notifications.filter(n => !n.read).length;
  return notifications;
}

export function getUnreadCount() {
  return unreadCount;
}

export async function markAllRead() {
  const user = getCurrentUser();
  if (!user) return;
  await markNotificationsRead(user.id);
  unreadCount = 0;
}

export function renderNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  if (badge) {
    badge.textContent = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add js/social.js js/lfg.js js/library.js js/notifications.js
git commit -m "feat: add social, LFG, library, and notifications modules"
```

---

### Task 11: Create js/main.js — App Initialization & Routing

**Covers:** STEP 6

**Files:**
- Create: `js/main.js`

**Interfaces:**
- Consumes: all other modules
- Produces: App initialization, event delegation, page routing

- [ ] **Step 1: Create js/main.js**

```javascript
import { initAuth, getCurrentUser, getCurrentProfile, signIn, signUp, signOut, requireAuth } from './auth.js';
import { fetchFeaturedGames, fetchPopularGames, fetchNewReleases, fetchGameDetails, fetchPublisher, fetchPublisherGames, searchAPI } from './api.js';
import { showPage, openModal, closeModal, skeletons, showToast } from './ui.js';
import { initCarousel, goSlide, resetCarouselTimer, scrollShowcase, makeGameCard } from './games.js';
import { makeReviewCard, renderReviews, renderTagCloud, renderTrending, filterGenre, openReview, initWriteReview, postComment, loadReviews, loadGenres } from './reviews.js';
import { getCurrentProfile as getProfileData } from './auth.js';
import { loadNotifications, markAllRead, renderNotificationBadge } from './notifications.js';

let currentPage = 'home';
let activeGenre = null;
let gamesCache = {};
let pubCache = {};

// Auth UI
function updateHeaderUser() {
  const el = document.getElementById('header-user-area');
  const user = getCurrentUser();
  const profile = getCurrentProfile();
  if (!el) return;

  if (user && profile) {
    el.innerHTML = `
      <div class="user-chip" data-action="go-profile">
        <span class="user-chip-name">${profile.username}</span>
        <div class="user-chip-avatar">
          <img src="${profile.avatar_url || ''}" alt="${profile.display_name}">
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `<button class="btn-enter" data-action="open-auth">Entrar</button>`;
  }
}

function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  openModal('auth-modal-overlay');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.classList.toggle('is-active', t.dataset.authTab === tab));
  document.querySelectorAll('.auth-panel').forEach(p =>
    p.classList.toggle('is-active', p.id === `auth-panel-${tab}`));
}

// Navigation
function setNavActive(nav) {
  document.querySelectorAll('.header-nav a').forEach(a => {
    a.classList.toggle('is-active', a.dataset.nav === nav);
  });
}

async function goHome() {
  currentPage = 'home';
  showPage('page-home');
  setNavActive('home');

  skeletons(document.getElementById('scroll-popular'), 10);
  skeletons(document.getElementById('scroll-new'), 10);

  const reviews = await loadReviews();
  renderReviews('review-list', reviews);
  const genres = await loadGenres();
  renderTagCloud(genres);
  await renderTrending();

  const [featured, popular, newRel] = await Promise.all([
    fetchFeaturedGames(), fetchPopularGames(), fetchNewReleases()
  ]);

  if (featured.length) initCarousel(featured);
  if (popular.length) {
    const el = document.getElementById('scroll-popular');
    if (el) { el.innerHTML = ''; popular.forEach(g => el.appendChild(makeGameCard(g))); }
  }
  if (newRel.length) {
    const el = document.getElementById('scroll-new');
    if (el) { el.innerHTML = ''; newRel.forEach(g => el.appendChild(makeGameCard(g))); }
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function goGame(gameId) {
  currentPage = 'game';
  showPage('page-game');
  setNavActive(null);
  window.scrollTo({ top: 0 });

  document.getElementById('game-banner-img').src = '';
  document.getElementById('game-cover-img').src = '';
  document.getElementById('gb-title').textContent = 'Carregando...';

  if (!gamesCache[gameId]) {
    gamesCache[gameId] = await fetchGameDetails(gameId);
  }
  const game = gamesCache[gameId];
  if (!game) {
    document.getElementById('gb-title').textContent = 'Jogo nao encontrado';
    return;
  }

  document.getElementById('game-banner-img').src = game.background_image || '';
  document.getElementById('game-cover-img').src = game.background_image || '';
  document.getElementById('gb-title').textContent = game.name;
  document.getElementById('gb-year').textContent = game.released ? `(${new Date(game.released).getFullYear()})` : '';
  if (game.metacritic) document.getElementById('game-score').textContent = game.metacritic;

  const compRow = document.getElementById('gb-company-row');
  if (game.publishers?.length) {
    compRow.innerHTML = game.publishers
      .map(p => `<span class="gb-company-badge" data-action="go-publisher" data-pub-id="${p.id}">${p.name}</span>`)
      .join('');
  }

  const raw = game.description_raw || (game.description || '').replace(/<[^>]*>/g, '');
  document.getElementById('game-synopsis').textContent = raw.length > 680 ? raw.slice(0, 680) + '...' : raw;

  const genres = (game.genres || []).map(g => `<span class="tag">${g.name}</span>`).join('') || '—';
  const plats = (game.platforms || []).map(p => `<span class="platform-pill">${p.platform.name}</span>`).join('') || '—';
  const devs = (game.developers || []).map(d => d.name).join(', ') || '—';
  document.getElementById('game-meta-box').innerHTML = `
    <div class="game-meta-item">
      <div class="gm-label">Generos</div>
      <div class="gm-value">${genres}</div>
    </div>
    <div class="game-meta-item">
      <div class="gm-label">Plataformas</div>
      <div class="gm-value">${plats}</div>
    </div>
    <div class="game-meta-item">
      <div class="gm-label">Lancamento</div>
      <div class="gm-value">${game.released || '—'}</div>
    </div>
    <div class="game-meta-item">
      <div class="gm-label">Desenvolvedor</div>
      <div class="gm-value">${devs}</div>
    </div>
  `;
}

async function goPublisher(id) {
  currentPage = 'publisher';
  showPage('page-publisher');
  setNavActive(null);
  window.scrollTo({ top: 0 });

  const head = document.getElementById('pub-header');
  const grid = document.getElementById('pub-games-grid');
  head.innerHTML = '<div class="skeleton" style="width:200px;height:40px;"></div>';
  grid.innerHTML = '';
  skeletons(grid, 12);

  if (!pubCache[id]) pubCache[id] = await fetchPublisher(id);
  const pub = pubCache[id];
  const games = await fetchPublisherGames(id);
  if (!pub) return;

  head.innerHTML = `
    <div class="pub-type">Desenvolvedora / Publisher</div>
    <div class="pub-name">${pub.name}</div>
    <div class="pub-stats">
      <div>
        <div class="pub-stat-n">${pub.games_count || 0}</div>
        <div class="pub-stat-l">Jogos Registrados</div>
      </div>
    </div>
  `;
  grid.innerHTML = '';
  games.forEach(g => grid.appendChild(makeGameCard(g)));
}

function goProfile() {
  if (!requireAuth()) return openModal('auth-modal-overlay');
  currentPage = 'profile';
  showPage('page-profile');
  setNavActive(null);
  window.scrollTo({ top: 0 });
  renderProfile();
}

function renderProfile() {
  const profile = getCurrentProfile();
  if (!profile) return;

  document.getElementById('profile-header').innerHTML = `
    <div class="profile-avatar">
      <img src="${profile.avatar_url || ''}" alt="${profile.display_name}">
    </div>
    <div>
      <div class="profile-name">${profile.display_name} <span style="font-size:1rem;color:var(--text-3);font-weight:600">@${profile.username}</span></div>
      <div class="profile-pronouns">${profile.pronouns || ''}</div>
      <div class="profile-bio">${profile.bio || ''}</div>
      <div class="profile-stats">
        <div><span class="ps-n">${profile.level || 1}</span> <span class="ps-l">Nivel</span></div>
      </div>
    </div>
  `;
}

// Search
let searchTimeout;
function initSearch() {
  document.getElementById('search-input')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    const box = document.getElementById('search-results');
    if (!q) { box.classList.remove('open'); return; }

    searchTimeout = setTimeout(async () => {
      const results = await searchAPI(q);
      box.innerHTML = '';
      if (!results?.length) {
        box.innerHTML = '<div class="sr-empty">Nenhum jogo encontrado.</div>';
      } else {
        results.forEach(g => {
          const item = document.createElement('div');
          item.className = 'sr-item';
          item.dataset.action = 'go-game';
          item.dataset.gameId = g.id;
          item.innerHTML = `
            <img class="sr-thumb" src="${g.background_image || ''}" alt="">
            <div>
              <div class="sr-name">${g.name}</div>
              <div class="sr-year">${g.released ? new Date(g.released).getFullYear() : ''}</div>
            </div>
          `;
          box.appendChild(item);
        });
      }
      box.classList.add('open');
    }, 450);
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.header-search')) {
      document.getElementById('search-results')?.classList.remove('open');
    }
  });
}

// Auth handlers
function initAuthHandlers() {
  document.getElementById('btn-simulate-login')?.addEventListener('click', async () => {
    try {
      const panel = document.getElementById('auth-panel-login');
      const email = panel?.querySelector('input[type="email"]')?.value;
      const password = panel?.querySelector('input[type="password"]')?.value;
      if (email && password) {
        await signIn(email, password);
        closeModal('auth-modal-overlay');
        updateHeaderUser();
        showToast('Login realizado com sucesso!');
      }
    } catch (e) {
      showToast('Erro ao fazer login: ' + e.message);
    }
  });

  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });
}

// Event delegation
function initEventDelegation() {
  document.addEventListener('click', e => {
    if (e.target.closest('[data-stop-propagation]')) {
      e.stopPropagation();
    }

    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    if (action === 'go-game') goGame(target.dataset.gameId);
    if (action === 'go-publisher') goPublisher(target.dataset.pubId);
    if (action === 'go-profile') goProfile();
    if (action === 'open-review') openReview(target.dataset.reviewId);
    if (action === 'filter-genre') filterGenre(target.dataset.genre);
    if (action === 'open-auth') openAuthModal('login');
    if (action === 'post-comment') postComment(target.dataset.reviewId);
    if (action === 'comment-click') {
      openReview(target.dataset.reviewId);
      setTimeout(() => {
        const ta = document.getElementById(`comment-ta-${target.dataset.reviewId}`);
        if (ta) ta.focus();
      }, 300);
    }
  });

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.nav === 'home') goHome();
    });
  });

  document.getElementById('carousel-prev')?.addEventListener('click', () => {
    goSlide(-1);
    resetCarouselTimer();
  });
  document.getElementById('carousel-next')?.addEventListener('click', () => {
    goSlide(1);
    resetCarouselTimer();
  });

  document.querySelectorAll('[data-scroll]').forEach(btn => {
    btn.addEventListener('click', () => {
      const dir = btn.classList.contains('sh-prev') ? -1 : 1;
      scrollShowcase(btn.dataset.scroll, dir);
    });
  });

  document.getElementById('close-review-modal')?.addEventListener('click', () => closeModal('review-modal-overlay'));
  document.getElementById('close-auth-modal')?.addEventListener('click', () => closeModal('auth-modal-overlay'));
  document.getElementById('close-write-review-modal')?.addEventListener('click', () => closeModal('write-review-modal-overlay'));
  document.getElementById('close-edit-profile-modal')?.addEventListener('click', () => closeModal('edit-profile-modal-overlay'));

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
      if (e.target === this) closeModal(this.id);
    });
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.is-open').forEach(m => closeModal(m.id));
    }
  });
}

// Init
async function init() {
  await initAuth();
  updateHeaderUser();
  initEventDelegation();
  initSearch();
  initAuthHandlers();
  initWriteReview();
  await goHome();
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add js/main.js
git commit -m "feat: add main module with app initialization and routing"
```

---

### Task 12: Update index.html — Module Imports

**Covers:** STEP 7

**Files:**
- Modify: `index.html`

**Steps:**

- [ ] **Step 1: Replace script tag with ES module imports**

Replace `<script src="script.js"></script>` with:
```html
<script type="module" src="js/main.js"></script>
```

- [ ] **Step 2: Update CSS imports**

Replace `<link rel="stylesheet" href="styles.css">` with:
```html
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/layout.css">
<link rel="stylesheet" href="css/components.css">
<link rel="stylesheet" href="css/pages.css">
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: update index.html with module imports"
```

---

### Task 13: Split styles.css into CSS Modules

**Covers:** STEP 7

**Files:**
- Create: `css/base.css`
- Create: `css/layout.css`
- Create: `css/components.css`
- Create: `css/pages.css`

**Steps:**

- [ ] **Step 1: Create css/base.css**

Contains: CSS variables, reset, scrollbar styles (lines 1-58 of styles.css)

- [ ] **Step 2: Create css/layout.css**

Contains: Header styles, layout, section titles (lines 60-224)

- [ ] **Step 3: Create css/components.css**

Contains: Game cards, tags, modals, buttons, forms (lines 225-532 + 768-1035)

- [ ] **Step 4: Create css/pages.css**

Contains: Carousel, showcases, game page, publisher, profile, responsive (lines 337-767 + 1302-1354)

- [ ] **Step 5: Commit**

```bash
git add css/
git commit -m "feat: split styles.css into modular CSS files"
```

---

### Task 14: Final Cleanup & Verification

**Covers:** STEP 8

**Files:**
- Delete: `script.js` (after verification)
- Delete: `styles.css` (after verification)

**Steps:**

- [ ] **Step 1: Verify all files exist**

Check that all js/*.js and css/*.css files exist.

- [ ] **Step 2: Verify index.html loads correctly**

Open index.html in browser and confirm:
- No console errors
- All modules load
- UI renders correctly

- [ ] **Step 3: Verify Supabase connection**

Test that the app can connect to Supabase and query data.

- [ ] **Step 4: Delete old files**

```bash
rm script.js styles.css
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: remove old monolithic files after successful refactor"
```

---

### Task 15: Deliver Final Summary

**Covers:** STEP 8

**Deliverable:**

After all tasks complete, provide a summary covering:
- All tables created and their purpose
- All files created or modified and what each does
- How the external API integration works
- What can be expanded next
