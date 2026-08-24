import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Euro,
  Package,
  TrendingUp,
  Clock,
  ChevronDown,
  BarChart3,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import type { ShipmentStats } from '../types/ups';
import { Card, CardTitle } from './ui/Card';
import { Alert } from './ui/Alert';
import Button from './ui/Button';
import { cn } from './ui/cn';
import { money } from '../utils/format';

/** Périodes proposées, en jours. `null` = depuis le début. */
const PERIODS = [
  { label: '7 jours', days: 7 },
  { label: '30 jours', days: 30 },
  { label: '90 jours', days: 90 },
  { label: 'Tout', days: null as number | null },
];

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Indicateurs chiffrés sur les envois : coût, volume, répartition par service.
 *
 * Replié par défaut : la page « Envois en cours » sert d'abord à retrouver un
 * colis. Le panneau s'ouvre quand on cherche des chiffres.
 */
export function ShipmentStatsPanel() {
  const [open, setOpen] = useState(false);
  const [periodDays, setPeriodDays] = useState<number | null>(30);

  const params = periodDays === null ? {} : { from: isoDaysAgo(periodDays) };

  const stats = useQuery({
    queryKey: ['shipment-stats', periodDays],
    queryFn: () => api.getShipmentStats(params),
    enabled: open,
    retry: false,
  });

  const data = stats.data?.stats;

  return (
    <Card className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="inline-flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[--k-primary]" />
          <span className="text-[14px] font-semibold text-[--k-text]">Indicateurs</span>
          <span className="text-[12px] text-[--k-muted]">
            Coûts, volumes et répartition par service
          </span>
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-[--k-muted] transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="mt-4 border-t border-[--k-border] pt-4">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <Button
                key={p.label}
                type="button"
                size="sm"
                variant={periodDays === p.days ? 'primary' : 'secondary'}
                onClick={() => setPeriodDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          {stats.isError ? (
            <Alert type="error">{(stats.error as Error).message}</Alert>
          ) : stats.isLoading ? (
            <p className="text-[13px] text-[--k-muted]">Calcul en cours…</p>
          ) : !data || data.shipmentCount === 0 ? (
            <p className="text-[13px] text-[--k-muted]">
              Aucun envoi sur cette période.
            </p>
          ) : (
            <StatsContent stats={data} />
          )}
        </div>
      )}
    </Card>
  );
}

function StatsContent({ stats }: { stats: ShipmentStats }) {
  const currency = stats.currency || 'EUR';

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={Euro}
          label="Coût total"
          value={money(stats.totalCost, currency)}
          hint={`${stats.shipmentCount} expédition${stats.shipmentCount > 1 ? 's' : ''}`}
          tone="text-indigo-700 bg-indigo-50"
        />
        <Tile
          icon={TrendingUp}
          label="Coût moyen"
          value={stats.averageCost != null ? money(stats.averageCost, currency) : '—'}
          hint="par expédition"
          tone="text-violet-700 bg-violet-50"
        />
        <Tile
          icon={Package}
          label="Colis"
          value={String(stats.packageCount)}
          hint={
            stats.packageCount !== stats.shipmentCount
              ? `${(stats.packageCount / stats.shipmentCount).toFixed(1)} par expédition`
              : 'un par expédition'
          }
          tone="text-blue-700 bg-blue-50"
        />
        <Tile
          icon={Clock}
          label="Délai moyen"
          value={
            stats.averageDeliveryDays != null
              ? `${stats.averageDeliveryDays.toFixed(1)} j`
              : '—'
          }
          hint={
            stats.deliveredCount > 0
              ? `sur ${stats.deliveredCount} livré${stats.deliveredCount > 1 ? 's' : ''}`
              : 'aucune livraison encore'
          }
          tone="text-green-700 bg-green-50"
        />
      </div>

      {stats.byService.length > 0 && (
        <div>
          <CardTitle title="Par service" hint="Ce que coûte chaque service UPS" />
          <ServiceBars services={stats.byService} currency={currency} />
        </div>
      )}

      {stats.byDay.length > 1 && (
        <div>
          <CardTitle title="Par jour" hint="Coût quotidien sur la période" />
          <DayChart days={stats.byDay} currency={currency} />
        </div>
      )}

      <p className="text-[12px] text-[--k-muted]">
        Les expéditions annulées sont exclues des coûts. Un envoi multi-colis compte pour une
        expédition, son coût n’est pas multiplié.
      </p>
    </div>
  );
}

interface TileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone: string;
}

function Tile({ icon: Icon, label, value, hint, tone }: TileProps) {
  return (
    <div className="rounded-xl border border-[--k-border] bg-[--k-surface] p-3">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[12px] font-medium text-[--k-muted]">{label}</span>
      </div>
      <p className="mt-2 text-[20px] font-bold leading-tight text-[--k-text]">{value}</p>
      <p className="text-[12px] text-[--k-muted]">{hint}</p>
    </div>
  );
}

/** Barres horizontales : lisibles sans librairie de graphiques. */
function ServiceBars({
  services,
  currency,
}: {
  services: ShipmentStats['byService'];
  currency: string;
}) {
  const max = Math.max(...services.map((s) => s.totalCost), 1);

  return (
    <ul className="space-y-2">
      {services.map((s) => (
        <li key={s.service}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-[--k-text]">{s.service}</span>
            <span className="shrink-0 font-medium text-[--k-text]">
              {money(s.totalCost, currency)}
              <span className="ml-1.5 text-[12px] font-normal text-[--k-muted]">
                ({s.shipmentCount})
              </span>
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[--k-surface-2]">
            <div
              className="h-full rounded-full bg-[--k-primary]"
              style={{ width: `${(s.totalCost / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Histogramme du coût quotidien. Les jours sans envoi ne sont pas comblés :
 * l'API ne renvoie que les jours présents, et un trou se lit aussi bien
 * qu'une barre à zéro.
 */
function DayChart({ days, currency }: { days: ShipmentStats['byDay']; currency: string }) {
  const max = useMemo(() => Math.max(...days.map((d) => d.totalCost), 1), [days]);

  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-full items-end gap-1" style={{ height: 96 }}>
        {days.map((d) => (
          <div
            key={d.day}
            className="group/bar relative flex min-w-[8px] flex-1 flex-col justify-end"
            title={`${d.day} — ${money(d.totalCost, currency)} (${d.shipmentCount} envoi${d.shipmentCount > 1 ? 's' : ''})`}
          >
            <div
              className="rounded-t bg-[--k-primary]/70 transition group-hover/bar:bg-[--k-primary]"
              style={{ height: `${Math.max((d.totalCost / max) * 100, 2)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-[--k-muted]">
        <span>{formatDay(days[0].day)}</span>
        <span>{formatDay(days[days.length - 1].day)}</span>
      </div>
    </div>
  );
}

function formatDay(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}
