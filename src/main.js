import './styles.css';
import { api, API_URL } from './lib/api.js';
import { renderTracking } from './pages/tracking.js';
import { renderRating } from './pages/rating.js';
import { renderLocator } from './pages/locator.js';
import { renderAddress } from './pages/address.js';
import { renderShipping } from './pages/shipping.js';

const PAGES = {
  tracking: renderTracking,
  rating: renderRating,
  locator: renderLocator,
  address: renderAddress,
  shipping: renderShipping,
};

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');
const badge = document.getElementById('status-badge');

function show(name) {
  tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  (PAGES[name] || PAGES.tracking)(app);
  // Permet de revenir sur un onglet via le bouton précédent du navigateur.
  window.location.hash = name;
}

tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) show(tab.dataset.tab);
});

window.addEventListener('hashchange', () => {
  const name = window.location.hash.slice(1);
  if (PAGES[name]) show(name);
});

/** Vérifie au démarrage que le backend répond et que les identifiants UPS sont valides. */
async function checkBackend() {
  try {
    const health = await api.health();

    if (!health.credentialsConfigured) {
      badge.className = 'status-badge status-error';
      badge.textContent = 'Identifiants UPS manquants';
      return;
    }

    await api.testAuth();
    badge.className = 'status-badge status-ok';
    badge.textContent = `Connecté — ${health.environment}`;
  } catch (err) {
    badge.className = 'status-badge status-error';
    badge.textContent = err.message.includes('joindre le backend')
      ? `Backend injoignable (${API_URL})`
      : 'Authentification UPS échouée';
  }
}

const initial = window.location.hash.slice(1);
show(PAGES[initial] ? initial : 'tracking');
checkBackend();
