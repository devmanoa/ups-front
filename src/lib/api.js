/**
 * Résolution de l'URL du backend, par ordre de priorité :
 * 1. window.__APP_CONFIG__ — injecté au démarrage du conteneur (production)
 * 2. VITE_API_URL — figé au build par Vite (développement local)
 * 3. localhost:3000 — repli par défaut
 */
const API_URL = (
  window.__APP_CONFIG__?.API_URL ||
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');

/**
 * Appelle le backend UPS et remonte les erreurs sous forme d'Error
 * portant le message renvoyé par l'API (et donc par UPS).
 */
async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`Impossible de joindre le backend (${API_URL}). Est-il démarré ?`);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.success === false) {
    const err = new Error(data?.error?.message || `Erreur HTTP ${res.status}`);
    err.code = data?.error?.code;
    err.upsCodes = data?.error?.upsCodes;
    throw err;
  }

  return data.data;
}

export const api = {
  health: () => request('/health'),
  testAuth: () => request('/api/auth/test'),

  track: (trackingNumber) => request(`/api/tracking/${encodeURIComponent(trackingNumber)}`),

  getServices: () => request('/api/rating/services'),
  getRates: (payload) => request('/api/rating', { method: 'POST', body: payload }),

  createShipment: (payload) => request('/api/shipping', { method: 'POST', body: payload }),
  voidShipment: (shipmentId) =>
    request(`/api/shipping/${encodeURIComponent(shipmentId)}`, { method: 'DELETE' }),

  validateAddress: (payload) => request('/api/address/validate', { method: 'POST', body: payload }),

  findAccessPoints: (payload) => request('/api/locator/access-points', { method: 'POST', body: payload }),
};

export { API_URL };
