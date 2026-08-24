import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Printer,
  Download,
  ExternalLink,
  Trash2,
  Send,
  History,
  Boxes,
} from 'lucide-react';
import { api } from '../services/api';
import keycloak from '../config/keycloak';
import type { ShipmentStatus, StoredLabel } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { RichTextEditor, sanitizeHtml, isHtmlEmpty } from '../components/ui/RichTextEditor';
import { AddressMap } from '../components/AddressMap';
import { cn } from '../components/ui/cn';
import {
  money,
  formatDate,
  downloadBase64,
  printBase64,
  printImages,
  shipmentKey,
  isPlaceholderTracking,
} from '../utils/format';
import { actionMeta } from '../utils/actionMeta';

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

/** Longueur acceptée par le backend : la même, pour refuser avant l'appel. */
const MAX_BODY = 2000;

export default function ShipmentDetail() {
  const { trackingNumber = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState('');

  const detail = useQuery({
    queryKey: ['shipment-detail', trackingNumber],
    queryFn: () => api.getShipmentDetail(trackingNumber),
    enabled: Boolean(trackingNumber),
    retry: false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['shipment-detail', trackingNumber] });
    // La liste porte le compteur de commentaires : elle est désormais périmée.
    queryClient.invalidateQueries({ queryKey: ['shipments'] });
  };

  const addComment = useMutation({
    mutationFn: (text: string) => api.addShipmentComment(trackingNumber, text),
    onSuccess: () => {
      setBody('');
      invalidate();
    },
  });

  const removeComment = useMutation({
    mutationFn: (id: number) => api.deleteShipmentComment(trackingNumber, id),
    onSuccess: invalidate,
  });

  const label = useMutation({
    mutationFn: async (action: 'print' | 'download') => {
      // Toutes les étiquettes de l'expédition : sur un envoi multi-colis,
      // n'en sortir qu'une laisserait les autres colis sans la leur.
      const { labels } = await api.getShipmentLabels(trackingNumber);
      const mimeOf = (l: StoredLabel) =>
        l.format === 'PDF' ? 'application/pdf' : 'image/gif';

      if (action === 'print') {
        const images = labels
          .filter((l) => mimeOf(l) === 'image/gif')
          .map((l) => ({ base64: l.base64, mime: 'image/gif' }));

        // Une seule boîte de dialogue pour tous les colis, une étiquette par
        // page : enchaîner les impressions en ouvrirait autant qu'il y a de
        // colis.
        if (images.length > 0 && printImages(images) > 0) return;

        // Format thermique (ZPL, EPL) ou PDF : on retombe sur le
        // téléchargement plutôt que de ne rien faire.
        if (labels.length === 1 && printBase64(labels[0].base64, mimeOf(labels[0]))) return;
      }

      for (const l of labels) {
        const ext = (l.format || 'gif').toLowerCase();
        downloadBase64(l.base64, mimeOf(l), `etiquette-${l.trackingNumber}.${ext}`);
      }
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // `isHtmlEmpty` et non `trim()` : un éditeur vidé laisse souvent un
    // `<br>` ou un `<div></div>` derrière lui, qui passerait pour du contenu.
    if (isHtmlEmpty(body) || body.length > MAX_BODY) return;
    addComment.mutate(sanitizeHtml(body));
  };

  if (detail.isLoading) {
    return (
      <div>
        <PageHeader title="Envoi" subtitle={trackingNumber} />
        <Card>
          <p className="text-[13px] text-[--k-muted]">Chargement de l’envoi…</p>
        </Card>
      </div>
    );
  }

  if (detail.isError) {
    return (
      <div>
        <PageHeader title="Envoi" subtitle={trackingNumber} />
        <Alert type="error">{(detail.error as Error).message}</Alert>
        <div className="mt-3">
          <Button type="button" variant="secondary" onClick={() => navigate('/shipments')}>
            <ArrowLeft className="h-4 w-4" />
            Retour aux envois
          </Button>
        </div>
      </div>
    );
  }

  const { shipment, creator, activity, comments, packages } = detail.data!;
  const meta = STATUS_META[shipment.status] ?? STATUS_META.created;
  const StatusIcon = meta.icon;
  // Nombre de colis porteurs d'étiquette : c'est ce que les boutons sortiront.
  const packageCount = packages.filter((p) => p.hasLabel).length || packages.length;
  // `sub` est l'identifiant Keycloak, celui que le backend compare pour
  // autoriser une suppression.
  const myId = keycloak.tokenParsed?.sub ?? null;

  const recipient = [
    shipment.recipient.name,
    shipment.recipient.company,
    shipment.recipient.address,
    [shipment.recipient.postalCode, shipment.recipient.city].filter(Boolean).join(' '),
    shipment.recipient.country,
  ].filter(Boolean);

  return (
    <div>
      <PageHeader
        title={shipment.trackingNumber ?? shipment.shipmentId}
        subtitle="Tout ce qui concerne cet envoi : suivi, actions et commentaires."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate('/shipments')}>
              <ArrowLeft className="h-4 w-4" />
              Retour
            </Button>
            {shipment.hasLabel && (
              <>
                {/* Le compte est affiché dès qu'il y a plus d'un colis : sans
                    lui, rien ne dirait que le bouton sort toutes les
                    étiquettes et non celle du colis affiché. */}
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={label.isPending && label.variables === 'print'}
                  onClick={() => label.mutate('print')}
                  title={
                    packageCount > 1
                      ? `Imprimer les ${packageCount} étiquettes de l’expédition`
                      : 'Imprimer l’étiquette'
                  }
                >
                  <Printer className="h-4 w-4" />
                  {packageCount > 1 ? `Imprimer (${packageCount})` : 'Imprimer'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  isLoading={label.isPending && label.variables === 'download'}
                  onClick={() => label.mutate('download')}
                  title={
                    packageCount > 1
                      ? `Télécharger les ${packageCount} étiquettes`
                      : 'Télécharger l’étiquette'
                  }
                >
                  <Download className="h-4 w-4" />
                  {packageCount > 1 ? `Étiquettes (${packageCount})` : 'Étiquette'}
                </Button>
              </>
            )}
          </div>
        }
      />

      {label.isError && (
        <Alert type="error" className="mb-4">
          {(label.error as Error).message}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={meta.tone}>
                    <StatusIcon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  {shipment.serviceName && <Badge tone="neutral">{shipment.serviceName}</Badge>}
                  {shipment.batchId && (
                    <Link
                      to={`/batches/${encodeURIComponent(shipment.batchId)}`}
                      className="text-[12px] text-[--k-primary] hover:underline"
                    >
                      Voir la commande
                    </Link>
                  )}
                </div>
                {shipment.statusDescription && (
                  <p className="mt-2 text-[13px] text-[--k-text]">{shipment.statusDescription}</p>
                )}
              </div>

              {shipment.totalCharges != null && (
                <span className="text-[18px] font-semibold text-[--k-text]">
                  {money(shipment.totalCharges, shipment.currency ?? 'EUR')}
                </span>
              )}
            </div>

            <dl className="mt-4 grid gap-x-6 gap-y-3 border-t border-[--k-border] pt-4 sm:grid-cols-2">
              <Detail label="Destinataire" value={recipient.join(', ') || '—'} />
              <Detail label="Créé le" value={formatDate(shipment.createdAt)} />
              <div className="min-w-0">
                <dt className="text-[12px] font-medium text-[--k-muted]">Créé par</dt>
                <dd className="mt-1 flex items-center gap-2">
                  <Avatar name={creator?.name} seed={creator?.id} size="sm" />
                  <span className="truncate text-[13px] text-[--k-text]">
                    {creator?.name ?? 'Utilisateur inconnu'}
                  </span>
                </dd>
                {!creator && (
                  <p className="mt-0.5 text-[11px] text-[--k-muted]">
                    L’auteur n’est enregistré que depuis l’activation de Keycloak.
                  </p>
                )}
              </div>
              <Detail label="Poids facturé" value={shipment.billingWeight ?? '—'} />
              {shipment.reference && <Detail label="Référence" value={shipment.reference} />}
              {shipment.description && <Detail label="Description" value={shipment.description} />}
              {shipment.expectedDelivery && (
                <Detail label="Livraison prévue" value={formatDate(shipment.expectedDelivery)} />
              )}
              {shipment.deliveredAt && (
                <Detail label="Livré le" value={formatDate(shipment.deliveredAt)} />
              )}
              {shipment.voidedAt && (
                <Detail label="Annulé le" value={formatDate(shipment.voidedAt)} />
              )}
            </dl>

            {shipment.trackingNumber && (
              <div className="mt-4 border-t border-[--k-border] pt-3">
                <a
                  href={`https://www.ups.com/track?loc=fr_FR&tracknum=${encodeURIComponent(shipment.trackingNumber)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-[--k-primary] hover:underline"
                >
                  <ExternalLink className="h-4 w-4" />
                  Suivre sur ups.com
                </a>
              </div>
            )}
          </Card>

          {packages.length > 0 && (
            <Card>
              <CardTitle
                title="Colis"
                hint={`${packages.length} colis dans l’expédition`}
              />
              <div className="divide-y divide-[--k-border]">
                {packages.map((pkg, i) => {
                  const current = pkg.trackingNumber === shipment.trackingNumber;
                  const pkgMeta = STATUS_META[pkg.status] ?? STATUS_META.created;

                  return (
                    <div
                      key={pkg.trackingNumber ?? i}
                      className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Boxes className="h-4 w-4 shrink-0 text-[--k-muted]" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Pas de lien vers le colis affiché, ni sur un
                                numéro factice : en CIE les colis frères
                                partagent le même et mèneraient tous ici. */}
                            {current ||
                            !pkg.trackingNumber ||
                            isPlaceholderTracking(pkg.trackingNumber) ? (
                              <span className="font-mono text-[13px] font-medium text-[--k-text]">
                                {pkg.trackingNumber ?? '—'}
                              </span>
                            ) : (
                              <Link
                                to={`/shipments/${encodeURIComponent(shipmentKey(pkg))}`}
                                className="font-mono text-[13px] font-medium text-[--k-text] hover:text-[--k-primary] hover:underline"
                              >
                                {pkg.trackingNumber}
                              </Link>
                            )}
                            {current && <Badge tone="primary">Affiché</Badge>}
                          </div>
                          <p className="mt-0.5 text-[12px] text-[--k-muted]">
                            Colis {i + 1}
                            {pkg.billingWeight && ` · ${pkg.billingWeight}`}
                            {pkg.reference && ` · ${pkg.reference}`}
                          </p>
                        </div>
                      </div>
                      <Badge tone={pkgMeta.tone}>{pkgMeta.label}</Badge>
                    </div>
                  );
                })}
              </div>

              {packages.length > 1 && (
                <p className="mt-3 border-t border-[--k-border] pt-3 text-[12px] text-[--k-muted]">
                  Le montant affiché plus haut couvre l’expédition entière, pas un colis isolé.
                </p>
              )}
            </Card>
          )}

          <Card>
            <CardTitle
              title="Destination"
              hint={`${[shipment.recipient.postalCode, shipment.recipient.city]
                .filter(Boolean)
                .join(' ')} — et les points relais UPS à proximité`}
            />
            <AddressMap
              addressLine1={shipment.recipient.address}
              city={shipment.recipient.city}
              postalCode={shipment.recipient.postalCode}
              country={shipment.recipient.country}
              label={shipment.recipient.name ?? shipment.recipient.company}
              height="320px"
              showAccessPoints
            />
          </Card>

          <Card>
            <CardTitle
              title="Commentaires"
              hint="Ce que le journal ne dit pas : appels, remises en main propre…"
            />

            <form onSubmit={submit} className="space-y-2">
              <RichTextEditor
                value={body}
                onChange={setBody}
                placeholder="Client prévenu par téléphone, colis récupéré à l’agence…"
                disabled={addComment.isPending}
              />
              <div className="flex items-center gap-2">
                <Button type="submit" isLoading={addComment.isPending} disabled={isHtmlEmpty(body)}>
                  <Send className="h-4 w-4" />
                  Commenter
                </Button>
                {body.length > MAX_BODY * 0.9 && (
                  <span className="text-[12px] text-[--k-muted]">
                    {body.length} / {MAX_BODY}
                  </span>
                )}
              </div>
            </form>

            {addComment.isError && (
              <Alert type="error" className="mt-3">
                {(addComment.error as Error).message}
              </Alert>
            )}
            {removeComment.isError && (
              <Alert type="error" className="mt-3">
                {(removeComment.error as Error).message}
              </Alert>
            )}

            {comments.length === 0 ? (
              <p className="mt-4 text-[13px] text-[--k-muted]">
                Aucun commentaire pour l’instant.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-[--k-border]">
                {comments.map((comment) => (
                  <li key={comment.id} className="flex items-start gap-3 py-3">
                    <Avatar name={comment.actor?.name} seed={comment.actor?.id} />
                    <div className="min-w-0 flex-1">
                      <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[12px]">
                        <span className="font-medium text-[--k-text]">
                          {comment.actor?.name ?? 'Utilisateur inconnu'}
                        </span>
                        <span className="text-[--k-muted]">{formatDate(comment.createdAt)}</span>
                      </p>
                      {/* Le corps est du HTML enrichi. Il est réassaini à
                          l'affichage et pas seulement à la saisie : une
                          entrée créée hors de l'application, ou avant
                          l'éditeur, ne doit pas pouvoir injecter de script. */}
                      <div
                        className="prose-comment text-[13px] text-[--k-text]"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(comment.body) }}
                      />
                    </div>
                    {/* Un commentaire n'est supprimable que par son auteur : le
                        backend le vérifie, le bouton ne fait que l'annoncer. */}
                    {comment.actor?.id && comment.actor.id === myId && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title="Supprimer mon commentaire"
                        isLoading={removeComment.isPending && removeComment.variables === comment.id}
                        onClick={() => removeComment.mutate(comment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4">
          <Card>
            <CardTitle title="Journal" hint="Les actions faites dans l’application" />

            {activity.length === 0 ? (
              <p className="text-[13px] text-[--k-muted]">
                Aucune action enregistrée pour cet envoi.
              </p>
            ) : (
              <ul>
                {activity.map((entry, i) => {
                  const entryMeta = actionMeta(entry.action);
                  const Icon = entryMeta.icon;
                  return (
                    <li key={entry.id} className="relative flex gap-3 pb-3">
                      {i < activity.length - 1 && (
                        <span className="absolute left-[15px] top-8 bottom-0 w-px bg-[--k-border]" />
                      )}
                      <span
                        className={cn(
                          'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          entryMeta.tone,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[13px] text-[--k-text]">{entry.summary}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-[--k-muted]">
                          <Avatar name={entry.actor.name} seed={entry.actor.id} size="sm" />
                          <span>{entry.actor.name}</span>
                          <span>·</span>
                          <span>{formatDate(entry.occurredAt)}</span>
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-2 border-t border-[--k-border] pt-3 text-[12px] text-[--k-muted]">
              <History className="mr-1 inline h-3 w-3" />
              Le parcours du colis chez UPS se consulte sur{' '}
              <Link to={`/tracking?number=${encodeURIComponent(trackingNumber)}`} className="text-[--k-primary] hover:underline">
                la page Suivi
              </Link>
              .
            </p>
          </Card>

          <Card>
            <CardTitle title="Identifiants" />
            <dl className="space-y-2">
              <Detail label="Numéro de suivi" value={shipment.trackingNumber ?? '—'} mono />
              <Detail label="Expédition UPS" value={shipment.shipmentId} mono />
              {shipment.accessPointId && (
                <Detail label="Point relais" value={shipment.accessPointId} mono />
              )}
              {shipment.batchId && <Detail label="Lot" value={shipment.batchId} mono />}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

interface DetailProps {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
}

function Detail({ label, value, hint, mono }: DetailProps) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-medium text-[--k-muted]">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 break-words text-[13px] text-[--k-text]',
          mono && 'font-mono text-[12px]',
        )}
      >
        {value}
      </dd>
      {hint && <p className="mt-0.5 text-[11px] text-[--k-muted]">{hint}</p>}
    </div>
  );
}
