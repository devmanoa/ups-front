import { api } from '../lib/api.js';
import { esc, field, message, setBusy, formatDate } from '../lib/ui.js';

export function renderTracking(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Suivi de colis</h2>
      <p class="hint">Saisissez un numéro de suivi UPS (format 1Z…).</p>
      <div class="grid">
        ${field('Numéro de suivi', 'trackingNumber', { placeholder: '1Z12345E1512345676', required: true })}
      </div>
      <div class="actions">
        <button class="primary" id="btn-track">Suivre le colis</button>
      </div>
    </div>
    <div id="track-result"></div>`;

  const btn = root.querySelector('#btn-track');
  const input = root.querySelector('#trackingNumber');
  const out = root.querySelector('#track-result');

  async function run() {
    const value = input.value.trim();
    if (!value) {
      out.innerHTML = message('Veuillez saisir un numéro de suivi.', 'error');
      return;
    }

    setBusy(btn, true, 'Suivre le colis');
    out.innerHTML = '';

    try {
      const data = await api.track(value);
      out.innerHTML = data.packages.length
        ? data.packages.map(renderPackage).join('')
        : message('Aucun colis trouvé pour ce numéro.', 'info');
    } catch (err) {
      out.innerHTML = message(err.message, 'error');
    } finally {
      setBusy(btn, false, 'Suivre le colis');
    }
  }

  btn.addEventListener('click', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') run();
  });
}

function renderPackage(pkg) {
  const delivered = pkg.currentStatusCode === '011' || /livr/i.test(pkg.currentStatus);

  const timeline = pkg.activities.length
    ? `<ul class="timeline">
        ${pkg.activities
          .map(
            (a) => `<li>
              <div class="t-status">${esc(a.status)}</div>
              <div class="t-meta">${esc(formatDate(a.date))}${a.location ? ` — ${esc(a.location)}` : ''}</div>
            </li>`,
          )
          .join('')}
      </ul>`
    : '<p class="meta">Aucun événement disponible.</p>';

  return `
    <div class="card">
      <div class="result-row">
        <h3>${esc(pkg.trackingNumber)}</h3>
        <span class="badge ${delivered ? 'green' : 'gold'}">${esc(pkg.currentStatus)}</span>
      </div>
      <p class="meta">
        ${pkg.service ? `Service : ${esc(pkg.service)}` : ''}
        ${pkg.weight ? ` · Poids : ${esc(pkg.weight)}` : ''}
        ${pkg.deliveryDate ? ` · Livraison : ${esc(formatDate(pkg.deliveryDate))}` : ''}
      </p>
      ${pkg.deliveredTo ? `<p class="meta">Réceptionné par : ${esc(pkg.deliveredTo)}</p>` : ''}
      ${timeline}
    </div>`;
}
