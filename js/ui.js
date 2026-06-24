export const year = s => s ? new Date(s).getFullYear() : '';
export const trunc = (s, n) => s && s.length > n ? s.slice(0, n).trim() + '\u2026' : (s || '');
export const imgUrl = g => g?.background_image || g?.cover_url || 'https://placehold.co/148x198/111318/5328e8?text=GameView';
export const formatDate = (isoDate) => {
  if (!isoDate) return 'Data desconhecida';
  return new Date(isoDate).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
};
export const nowDate = () => {
  const d = new Date();
  const months = ['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.'];
  return `${d.getDate()} de ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export function stars(n) {
  let h = '';
  for (let i = 1; i <= 5; i++) {
    const full = i <= n;
    const half = !full && (i - 0.5) <= n;
    if (full) h += '<span class="rv-star">\u2605</span>';
    else if (half) h += '<span class="rv-star half">\u2605</span>';
    else h += '<span class="rv-star off">\u2605</span>';
  }
  return h;
}

export function skeletons(el, n) {
  if (!el) return;
  el.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'skeleton';
    d.style.cssText = 'width:148px;height:198px;flex-shrink:0;border-radius:6px';
    el.appendChild(d);
  }
}

export function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('is-active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('is-active');
}

export function openModal(id) {
  document.getElementById(id).classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('is-open');
  document.body.style.overflow = '';
}

export function showToast(message) {
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:28px;left:50%;transform:translateX(-50%);
    background:var(--purple-700);color:#fff;
    padding:10px 22px;border-radius:20px;
    font-size:.85rem;font-weight:700;z-index:9999;
    border:1px solid var(--purple-500);
    animation:fadeUp 300ms ease;
  `;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
