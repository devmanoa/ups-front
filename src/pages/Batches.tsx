import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Package,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Truck,
  Clock,
} from 'lucide-react';
import { api } from '../services/api';
import type { Batch } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Field } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { formatDate, money } from '../utils/format';

const PAGE_SIZE = 50;

/**
 * Commandes = lots d'envoi groupé. Chaque import CSV ou envoi groupé produit
 * un lot, agrégé depuis `batch_id` : aucune table dédiée côté base.
 */
export default function Batches() {
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(0);

  const params = {
    search: search || undefined,
    from: from || undefined,
    to: to || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const batches = useQuery({
    queryKey: ['batches', params],
    queryFn: () => api.listBatches(params),
    retry: false,
  });

  const applyFilter = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const items = batches.data?.batches ?? [];
  const total = batches.data?.total ?? 0;
  const hasFilters = Boolean(search || from || to);

  if (batches.isError) {
    return (
      <div>
        <PageHeader title="Commandes" subtitle="Historique de vos envois groupés." />
        <Alert type="error">{(batches.error as Error).message}</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Commandes"
        subtitle="Chaque envoi groupé forme une commande : son avancement, ses colis, son coût."
        action={
          <Link to="/shipping/bulk">
            <Button type="button" size="sm">
              <Layers className="h-4 w-4" />
              Nouvel envoi groupé
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Field
              label="Recherche"
              placeholder="Identifiant de lot, destinataire, numéro de suivi…"
              value={search}
              onChange={(e) => applyFilter(() => setSearch(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <Field
              label="Du"
              type="date"
              value={from}
              onChange={(e) => applyFilter(() => setFrom(e.target.value))}
            />
            <Field
              label="Au"
              type="date"
              value={to}
              onChange={(e) => applyFilter(() => setTo(e.target.value))}
            />
          </div>
        </div>
      </Card>

      {batches.isLoading ? (
        <Card>
          <p className="text-[13px] text-[--k-muted]">Chargement des commandes…</p>
        </Card>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Layers}
          title={hasFilters ? 'Aucune commande ne correspond' : 'Aucune commande'}
          description={
            hasFilters
              ? 'Modifiez ou réinitialisez les filtres.'
              : 'Les envois groupés apparaîtront ici, avec leur avancement.'
          }
        >
          {!hasFilters && (
            <Link to="/shipping/bulk">
              <Button type="button">Créer un envoi groupé</Button>
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {items.map((batch) => (
            <BatchCard key={batch.batchId} batch={batch} />
          ))}

          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-[--k-muted]">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} sur {total}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                Précédent
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BatchCard({ batch }: { batch: Batch }) {
  return (
    <Link to={`/batches/${encodeURIComponent(batch.batchId)}`} className="block">
      <Card className="transition hover:border-[--k-primary]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-medium text-[--k-text]">
                {batch.batchId}
              </span>
              {batch.completed ? (
                <Badge tone="success">Terminée</Badge>
              ) : (
                <Badge tone="primary">En cours</Badge>
              )}
            </div>
            <p className="mt-0.5 text-[12px] text-[--k-muted]">
              {formatDate(batch.createdAt)} — {batch.shipmentCount} colis
            </p>
          </div>

          {batch.totalCharges != null && (
            <span className="text-[16px] font-bold text-[--k-text]">
              {money(batch.totalCharges, batch.currency || 'EUR')}
            </span>
          )}
        </div>

        <BatchProgress batch={batch} />
      </Card>
    </Link>
  );
}

/** Barre d'avancement : la répartition des statuts se lit d'un coup d'œil. */
function BatchProgress({ batch }: { batch: Batch }) {
  const { counts, shipmentCount } = batch;

  const segments = [
    { key: 'delivered', value: counts.delivered, className: 'bg-green-500', label: 'Livrés' },
    { key: 'in_transit', value: counts.inTransit, className: 'bg-indigo-500', label: 'En transit' },
    { key: 'exception', value: counts.exception, className: 'bg-orange-500', label: 'Incidents' },
    { key: 'created', value: counts.created, className: 'bg-slate-300', label: 'Créés' },
    { key: 'voided', value: counts.voided, className: 'bg-red-400', label: 'Annulés' },
  ].filter((s) => s.value > 0);

  return (
    <div className="mt-3">
      <div className="flex h-1.5 overflow-hidden rounded-full bg-[--k-surface-2]">
        {segments.map((s) => (
          <span
            key={s.key}
            className={s.className}
            style={{ width: `${(s.value / shipmentCount) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[--k-muted]">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${s.className}`} />
            {s.value} {s.label.toLowerCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

const STATUS_META: Record<string, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'; icon: typeof Truck }> = {
  created: { label: 'Créé', tone: 'neutral', icon: Clock },
  in_transit: { label: 'En transit', tone: 'primary', icon: Truck },
  delivered: { label: 'Livré', tone: 'success', icon: CheckCircle2 },
  exception: { label: 'Incident', tone: 'warning', icon: AlertTriangle },
  voided: { label: 'Annulé', tone: 'danger', icon: Ban },
};

/** Détail d'une commande : son récapitulatif et les colis qui la composent. */
export function BatchDetailPage() {
  const { batchId = '' } = useParams();

  const batch = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => api.getBatch(batchId),
    retry: false,
    enabled: Boolean(batchId),
  });

  if (batch.isError) {
    return (
      <div>
        <PageHeader title="Commande" subtitle={batchId} />
        <Alert type="error">{(batch.error as Error).message}</Alert>
        <Link to="/batches" className="mt-3 inline-block">
          <Button type="button" variant="secondary" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Retour aux commandes
          </Button>
        </Link>
      </div>
    );
  }

  if (batch.isLoading || !batch.data) {
    return (
      <div>
        <PageHeader title="Commande" subtitle={batchId} />
        <Card>
          <p className="text-[13px] text-[--k-muted]">Chargement…</p>
        </Card>
      </div>
    );
  }

  const data = batch.data;

  return (
    <div>
      <PageHeader
        title="Commande"
        subtitle={`${data.shipmentCount} colis — créée le ${formatDate(data.createdAt)}`}
        action={
          <Link to="/batches">
            <Button type="button" variant="secondary" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Toutes les commandes
            </Button>
          </Link>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="font-mono text-[13px] font-medium text-[--k-text]">
              {data.batchId}
            </span>
            <div className="mt-1">
              {data.completed ? (
                <Badge tone="success">Terminée</Badge>
              ) : (
                <Badge tone="primary">En cours</Badge>
              )}
            </div>
          </div>
          {data.totalCharges != null && (
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-[--k-muted]">Coût total</p>
              <p className="text-[18px] font-bold text-[--k-text]">
                {money(data.totalCharges, data.currency || 'EUR')}
              </p>
            </div>
          )}
        </div>
        <BatchProgress batch={data} />
      </Card>

      <Card>
        <CardTitle title="Colis" hint={`${data.shipments.length} envoi(s)`} />
        <div className="divide-y divide-[--k-border]">
          {data.shipments.map((shipment) => {
            const meta = STATUS_META[shipment.status] ?? STATUS_META.created;
            const Icon = meta.icon;

            return (
              <div
                key={shipment.trackingNumber || shipment.id}
                className="flex flex-wrap items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] font-medium text-[--k-text]">
                      {shipment.trackingNumber || '—'}
                    </span>
                    <Badge tone={meta.tone}>
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-[--k-muted]">
                    {[shipment.recipient?.name, shipment.recipient?.city]
                      .filter(Boolean)
                      .join(', ') || 'Destinataire inconnu'}
                  </p>
                </div>

                {shipment.totalCharges != null && (
                  <span className="text-[13px] font-medium text-[--k-text]">
                    {money(shipment.totalCharges, shipment.currency || 'EUR')}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <Link to="/shipments" className="mt-3 inline-block">
          <Button type="button" variant="secondary" size="sm">
            <Package className="h-4 w-4" />
            Voir dans les envois
          </Button>
        </Link>
      </Card>
    </div>
  );
}
