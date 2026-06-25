import { supabase } from './config.js';

const EDGE_FUNCTION_URL = `${supabase.supabaseUrl}/functions/v1/rawg-proxy`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function rawgApiGet(endpoint, params = {}, retries = 2) {
  const cacheKey = `${endpoint}:${JSON.stringify(params)}`;

  const cached = await getCachedGameData('rawg', cacheKey);
  if (cached) return cached;

  const body = JSON.stringify({ endpoint, params });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
        },
        body,
      });

      const data = await res.json();

      if (!res.ok) {
        const err = new Error(data?.error || `RAWG API error: ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }

      await setCachedGameData('rawg', cacheKey, data);
      return data;
    } catch (e) {
      const err = e;
      const isRateLimited = err.status === 429;
      const isServerError = (err.status && err.status >= 500) || !err.status;

      if ((isRateLimited || isServerError) && attempt < retries) {
        const delay = isRateLimited ? 1000 * (attempt + 1) : 500 * Math.pow(2, attempt);
        console.warn(`RAWG API ${err.status || 'network'} error, retrying in ${delay}ms (attempt ${attempt + 1}/${retries})`);
        await sleep(delay);
        continue;
      }

      console.error('RAWG API error:', endpoint, err);
      throw err;
    }
  }

  throw new Error('RAWG API: max retries exceeded');
}

function currentYear() {
  return new Date().getFullYear();
}

export const fetchFeaturedGames = async () => {
  try {
    const data = await rawgApiGet('games', {
      ordering: '-rating',
      page_size: '6',
      metacritic: '85,100',
      dates: `2015-01-01,${currentYear()}-12-31`,
    });
    return data?.results || [];
  } catch {
    return [];
  }
};

export const fetchPopularGames = async () => {
  try {
    const data = await rawgApiGet('games', {
      ordering: '-added',
      page_size: '18',
      dates: `2018-01-01,${currentYear()}-12-31`,
    });
    return data?.results || [];
  } catch {
    return [];
  }
};

export const fetchNewReleases = async () => {
  try {
    const to = new Date().toISOString().split('T')[0];
    const from = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
    const data = await rawgApiGet('games', {
      ordering: '-released',
      page_size: '18',
      dates: `${from},${to}`,
    });
    return data?.results || [];
  } catch {
    return [];
  }
};

export async function fetchGameDetails(id) {
  try {
    return await rawgApiGet(`games/${id}`);
  } catch {
    return null;
  }
}

export async function fetchPublisher(id) {
  try {
    return await rawgApiGet(`publishers/${id}`);
  } catch {
    return null;
  }
}

export const fetchPublisherGames = async (id) => {
  try {
    const data = await rawgApiGet('games', { publishers: String(id), page_size: '20' });
    return data?.results || [];
  } catch {
    return [];
  }
};

export const searchAPI = async (q) => {
  if (!q.trim()) return [];
  try {
    const data = await rawgApiGet('games', { search: q, page_size: '7' }, 1);
    return data?.results || [];
  } catch {
    return [];
  }
};

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
  if (error) throw error;
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
