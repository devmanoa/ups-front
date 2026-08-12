import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  PackageSearch,
  Calculator,
  Tag,
  MapPin,
  MapPinned,
  Truck,
  Clock,
  Globe,
  FileText,
  Layers,
  Package,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api } from '../services/api';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Section } from '../components/ui/Section';
import { useAuth } from '../contexts/AuthContext';

interface Shortcut {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}

const SHORTCUTS: Array<{ section: string; items: Shortcut[] }> = [
  {
    section: 'Expédition',
    items: [
      {
        to: '/tracking',
        label: 'Suivi de colis',
        description: 'Statut et historique d’un colis',
        icon: PackageSearch,
        color: 'text-blue-700',
        bg: 'bg-blue-50',
      },
      {
        to: '/rating',
        label: 'Tarifs',
        description: 'Comparer les services et leurs prix',
        icon: Calculator,
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
      },
      {
        to: '/transit-times',
        label: 'Délais',
        description: 'Estimer les temps d’acheminement',
        icon: Clock,
        color: 'text-cyan-700',
        bg: 'bg-cyan-50',
      },
      {
        to: '/shipping',
        label: 'Étiquettes',
        description: 'Créer une expédition et son étiquette',
        icon: Tag,
        color: 'text-emerald-700',
        bg: 'bg-emerald-50',
      },
      {
        to: '/shipping/bulk',
        label: 'Envoi groupé',
        description: 'Créer plusieurs expéditions ou importer un CSV',
        icon: Layers,
        color: 'text-fuchsia-700',
        bg: 'bg-fuchsia-50',
      },
      {
        to: '/shipments',
        label: 'Envois en cours',
        description: 'Historique et suivi de vos expéditions',
        icon: Package,
        color: 'text-sky-700',
        bg: 'bg-sky-50',
      },
      {
        to: '/pickup',
        label: 'Enlèvement',
        description: 'Planifier le passage d’un chauffeur',
        icon: Truck,
        color: 'text-amber-700',
        bg: 'bg-amber-50',
      },
    ],
  },
  {
    section: 'Adresses',
    items: [
      {
        to: '/locator',
        label: 'Points relais',
        description: 'Trouver les UPS Access Points',
        icon: MapPin,
        color: 'text-rose-700',
        bg: 'bg-rose-50',
      },
      {
        to: '/address',
        label: 'Validation',
        description: 'Normaliser une adresse (US/PR)',
        icon: MapPinned,
        color: 'text-violet-700',
        bg: 'bg-violet-50',
      },
    ],
  },
  {
    section: 'International',
    items: [
      {
        to: '/landed-cost',
        label: 'Coûts à l’import',
        description: 'Droits de douane et taxes',
        icon: Globe,
        color: 'text-teal-700',
        bg: 'bg-teal-50',
      },
      {
        to: '/paperless',
        label: 'Documents douaniers',
        description: 'Téléverser une facture commerciale',
        icon: FileText,
        color: 'text-slate-700',
        bg: 'bg-slate-100',
      },
    ],
  },
];

export default function Dashboard() {
  const { user } = useAuth();

  const health = useQuery({
    queryKey: ['backend-status'],
    queryFn: () => api.health(),
    retry: false,
  });

  const firstName = user?.firstName || user?.fullName?.split(' ')[0];

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        title={firstName ? `Bonjour ${firstName}` : 'Tableau de bord'}
        subtitle="Accédez aux services UPS depuis un point unique."
      />

      {/* État de la connexion : la première chose à vérifier en cas de souci. */}
      <Card className="mb-5">
        {health.isLoading ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-[--k-muted]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Vérification de la connexion UPS…
          </span>
        ) : health.isError ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-[--k-danger]">
            <AlertCircle className="h-4 w-4" />
            Backend injoignable — vérifiez qu'il est démarré.
          </span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-2 text-[13px]">
              {health.data?.credentialsConfigured ? (
                <CheckCircle2 className="h-4 w-4 text-[--k-success]" />
              ) : (
                <AlertCircle className="h-4 w-4 text-[--k-warning]" />
              )}
              <span className="font-medium text-[--k-text]">
                {health.data?.credentialsConfigured
                  ? 'Identifiants UPS configurés'
                  : 'Identifiants UPS manquants'}
              </span>
            </span>
            <span className="text-[12px] text-[--k-muted]">
              Environnement :{' '}
              <strong className="text-[--k-text]">{health.data?.environment}</strong>
            </span>
            <span className="text-[12px] text-[--k-muted]">
              Compte :{' '}
              <strong className="text-[--k-text]">
                {health.data?.accountConfigured ? 'renseigné' : 'non renseigné'}
              </strong>
            </span>
          </div>
        )}
      </Card>

      <div className="space-y-5">
        {SHORTCUTS.map((group) => (
          <Section key={group.section} label={group.section}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((item) => (
                <ShortcutCard key={item.to} {...item} />
              ))}
            </div>
          </Section>
        ))}
      </div>
    </div>
  );
}

function ShortcutCard({ to, label, description, icon: Icon, color, bg }: Shortcut) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-xl border border-[--k-border] bg-[--k-surface] p-3.5 transition hover:border-[--k-primary]/40 hover:shadow-sm"
    >
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}>
        <Icon className={`h-[18px] w-[18px] ${color}`} />
      </span>
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-[--k-text]">{label}</div>
        <div className="mt-0.5 text-[12px] text-[--k-muted]">{description}</div>
      </div>
    </Link>
  );
}
