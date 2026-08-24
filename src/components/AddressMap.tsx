import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { loadGoogleMaps, isGoogleMapsConfigured, geocodeAddress } from '../utils/googleMaps';

interface AddressMapProps {
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  /** Texte de l'infobulle : le nom du destinataire, typiquement. */
  label?: string | null;
  /** Hauteur CSS de la carte. */
  height?: string;
}

/** Marqueur du destinataire : disque plein, lisible en noir et blanc. */
function pinIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <path d="M17 41C17 41 32 25.5 32 16A15 15 0 1 0 2 16c0 9.5 15 25 15 25z"
            fill="#4F46E5" stroke="#fff" stroke-width="2.5"/>
      <circle cx="17" cy="16" r="5.5" fill="#fff"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(34, 42),
    anchor: new google.maps.Point(17, 41),
  } as google.maps.Icon;
}

/** Échappe le HTML : le nom du destinataire vient d'une saisie libre. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Situe une adresse sur une carte, à partir de ses composants textuels.
 *
 * L'envoi enregistré ne porte pas de coordonnées : elles sont demandées au
 * géocodeur à l'affichage. Une adresse introuvable n'est pas une erreur —
 * le composant l'annonce et disparaît le reste du temps.
 */
export function AddressMap({
  addressLine1,
  city,
  postalCode,
  country,
  label,
  height = '260px',
}: AddressMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  // Les composants d'adresse sont recomposés en chaîne pour servir de
  // dépendance : un objet littéral relancerait l'effet à chaque rendu.
  const key = [addressLine1, postalCode, city, country].filter(Boolean).join('|');

  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setStatus('error');
      return;
    }
    if (!key) {
      setStatus('not-found');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      const point = await geocodeAddress({
        addressLine1: addressLine1 ?? undefined,
        city: city ?? undefined,
        postalCode: postalCode ?? undefined,
        country: country ?? undefined,
      });

      if (cancelled) return;
      if (!point) {
        setStatus('not-found');
        return;
      }

      try {
        await loadGoogleMaps();
        // `containerRef` n'est monté qu'une fois `status` passé à 'ready' :
        // on le règle d'abord, puis on attend la peinture avant de créer la
        // carte, sinon le conteneur n'existe pas encore.
        if (cancelled) return;
        setStatus('ready');

        requestAnimationFrame(() => {
          if (cancelled || !containerRef.current) return;

          mapRef.current = new google.maps.Map(containerRef.current, {
            center: point,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });

          markerRef.current = new google.maps.Marker({
            map: mapRef.current,
            position: point,
            icon: pinIcon(),
            title: label ?? undefined,
          });

          if (label) {
            const info = new google.maps.InfoWindow({
              content: `<div style="font-size:13px;font-weight:600;padding:2px 4px">${esc(label)}</div>`,
            });
            markerRef.current.addListener('click', () => info.open(mapRef.current!, markerRef.current!));
          }
        });
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      markerRef.current?.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
    // `label` est délibérément absent : il n'affecte que l'infobulle, et le
    // renommer ne justifie pas un nouvel appel au géocodeur (facturé).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (status === 'error' || status === 'not-found') {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-dashed border-[--k-border] bg-[--k-surface-2] px-4 text-center"
        style={{ height }}
      >
        <p className="text-[12px] text-[--k-muted]">
          <MapPin className="mr-1 inline h-3.5 w-3.5" />
          {status === 'error'
            ? 'Carte indisponible : clé Google Maps absente.'
            : 'Adresse non localisable sur la carte.'}
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[--k-border]" style={{ height }}>
      {status === 'loading' && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[--k-surface-2]">
          <Loader2 className="h-5 w-5 animate-spin text-[--k-muted]" />
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
