import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Package, Search, Plus, X, Check } from 'lucide-react';
import { api } from '../../services/api';
import { Alert } from './Alert';
import { Field } from './Field';
import Button from './Button';
import { cn } from './cn';
import { formatDate } from '../../utils/format';

interface TrackingNumberPickerProps {
  value: string[];
  onChange: (trackingNumbers: string[]) => void;
  /** Limite imposée par la spec UPS (TrackingData : 30 entrées). */
  max?: number;
}

/**
 * Rattache des numéros de suivi à un enlèvement, à la main ou en cherchant
 * dans les étiquettes déjà créées.
 *
 * La recherche s'appuie sur l'historique local des envois : UPS ne permet pas
 * de relire les expéditions créées. Sans base de données, seule la saisie
 * manuelle reste disponible — et elle suffit.
 */
export function TrackingNumberPicker({ value, onChange, max = 30 }: TrackingNumberPickerProps) {
  const [manual, setManual] = useState('');
  const [search, setSearch] = useState('');
  const [browsing, setBrowsing] = useState(false);

  const shipments = useQuery({
    queryKey: ['shipments', 'picker', search],
    queryFn: () => api.listShipments({ search: search || undefined, limit: 20 }),
    enabled: browsing,
    retry: false,
  });

  const full = value.length >= max;

  const add = (raw: string) => {
    const trackingNumber = raw.trim().toUpperCase();
    if (!trackingNumber || full) return;
    // Un même colis ne doit pas être rattaché deux fois.
    if (value.includes(trackingNumber)) return;
    onChange([...value, trackingNumber]);
  };

  const remove = (trackingNumber: string) =>
    onChange(value.filter((n) => n !== trackingNumber));

  const addManual = () => {
    add(manual);
    setManual('');
  };

  // Le format UPS courant fait 18 caractères (1Z…), mais d'autres existent :
  // on avertit sans bloquer.
  const suspicious = manual.trim().length > 0 && manual.trim().length !== 18;

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((trackingNumber) => (
            <li
              key={trackingNumber}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[--k-primary-2] px-2 py-1 text-[12px] font-medium text-indigo-800"
            >
              <span className="font-mono">{trackingNumber}</span>
              <button
                type="button"
                onClick={() => remove(trackingNumber)}
                title="Retirer ce colis"
                className="hover:text-indigo-950"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field
            label="Numéro de suivi"
            placeholder="1Z12345E1512345676"
            value={manual}
            maxLength={18}
            onChange={(e) => setManual(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Sans cela, Entrée soumettrait le formulaire d'enlèvement.
                e.preventDefault();
                addManual();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          disabled={!manual.trim() || full}
          onClick={addManual}
        >
          <Plus className="h-4 w-4" />
          Ajouter
        </Button>
      </div>

      {suspicious && (
        <p className="text-[12px] text-[--k-muted]">
          Un numéro UPS compte généralement 18 caractères ({manual.trim().length} saisis).
        </p>
      )}

      {full && (
        <Alert type="info">
          {max} colis maximum par enlèvement — c’est la limite de l’API UPS. Planifiez un second
          enlèvement pour les suivants.
        </Alert>
      )}

      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setBrowsing((v) => !v)}
        >
          <Search className="h-4 w-4" />
          {browsing ? 'Masquer les étiquettes créées' : 'Chercher dans les étiquettes créées'}
        </Button>
      </div>

      {browsing && (
        <div className="rounded-xl border border-[--k-border] bg-[--k-surface-2] p-3">
          <Field
            label="Recherche"
            placeholder="Destinataire, ville, référence, numéro…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {shipments.isError ? (
            // Sans base, l'historique est indisponible : la saisie manuelle
            // reste le chemin normal, on ne bloque rien.
            <p className="mt-3 text-[12px] text-[--k-muted]">
              Historique indisponible — saisissez les numéros à la main.
            </p>
          ) : shipments.isLoading ? (
            <p className="mt-3 text-[12px] text-[--k-muted]">Chargement…</p>
          ) : (shipments.data?.shipments.length ?? 0) === 0 ? (
            <p className="mt-3 text-[12px] text-[--k-muted]">
              {search ? 'Aucun envoi ne correspond.' : 'Aucun envoi enregistré.'}
            </p>
          ) : (
            <ul className="mt-3 max-h-64 divide-y divide-[--k-border] overflow-y-auto">
              {shipments.data!.shipments
                .filter((s) => s.trackingNumber)
                .map((shipment) => {
                  const picked = value.includes(shipment.trackingNumber!);

                  return (
                    <li key={shipment.trackingNumber}>
                      <button
                        type="button"
                        disabled={full && !picked}
                        onClick={() =>
                          picked ? remove(shipment.trackingNumber!) : add(shipment.trackingNumber!)
                        }
                        className={cn(
                          'flex w-full items-center gap-2 py-2 text-left transition',
                          'hover:bg-[--k-surface] disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-mono text-[12px] font-medium text-[--k-text]">
                            {shipment.trackingNumber}
                          </span>
                          {/* Destinataire et date : de quoi ne pas se tromper
                              entre deux envois au même numéro proche. */}
                          <span className="block truncate text-[12px] text-[--k-muted]">
                            {[shipment.recipient?.name, shipment.recipient?.city]
                              .filter(Boolean)
                              .join(', ')}
                            {' — '}
                            {formatDate(shipment.createdAt)}
                          </span>
                        </span>
                        {picked && <Check className="h-4 w-4 shrink-0 text-[--k-primary]" />}
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}

      {value.length === 0 && (
        <p className="inline-flex items-start gap-1.5 text-[12px] text-[--k-muted]">
          <Package className="mt-[2px] h-3.5 w-3.5 shrink-0" />
          Facultatif, mais recommandé : sans numéro, l’enlèvement n’est rattaché à aucun colis.
        </p>
      )}
    </div>
  );
}
