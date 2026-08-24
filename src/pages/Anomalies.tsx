import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  PauseCircle,
  PackageX,
  ExternalLink,
  FileText,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import type { AnomalyType, StoredShipment } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { EmptyState } from '../components/ui/EmptyState';
import Button from '../components/ui/Button';
import { ButtonLink } from '../components/ui/ButtonLink';
import { formatDate, shipmentKey } from '../utils/format';

const META: Record<
  AnomalyType,
  { label: string; icon: LucideIcon; color: string; bg: string; border: string }
> = {
  exception: {
    label: 'Incidents UPS',
    icon: AlertTriangle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  delayed: {
    label: 'En retard',
    icon: Clock,
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  stalled: {
    label: 'Sans mouvement',
    icon: PauseCircle,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  never_picked_up: {
    label: 'Jamais pris en charge',
    icon: PackageX,
    color: 'text-slate-700',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
  },
};

export default function Anomalies() {
  const [filter, setFilter] = useState<AnomalyType | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['anomalies', filter],
    queryFn: () => api.getAnomalies(filter ?? undefined),
    refetchInterval: 120_000,
  });

  return (
    <div>
      <PageHeader
        title="Anomalies"
        subtitle="Envois nécessitant votre attention : retards, incidents et colis immobiles."
      />

      {isError ? (
        <Alert type="error">{error.message}</Alert>
      ) : isLoading ? (
        <Card>
          <span className="inline-flex items-center gap-2 text-[13px] text-[--k-muted]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyse des envois en cours…
          </span>
        </Card>
      ) : !data ? null : (
        <>
          {/* Compteurs cliquables : chacun filtre la liste. */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(META) as AnomalyType[]).map((type) => {
              const meta = META[type];
              const Icon = meta.icon;
              const count = data.summary.counts[type] ?? 0;
              const active = filter === type;

              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilter(active ? null : type)}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition ${
                    active
                      ? `${meta.border} ${meta.bg} ring-2 ring-[--k-primary]/20`
                      : 'border-[--k-border] bg-[--k-surface] hover:border-[--k-primary]/30'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}
                  >
                    <Icon className={`h-[18px] w-[18px] ${meta.color}`} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[18px] font-bold text-[--k-text]">{count}</div>
                    <div className="text-[12px] text-[--k-muted]">{meta.label}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-[--k-muted]">
              {data.summary.affected} envoi(s) concerné(s) sur {data.summary.total} en cours
              {filter && ` — filtré sur « ${META[filter].label} »`}
            </p>
            {filter && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setFilter(null)}>
                Retirer le filtre
              </Button>
            )}
          </div>

          {data.shipments.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={filter ? 'Aucun envoi dans cette catégorie' : 'Aucune anomalie détectée'}
              description={
                filter
                  ? 'Aucun envoi ne correspond à ce type d’anomalie actuellement.'
                  : 'Tous vos envois en cours suivent leur acheminement normalement.'
              }
            />
          ) : (
            <div className="space-y-2">
              {data.shipments.map((s) => (
                <AnomalyRow key={s.id} shipment={s} />
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] text-[--k-muted]">
            Seuils : sans mouvement après {data.thresholds.stalledDays} j · non pris en charge
            après {data.thresholds.neverPickedUpDays} j · durée inhabituelle après{' '}
            {data.thresholds.fallbackDelayDays} j (quand UPS ne fournit pas de date prévue).
          </p>
        </>
      )}
    </div>
  );
}

function AnomalyRow({ shipment }: { shipment: StoredShipment }) {
  const primary = shipment.primaryAnomaly;
  const meta = primary ? META[primary.type] : null;
  const Icon = meta?.icon ?? AlertTriangle;

  const address = [shipment.recipient.postalCode, shipment.recipient.city]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`rounded-xl border bg-[--k-surface] p-3 ${meta?.border ?? 'border-[--k-border]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${meta?.bg ?? 'bg-[--k-surface-2]'}`}
          >
            <Icon className={`h-4 w-4 ${meta?.color ?? 'text-[--k-muted]'}`} />
          </span>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {shipment.trackingNumber ? (
                <Link
                  to={`/shipments/${encodeURIComponent(shipmentKey(shipment))}`}
                  className="font-mono text-[13px] font-medium text-[--k-text] hover:text-[--k-primary] hover:underline"
                >
                  {shipment.trackingNumber}
                </Link>
              ) : (
                <span className="font-mono text-[13px] font-medium text-[--k-text]">
                  {shipment.shipmentId}
                </span>
              )}
              {/* Un envoi peut cumuler plusieurs anomalies. */}
              {(shipment.anomalies ?? []).map((a) => (
                <span
                  key={a.type}
                  className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${META[a.type].bg} ${META[a.type].color}`}
                >
                  {a.label}
                </span>
              ))}
            </div>

            <p className="mt-1 text-[13px] text-[--k-text]">
              {shipment.recipient.name || 'Destinataire inconnu'}
              {address && <span className="text-[--k-muted]"> — {address}</span>}
            </p>

            <ul className="mt-1 space-y-0.5">
              {(shipment.anomalies ?? []).map((a) => (
                <li key={a.type} className="text-[12px] text-[--k-muted]">
                  {a.detail}
                </li>
              ))}
            </ul>

            <p className="mt-1 text-[11px] text-[--k-muted]">
              Créé le {formatDate(shipment.createdAt)}
              {shipment.expectedDelivery && ` · livraison prévue le ${shipment.expectedDelivery}`}
            </p>
          </div>
        </div>

        {shipment.trackingNumber && (
          <>
            <ButtonLink
              to={`/shipments/${encodeURIComponent(shipmentKey(shipment))}`}
              variant="secondary"
              title="Détail, journal et commentaires"
            >
              <FileText className="h-3.5 w-3.5" />
              Détail
            </ButtonLink>
            <ButtonLink
              to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}
              variant="secondary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Suivi
            </ButtonLink>
          </>
        )}
      </div>
    </div>
  );
}
