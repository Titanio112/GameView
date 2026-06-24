import { initAuth, getCurrentUser, getCurrentProfile, signIn, signUp, signOut, resetPassword, requireAuth } from './auth.js';
import { fetchFeaturedGames, fetchPopularGames, fetchNewReleases, fetchGameDetails, fetchPublisher, fetchPublisherGames, searchAPI } from './api.js';
import { showPage, openModal, closeModal, skeletons, showToast, formatDate } from './ui.js';
import { initCarousel, goSlide, resetCarouselTimer, scrollShowcase, makeGameCard } from './games.js';
import { makeReviewCard, renderReviews, renderTagCloud, renderTrending, filterGenre, openReview, initWriteReview, postComment, loadReviews, loadGenres } from './reviews.js';
import { loadNotifications, markAllRead, renderNotificationBadge } from './notifications.js';

let currentPage = 'home';
let gamesCache = {};
let pubCache = {};

const errorMessages = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'Email not confirmed': 'Confirme seu e-mail antes de fazer login.',
  'User already registered': 'Este e-mail já está cadastrado.',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres.',
  'Unable to validate email address': 'Digite um e-mail válido.',
};
function translateError(message) {
  for (const [key, value] of Object.entries(errorMessages)) {
    if (message.includes(key)) return value;
  }
  return 'Algo deu errado. Tente novamente.';
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Auth UI
function updateHeaderUser() {
  const el = document.getElementById('header-user-area');
  const user = getCurrentUser();
  const profile = getCurrentProfile();
  if (!el) return;

  if (user && profile) {
    const avatarUrl = profile.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`;
    el.innerHTML = `
      <div class="user-chip" id="user-chip-toggle">
        <span class="user-chip-name">${profile.username}</span>
        <div class="user-chip-avatar">
          <img src="${avatarUrl}" alt="${profile.display_name}">
        </div>
      </div>
      <div class="user-dropdown" id="user-dropdown">
        <div class="ud-item" data-action="go-profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Meu Perfil
        </div>
        <div class="ud-item" data-action="open-edit-profile">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Configurações
        </div>
        <div class="ud-divider"></div>
        <div class="ud-item ud-logout" data-action="sign-out">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sair
        </div>
      </div>
    `;
    document.getElementById('user-chip-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('user-dropdown')?.classList.toggle('open');
    });
  } else {
    el.innerHTML = `<button class="btn-enter" data-action="open-auth">Entrar</button>`;
  }
}

function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  openModal('auth-modal-overlay');
  const modal = document.querySelector('#auth-modal-overlay .modal-box');
  if (modal) trapFocus(modal);
}

function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  modal.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  first.focus();
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

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  document.getElementById('search-results')?.classList.remove('open');

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

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.value = '';
  document.getElementById('search-results')?.classList.remove('open');

  document.getElementById('game-banner-img').src = '';
  document.getElementById('game-cover-img').src = '';
  document.getElementById('gb-title').textContent = 'Carregando\u2026';

  if (!gamesCache[gameId]) {
    gamesCache[gameId] = await fetchGameDetails(gameId);
  }
  const game = gamesCache[gameId];
  if (!game) {
    document.getElementById('gb-title').textContent = 'Jogo n\u00e3o encontrado';
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
  document.getElementById('game-synopsis').textContent = raw.length > 680 ? raw.slice(0, 680) + '\u2026' : raw;

  const genres = (game.genres || []).map(g => `<span class="tag">${g.name}</span>`).join('') || '\u2014';
  const plats = (game.platforms || []).map(p => `<span class="platform-pill">${p.platform.name}</span>`).join('') || '\u2014';
  const devs = (game.developers || []).map(d => d.name).join(', ') || '\u2014';
  document.getElementById('game-meta-box').innerHTML = `
    <div class="game-meta-item">
      <div class="gm-label">G\u00eaneros</div>
      <div class="gm-value">${genres}</div>
    </div>
    <div class="game-meta-item">
      <div class="gm-label">Plataformas</div>
      <div class="gm-value">${plats}</div>
    </div>
    <div class="game-meta-item">
      <div class="gm-label">Lan\u00e7amento</div>
      <div class="gm-value">${formatDate(game.released)}</div>
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

function openEditProfileModal() {
  const profile = getCurrentProfile();
  if (!profile) return;

  document.getElementById('ep-avatar-preview-img').src = profile.avatar_url || '';
  document.getElementById('ep-avatar-url').value = profile.avatar_url || '';
  document.getElementById('ep-display-name').value = profile.display_name || '';
  document.getElementById('ep-pronouns').value = profile.pronouns || 'ele/dele';
  document.getElementById('ep-bio').value = profile.bio || '';

  openModal('edit-profile-modal-overlay');
}

async function goBrowse(type) {
  currentPage = 'browse';
  showPage('page-browse');
  setNavActive(null);
  window.scrollTo({ top: 0 });

  const title = document.getElementById('browse-title');
  const grid = document.getElementById('browse-grid');
  title.textContent = type === 'popular' ? 'Em Alta' : 'Lançamentos Recentes';
  grid.innerHTML = '';
  skeletons(grid, 18);

  const games = type === 'popular'
    ? await fetchPopularGames()
    : await fetchNewReleases();

  grid.innerHTML = '';
  games.forEach(g => grid.appendChild(makeGameCard(g)));
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
        <div><span class="ps-n">${profile.level || 1}</span> <span class="ps-l">N\u00edvel</span></div>
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

  document.getElementById('search-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.target.value = '';
      document.getElementById('search-results')?.classList.remove('open');
    }
  });
}

// Auth handlers
function initAuthHandlers() {
  document.getElementById('btn-simulate-login')?.addEventListener('click', async () => {
    const panel = document.getElementById('auth-panel-login');
    const email = panel?.querySelector('input[type="email"]')?.value;
    const password = panel?.querySelector('input[type="password"]')?.value;
    if (!email || !password) {
      showToast('Preencha e-mail e senha.');
      return;
    }
    if (!emailRegex.test(email)) {
      showToast('Digite um e-mail válido.');
      return;
    }
    try {
      await signIn(email, password);
      closeModal('auth-modal-overlay');
      updateHeaderUser();
      showToast('Login realizado com sucesso!');
    } catch (err) {
      showToast(translateError(err.message || 'verifique suas credenciais'));
    }
  });

  document.getElementById('btn-register')?.addEventListener('click', async () => {
    const panel = document.getElementById('auth-panel-register');
    const username = panel?.querySelector('input[type="text"]')?.value?.trim();
    const email = panel?.querySelector('input[type="email"]')?.value;
    const password = panel?.querySelector('input[type="password"]')?.value;
    if (!username || !email || !password) {
      showToast('Preencha todos os campos.');
      return;
    }
    if (!emailRegex.test(email)) {
      showToast('Digite um e-mail válido.');
      return;
    }
    try {
      await signUp(email, password, username);
      const confirmBody = `
        <div class="am-confirm">
          <div class="am-confirm-icon">🎮</div>
          <div class="am-confirm-title">Conta criada com sucesso!</div>
          <p class="am-confirm-text">
            Enviamos um link de confirmação para <strong>${email}</strong>.
            Acesse seu e-mail e clique no link para ativar sua conta.
            Depois volte aqui para fazer login.
          </p>
          <button class="btn-auth-primary" onclick="document.getElementById('auth-confirm-overlay')?.classList.remove('is-open');document.body.style.overflow='';">Entendi</button>
        </div>
      `;
      const confirmOverlay = document.createElement('div');
      confirmOverlay.className = 'modal-overlay';
      confirmOverlay.id = 'auth-confirm-overlay';
      confirmOverlay.innerHTML = `<div class="modal-box auth-modal-box"><div class="am-body">${confirmBody}</div></div>`;
      document.body.appendChild(confirmOverlay);
      confirmOverlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      confirmOverlay.addEventListener('click', (e) => {
        if (e.target === confirmOverlay) {
          confirmOverlay.classList.remove('is-open');
          document.body.style.overflow = '';
        }
      });
      switchAuthTab('login');
      showToast('Verifique seu e-mail para confirmar o cadastro.');
    } catch (err) {
      showToast(translateError(err.message || 'tente novamente'));
    }
  });

  document.getElementById('btn-forgot-password')?.addEventListener('click', async () => {
    const panel = document.getElementById('auth-panel-forgot');
    const email = panel?.querySelector('input[type="email"]')?.value;
    if (!email) {
      showToast('Digite seu e-mail.');
      return;
    }
    try {
      await resetPassword(email);
      showToast('Link de recuperação enviado!');
    } catch (err) {
      showToast('Erro: ' + (err.message || 'tente novamente'));
    }
  });

  document.querySelectorAll('[data-auth-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.authTab));
  });

  document.getElementById('btn-google-login')?.addEventListener('click', () => {
    showToast('Login com Google em breve. Use e-mail por enquanto.');
  });
}

