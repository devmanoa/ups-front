import React, { Component, Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { loadRemoteComponent } from '../../remoteLoader';
import { Topbar } from '../Topbar';
import { Sidebar, SIDEBAR_SECTIONS as LOCAL_SECTIONS } from '../Sidebar';
import ErrorBoundary from '../ErrorBoundary';

/**
 * Coquille applicative, calquée sur bornes_factory.
 *
 * On charge le HeaderBar et la Sidebar fédérés depuis la plateforme Konitys
 * via Module Federation. Si la plateforme est indisponible (variable d'env
 * absente, réseau…), un ErrorBoundary bascule sur les composants locaux,
 * visuellement identiques.
 */

const RemoteHeaderBar = React.lazy(() => loadRemoteComponent('./HeaderBar'));
const RemoteSidebar = React.lazy(() => loadRemoteComponent('./Sidebar'));

// Deux contrats coexistent — `path` pour le composant remote Konitys,
// `to` pour la Sidebar locale (react-router). Le menu est défini une seule
// fois dans Sidebar.tsx ; on y ajoute `path` ici plutôt que d'entretenir
// une seconde liste qui finirait par diverger.
const SIDEBAR_SECTIONS = LOCAL_SECTIONS.map((section) => ({
  ...section,
  items: section.items.map((item) => ({ ...item, path: item.to })),
}));

// Placeholders dimensionnés comme les composants finaux pour éviter un saut visuel.
function HeaderFallback() {
  return (
    <div className="h-12 shrink-0 border-b border-[--k-border] bg-gradient-to-r from-white to-blue-50" />
  );
}

function SidebarFallback() {
  return <div className="w-[210px] shrink-0 bg-[--k-sidebar-bg] h-full" />;
}

interface RemoteErrorBoundaryProps {
  fallback: React.ReactNode;
  children: React.ReactNode;
}

interface RemoteErrorBoundaryState {
  hasError: boolean;
}

/**
 * Boundary dédiée au chargement des remotes : capture les erreurs de fetch ou
 * d'initialisation du Module Federation et rend le composant local.
 * À ne pas confondre avec ErrorBoundary, qui couvre les erreurs des pages.
 */
class RemoteErrorBoundary extends Component<RemoteErrorBoundaryProps, RemoteErrorBoundaryState> {
  constructor(props: RemoteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): RemoteErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('k_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('k_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
    } catch {
      /* stockage indisponible : préférence non persistée */
    }
  }, [sidebarCollapsed]);

  // Ferme le menu mobile à chaque navigation.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Adapte notre utilisateur Keycloak à la forme attendue par le HeaderBar remote.
  const headerUser = user
    ? {
        firstName: user.firstName || user.fullName?.split(' ')[0] || '',
        lastName: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        username: user.username || '',
      }
    : null;

  const handleNavigate = (path: string) => navigate(path);

  const localTopbar = <Topbar onToggleMobileMenu={() => setMobileMenuOpen((v) => !v)} />;
  const localSidebar = (
    <Sidebar
      collapsed={sidebarCollapsed}
      onToggle={() => setSidebarCollapsed((v) => !v)}
      sections={SIDEBAR_SECTIONS}
    />
  );
  const localMobileSidebar = (
    <Sidebar collapsed={false} onToggle={() => setMobileMenuOpen(false)} sections={SIDEBAR_SECTIONS} />
  );

  return (
    <div className="h-screen flex flex-col bg-[--k-bg]">
      <RemoteErrorBoundary fallback={localTopbar}>
        <Suspense fallback={<HeaderFallback />}>
          <RemoteHeaderBar
            user={headerUser}
            onLogout={logout}
            currentAppName="UPS Expédition"
            onNavigate={handleNavigate}
          />
        </Suspense>
      </RemoteErrorBoundary>

      <div className="flex flex-1 min-h-0">
        <div className="hidden md:block">
          <RemoteErrorBoundary fallback={localSidebar}>
            <Suspense fallback={<SidebarFallback />}>
              <RemoteSidebar
                sections={SIDEBAR_SECTIONS}
                activePath={location.pathname}
                onNavigate={handleNavigate}
                collapsed={sidebarCollapsed}
                onCollapse={() => setSidebarCollapsed((v) => !v)}
                onHelpClick={() => {}}
              />
            </Suspense>
          </RemoteErrorBoundary>
        </div>

        {/* Sidebar mobile (overlay). */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/30 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed left-0 top-12 z-40 h-[calc(100vh-48px)] md:hidden">
              <RemoteErrorBoundary fallback={localMobileSidebar}>
                <Suspense fallback={<SidebarFallback />}>
                  <RemoteSidebar
                    sections={SIDEBAR_SECTIONS}
                    activePath={location.pathname}
                    onNavigate={handleNavigate}
                    collapsed={false}
                    onCollapse={() => setMobileMenuOpen(false)}
                    onHelpClick={() => {}}
                  />
                </Suspense>
              </RemoteErrorBoundary>
            </div>
          </>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto p-3 md:p-5">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
