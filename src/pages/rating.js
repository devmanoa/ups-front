import { api } from '../lib/api.js';
import { esc, field, select, message, setBusy, readForm, money } from '../lib/ui.js';
import { packagesEditor } from '../lib/packages.js';

export function renderRating(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Calcul de tarifs</h2>
      <p class="hint">Comparez les services UPS disponibles pour une destination donnée.</p>

      <h3 style="font-size:15px;margin:0 0 10px">Destination</h3>
      <div class="grid" id="rate-to">
        ${field('Adresse', 'addressLine1', { placeholder: '10 Downing Street' })}
        ${field('Ville', 'city', { placeholder: 'Lyon' })}
        ${field('Code postal', 'postalCode', { placeholder: '69001', required: true })}
        ${field('Pays (ISO 2)', 'country', { value: 'FR', required: true })}
        ${select('Type d\'adresse', 'residential', [
          { value: '', label: 'Professionnelle' },
          { value: '1', label: 'Résidentielle' },
        ])}
      </div>

      <div class="packages-header">
        <h3>Colis</h3>
        <button type="button" class="secondary" id="btn-add-pkg">+ Ajouter un colis</button>
      </div>
      <div id="rate-packages"></div>

      <div class="grid" style="margin-top:14px" id="rate-options">
        ${select('Mode de calcul', 'requestOption', [
          { value: 'Shop', label: 'Tous les services (Shop)' },
          { value: 'Shoptimeintransit', label: 'Tous les services + délais' },
          { value: 'Rate', label: 'Un service précis (Rate)' },
        ], 'Shop')}
        <div class="field" id="service-wrapper" style="display:none">
          <label for="serviceCode">Service</label>
          <select id="serviceCode" name="serviceCode"></select>
        </div>
      </div>

      <div class="actions">
        <button class="primary" id="btn-rate">Calculer les tarifs</button>
      </div>
    </div>
    <div id="rate-result"></div>`;

  const btn = root.querySelector('#btn-rate');
  const out = root.querySelector('#rate-result');
  const toForm = root.querySelector('#rate-to');
  const optForm = root.querySelector('#rate-options');
  const serviceWrapper = root.querySelector('#service-wrapper');
  const serviceSelect = root.querySelector('#serviceCode');

  const pkgs = packagesEditor(root.querySelector('#rate-packages'));
  root.querySelector('#btn-add-pkg').addEventListener('click', () => pkgs.addRow());

  // Le choix d'un service n'a de sens qu'en mode "Rate".
  const optionSelect = optForm.querySelector('#requestOption');
  optionSelect.addEventListener('change', () => {
    serviceWrapper.style.display = optionSelect.value.startsWith('Rate') ? 'flex' : 'none';
  });

  api
    .getServices()
    .then((services) => {
      serviceSelect.innerHTML = services
        .map((s) => `<option value="${esc(s.code)}">${esc(s.name)}</option>`)
        .join('');
      serviceSelect.value = '11';
    })
    .catch(() => {
      serviceSelect.innerHTML = '<option value="11">UPS Standard</option>';
    });

  btn.addEventListener('click', async () => {
    const to = readForm(toForm);
    const opts = readForm(optForm);
    const packages = pkgs.read();

    if (!to.postalCode) {
      out.innerHTML = message('Le code postal de destination est obligatoire.', 'error');
      return;
    }
    if (packages.some((p) => !p.weight || Number(p.weight) <= 0)) {
      out.innerHTML = message('Chaque colis doit avoir un poids supérieur à 0.', 'error');
      return;
    }

    setBusy(btn, true, 'Calculer les tarifs');
    out.innerHTML = '';

    try {
      const data = await api.getRates({
        shipTo: {
          addressLine1: to.addressLine1,
          city: to.city,
          postalCode: to.postalCode,
          country: to.country || 'FR',
          residential: to.residential === '1',
        },
        packages,
        requestOption: opts.requestOption,
        serviceCode: opts.requestOption.startsWith('Rate') ? opts.serviceCode : undefined,
      });

      out.innerHTML = data.rates.length
        ? `<div class="card">
             <h2>${data.rates.length} tarif(s) disponible(s)</h2>
             <div class="result-list">${data.rates.map(renderRate).join('')}</div>
           </div>`
        : message('Aucun tarif retourné pour cette destination.', 'info');
    } catch (err) {
      out.innerHTML = message(err.message, 'error');
    } finally {
      setBusy(btn, false, 'Calculer les tarifs');
    }
  });
}

function renderRate(rate) {
  return `
    <div class="result-item">
      <div class="result-row">
        <div>
          <h3>${esc(rate.serviceName)}</h3>
          <p class="meta">
            Code ${esc(rate.serviceCode)}
            ${rate.billingWeight ? ` · Poids facturé : ${esc(rate.billingWeight)}` : ''}
            ${rate.guaranteedDays ? ` · ${esc(rate.guaranteedDays)} jour(s)` : ''}
          </p>
          ${rate.isNegotiated ? '<span class="badge green">Tarif négocié</span>' : ''}
        </div>
        <div class="price">${esc(money(rate.totalCharges, rate.currency))}</div>
      </div>
    </div>`;
}
