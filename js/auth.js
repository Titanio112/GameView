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
      const baseUsername = currentUser.user_metadata?.user_name
        || currentUser.user_metadata?.full_name?.toLowerCase().replace(/\s+/g, '')
        || currentUser.email?.split('@')[0]
        || 'user';
      let username = baseUsername;
      let counter = 1;
      while (await checkUsernameExists(username)) {
        username = `${baseUsername}${counter}`;
        counter++;
      }
      currentProfile = await upsertProfile({
        id: currentUser.id,
        username,
        display_name: currentUser.user_metadata?.full_name || username,
        avatar_url: currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
      });
    }
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      currentUser = session.user;
      currentProfile = await getProfile(currentUser.id);
      if (!currentProfile) {
        const baseUsername = currentUser.user_metadata?.user_name
          || currentUser.user_metadata?.full_name?.toLowerCase().replace(/\s+/g, '')
          || currentUser.email?.split('@')[0]
          || 'user';
        let username = baseUsername;
        let counter = 1;
        while (await checkUsernameExists(username)) {
          username = `${baseUsername}${counter}`;
          counter++;
        }
        currentProfile = await upsertProfile({
          id: currentUser.id,
          username,
          display_name: currentUser.user_metadata?.full_name || username,
          avatar_url: currentUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        });
      }
    } else {
      currentUser = null;
      currentProfile = null;
    }
    notifyAuthChange();
  });
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  currentUser = data.user;
  currentProfile = await getProfile(currentUser.id);
  return { user: currentUser, profile: currentProfile };
}

export async function checkUsernameExists(username) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single();
  return !!data;
}

export async function checkEmailExists(email) {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', email.split('@')[0])
    .single();
  if (data) return true;

  try {
    const { data: exists } = await supabase.rpc('check_email_exists', { check_email: email });
    return !!exists;
  } catch {
    return false;
  }
}

export async function signUp(email, password, username) {
  const emailTaken = await checkEmailExists(email);
  if (emailTaken) {
    throw new Error('Este e-mail já está cadastrado.');
  }

  const usernameTaken = await checkUsernameExists(username);
  if (usernameTaken) {
    throw new Error('Este nome de usuário já está em uso.');
  }

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

export async function uploadAvatar(file) {
  const user = currentUser;
  if (!user) throw new Error('Não autenticado');

  const ext = file.name.split('.').pop();
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(path);

  return urlData.publicUrl;
}

export async function signOut() {
  await supabase.auth.signOut();
  currentUser = null;
  currentProfile = null;
}

export async function resetPassword(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://titanio112.github.io/GameView',
  });
  if (error) throw error;
}
