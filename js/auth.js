import { supabase } from './config.js';
import { getProfile, upsertProfile } from './api.js';

let currentUser = null;
let currentProfile = null;
let authChangeCallback = null;

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentProfile() {
  return currentProfile;
}

export function requireAuth() {
  return !!currentUser;
}

export function onAuthChange(callback) {
  authChangeCallback = callback;
}

function notifyAuthChange() {
  if (authChangeCallback) authChangeCallback();
}

export async function initAuth() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    currentProfile = await getProfile(currentUser.id);
    if (!currentProfile) {
      currentProfile = await upsertProfile({
        id: currentUser.id,
        username: currentUser.user_metadata?.user_name || currentUser.email?.split('@')[0] || 'user',
        display_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.user_name || currentUser.email?.split('@')[0] || 'user',
        avatar_url: currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
      });
    }
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await getProfile(currentUser.id);
      if (!currentProfile) {
        currentProfile = await upsertProfile({
          id: currentUser.id,
          username: currentUser.user_metadata?.user_name || currentUser.email?.split('@')[0] || 'user',
          display_name: currentUser.user_metadata?.full_name || currentUser.user_metadata?.user_name || currentUser.email?.split('@')[0] || 'user',
          avatar_url: currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.id}`,
        });
      }
    } else {
      currentUser = null;
      currentProfile = null;
    }
    notifyAuthChange();
  });
}
    } else {
      currentUser = null;
      currentProfile = null;
    }
    notifyAuthChange();
  });
}

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await getProfile(currentUser.id);
    } else {
      currentUser = null;
      currentProfile = null;
    }
    if (authStateCallback) authStateCallback();
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

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}
