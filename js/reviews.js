import { stars, imgUrl, trunc, nowDate, formatDate, openModal, closeModal, showToast } from './ui.js';
import { getReviews, createReview, getComments, createComment, toggleReviewReaction, supabaseQuery, searchAPI } from './api.js';
import { getCurrentUser, requireAuth } from './auth.js';
import { APP_CONFIG } from './config.js';

let activeGenre = null;
let allReviews = [];
let genres = [];

export async function loadReviews() {
  allReviews = await supabaseQuery('reviews', {
    select: '*, profiles:user_id(username, display_name, avatar_url), games:game_id(title, cover_url, release_date)',
    order: { column: 'created_at', ascending: false },
    limit: 50,
  });
  return allReviews;
}

export async function loadGenres() {
  genres = await supabaseQuery('genres', { select: 'name', order: { column: 'name' } });
  return genres.map(g => g.name);
}

export function makeReviewCard(rv) {
  const el = document.createElement('article');
  el.className = 'review-card fade-up';
  el.dataset.action = 'open-review';
  el.dataset.reviewId = rv.id;

  const gameName = rv.games?.title || rv.gameName || 'Jogo';
  const gameCover = rv.games?.cover_url || rv.gameCover || '';
  const authorName = rv.profiles?.display_name || rv.author?.name || 'An\u00f4nimo';
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
        <span class="rv-date">${formatDate(rv.created_at)}</span>
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

export function renderReviews(containerId, list, isFiltered = false) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (!list.length) {
    const msg = isFiltered
      ? 'Nenhuma resenha encontrada para este filtro.'
      : 'Ainda não há resenhas. Seja o primeiro a publicar! \u270D\uFE0F';
    el.innerHTML = `<div class="empty-state">
      <strong>${msg}</strong>
    </div>`;
    return;
  }
  list.forEach(rv => el.appendChild(makeReviewCard(rv)));
}

export function renderTagCloud(genresList) {
  const el = document.getElementById('tag-cloud');
  if (!el) return;
  el.innerHTML = '';
  genresList.forEach(g => {
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
    ? allReviews.filter(r => r.genre === activeGenre || r.games?.genres?.some(g => g.name === activeGenre))
    : allReviews;
  renderReviews('review-list', filtered, !!activeGenre);
}

export async function renderTrending() {
  const el = document.getElementById('trending-list');
  if (!el) return;
  const trending = [...allReviews].sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0)).slice(0, 5);
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
  if (!requireAuth()) {
    showToast('Faça login para escrever uma resenha');
    return openModal('auth-modal-overlay');
  }

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
    const starEl = document.createElement('span');
    starEl.className = 'star-picker-star';
    starEl.dataset.value = star;
    starEl.textContent = '\u2605';
    if (currentRating >= star) starEl.classList.add('filled');
    else if (currentRating >= star - 0.5) starEl.classList.add('half');

    starEl.setAttribute('role', 'slider');
    starEl.setAttribute('aria-label', `Nota ${star} de 5`);
    starEl.setAttribute('aria-valuemin', '0.5');
    starEl.setAttribute('aria-valuemax', '5');
    starEl.setAttribute('aria-valuenow', currentRating.toString());
    starEl.setAttribute('tabindex', '0');

    starEl.addEventListener('mouseenter', () => highlightStars(star));
    starEl.addEventListener('mouseleave', () => highlightStars(writeState.rating));
    starEl.addEventListener('click', (e) => {
      const rect = starEl.getBoundingClientRect();
      const isLeftHalf = e.clientX - rect.left < rect.width / 2;
      const value = isLeftHalf ? star - 0.5 : star;
      writeState.rating = value;
      highlightStars(value);
      starEl.setAttribute('aria-valuenow', value.toString());
      document.getElementById('star-display-label').textContent = `${value} \u2605`;
      document.querySelectorAll('.wm-error').forEach(el => el.remove());
      validateWriteForm();
    });
    starEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' && writeState.rating < 5) {
        e.preventDefault();
        writeState.rating = Math.min(5, writeState.rating + 0.5);
        highlightStars(writeState.rating);
        starEl.setAttribute('aria-valuenow', writeState.rating.toString());
        document.getElementById('star-display-label').textContent = `${writeState.rating} \u2605`;
        validateWriteForm();
      } else if (e.key === 'ArrowLeft' && writeState.rating > 0.5) {
        e.preventDefault();
        writeState.rating = Math.max(0.5, writeState.rating - 0.5);
        highlightStars(writeState.rating);
        starEl.setAttribute('aria-valuenow', writeState.rating.toString());
        document.getElementById('star-display-label').textContent = `${writeState.rating} \u2605`;
        validateWriteForm();
      }
    });

    picker.appendChild(starEl);
  }
}

function highlightStars(rating) {
  document.querySelectorAll('.star-picker-star').forEach(starEl => {
    const value = parseFloat(starEl.dataset.value);
    starEl.classList.toggle('filled', value <= rating);
    starEl.classList.toggle('half', !starEl.classList.contains('filled') && value - 0.5 <= rating);
  });
}

