import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { History, ChevronDown } from 'lucide-react';
import { api, type ActivityQuery } from '../services/api';
import type { ActivityEntry } from '../types/ups';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Field, SelectField } from '../components/ui/Field';
import { Avatar } from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import { actionMeta } from '../utils/actionMeta';

const PAGE_SIZE = 50;


/** Familles proposées au filtre : le backend accepte le préfixe seul. */
const ACTION_FAMILIES = [
  { value: '', label: 'Toutes les actions' },
  { value: 'shipment', label: 'Expéditions' },
  { value: 'bulk', label: 'Envois groupés' },
  { value: 'address', label: 'Carnet d’adresses' },
  { value: 'group', label: 'Groupes d’adresses' },
  { value: 'pickup', label: 'Enlèvements' },
];

export default function Timeline() {
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);

  const params: ActivityQuery = {
    actorId: actorId || undefined,
    action: action || undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  };

  const activity = useQuery({
    queryKey: ['activity', params],
    queryFn: () => api.listActivity(params),
    retry: false,
  });

  const actors = useQuery({
    queryKey: ['activity-actors'],
    queryFn: () => api.listActivityActors(),
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  /** Revenir en page 1 : un filtre appliqué depuis la page 3 donnerait du vide. */
  const applyFilter = (fn: () => void) => {
    fn();
    setPage(0);
  };

  const entries = activity.data?.entries ?? [];
  const total = activity.data?.total ?? 0;

  /** Regroupe par jour : la timeline se lit par journée, pas en flux continu. */
  const days = useMemo(() => {
    const bucket = new Map<string, ActivityEntry[]>();
    for (const entry of entries) {
      const key = new Date(entry.occurredAt).toISOString().slice(0, 10);
      if (!bucket.has(key)) bucket.set(key, []);
      bucket.get(key)!.push(entry);
    }
    return [...bucket.entries()];
  }, [entries]);

  const hasFilters = Boolean(actorId || action || from || to || search);

  if (activity.isError) {
    return (
      <div>
        <PageHeader
          title="Timeline"
          subtitle="Récapitulatif des actions réalisées dans l’application."
        />
        <Alert type="error">{(activity.error as Error).message}</Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Timeline"
        subtitle="Qui a fait quoi dans l’application : étiquettes créées, adresses ajoutées, envois annulés."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Field
              label="Recherche"
              placeholder="Résumé, auteur, numéro de suivi…"
              value={search}
              onChange={(e) => applyFilter(() => setSearch(e.target.value))}
            />
          </div>

          <SelectField
            label="Auteur"
            value={actorId}
            onChange={(e) => applyFilter(() => setActorId(e.target.value))}
          >
            <option value="">Tous les auteurs</option>
            {(actors.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.actionCount})
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Type d’action"
            value={action}
            onChange={(e) => applyFilter(() => setAction(e.target.value))}
          >
            {ACTION_FAMILIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </SelectField>

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

          {hasFilters && (
            <div className="flex items-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  applyFilter(() => {
                    setActorId('');
                    setAction('');
                    setFrom('');
                    setTo('');
                    setSearch('');
                  })
                }
              >
                Réinitialiser
              </Button>
            </div>
          )}
        </div>
      </Card>

      {actors.data && actors.data.some((a) => !a.id) && (
        <Alert type="info" className="mb-4">
          Certaines actions n’ont pas d’auteur : elles datent d’avant l’activation de
          l’authentification Keycloak.
        </Alert>
      )}

      {activity.isLoading ? (
        <Card>
          <p className="text-[13px] text-[--k-muted]">Chargement de la timeline…</p>
        </Card>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={History}
          title={hasFilters ? 'Aucune action ne correspond' : 'Aucune action enregistrée'}
          description={
            hasFilters
              ? 'Modifiez ou réinitialisez les filtres pour élargir la recherche.'
              : 'Les actions apparaîtront ici au fur et à mesure : création d’étiquettes, ajout d’adresses, annulations.'
          }
        />
      ) : (
        <div className="space-y-4">
          {days.map(([day, dayEntries]) => (
            <Card key={day}>
              <CardTitle
                title={formatDay(day)}
                hint={`${dayEntries.length} action${dayEntries.length > 1 ? 's' : ''}`}
              />
              <ol className="relative space-y-0">
                {dayEntries.map((entry, i) => (
                  <TimelineRow key={entry.id} entry={entry} last={i === dayEntries.length - 1} />
                ))}
              </ol>
            </Card>
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

function TimelineRow({ entry, last }: { entry: ActivityEntry; last: boolean }) {
  const [open, setOpen] = useState(false);
  const meta = actionMeta(entry.action);
  const Icon = meta.icon;
  const hasDetails = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <li className="relative flex gap-3 pb-3">
      {/* Trait vertical reliant les événements d'une même journée. */}
      {!last && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-[--k-border]" />}

      <span
        className={cn(
          'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
          meta.tone,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-[13px] text-[--k-text]">{entry.summary}</span>
          <Badge tone="neutral">{meta.label}</Badge>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[--k-muted]">
          <span className="inline-flex items-center gap-1.5">
            <Avatar name={entry.actor.name} seed={entry.actor.id} size="sm" />
            {entry.actor.name}
          </span>
          <span>{formatTime(entry.occurredAt)}</span>

          {/* Lien vers l'objet concerné, quand il est consultable. */}
          {entry.entityType === 'shipment' && entry.entityId && (
            <Link
              to={`/shipments/${encodeURIComponent(entry.entityId)}`}
              className="text-[--k-primary] hover:underline"
            >
              Voir l’envoi
            </Link>
          )}
          {entry.entityType === 'batch' && entry.entityId && (
            <Link
              to={`/batches/${encodeURIComponent(entry.entityId)}`}
              className="text-[--k-primary] hover:underline"
            >
              Voir la commande
            </Link>
          )}
          {(entry.entityType === 'address' || entry.entityType === 'group') && (
            <Link to="/addresses" className="text-[--k-primary] hover:underline">
              Voir le carnet
            </Link>
          )}

          {hasDetails && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-0.5 hover:text-[--k-text]"
            >
              Détails
              <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
            </button>
          )}
        </div>

        {open && hasDetails && (
          <dl className="mt-2 grid gap-x-4 gap-y-1 rounded-lg bg-[--k-surface-2] px-3 py-2 text-[12px] sm:grid-cols-2">
            {Object.entries(entry.metadata ?? {}).map(([key, value]) => (
              <div key={key} className="flex gap-1.5">
                <dt className="text-[--k-muted]">{key} :</dt>
                <dd className="min-w-0 truncate font-medium text-[--k-text]">
                  {formatValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </li>
  );
}

/** « Aujourd'hui » et « Hier » se lisent mieux qu'une date complète. */
function formatDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return "Aujourd'hui";
  if (same(date, yesterday)) return 'Hier';

  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
