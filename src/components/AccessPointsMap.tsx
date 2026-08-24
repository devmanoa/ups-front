import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { loadGoogleMaps, isGoogleMapsConfigured } from '../utils/googleMaps';
import type { AccessPointLocation } from '../types/ups';

interface AccessPointsMapProps {
  locations: AccessPointLocation[];
  /** Index survolé/sélectionné dans la liste — met le marqueur en avant. */
  activeIndex: number | null;
  onActivate: (index: number | null) => void;
  /**
   * Point de la recherche, affiché d'une couleur distincte pour se situer
   * par rapport aux points relais. Absent si l'adresse n'a pas pu être
   * localisée.
   */
  origin?: { lat: number; lng: number; label?: string } | null;
}

/** Échappe le HTML : le contenu des infobulles vient de l'API UPS. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Contenu de l'infobulle, calqué sur celle du CRM : photo de la façade,
 * coordonnées, puis onglets Horaires / Services.
 *
 * L'InfoWindow de Google reçoit du HTML brut : les valeurs venant de l'API
 * UPS sont donc toutes échappées, et les onglets basculent par un onclick
 * inline puisqu'aucun React ne vit dans ce fragment.
 */
function infoWindowHtml(loc: AccessPointLocation, index: number): string {
  const uid = `apw-${index}`;
  const address = [...loc.addressLines].filter(Boolean).join(', ');
  const cityLine = [loc.postalCode, loc.city].filter(Boolean).join(' ');

  // Grille structurée en priorité ; texte libre UPS en repli.
  const hoursRows = loc.openingHours.length
    ? loc.openingHours
        .map(
          (h) =>
            `<div style="display:flex;justify-content:space-between;gap:12px">
               <span style="font-weight:600">${esc(h.day)}</span>
               <span${h.closed ? ' style="opacity:.55"' : ''}>${esc(h.hours)}</span>
             </div>`,
        )
        .join('')
    : loc.hoursText.map((line) => `<div>${esc(line)}</div>`).join('');

  const servicesRows = loc.services.length
    ? loc.services.map((s) => `<div>• ${esc(s)}</div>`).join('')
    : '<div style="opacity:.6">Aucun service détaillé.</div>';

  const photo = loc.imageUrl
    ? `<img src="${esc(loc.imageUrl)}" alt="" loading="lazy"
            style="width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:8px" />`
    : '';

  const promos = loc.promotions.length
    ? `<div style="margin-top:6px;background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;
                   padding:4px 8px;font-size:11px;color:#9A3412">
         ${loc.promotions.map((p) => esc(p)).join('<br>')}
       </div>`
    : '';

  const comments = loc.comments
    ? `<div style="margin-top:6px;font-size:11px;color:#5E6A82;font-style:italic">
         ${esc(loc.comments)}
       </div>`
    : '';

  const idLine = loc.publicAccessPointId || loc.locationId;

  return `
    <div style="font-family:'Segoe UI',system-ui,sans-serif;box-sizing:border-box;
                width:288px;max-width:100%;overflow:hidden;padding:2px 2px 4px">
      ${photo}

      <div style="display:flex;align-items:flex-start;gap:7px">
        <span style="display:inline-flex;align-items:center;justify-content:center;flex:none;
                     width:19px;height:19px;border-radius:6px;background:#4F46E5;
                     color:#fff;font-size:11px;font-weight:700;margin-top:1px">${index + 1}</span>
        <div style="min-width:0;flex:1">
          <strong style="font-size:13px;color:#1A1D2B;display:block">
            ${esc(loc.name || 'Point relais')}
          </strong>
          <div style="font-size:12px;color:#5E6A82;margin-top:1px">
            ${esc(address)}${cityLine ? `<br>${esc(cityLine)}` : ''}
          </div>
          ${loc.phone ? `<div style="font-size:12px;color:#5E6A82;margin-top:2px">Tél. ${esc(loc.phone)}</div>` : ''}
        </div>
        ${
          loc.distance
            ? `<span style="flex:none;background:#EEF2FF;color:#4F46E5;border-radius:6px;
                            padding:1px 6px;font-size:11px;font-weight:600;white-space:nowrap">
                 ${esc(String(loc.distance.value))} ${esc(loc.distance.unit)}
               </span>`
            : ''
        }
      </div>

      ${comments}
      ${promos}

      <div style="margin-top:8px;border-top:1px solid #D6DFED;padding-top:6px">
        <div style="display:flex;gap:4px;margin-bottom:5px">
          <button type="button" id="${uid}-tab-h"
                  onclick="document.getElementById('${uid}-h').style.display='block';
                           document.getElementById('${uid}-s').style.display='none';
                           this.style.background='#EEF2FF';this.style.color='#4F46E5';
                           document.getElementById('${uid}-tab-s').style.background='transparent';
                           document.getElementById('${uid}-tab-s').style.color='#5E6A82';"
                  style="flex:1;border:none;border-radius:6px;padding:3px 6px;font-size:11px;
                         font-weight:600;cursor:pointer;background:#EEF2FF;color:#4F46E5;
                         font-family:inherit">Horaires</button>
          <button type="button" id="${uid}-tab-s"
                  onclick="document.getElementById('${uid}-s').style.display='block';
                           document.getElementById('${uid}-h').style.display='none';
                           this.style.background='#EEF2FF';this.style.color='#4F46E5';
                           document.getElementById('${uid}-tab-h').style.background='transparent';
                           document.getElementById('${uid}-tab-h').style.color='#5E6A82';"
                  style="flex:1;border:none;border-radius:6px;padding:3px 6px;font-size:11px;
                         font-weight:600;cursor:pointer;background:transparent;color:#5E6A82;
                         font-family:inherit">Services</button>
        </div>

        <div id="${uid}-h" style="font-size:11px;color:#5E6A82;max-height:104px;overflow-y:auto;overflow-x:hidden;
                    word-break:break-word;line-height:1.45">
          ${hoursRows || '<div style="opacity:.6">Horaires non communiqués.</div>'}
        </div>
        <div id="${uid}-s" style="display:none;font-size:11px;color:#5E6A82;max-height:104px;overflow-y:auto;overflow-x:hidden;
                    word-break:break-word;line-height:1.45">
          ${servicesRows}
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;
                  margin-top:8px;border-top:1px solid #D6DFED;padding-top:6px">
        ${
          idLine
            ? `<span style="font-size:10px;color:#5E6A82">ID
                 <code style="background:#E3EAF5;padding:1px 4px;border-radius:4px">${esc(idLine)}</code>
               </span>`
            : '<span></span>'
        }
        ${
          loc.latitude != null && loc.longitude != null
            ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}"
                  target="_blank" rel="noopener"
                  style="font-size:11px;color:#4F46E5;text-decoration:none;font-weight:600;white-space:nowrap">
                 Itinéraire →
               </a>`
            : ''
        }
      </div>
    </div>`;
}

/** Épingle SVG colorée, numérotée — plus lisible que le marqueur par défaut. */
function pinIcon(index: number, active: boolean): google.maps.Symbol | google.maps.Icon {
  const fill = active ? '#1E2A40' : '#4F46E5';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
      <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25c0-8.3-6.7-15-15-15z" fill="${fill}"/>
      <circle cx="15" cy="15" r="10" fill="#fff"/>
      <text x="15" y="19.5" text-anchor="middle"
            font-family="Segoe UI,sans-serif" font-size="12" font-weight="700" fill="${fill}">${index + 1}</text>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(active ? 36 : 30, active ? 48 : 40),
    anchor: new google.maps.Point(active ? 18 : 15, active ? 48 : 40),
  } as google.maps.Icon;
}

/**
 * Marqueur du point de recherche : un disque, volontairement d'une autre
 * forme et d'une autre couleur que les épingles numérotées, pour qu'on
 * distingue « où je suis » de « où sont les points relais ».
 */
function originIcon(): google.maps.Icon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="11" fill="#DC2626" fill-opacity="0.18"/>
      <circle cx="13" cy="13" r="7" fill="#DC2626" stroke="#fff" stroke-width="2.5"/>
    </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(26, 26),
    anchor: new google.maps.Point(13, 13),
  } as google.maps.Icon;
}

export function AccessPointsMap({
  locations,
  activeIndex,
  onActivate,
  origin,
}: AccessPointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const originRef = useRef<google.maps.Marker | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // onActivate est lu via une ref : les listeners des marqueurs ne sont
  // attachés qu'à la création, ils ne doivent pas figer un callback périmé.
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  // Initialisation unique de la carte.
  useEffect(() => {
    if (!isGoogleMapsConfigured()) {
      setStatus('error');
      return;
    }

    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 46.6, lng: 2.4 }, // centre de la France par défaut
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new google.maps.InfoWindow();
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Recrée les marqueurs à chaque nouveau jeu de résultats.
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Le marqueur d'origine est recréé avec les autres : sa position change
    // à chaque nouvelle recherche.
    originRef.current?.setMap(null);
    originRef.current = null;

    const positioned = locations
      .map((loc, index) => ({ loc, index }))
      .filter((e) => e.loc.latitude != null && e.loc.longitude != null);

    if (positioned.length === 0 && !origin) return;

    const bounds = new google.maps.LatLngBounds();

    if (origin) {
      originRef.current = new google.maps.Marker({
        position: origin,
        map,
        icon: originIcon(),
        title: origin.label || 'Adresse recherchée',
        // Au-dessus des épingles : c'est le repère, il ne doit pas être
        // masqué par un point relais tout proche.
        zIndex: 2000,
      });

      originRef.current.addListener('click', () => {
        infoRef.current?.setContent(
          `<div style="font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;
                       color:#1A1D2B;padding:2px 4px">
             <strong>Adresse recherchée</strong>
             ${origin.label ? `<div style="color:#5E6A82;margin-top:2px">${esc(origin.label)}</div>` : ''}
           </div>`,
        );
        infoRef.current?.open({ map, anchor: originRef.current! });
      });

      // Inclus dans le cadrage : sans cela, une recherche à large rayon
      // pourrait sortir le repère de l'écran.
      bounds.extend(origin);
    }

    positioned.forEach(({ loc, index }) => {
      const position = { lat: loc.latitude!, lng: loc.longitude! };

      const marker = new google.maps.Marker({
        position,
        map,
        icon: pinIcon(index, false),
        title: loc.name || `Point relais ${index + 1}`,
        zIndex: index,
      });

      marker.addListener('click', () => {
        infoRef.current?.setContent(infoWindowHtml(loc, index));
        infoRef.current?.open({ map, anchor: marker });
        onActivateRef.current(index);
      });

      markersRef.current[index] = marker;
      bounds.extend(position);
    });

    // Cadre sur l'ensemble des points ; zoom borné pour un point unique.
    map.fitBounds(bounds, 48);
    const listener = google.maps.event.addListenerOnce(map, 'idle', () => {
      if ((map.getZoom() ?? 0) > 15) map.setZoom(15);
    });

    return () => google.maps.event.removeListener(listener);
  }, [locations, status, origin]);

  // Met en avant le marqueur correspondant à l'élément actif de la liste.
  useEffect(() => {
    if (status !== 'ready') return;

    markersRef.current.forEach((marker, i) => {
      if (!marker) return;
      const active = i === activeIndex;
      marker.setIcon(pinIcon(i, active));
      marker.setZIndex(active ? 1000 : i);
    });

    if (activeIndex != null) {
      const marker = markersRef.current[activeIndex];
      const loc = locations[activeIndex];
      if (marker && loc) {
        infoRef.current?.setContent(infoWindowHtml(loc, activeIndex));
        infoRef.current?.open({ map: mapRef.current!, anchor: marker });
      }
    }
  }, [activeIndex, locations, status]);

  if (status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-[--k-border] bg-[--k-surface]/60 px-4 py-6 text-[13px] text-[--k-muted]">
        <MapPin className="h-4 w-4" />
        Carte indisponible — clé Google Maps absente ou invalide. La liste reste utilisable.
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[--k-border]">
      {/* Hauteur alignée sur celle de la liste voisine, pour un bloc homogène. */}
      <div ref={containerRef} className="h-[420px] w-full bg-[--k-surface-2] xl:h-[600px]" />

      {/* Légende : sans elle, le point rouge se confond avec un marqueur
          d'incident ou un point relais indisponible. */}
      {status === 'ready' && origin && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1.5 text-[12px] font-medium text-[--k-text] shadow-md">
          <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600 ring-1 ring-red-200" />
          Adresse recherchée
        </div>
      )}

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[--k-surface-2] text-[13px] text-[--k-muted]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la carte…
        </div>
      )}
    </div>
  );
}
