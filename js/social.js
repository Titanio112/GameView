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
