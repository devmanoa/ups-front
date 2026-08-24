export function formatDate(iso: string | null): string {
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

export function money(amount: number, currency: string): string {
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(amount);
}

/**
 * Vrai si l'étiquette peut être imprimée depuis le navigateur.
 *
 * ZPL, EPL et SPL sont des langages de commande destinés aux imprimantes
 * thermiques : les envoyer à une imprimante bureautique produirait des pages
 * de charabia. Ces formats se téléchargent, puis s'envoient tels quels à
 * l'imprimante d'étiquettes.
 */
export function isPrintable(mime: string): boolean {
  return mime.startsWith('image/') || mime === 'application/pdf';
}

/**
 * Ouvre la boîte de dialogue d'impression pour une étiquette reçue en base64,
 * comme le fait le site UPS.
 *
 * L'étiquette est rendue dans une iframe masquée plutôt que dans un onglet :
 * pas de fenêtre surgissante à autoriser, et rien à refermer ensuite.
 * Retourne false si le format n'est pas imprimable.
 */
export function printBase64(base64: string, mime: string): boolean {
  if (!isPrintable(mime)) return false;

  // Une image chargée directement dans l'iframe hérite de la mise en page par
  // défaut du navigateur pour un document image isolé : l'étiquette UPS
  // (GIF ~800×1200) déborde de la A4 et sort une page blanche. On l'enveloppe
  // donc dans un document contrôlé. Le PDF, lui, porte déjà sa pagination.
  if (mime.startsWith('image/')) {
    return printImages([{ base64, mime }]) > 0;
  }

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));

  const frame = createPrintFrame();

  /** Libère l'iframe et l'URL une fois la boîte de dialogue refermée. */
  const cleanup = () => {
    // Retarde le retrait : Safari annule l'impression si l'iframe disparaît
    // pendant que la boîte de dialogue est encore ouverte.
    window.setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  };

  frame.onload = () => {
    try {
      const view = frame.contentWindow;
      if (!view) throw new Error('iframe inaccessible');

      view.focus();
      view.print();
      // print() est bloquant sur la plupart des navigateurs, mais pas tous :
      // on nettoie aussi via l'événement afterprint quand il est disponible.
      view.addEventListener?.('afterprint', cleanup, { once: true });
      cleanup();
    } catch {
      // Impression refusée (navigateur restrictif) : l'étiquette reste
      // téléchargeable, on n'interrompt pas l'utilisateur.
      frame.remove();
      URL.revokeObjectURL(url);
    }
  };

  frame.src = url;
  document.body.appendChild(frame);
  return true;
}

/** Iframe hors écran servant de support d'impression. */
function createPrintFrame(): HTMLIFrameElement {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '0';
  frame.style.bottom = '0';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  return frame;
}

/**
 * Imprime plusieurs étiquettes en une seule boîte de dialogue, une par page.
 *
 * Enchaîner printBase64() ouvrirait autant de dialogues qu'il y a
 * d'étiquettes : sur un envoi groupé de vingt colis, c'est inutilisable.
 * Retourne le nombre d'étiquettes imprimables retenues.
 */
export function printImages(labels: Array<{ base64: string; mime: string }>): number {
  const printable = labels.filter((l) => l.mime.startsWith('image/'));
  if (printable.length === 0) return 0;

  const frame = createPrintFrame();
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return 0;
  }

  const images = printable
    .map((l) => `<img src="data:${l.mime};base64,${l.base64}" alt="">`)
    .join('');

  doc.open();
  doc.write(
    `<!doctype html><html><head><meta charset="utf-8"><style>` +
      // Marge nulle : l'étiquette porte déjà la sienne, et le navigateur
      // ajouterait sinon ses en-têtes et pieds de page sur l'étiquette.
      `@page{margin:0}` +
      `body{margin:0}` +
      // `height:auto` avec `max-height` borne la page dans les deux sens :
      // `max-width` seul laisse une étiquette haute déborder et produire une
      // page blanche à la suite.
      `img{display:block;width:auto;height:auto;max-width:100%;max-height:100vh;` +
      // Une étiquette par page : sans le saut, elles s'enchaîneraient.
      `page-break-after:always}` +
      // Sans cette exception, le saut du dernier élément crée une page vide.
      `img:last-child{page-break-after:auto}` +
      `</style></head><body>${images}</body></html>`,
  );
  doc.close();

  /** Attend le décodage des images : imprimer trop tôt donnerait des cadres vides. */
  const waitForImages = () => {
    const all = Array.from(doc.images);
    return Promise.all(
      all.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
            }),
      ),
    );
  };

  waitForImages().then(() => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Impression refusée : les étiquettes restent téléchargeables.
    }
    window.setTimeout(() => frame.remove(), 60_000);
  });

  return printable.length;
}

/** Télécharge un fichier reçu en base64 (étiquettes UPS). */
export function downloadBase64(base64: string, mime: string, filename: string): void {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Vrai pour un numéro de suivi factice.
 *
 * L'environnement CIE d'UPS renvoie 1ZXXXXXXXXXXXXXXXX, identique pour tous
 * les colis et toutes les expéditions : un tel numéro n'identifie rien.
 */
export function isPlaceholderTracking(trackingNumber: string | null | undefined): boolean {
  return /X{6,}/i.test(String(trackingNumber ?? ''));
}

/**
 * Identifiant à utiliser dans l'URL du détail d'un envoi.
 *
 * Le numéro de suivi quand il est réel — lisible et partageable. Sinon
 * l'identifiant local, seul à désigner un envoi et un seul : en CIE, numéro
 * de suivi comme identifiant UPS sont partagés par toutes les expéditions.
 */
export function shipmentKey(shipment: {
  trackingNumber?: string | null;
  localShipmentId?: string | null;
  shipmentId?: string | null;
}): string {
  const tracking = shipment.trackingNumber;
  if (tracking && !isPlaceholderTracking(tracking)) return tracking;
  return shipment.localShipmentId || shipment.shipmentId || tracking || '';
}
