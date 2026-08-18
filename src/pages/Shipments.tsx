import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  RefreshCw,
  RadioTower,
  Download,
  XCircle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Clock,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, type ShipmentsQuery } from '../services/api';
import type { ShipmentStatus, StoredShipment } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Field';
import Button from '../components/ui/Button';
import { money, downloadBase64, formatDate } from '../utils/format';

const PAGE_SIZE = 25;

const STATUS_META: Record<
  ShipmentStatus,
  { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'danger'; icon: typeof Truck }
> = {
  created: { label: 'Créé', tone: 'neutral', icon: Clock },
  in_transit: { label: 'En transit', tone: 'primary', icon: Truck },
  delivered: { label: 'Livré', tone: 'success', icon: CheckCircle2 },
  exception: { label: 'Incident', tone: 'warning', icon: AlertTriangle },
  voided: { label: 'Annulé', tone: 'danger', icon: Ban },
};

/**
 * Traduit les codes d'erreur QuantumView en action concrète.
 *
 * Deux échecs distincts se ressemblent à l'usage : l'API non souscrite
 * (250002) et les abonnements Quantum View inactifs (330052). Le second se
 * règle sur ups.com, pas sur developer.ups.com — d'où cette distinction.
 */
function syncHint(message: string): string {
  if (message.includes('250002')) {
    return "L'API QuantumView n'est pas souscrite par votre application UPS. Ajoutez-la depuis developer.ups.com (Edit App), puis redémarrez le backend.";
  }
  if (message.includes('330052')) {
    return "Votre compte a bien QuantumView, mais le service Quantum View Data (QVD) n'est pas activé — c'est lui qui produit les fichiers lus par cette API, distinct de Quantum View Manage consulté sur ups.com. Demandez son activation à votre contact UPS, puis comptez jusqu'à 24 h avant le premier fichier.";
  }
  return 'La synchronisation nécessite un abonnement Quantum View actif sur votre compte UPS.';
}