let searchTimeout;
function handleGameSearch(e) {
  clearTimeout(searchTimeout);
  const q = e.target.value.trim().toLowerCase();
  const dd = document.getElementById('wm-game-dropdown');
  if (!q) { dd.classList.remove('open'); return; }

  dd.innerHTML = '<div class="wm-search-loading">Buscando...</div>';
  dd.classList.add('open');

  searchTimeout = setTimeout(async () => {
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
            <div class="wm-game-option-year">${g.released ? new Date(g.released).getFullYear() : ''}</div>
          </div>
        `;
        opt.addEventListener('click', () => selectWriteGame(g));
        dd.appendChild(opt);
      });
    }
    dd.classList.add('open');
  }, 400);
}

function selectWriteGame(g) {
  writeState.selectedGame = g;
  document.getElementById('wm-sel-cover').src = imgUrl(g);
  document.getElementById('wm-sel-name').textContent = g.name;
  document.getElementById('wm-selected-game').classList.add('visible');
  document.getElementById('wm-game-search').value = '';
  document.getElementById('wm-game-dropdown').classList.remove('open');
  document.querySelectorAll('.wm-error').forEach(el => el.remove());
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
  document.querySelectorAll('.wm-error').forEach(el => el.remove());
  validateWriteForm();
}

function validateWriteForm() {
  const hasGame = !!writeState.selectedGame;
  const hasRating = writeState.rating > 0;
  const text = document.getElementById('wm-textarea').value.trim();
  const hasText = text.length >= 20;
  document.getElementById('btn-wm-save').disabled = !(hasGame && hasRating && hasText);
  return { hasGame, hasRating, hasText, text };
}

function showWriteError(field, message) {
  clearWriteErrors(field);
  const errorEl = document.createElement('div');
  errorEl.className = 'wm-error';
  errorEl.textContent = message;
  if (field === 'game') {
    document.querySelector('.wm-game-selector')?.after(errorEl);
  } else if (field === 'rating') {
    document.querySelector('.star-picker')?.parentElement?.after(errorEl);
  } else if (field === 'text') {
    document.querySelector('.wm-textarea-wrap')?.after(errorEl);
  }
}

function clearWriteErrors(field) {
  if (field) {
    document.querySelectorAll(`.wm-error`).forEach((el, i, arr) => {
      if (!field || el.previousElementSibling?.classList?.contains(
        field === 'game' ? 'wm-game-selector' :
        field === 'rating' ? 'star-picker' :
        'wm-textarea-wrap'
      )) el.remove();
    });
  } else {
    document.querySelectorAll('.wm-error').forEach(el => el.remove());
  }
}

async function publishReview() {
  const user = getCurrentUser();
  if (!user) return;

  clearWriteErrors();

  const game = writeState.selectedGame;
  const rating = writeState.rating;
  const text = document.getElementById('wm-textarea').value.trim();

  let hasError = false;
  if (!game) {
    showWriteError('game', 'Selecione um jogo');
    hasError = true;
  }
  if (!rating) {
    showWriteError('rating', 'Dê uma nota ao jogo');
    hasError = true;
  }
  if (!text || text.length < 20) {
    showWriteError('text', 'Escreva sua resenha (mínimo 20 caracteres)');
    hasError = true;
  }
  if (hasError) return;

  const reviewData = {
    user_id: user.id,
    game_id: game.id,
    game_title: game.name,
    score: rating * 2,
    body: text,
    recommended: true,
    created_at: new Date().toISOString(),
  };

  try {
    await createReview(reviewData);
    closeModal('write-review-modal-overlay');
    showToast('Resenha publicada!');
    const reviews = await loadReviews();
    renderReviews('review-list', reviews);
  } catch (err) {
    showToast('Erro ao publicar: ' + translateReviewError(err.message));
  }
}

function translateReviewError(message) {
  if (message.includes('duplicate') || message.includes('already exists')) return 'Você já publicou uma resenha para este jogo.';
  if (message.includes('foreign key') || message.includes('game_id')) return 'Jogo não encontrado.';
  if (message.includes('unauthorized') || message.includes('auth')) return 'Sessão expirada. Faça login novamente.';
  return 'Erro ao publicar. Tente novamente.';
}

// Review Modal (read)
export async function openReview(id) {
  const rv = allReviews.find(r => r.id === id);
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
          <div class="rm-rv-date">${formatDate(rv.created_at)}</div>
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
      <div class="comments-head">${comments.length} Coment\u00e1rio${comments.length !== 1 ? 's' : ''}</div>
      <div class="comment-input-row">
        ${avHtml}
        <div class="comment-input-wrap">
          <textarea class="comment-input" id="comment-ta-${rv.id}"
            placeholder="${user ? 'Adicione um coment\u00e1rio...' : 'Fa\u00e7a login para comentar...'}"></textarea>
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
    showToast('Coment\u00e1rio publicado!');
    openReview(id);
  }
}
