/** Échappe le HTML — toutes les données affichées viennent de l'API UPS. */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function field(label, name, { type = 'text', value = '', placeholder = '', required = false } = {}) {
  return `
    <div class="field">
      <label for="${esc(name)}">${esc(label)}${required ? ' *' : ''}</label>
      <input id="${esc(name)}" name="${esc(name)}" type="${esc(type)}"
             value="${esc(value)}" placeholder="${esc(placeholder)}" />
    </div>`;
}

export function select(label, name, options, selected = '') {
  const opts = options
    .map((o) => `<option value="${esc(o.value)}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`)
    .join('');
  return `
    <div class="field">
      <label for="${esc(name)}">${esc(label)}</label>
      <select id="${esc(name)}" name="${esc(name)}">${opts}</select>
    </div>`;
}

export function message(text, type = 'info') {
  return `<div class="message ${type}">${esc(text)}</div>`;
}

export function setBusy(button, busy, idleLabel) {
  button.disabled = busy;
  button.innerHTML = busy ? '<span class="spinner"></span> Chargement…' : esc(idleLabel);
}

/** Lit les champs d'un formulaire sous forme d'objet plat. */
export function readForm(root) {
  const data = {};
  root.querySelectorAll('input, select').forEach((el) => {
    if (el.name) data[el.name] = el.value.trim();
  });
  return data;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function money(amount, currency) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: currency || 'EUR' }).format(n);
}

/** Télécharge un fichier reçu en base64 (étiquettes UPS). */
export function downloadBase64(base64, mime, filename) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
