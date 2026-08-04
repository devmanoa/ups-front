import { api } from '../lib/api.js';
import { esc, field, select, message, setBusy, readForm } from '../lib/ui.js';

export function renderLocator(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Points relais (UPS Access Point)</h2>
      <p class="hint">Recherchez les points relais autour d'une adresse de livraison.</p>
      <div class="grid" id="locator-form">
        ${field('Adresse', 'addressLine1', { placeholder: '1 rue de la Paix' })}
        ${field('Ville', 'city', { placeholder: 'Paris' })}
        ${field('Code postal', 'postalCode', { placeholder: '75002', required: true })}
        ${field('Pays (ISO 2)', 'country', { value: 'FR', required: true })}
        ${field('Rayon', 'radius', { type: 'number', value: '25' })}
        ${select('Unité', 'unit', [
          { value: 'KM', label: 'Kilomètres' },
          { value: 'MI', label: 'Miles' },
        ], 'KM')}
        ${field('Nombre de résultats', 'maxResults', { type: 'number', value: '10' })}
      </div>
      <div class="actions">
        <button class="primary" id="btn-locate">Rechercher</button>
      </div>
    </div>
    <div id="locator-result"></div>`;

  const btn = root.querySelector('#btn-locate');
  const form = root.querySelector('#locator-form');
  const out = root.querySelector('#locator-result');

  btn.addEventListener('click', async () => {
    const f = readForm(form);

    if (!f.postalCode && !f.city) {
      out.innerHTML = message('Renseignez au minimum un code postal ou une ville.', 'error');
      return;
    }

    setBusy(btn, true, 'Rechercher');
    out.innerHTML = '';

    try {
      const data = await api.findAccessPoints({
        address: {
          addressLine1: f.addressLine1,
          city: f.city,
          postalCode: f.postalCode,
          country: f.country || 'FR',
        },
        radius: Number(f.radius) || 25,
        unit: f.unit,
        maxResults: Number(f.maxResults) || 10,
      });

      out.innerHTML = data.locations.length
        ? `<div class="card">
             <h2>${data.locations.length} point(s) relais trouvé(s)</h2>
             <div class="result-list">${data.locations.map(renderLocation).join('')}</div>
           </div>`
        : message('Aucun point relais trouvé dans ce rayon.', 'info');
    } catch (err) {
      out.innerHTML = message(err.message, 'error');
    } finally {
      setBusy(btn, false, 'Rechercher');
    }
  });
}

function renderLocation(loc) {
  const address = [...loc.addressLines, loc.postalCode, loc.city].filter(Boolean).join(', ');

  const hours = loc.openingHours.length
    ? `<div class="hours">
        ${loc.openingHours.map((h) => `<div>${esc(h.day)} : ${esc(h.hours)}</div>`).join('')}
       </div>`
    : '';

  const maps =
    loc.latitude && loc.longitude
      ? `<p class="meta"><a href="https://www.google.com/maps?q=${loc.latitude},${loc.longitude}"
           target="_blank" rel="noopener">Voir sur la carte</a></p>`
      : '';

  return `
    <div class="result-item">
      <div class="result-row">
        <h3>${esc(loc.name || 'Point relais')}</h3>
        ${loc.distance ? `<span class="badge gold">${esc(loc.distance.value)} ${esc(loc.distance.unit)}</span>` : ''}
      </div>
      <p class="meta">${esc(address)}</p>
      ${loc.phone ? `<p class="meta">Tél. : ${esc(loc.phone)}</p>` : ''}
      ${loc.locationId ? `<p class="meta">ID : <code>${esc(loc.locationId)}</code></p>` : ''}
      ${hours}
      ${maps}
    </div>`;
}
