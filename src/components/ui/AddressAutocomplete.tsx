import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { loadGoogleMaps, parsePlace, isGoogleMapsConfigured, type ParsedAddress } from '../../utils/googleMaps';

interface AddressAutocompleteProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Appelé quand l'utilisateur choisit une suggestion : remplit les autres champs. */
  onSelect: (parsed: ParsedAddress) => void;
  placeholder?: string;
  required?: boolean;
  /** Restreint les suggestions à ces pays (codes ISO 2). */
  countries?: string[];
}

/**
 * Champ d'adresse avec suggestions Google Places.
 *
 * Sans clé API configurée, se comporte comme un champ texte ordinaire :
 * la saisie manuelle reste toujours possible.
 */
export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  placeholder,
  required,
  countries,
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // onSelect est stocké dans une ref : le listener Google est attaché une
  // seule fois, il ne doit pas capturer une version périmée du callback.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    if (!isGoogleMapsConfigured()) return;

    let autocomplete: google.maps.places.Autocomplete | undefined;
    let cancelled = false;

    setStatus('loading');

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !inputRef.current) return;

        autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          fields: ['address_components', 'geometry', 'formatted_address'],
          types: ['address'],
          ...(countries?.length ? { componentRestrictions: { country: countries } } : {}),
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete!.getPlace();
          if (!place.address_components) return;
          onSelectRef.current(parsePlace(place));
        });

        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
      if (autocomplete) google.maps.event.clearInstanceListeners(autocomplete);
    };
    // countries est un tableau littéral : on le sérialise pour éviter de
    // recréer l'autocomplete à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countries?.join(',')]);

  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-[--k-muted]">
        {label}
        {required && <span className="text-[--k-danger]">*</span>}
        {status === 'loading' && <Loader2 className="h-3 w-3 animate-spin" />}
        {status === 'ready' && <MapPin className="h-3 w-3 text-[--k-primary]" />}
      </span>
      <input
        ref={inputRef}
        className="input-field"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        // Google Places remplace la liste native du navigateur.
        autoComplete="off"
      />
      {status === 'error' && (
        <span className="text-[11px] text-[--k-warning]">
          Suggestions indisponibles — saisie manuelle possible.
        </span>
      )}
    </label>
  );
}
