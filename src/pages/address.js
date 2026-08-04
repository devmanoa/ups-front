import { api } from '../lib/api.js';
import { esc, field, select, message, setBusy, readForm } from '../lib/ui.js';

export function renderAddress(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Validation d'adresse</h2>
      <p class="hint">
        Vérifie et normalise une adresse, et indique si elle est résidentielle ou professionnelle.
        Cette API UPS ne couvre que les États-Unis et Porto Rico.
      </p>
      <div class="grid" id="addr-form">
        ${field('Adresse ligne 1', 'addressLine1', { placeholder: '2311 York Rd' })}
        ${field('Adresse ligne 2', 'addressLine2')}
        ${field('Ville', 'city', { placeholder: 'Timonium' })}
        ${field('État (code)', 'state', { placeholder: 'MD' })}
        ${field('Code postal', 'postalCode', { placeholder: '21093' })}
        ${field('Pays (ISO 2)', 'country', { value: 'US', required: true })}
        ${select('Traitement', 'requestOption', [
          { value: '3', label: 'Validation + classification' },
          { value: '1', label: 'Validation seule' },
          { value: '2', label: 'Classification seule' },
        ], '3')}
      </div>
      <div class="actions">
        <button class="primary" id="btn-validate">Valider l'adresse</button>
      </div>
    </div>
    <div id="addr-result"></div>`;

  const btn = root.querySelector('#btn-validate');
  const form = root.querySelector('#addr-form');
  const out = root.querySelector('#addr-result');

  btn.addEventListener('click', async () => {
    const f = readForm(form);

    if (!f.postalCode && !f.city) {
      out.innerHTML = message('Renseignez au minimum un code postal ou une ville.', 'error');
      return;
    }

    setBusy(btn, true, "Valider l'adresse");
    out.innerHTML = '';

    try {
      const data = await api.validateAddress({
        address: {
          addressLine1: f.addressLine1,
          addressLine2: f.addressLine2,
          city: f.city,
          state: f.state,
          postalCode: f.postalCode,
          country: f.country || 'US',
        },
        requestOption: Number(f.requestOption),
      });

      out.innerHTML = renderResult(data);
    } catch (err) {
      out.innerHTML = message(err.message, 'error');
    } finally {
      setBusy(btn, false, "Valider l'adresse");
    }
  });
}

function renderResult(data) {
  let verdict;
  if (data.valid) verdict = message('Adresse valide.', 'success');
  else if (data.ambiguous) verdict = message('Adresse ambiguë — plusieurs correspondances possibles.', 'info');
  else verdict = message('Adresse introuvable dans la base UPS.', 'error');

  const classification = data.classification
    ? `<p class="meta">Classification : <strong>${esc(data.classification.description)}</strong></p>`
    : '';

  const candidates = data.candidates.length
    ? `<div class="result-list">
        ${data.candidates
          .map(
            (c) => `<div class="result-item">
              <p style="margin:0">${esc(c.addressLines.join(', '))}</p>
              <p class="meta">${esc([c.city, c.state, c.postalCode, c.country].filter(Boolean).join(', '))}</p>
            </div>`,
          )
          .join('')}
       </div>`
    : '<p class="meta">Aucune suggestion retournée.</p>';

  return `
    <div class="card">
      ${verdict}
      ${classification}
      <h3 style="font-size:15px;margin:16px 0 10px">Adresses proposées</h3>
      ${candidates}
    </div>`;
}
