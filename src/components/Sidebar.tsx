import { NavLink, useLocation } from 'react-router-dom';
import { cn } from './ui/cn';
import {
  LayoutDashboard,
  PackageSearch,
  Calculator,
  MapPin,
  Tag,
  Truck,
  Clock,
  Globe,
  FileText,
  Layers,
  Package,
  AlertTriangle,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  BookUser,
  Boxes,
  History,
  ClipboardList,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Sidebar locale de repli. Reproduit la structure de la Sidebar fédérée de la
 * plateforme pour partager le même contrat de props : quand le remote se
 * charge, AppLayout bascule dessus avec les mêmes sections.
 */

interface SidebarItem {
  label: string;
  icon: LucideIcon;
  to: string;
}

interface SidebarSection {
  label: string;
  items: SidebarItem[];
}

const DEFAULT_SECTIONS: SidebarSection[] = [
  {
    label: 'Accueil',
    items: [{ label: 'Tableau de bord', icon: LayoutDashboard, to: '/' }],
  },
  {
    label: 'Expédition',
    items: [
      { label: 'Étiquettes', icon: Tag, to: '/shipping' },
      { label: 'Envoi groupé', icon: Layers, to: '/shipping/bulk' },
      { label: 'Commandes', icon: ClipboardList, to: '/batches' },
      { label: 'Enlèvement', icon: Truck, to: '/pickup' },
    ],
  },
  {
    label: 'Suivi',
    items: [
      { label: 'Suivi de colis', icon: PackageSearch, to: '/tracking' },
      { label: 'Envois en cours', icon: Package, to: '/shipments' },
      { label: 'Anomalies', icon: AlertTriangle, to: '/anomalies' },
      { label: 'Timeline', icon: History, to: '/activity' },
    ],
  },
  {
    label: 'Tarifs et délais',
    items: [
      { label: 'Tarifs', icon: Calculator, to: '/rating' },
      { label: 'Délais', icon: Clock, to: '/transit-times' },
      { label: "Coûts à l'import", icon: Globe, to: '/landed-cost' },
    ],
  },
  {
    label: 'Outils',
    items: [
      { label: "Carnet d'adresses", icon: BookUser, to: '/addresses' },
      { label: 'Types de colis', icon: Boxes, to: '/package-types' },
      { label: 'Points relais', icon: MapPin, to: '/locator' },
      { label: 'Documents douaniers', icon: FileText, to: '/paperless' },
    ],
  },
];

export { DEFAULT_SECTIONS as SIDEBAR_SECTIONS };
export type { SidebarSection, SidebarItem };

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  sections?: SidebarSection[];
}

function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="group/tip relative">
      {children}
      <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 opacity-0 transition-opacity group-hover/tip:opacity-100">
        <div className="whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-[12px] font-medium text-white shadow-lg">
          {label}
        </div>
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-[5px] border-transparent border-r-slate-900" />
      </div>
    </div>
  );
}

export function Sidebar({ collapsed, onToggle, sections = DEFAULT_SECTIONS }: SidebarProps) {
  const location = useLocation();

  function SidebarNavItem({ item }: { item: SidebarItem }) {
    const Icon = item.icon;
    // Une autre entrée plus spécifique gagne la priorité : sans cela,
    // "/shipping/bulk" activerait aussi "Étiquettes" (/shipping).
    const moreSpecific = sections
      .flatMap((s) => s.items)
      .some((other) => other.to !== item.to && other.to.startsWith(`${item.to}/`) && location.pathname.startsWith(other.to));

    const isActive =
      item.to === '/'
        ? location.pathname === '/'
        : !moreSpecific &&
          (location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

    const link = (
      <NavLink
        to={item.to}
        className={cn(
          'relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-all duration-150',
          collapsed ? 'justify-center px-0' : 'justify-start',
          isActive
            ? 'bg-white/10 text-white'
            : 'text-[--k-sidebar-text] hover:bg-white/[0.06] hover:text-[--k-sidebar-text-active]'
        )}
      >
        {isActive && !collapsed && (
          <span className="absolute left-0 top-[6px] bottom-[6px] w-[2px] rounded-full bg-white" />
        )}
        <Icon className={cn('h-[16px] w-[16px] shrink-0', isActive ? 'text-white' : '')} />
        {!collapsed && <span>{item.label}</span>}
      </NavLink>
    );

    if (collapsed) return <Tooltip label={item.label}>{link}</Tooltip>;
    return link;
  }

  function BottomLink({
    icon: Icon,
    label,
    onClick,
  }: {
    icon: LucideIcon;
    label: string;
    onClick?: () => void;
  }) {
    const element = (
      <button onClick={onClick} className="w-full">
        <span
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-[--k-sidebar-text] hover:bg-white/[0.06] hover:text-[--k-sidebar-text-active] transition',
            collapsed && 'justify-center px-0',
            onClick && 'w-full'
          )}
        >
          <Icon className="h-[16px] w-[16px] shrink-0" />
          {!collapsed && <span>{label}</span>}
        </span>
      </button>
    );

    if (collapsed) return <Tooltip label={label}>{element}</Tooltip>;
    return element;
  }

  return (
    <aside
      className={cn(
        'sticky top-12 h-[calc(100vh-48px)] shrink-0 bg-[--k-sidebar-bg] transition-all duration-200',
        collapsed ? 'w-[52px]' : 'w-[210px]'
      )}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex-1 overflow-y-auto pt-3 pb-2">
          {sections.map((section, si) => (
            <div key={section.label} className={cn(si > 0 && 'mt-4')}>
              {!collapsed && (
                <div className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-[--k-sidebar-section]">
                  {section.label}
                </div>
              )}
              {collapsed && si > 0 && (
                <div className="mx-3 mb-2 border-t border-[--k-sidebar-border]" />
              )}
              <nav className="space-y-0.5 px-2">
                {section.items.map((item) => (
                  <SidebarNavItem key={item.to} item={item} />
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="border-t border-[--k-sidebar-border] px-2 py-2 space-y-0.5">
          <BottomLink icon={HelpCircle} label="Aide" />
          <BottomLink
            icon={collapsed ? ChevronsRight : ChevronsLeft}
            label={collapsed ? 'Déplier' : 'Réduire'}
            onClick={onToggle}
          />
        </div>
      </div>
    </aside>
  );
}
