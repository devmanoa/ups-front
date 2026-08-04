import { useState } from 'react';
import {
  Bell,
  HelpCircle,
  User,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
  Truck,
} from 'lucide-react';
import { cn } from './ui/cn';
import { useAuth } from '../contexts/AuthContext';
import { BackendStatus } from './BackendStatus';

/**
 * Topbar locale de repli, alignée sur le langage visuel de la plateforme
 * Konitys. Seule l'identité applicative change ("UPS Expédition").
 */

interface TopbarProps {
  onToggleMobileMenu?: () => void;
}

export function Topbar({ onToggleMobileMenu }: TopbarProps) {
  const { user, logout, authConfigured } = useAuth();

  const [notifOpen, setNotifOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const initials = user?.fullName
    ? user.fullName
        .split(/\s+/)
        .filter(Boolean)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : '??';

  return (
    <header className="shrink-0 z-30 border-b border-[--k-border] bg-gradient-to-r from-white to-blue-50 shadow-sm shadow-black/[0.04]">
      <div className="flex h-12 items-center gap-2 px-3 md:gap-3 md:px-4">
        {onToggleMobileMenu && (
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[--k-muted] hover:bg-[--k-surface-2] md:hidden"
            onClick={onToggleMobileMenu}
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>
        )}

        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50">
            <Truck className="h-4 w-4 text-indigo-600" />
          </span>
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[--k-muted] leading-none">
              KONITYS
            </span>
            <span className="text-[13px] font-semibold text-[--k-text] leading-tight">
              UPS Expédition
            </span>
          </div>
        </div>

        <div className="flex-1" />

        <BackendStatus />

        <div className="relative">
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text] transition"
            onClick={() => {
              setNotifOpen((v) => !v);
              setAccountOpen(false);
            }}
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
          {notifOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-[calc(100vw-24px)] sm:w-[340px] max-w-[340px] rounded-2xl border border-[--k-border] bg-white/95 backdrop-blur-lg shadow-xl shadow-black/8">
                <div className="flex items-center justify-between border-b border-[--k-border] px-4 py-3">
                  <span className="text-[14px] font-semibold">Notifications</span>
                </div>
                <div className="px-4 py-6 text-center text-[13px] text-[--k-muted]">
                  Aucune notification
                </div>
              </div>
            </>
          )}
        </div>

        <button className="hidden sm:flex h-9 w-9 items-center justify-center rounded-lg text-[--k-muted] hover:bg-[--k-surface-2] hover:text-[--k-text] transition">
          <HelpCircle className="h-[18px] w-[18px]" />
        </button>

        <div className="hidden sm:block mx-0.5 h-6 w-px bg-[--k-border]" />

        <div className="relative">
          <button
            className="flex h-9 items-center gap-2 rounded-lg px-2 hover:bg-[--k-surface-2] transition"
            onClick={() => {
              setAccountOpen((v) => !v);
              setNotifOpen(false);
            }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 text-[11px] font-semibold text-white">
              {initials}
            </span>
            <span className="hidden sm:inline text-[13px] font-medium text-[--k-text]">
              {user?.firstName || user?.fullName || 'Invité'}
            </span>
            <ChevronDown className="h-3 w-3 text-[--k-muted]" />
          </button>
          {accountOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setAccountOpen(false)} />
              <div className="absolute right-0 z-40 mt-2 w-[240px] rounded-2xl border border-[--k-border] bg-white/95 backdrop-blur-lg shadow-xl shadow-black/8 py-1">
                <div className="px-3 py-2.5 border-b border-[--k-border]">
                  <div className="text-[13px] font-semibold text-[--k-text]">
                    {user?.fullName || 'Utilisateur'}
                  </div>
                  <div className="text-xs text-[--k-muted]">{user?.email}</div>
                </div>
                <div className="py-1">
                  <AccountItem icon={User} label="Mon compte" />
                  <AccountItem icon={Settings} label="Paramètres" />
                </div>
                {authConfigured && (
                  <div className="border-t border-[--k-border] py-1">
                    <AccountItem icon={LogOut} label="Déconnexion" danger onClick={logout} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function AccountItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof User;
  label: string;
  danger?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition hover:bg-[--k-surface-2]',
        danger ? 'text-[--k-danger]' : 'text-[--k-text]'
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
