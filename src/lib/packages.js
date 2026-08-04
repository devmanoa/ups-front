import { esc } from './ui.js';

/**
 * Éditeur de colis réutilisé par les pages Tarifs et Étiquettes.
 * Gère l'ajout/suppression de lignes et la lecture des valeurs.
 */
export function packagesEditor(container, { withReference = false } = {}) {
  let count = 0;

  function addRow(values = {}) {
    count += 1;
    const idx = count;
    const row = document.createElement('div');
    row.className = 'package-row';
    row.dataset.pkgRow = String(idx);
    row.innerHTML = `
      <div class="grid">
        <div class="field">
          <label>Poids (kg) *</label>
          <input type="number" step="0.1" min="0.1" data-pkg="weight" value="${esc(values.weight ?? '1')}" />
        </div>
        <div class="field">
          <label>Longueur (cm)</label>
          <input type="number" min="1" data-pkg="length" value="${esc(values.length ?? '')}" />
        </div>
        <div class="field">
          <label>Largeur (cm)</label>
          <input type="number" min="1" data-pkg="width" value="${esc(values.width ?? '')}" />
        </div>
        <div class="field">
          <label>Hauteur (cm)</label>
          <input type="number" min="1" data-pkg="height" value="${esc(values.height ?? '')}" />
        </div>
        ${
          withReference
            ? `<div class="field">
                 <label>Référence</label>
                 <input type="text" data-pkg="reference" value="${esc(values.reference ?? '')}" />
               </div>`
            : ''
        }
      </div>
      <div class="actions">
        <button type="button" class="secondary" data-remove-pkg>Supprimer ce colis</button>
      </div>`;

    row.querySelector('[data-remove-pkg]').addEventListener('click', () => {
      // On conserve toujours au moins un colis.
      if (container.querySelectorAll('[data-pkg-row]').length > 1) row.remove();
    });

    container.appendChild(row);
  }

  function read() {
    return Array.from(container.querySelectorAll('[data-pkg-row]')).map((row) => {
      const pkg = {};
      row.querySelectorAll('[data-pkg]').forEach((input) => {
        const value = input.value.trim();
        if (value !== '') pkg[input.dataset.pkg] = value;
      });
      return pkg;
    });
  }

  addRow();
  return { addRow, read };
}
