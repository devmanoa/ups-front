import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { loadGoogleMaps, isGoogleMapsConfigured } from '../utils/googleMaps';
import type { AccessPointLocation } from '../types/ups';

interface AccessPointsMapProps {
  locations: AccessPointLocation[];
  /** Index survolé/sélectionné dans la liste — met le marqueur en avant. */
  activeIndex: number | null;
  onActivate: (index: number | null) => void;
}

/** Échappe le HTML : le contenu des infobulles vient de l'API UPS. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function infoWindowHtml(loc: AccessPointLocation, index: number): string {
  const address = [...loc.addressLines, loc.postalCode, loc.city].filter(Boolean).join(', ');

  const hours = loc.openingHours.length
    ? `<div style="margin-top:8px;border-top:1px solid #D6DFED;padding-top:6px;
                  display:grid;grid-template-columns:repeat(2,auto);gap:2px 12px;font-size:11px;color:#5E6A82">
         ${loc.openingHours
           .map(
             (h) =>
               `<div><strong>${esc(h.day.slice(0, 3))}</strong> ${esc(h.hours)}</div>`
           )
           .join('')}
       </div>`
    : '';

  const maps =
    loc.latitude != null && loc.longitude != null
      ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}"
            target="_blank" rel="noopener"
            style="display:inline-block;margin-top:8px;font-size:12px;color:#4F46E5;text-decoration:none">
           Itinéraire →
         </a>`
      : '';

  return `
    <div style="font-family:'Segoe UI',system-ui,sans-serif;max-width:260px;padding:2px 4px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
        <span style="display:inline-flex;align-items:center;justify-content:center;
                     width:18px;height:18px;border-radius:6px;background:#4F46E5;
                     color:#fff;font-size:11px;font-weight:700">${index + 1}</span>
        <strong style="font-size:13px;color:#1A1D2B">${esc(loc.name || 'Point relais')}</strong>
      </div>
      <div style="font-size:12px;color:#5E6A82">${esc(address)}</div>
      ${loc.phone ? `<div style="font-size:12px;color:#5E6A82;margin-top:2px">${esc(loc.phone)}</div>` : ''}
      ${
        loc.distance
          ? `<div style="margin-top:6px;display:inline-block;background:#EEF2FF;color:#4F46E5;
                        border-radius:6px;padding:1px 6px;font-size:11px;font-weight:600">
               ${esc(String(loc.distance.value))} ${esc(loc.distance.unit)}
             </div>`
          : ''
      }
      ${
        loc.locationId
          ? `<div style="margin-top:6px;font-size:11px;color:#5E6A82">
               ID : <code style="background:#E3EAF5;padding:1px 4px;border-radius:4px">${esc(loc.locationId)}</code>
             </div>`
          : ''
      }
      ${hours}
      ${maps}
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

export function AccessPointsMap({ locations, activeIndex, onActivate }: AccessPointsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
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

    const positioned = locations
      .map((loc, index) => ({ loc, index }))
      .filter((e) => e.loc.latitude != null && e.loc.longitude != null);

    if (positioned.length === 0) return;

    const bounds = new google.maps.LatLngBounds();

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
  }, [locations, status]);

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
      <div ref={containerRef} className="h-[420px] w-full bg-[--k-surface-2] xl:h-[520px]" />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-[--k-surface-2] text-[13px] text-[--k-muted]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la carte…
        </div>
      )}
    </div>
  );
}
