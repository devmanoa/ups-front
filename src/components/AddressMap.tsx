import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Loader2 } from 'lucide-react';
import { loadGoogleMaps, isGoogleMapsConfigured, geocodeAddress } from '../utils/googleMaps';
import { api } from '../services/api';
import type { AccessPointLocation } from '../types/ups';

interface AddressMapProps {
  addressLine1?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  /** Texte de l'infobulle : le nom du destinataire, typiquement. */
  label?: string | null;
  /** Hauteur CSS de la carte. */
  height?: string;
  /** Affiche les points relais UPS les plus proches de l'adresse. */
  showAccessPoints?: boolean;
}

/**
 * Marqueur du destinataire : goutte rouge.
 *
 * Rouge et non indigo pour trancher avec les points relais, et forme
 * différente de leur pastille : la distinction tient sans la couleur, donc
 * en niveaux de gris ou pour un daltonien.
 */
function recipientIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
      <path d="M17 41C17 41 32 25.5 32 16A15 15 0 1 0 2 16c0 9.5 15 25 15 25z"
            fill="#DC2626" stroke="#fff" stroke-width="2.5"/>
      <circle cx="17" cy="16" r="5.5" fill="#fff"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(34, 42),
    anchor: new google.maps.Point(17, 41),
  } as google.maps.Icon;
}

/** Point relais : pastille numérotée, plus discrète que le destinataire. */
function accessPointIcon(index: number): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="11" fill="#4F46E5" stroke="#fff" stroke-width="2"/>
      <text x="13" y="17.5" text-anchor="middle"
            font-family="system-ui, sans-serif" font-size="12" font-weight="700"
            fill="#fff">${index + 1}</text>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(26, 26),
    anchor: new google.maps.Point(13, 13),
  } as google.maps.Icon;
}

/** Échappe le HTML : ces valeurs viennent d'une saisie libre et de l'API UPS. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function accessPointHtml(loc: AccessPointLocation, index: number): string {
  const address = loc.addressLines.filter(Boolean).join(', ');
  const cityLine = [loc.postalCode, loc.city].filter(Boolean).join(' ');
  const distance = loc.distance
    ? `<div style="margin-top:4px;opacity:.7">À ${loc.distance.value} ${esc(loc.distance.unit)}</div>`
    : '';

  return `<div style="font-size:13px;max-width:220px">
    <div style="font-weight:600">${index + 1}. ${esc(loc.name)}</div>
    <div style="margin-top:2px">${esc(address)}</div>
    <div>${esc(cityLine)}</div>
    ${distance}
  </div>`;
}

/**
 * Situe une adresse sur une carte, avec en option les points relais proches.
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
  showAccessPoints = false,
}: AddressMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [points, setPoints] = useState<AccessPointLocation[]>([]);

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
    setPoints([]);

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

      // Les points relais sont demandés en parallèle du rendu : leur échec
      // (quota, API non souscrite) ne doit pas empêcher d'afficher la carte.
      //
      // Le résultat passe par le cache de react-query : la recherche appelle
      // l'API UPS, et revenir sur la page ne doit pas la rappeler. La clé est
      // l'adresse, qui ne change pas pour un envoi donné.
      const relaysPromise = showAccessPoints
        ? queryClient
            .fetchQuery({
              queryKey: ['access-points-near', key],
              queryFn: () =>
                api.findAccessPoints({
                  address: {
                    addressLine1: addressLine1 ?? '',
                    city: city ?? '',
                    postalCode: postalCode ?? '',
                    country: country ?? 'FR',
                  },
                  radius: 25,
                  maxResults: 10,
                }),
              staleTime: 1000 * 60 * 60,
            })
            .then((r) => r.locations ?? [])
            .catch(() => [])
        : Promise.resolve([]);

      try {
        await loadGoogleMaps();
        if (cancelled) return;
        setStatus('ready');

        // `containerRef` n'est monté qu'une fois `status` passé à 'ready' :
        // on attend la peinture avant de créer la carte.
        requestAnimationFrame(async () => {
          if (cancelled || !containerRef.current) return;

          const map = new google.maps.Map(containerRef.current, {
            center: point,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          mapRef.current = map;

          const info = new google.maps.InfoWindow();

          const recipient = new google.maps.Marker({
            map,
            position: point,
            icon: recipientIcon(),
            title: label ?? undefined,
            // Au-dessus des points relais : c'est le repère principal.
            zIndex: 2000,
          });
          markersRef.current.push(recipient);

          if (label) {
            recipient.addListener('click', () => {
              info.setContent(
                `<div style="font-size:13px;font-weight:600;padding:2px 4px">${esc(label)}</div>`,
              );
              info.open(map, recipient);
            });
          }

          const relays = await relaysPromise;
          if (cancelled) return;

          const located = relays.filter((l) => l.latitude != null && l.longitude != null);
          setPoints(located);

          if (located.length === 0) return;

          const bounds = new google.maps.LatLngBounds();
          bounds.extend(point);

          located.forEach((loc, i) => {
            const position = { lat: loc.latitude!, lng: loc.longitude! };
            const marker = new google.maps.Marker({
              map,
              position,
              icon: accessPointIcon(i),
              title: loc.name,
            });
            marker.addListener('click', () => {
              info.setContent(accessPointHtml(loc, i));
              info.open(map, marker);
            });
            markersRef.current.push(marker);
            bounds.extend(position);
          });

          map.fitBounds(bounds, 40);
        });
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
    // `label` est délibérément absent : il n'affecte que l'infobulle, et le
    // renommer ne justifie pas un nouvel appel au géocodeur (facturé).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, showAccessPoints]);

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
    <div>
      <div
        className="relative overflow-hidden rounded-xl border border-[--k-border]"
        style={{ height }}
      >
        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[--k-surface-2]">
            <Loader2 className="h-5 w-5 animate-spin text-[--k-muted]" />
          </div>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {status === 'ready' && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[--k-muted]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
            Destinataire
          </span>
          {showAccessPoints && (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" />
              {points.length > 0
                ? `${points.length} point${points.length > 1 ? 's' : ''} relais à proximité`
                : 'Aucun point relais trouvé dans un rayon de 25 km'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
