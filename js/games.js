import { imgUrl, year } from './ui.js';

export function makeGameCard(game) {
  const el = document.createElement('div');
  el.className = 'game-card fade-up';
  el.dataset.action = 'go-game';
  el.dataset.gameId = game.id;

  const genreTags = (game.genres || []).length > 0
    ? `<div class="gc-tags">${(game.genres || []).slice(0, 2).map(g => `<span class="tag">${g.name || g}</span>`).join('')}</div>`
    : '';
  const scoreHtml = game.metacritic
    ? `<div class="gc-score">${game.metacritic}</div>` : '';
  const hasImg = !!imgUrl(game);

  el.innerHTML = `
    <div class="gc-cover${hasImg ? ' has-skeleton' : ''}">
      <img src="${imgUrl(game)}" alt="${game.name}" loading="lazy" class="${hasImg ? 'loading' : ''}"
        onload="this.classList.remove('loading');this.closest('.gc-cover')?.classList.remove('has-skeleton')">
      ${scoreHtml}
    </div>
    <div class="gc-title">${game.name}</div>
    ${genreTags}
  `;
  return el;
}

export function makeCarouselSlide(game) {
  const el = document.createElement('div');
  el.className = 'carousel-slide';
  el.dataset.action = 'go-game';
  el.dataset.gameId = game.id;

  const genre = game.genres?.[0]?.name || 'Destaque';
  const yr = year(game.released);
  const score = game.metacritic ? `<span class="c-score">${game.metacritic}</span><span class="c-meta-sep">&middot;</span>` : '';
  const plats = (game.platforms || []).slice(0, 3).map(p => p.platform?.name || p).join(', ');

  el.innerHTML = `
    <img src="${imgUrl(game)}" alt="${game.name}" loading="lazy">
    <div class="c-fade-bottom"></div>
    <div class="c-fade-left"></div>
    <div class="c-info">
      <div class="c-genre-badge">${genre}</div>
      <div class="c-title">${game.name}</div>
      <div class="c-meta">
        ${score}
        ${yr ? `<span>${yr}</span><span class="c-meta-sep">&middot;</span>` : ''}
        <span>${plats || 'Multi-plataforma'}</span>
      </div>
      <button class="c-btn" data-action="go-game" data-game-id="${game.id}">
        Ver detalhes
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>
    </div>
  `;
  return el;
}

let carouselGames = [];
let carouselIndex = 0;
let carouselTimer = null;

export function initCarousel(games, { onDotClick, onSlideClick } = {}) {
  carouselGames = games;
  carouselIndex = 0;
  const track = document.getElementById('carousel-track');
  const dots = document.getElementById('carousel-dots');
  if (!track || !dots) return;
  track.innerHTML = '';
  dots.innerHTML = '';

  games.forEach((g, i) => {
    const slide = makeCarouselSlide(g);
    if (onSlideClick) slide.addEventListener('click', () => onSlideClick(g.id));
    track.appendChild(slide);

    const d = document.createElement('button');
    d.className = `c-dot${i === 0 ? ' is-active' : ''}`;
    d.setAttribute('aria-label', `Slide ${i + 1}`);
    d.dataset.action = 'carousel-dot';
    d.dataset.slideIdx = i;
    d.addEventListener('click', () => {
      goSlide(i);
      resetCarouselTimer();
    });
    dots.appendChild(d);
  });

  updateCarousel();
  resetCarouselTimer();
}

export function goSlide(idx) {
  if (!carouselGames.length) return;
  const len = carouselGames.length;
  carouselIndex = ((idx % len) + len) % len;
  updateCarousel();
}

function updateCarousel() {
  const track = document.getElementById('carousel-track');
  if (track) track.style.transform = `translateX(-${carouselIndex * 100}%)`;
  document.querySelectorAll('.c-dot').forEach((d, i) => {
    d.classList.toggle('is-active', i === carouselIndex);
  });
  document.querySelectorAll('.carousel-slide').forEach((s, i) => {
    s.classList.toggle('is-active', i === carouselIndex);
  });
}

export function resetCarouselTimer() {
  clearInterval(carouselTimer);
  carouselTimer = setInterval(() => goSlide(carouselIndex + 1), 5200);
}

export function scrollShowcase(scrollId, dir) {
  const el = document.getElementById(scrollId);
  if (el) el.scrollBy({ left: dir * 580, behavior: 'smooth' });
}