export default function Shipments() {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);

  const params: ShipmentsQuery = {
    search: search.trim() || undefined,
    status,
    from: from || undefined,
    to: to || undefined,
    limit: PAGE_SIZE,
    offset,
  };

  const list = useQuery({
    queryKey: ['shipments', params],
    queryFn: () => api.listShipments(params),
  });

  const refresh = useMutation({
    mutationFn: (trackingNumbers: string[]) => api.refreshShipmentStatus(trackingNumbers),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });

  const voidShipment = useMutation({
    mutationFn: (shipmentId: string) => api.voidShipment(shipmentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });

  // Synchronisation globale via QuantumView : un seul appel UPS couvre tous
  // les colis récents, sans dépendre de la page affichée.
  const sync = useMutation({
    mutationFn: () => api.syncShipments(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['shipments'] }),
  });

  /** Filtre appliqué : réinitialise la pagination pour éviter une page vide. */
  const applyFilter = (fn: () => void) => {
    fn();
    setOffset(0);
  };

  const shipments = list.data?.shipments ?? [];
  const total = list.data?.total ?? 0;

  // On n'interroge UPS que pour les envois dont le statut peut encore bouger.
  const refreshable = shipments
    .filter((s) => s.trackingNumber && s.status !== 'delivered' && s.status !== 'voided')
    .map((s) => s.trackingNumber!)
    .slice(0, 50);

  return (
    <div>
      <PageHeader
        title="Envois en cours"
        subtitle="Historique de vos expéditions et suivi de leur acheminement."
        action={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={sync.isPending}
              onClick={() => sync.mutate()}
              title="Un seul appel UPS pour tous les colis récents (QuantumView)"
            >
              {!sync.isPending && <RadioTower className="h-4 w-4" />}
              Synchroniser
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              isLoading={refresh.isPending}
              disabled={refreshable.length === 0}
              onClick={() => refresh.mutate(refreshable)}
              title="Interroge le suivi colis par colis, pour la page affichée"
            >
              {!refresh.isPending && <RefreshCw className="h-4 w-4" />}
              Actualiser la page
            </Button>
            <Link to="/shipping">
              <Button type="button" size="sm">
                Nouvel envoi
              </Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Field
              label="Recherche"
              placeholder="Numéro de suivi, destinataire, ville, référence…"
              value={search}
              onChange={(e) => applyFilter(() => setSearch(e.target.value))}
            />
          </div>
          <SelectField
            label="Statut"
            value={status}
            onChange={(e) => applyFilter(() => setStatus(e.target.value))}
          >
            <option value="all">Tous</option>
            {Object.entries(STATUS_META).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </SelectField>
          <div className="grid grid-cols-2 gap-2">
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

      {refresh.isSuccess && (
        <Alert
          type={refresh.data.results.some((r) => !r.ok) ? 'error' : 'info'}
          className="mb-4"
        >
          {refresh.data.results.filter((r) => r.ok).length} statut(s) mis à jour
          {refresh.data.results.some((r) => !r.ok) &&
            ` — ${refresh.data.results.filter((r) => !r.ok).length} en échec`}
          {/* Sans le détail, impossible de distinguer un numéro erroné
              d'une panne UPS transitoire, ni de savoir quels envois ne
              se mettent plus à jour. */}
          {refresh.data.results.some((r) => !r.ok) && (
            <ul className="mt-1.5 space-y-0.5 text-[12px] opacity-90">
              {refresh.data.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.trackingNumber}>
                    <code className="rounded bg-black/5 px-1">{r.trackingNumber}</code>{' '}
                    — {r.error || 'erreur inconnue'}
                  </li>
                ))}
            </ul>
          )}
        </Alert>
      )}

      {sync.isError && (
        <Alert type="error" className="mb-4">
          {sync.error.message}
          <span className="mt-1 block text-[12px] opacity-80">
            {syncHint(sync.error.message)} Le bouton « Actualiser la page » reste utilisable.
          </span>
        </Alert>
      )}

      {sync.isSuccess && (
        <Alert type={sync.data.updated > 0 ? 'success' : 'info'} className="mb-4">
          {sync.data.eventsRead} événement(s) reçu(s) — {sync.data.updated} envoi(s) mis à jour
          {sync.data.ignored > 0 && `, ${sync.data.ignored} hors historique`}
          {sync.data.hasMore && ' (données supplémentaires disponibles)'}
        </Alert>
      )}

      {voidShipment.isError && (
        <Alert type="error" className="mb-4">
          {voidShipment.error.message}
        </Alert>
      )}

      {list.isError ? (
        <Alert type="error">{list.error.message}</Alert>
      ) : list.isLoading ? (
        <Card>
          <p className="text-[13px] text-[--k-muted]">Chargement de l'historique…</p>
        </Card>
      ) : shipments.length === 0 ? (
        <EmptyState
          icon={Package}
          title={
            search || status !== 'all' || from || to
              ? 'Aucun envoi ne correspond'
              : 'Aucun envoi enregistré'
          }
          description={
            search || status !== 'all' || from || to
              ? 'Modifiez ou réinitialisez les filtres pour élargir la recherche.'
              : 'Les expéditions créées depuis la page Étiquettes apparaîtront ici.'
          }
        >
          {!search && status === 'all' && !from && !to && (
            <Link to="/shipping">
              <Button type="button" size="sm">
                Créer un envoi
              </Button>
            </Link>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="space-y-2">
            {shipments.map((s) => (
              <ShipmentRow
                key={s.id}
                shipment={s}
                onVoid={() => voidShipment.mutate(s.shipmentId)}
                voiding={voidShipment.isPending && voidShipment.variables === s.shipmentId}
              />
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-[12px] text-[--k-muted]">
              {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} sur {total}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface RowProps {
  shipment: StoredShipment;
  onVoid: () => void;
  voiding: boolean;
}

function ShipmentRow({ shipment, onVoid, voiding }: RowProps) {
  const [downloading, setDownloading] = useState(false);
  const meta = STATUS_META[shipment.status] ?? STATUS_META.created;
  const StatusIcon = meta.icon;

  // L'étiquette n'est pas chargée avec la liste : elle pèse lourd en base64.
  const download = async () => {
    if (!shipment.trackingNumber) return;
    setDownloading(true);
    try {
      const label = await api.getShipmentLabel(shipment.trackingNumber);
      const mime = label.format === 'PDF' ? 'application/pdf' : 'image/gif';
      const ext = (label.format || 'gif').toLowerCase();
      downloadBase64(label.base64, mime, `etiquette-${label.trackingNumber}.${ext}`);
    } catch {
      /* l'absence d'étiquette est déjà signalée par le bouton désactivé */
    } finally {
      setDownloading(false);
    }
  };

  const address = [shipment.recipient.postalCode, shipment.recipient.city]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="rounded-xl border border-[--k-border] bg-[--k-surface] p-3 transition hover:border-[--k-primary]/30">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>
              <StatusIcon className="h-3 w-3" />
              {meta.label}
            </Badge>
            <span className="font-mono text-[13px] font-medium text-[--k-text]">
              {shipment.trackingNumber || shipment.shipmentId}
            </span>
            {shipment.primaryAnomaly && (
              <Badge tone="warning">
                <AlertTriangle className="h-3 w-3" />
                {shipment.primaryAnomaly.label}
              </Badge>
            )}
            {shipment.batchId && <Badge tone="neutral">Lot</Badge>}
          </div>

          <p className="mt-1 text-[13px] text-[--k-text]">
            {shipment.recipient.name || 'Destinataire inconnu'}
            {address && <span className="text-[--k-muted]"> — {address}</span>}
            {shipment.recipient.country && (
              <span className="text-[--k-muted]"> ({shipment.recipient.country})</span>
            )}
          </p>

          <p className="mt-0.5 text-[12px] text-[--k-muted]">
            {[
              shipment.serviceName,
              shipment.billingWeight,
              `Créé le ${formatDate(shipment.createdAt)}`,
              shipment.statusDescription,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {shipment.totalCharges != null && (
            <span className="text-[15px] font-bold text-[--k-text]">
              {money(shipment.totalCharges, shipment.currency || 'EUR')}
            </span>
          )}
          <div className="flex flex-wrap justify-end gap-1.5">
            {shipment.trackingNumber && (
              <Link to={`/tracking?number=${encodeURIComponent(shipment.trackingNumber)}`}>
                <Button type="button" variant="ghost" size="sm">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Suivi
                </Button>
              </Link>
            )}
            {shipment.hasLabel && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={downloading}
                onClick={download}
              >
                {!downloading && <Download className="h-3.5 w-3.5" />}
                Étiquette
              </Button>
            )}
            {shipment.status !== 'voided' && shipment.status !== 'delivered' && (
              <Button
                type="button"
                variant="danger"
                size="sm"
                isLoading={voiding}
                onClick={onVoid}
              >
                {!voiding && <XCircle className="h-3.5 w-3.5" />}
                Annuler
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
