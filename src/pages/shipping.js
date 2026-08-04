import { api } from '../lib/api.js';
import { esc, field, select, message, setBusy, readForm, money, downloadBase64 } from '../lib/ui.js';
import { packagesEditor } from '../lib/packages.js';

export function renderShipping(root) {
  root.innerHTML = `
    <div class="card">
      <h2>Création d'étiquette</h2>
      <p class="hint">
        Crée une expédition réelle sur le compte UPS configuré et génère l'étiquette.
        En environnement <strong>test</strong>, aucune expédition réelle n'est facturée.
      </p>

      <h3 style="font-size:15px;margin:0 0 10px">Destinataire</h3>
      <div class="grid" id="ship-to">
        ${field('Nom', 'name', { placeholder: 'Jean Dupont', required: true })}
        ${field('Contact', 'attentionName', { placeholder: 'Service réception' })}
        ${field('Téléphone', 'phone', { placeholder: '0102030405' })}
        ${field('Adresse', 'addressLine1', { placeholder: '10 rue Victor Hugo', required: true })}
        ${field('Ville', 'city', { placeholder: 'Lyon', required: true })}
        ${field('Code postal', 'postalCode', { placeholder: '69001', required: true })}
        ${field('État (si applicable)', 'state')}
        ${field('Pays (ISO 2)', 'country', { value: 'FR', required: true })}
      </div>

      <div class="packages-header">
        <h3>Colis</h3>
        <button type="button" class="secondary" id="btn-add-pkg">+ Ajouter un colis</button>
      </div>
      <div id="ship-packages"></div>

      <div class="grid" style="margin-top:14px" id="ship-options">
        ${field('Description', 'description', { value: 'Marchandise' })}
        <div class="field">
          <label for="serviceCode">Service</label>
          <select id="serviceCode" name="serviceCode"></select>
        </div>
        ${select("Format d'étiquette", 'labelFormat', [
          { value: 'GIF', label: 'GIF (image)' },
          { value: 'PDF', label: 'PDF' },
          { value: 'ZPL', label: 'ZPL (imprimante thermique)' },
        ], 'GIF')}
        ${field('ID point relais (optionnel)', 'accessPointLocationId', { placeholder: 'Livraison en point relais' })}
      </div>

      <div class="actions">
        <button class="primary" id="btn-ship">Créer l'expédition</button>
      </div>
    </div>
    <div id="ship-result"></div>`;

  const btn = root.querySelector('#btn-ship');
  const out = root.querySelector('#ship-result');
  const toForm = root.querySelector('#ship-to');
  const optForm = root.querySelector('#ship-options');
  const serviceSelect = root.querySelector('#serviceCode');

  const pkgs = packagesEditor(root.querySelector('#ship-packages'), { withReference: true });
  root.querySelector('#btn-add-pkg').addEventListener('click', () => pkgs.addRow());

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

    const missing = ['name', 'addressLine1', 'city', 'postalCode', 'country'].filter((f) => !to[f]);
    if (missing.length) {
      out.innerHTML = message(`Champs destinataire obligatoires manquants : ${missing.join(', ')}`, 'error');
      return;
    }
    if (packages.some((p) => !p.weight || Number(p.weight) <= 0)) {
      out.innerHTML = message('Chaque colis doit avoir un poids supérieur à 0.', 'error');
      return;
    }

    setBusy(btn, true, "Créer l'expédition");
    out.innerHTML = '';

    try {
      const data = await api.createShipment({
        shipTo: {
          name: to.name,
          attentionName: to.attentionName,
          phone: to.phone,
          addressLine1: to.addressLine1,
          city: to.city,
          state: to.state,
          postalCode: to.postalCode,
          country: to.country || 'FR',
        },
        packages,
        serviceCode: opts.serviceCode,
        description: opts.description,
        labelFormat: opts.labelFormat,
        accessPointLocationId: opts.accessPointLocationId || undefined,
      });

      out.innerHTML = renderResult(data);
      attachHandlers(out, data);
    } catch (err) {
      out.innerHTML = message(err.message, 'error');
    } finally {
      setBusy(btn, false, "Créer l'expédition");
    }
  });
}

function renderResult(data) {
  const packages = data.packages
    .map((p, i) => {
      const preview =
        p.label && p.label.mime.startsWith('image/')
          ? `<img class="label-preview" src="data:${esc(p.label.mime)};base64,${esc(p.label.base64)}" alt="Étiquette" />`
          : '';

      return `
        <div class="result-item">
          <div class="result-row">
            <h3>Colis ${i + 1} — ${esc(p.trackingNumber)}</h3>
            ${p.label ? `<button class="secondary" data-download="${i}">Télécharger l'étiquette</button>` : ''}
          </div>
          ${preview}
        </div>`;
    })
    .join('');

  return `
    <div class="card">
      ${message('Expédition créée avec succès.', 'success')}
      <div class="result-row">
        <div>
          <h3 style="margin:0">Expédition ${esc(data.shipmentIdentificationNumber)}</h3>
          ${data.billingWeight ? `<p class="meta">Poids facturé : ${esc(data.billingWeight)}</p>` : ''}
        </div>
        <div class="price">${esc(money(data.totalCharges, data.currency))}</div>
      </div>
      <div class="result-list" style="margin-top:14px">${packages}</div>
      <div class="actions">
        <button class="secondary" id="btn-void">Annuler cette expédition</button>
      </div>
      <div id="void-result"></div>
    </div>`;
}

function attachHandlers(out, data) {
  out.querySelectorAll('[data-download]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pkg = data.packages[Number(btn.dataset.download)];
      if (!pkg?.label) return;
      downloadBase64(pkg.label.base64, pkg.label.mime, `etiquette-${pkg.trackingNumber}.${pkg.label.ext}`);
    });
  });

  const voidBtn = out.querySelector('#btn-void');
  const voidOut = out.querySelector('#void-result');

  voidBtn?.addEventListener('click', async () => {
    setBusy(voidBtn, true, 'Annuler cette expédition');
    try {
      const result = await api.voidShipment(data.shipmentIdentificationNumber);
      voidOut.innerHTML = message(result.message, result.success ? 'success' : 'error');
    } catch (err) {
      voidOut.innerHTML = message(err.message, 'error');
    } finally {
      setBusy(voidBtn, false, 'Annuler cette expédition');
    }
  });
}
