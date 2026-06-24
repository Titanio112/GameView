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
  return !!currentUser;
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

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}