function initEditProfile() {
  document.getElementById('ep-save-btn')?.addEventListener('click', async () => {
    const profile = getCurrentProfile();
    if (!profile) return;

    const avatarUrl = document.getElementById('ep-avatar-url').value.trim();
    const displayName = document.getElementById('ep-display-name').value.trim();
    const pronouns = document.getElementById('ep-pronouns').value;
    const bio = document.getElementById('ep-bio').value.trim();

    try {
      const updatedProfile = await upsertProfile({
        id: profile.id,
        username: profile.username,
        display_name: displayName || profile.username,
        avatar_url: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${profile.username}`,
        pronouns,
        bio,
      });

      if (updatedProfile) {
        showToast('Perfil salvo com sucesso!');
        closeModal('edit-profile-modal-overlay');
        updateHeaderUser();
        renderProfile();
      } else {
        showToast('Erro ao salvar perfil. Tente novamente.');
      }
    } catch (err) {
      showToast('Erro ao salvar perfil: ' + (err.message || 'tente novamente'));
    }
  });
}

// Event delegation
function initEventDelegation() {
  document.addEventListener('click', e => {
    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && !e.target.closest('#user-chip-toggle') && !e.target.closest('#user-dropdown')) {
      dropdown.classList.remove('open');
    }

    const target = e.target.closest('[data-action']');
    if (target) {
      const action = target.dataset.action;

      if (action === 'go-game') {
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        if (searchInput) searchInput.value = '';
        if (searchResults) searchResults.classList.remove('open');
        goGame(target.dataset.gameId);
      }
      if (action === 'go-publisher') goPublisher(target.dataset.pubId);
      if (action === 'go-profile') goProfile();
      if (action === 'go-home') goHome();
      if (action === 'open-review') openReview(target.dataset.reviewId);
      if (action === 'filter-genre') filterGenre(target.dataset.genre);
      if (action === 'open-auth') openAuthModal('login');
      if (action === 'open-edit-profile') openEditProfileModal();
      if (action === 'sign-out') {
        signOut().then(() => {
          updateHeaderUser();
          showToast('Você saiu da sua conta.');
        });
      }
      if (action === 'post-comment') postComment(target.dataset.reviewId);
      if (action === 'comment-click') {
        openReview(target.dataset.reviewId);
        setTimeout(() => {
          const ta = document.getElementById(`comment-ta-${target.dataset.reviewId}`);
          if (ta) ta.focus();
        }, 300);
      }
    }

    const dropdown = document.getElementById('user-dropdown');
    if (dropdown && !e.target.closest('#user-chip-toggle') && !e.target.closest('#user-dropdown')) {
      dropdown.classList.remove('open');
    }
  });

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      if (el.dataset.nav === 'home') goHome();
      if (el.dataset.nav === 'browse') goBrowse(el.dataset.browseType || 'popular');
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
  try {
    await initAuth();
  } catch (e) {
    console.warn('Auth init failed:', e);
  }
  updateHeaderUser();
  initEventDelegation();
  initSearch();
  initAuthHandlers();
  initWriteReview();
  initEditProfile();
  await goHome();
}

init();
