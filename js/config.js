import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://jdhqgrnhfitsxxlmyhvk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpkaHFncm5oZml0c3h4bG15aHZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNjM0MjgsImV4cCI6MjA5NzgzOTQyOH0.3v3s9AgUi5XtwIUdQ0JNq6QK5g4v1rKdxItFxRtcx2k';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const supabaseUrl = SUPABASE_URL;
export const supabaseKey = SUPABASE_ANON_KEY;

export const APP_CONFIG = {
  maxReviewLength: 800,
  maxFavoriteGames: 4,
  carouselInterval: 5200,
  searchDebounce: 450,
  reviewExcerptLength: 200,
};