import { supabase } from './config.js';
import { getLfgPosts, supabaseQuery } from './api.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './ui.js';

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
