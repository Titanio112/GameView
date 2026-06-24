import { getUserLibrary, addToLibrary, supabaseQuery } from './api.js';
import { getCurrentUser } from './auth.js';
import { showToast } from './ui.js';
import { supabase } from './config.js';

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

  if (result) showToast('Jogo adicionado \u00e0 biblioteca!');
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
