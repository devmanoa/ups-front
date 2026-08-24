import React, { Component, Suspense, useState, useEffect, useRef } from 'react';
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

/**
 * Sections pour le menu fédéré, avec un vrai lien glissé dans le libellé.
 *
 * Le hub rend chaque entrée en `<button onClick>`. Un bouton n'a ni
 * Ctrl+clic, ni clic du milieu, ni « Ouvrir dans un nouvel onglet » au clic
 * droit : le navigateur réserve ces gestes aux `<a href>`, et aucun
 * JavaScript ne les simule — on peut lire `ctrlKey`, on ne peut pas faire
 * apparaître un menu contextuel.
 *
 * `label` étant rendu tel quel par le hub, on y place un lien transparent
 * qui recouvre la ligne (motif « stretched link »). C'est lui que la souris
 * touche, donc le navigateur offre tout son nécessaire — sans qu'une ligne
 * du hub soit modifiée.
 */
function federatedSections(
  collapsed: boolean,
  onPlainClick: (path: string, e: React.MouseEvent) => void,
) {
  return SIDEBAR_SECTIONS.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      label: (
        <>
          {item.label}
          {/* Inerte quand la barre est repliée : le libellé vit alors dans
              l'infobulle, elle-même positionnée. Le lien s'y calerait et
              laisserait une zone cliquable invisible à côté de la barre.
              L'interception au clavier reprend la main dans ce cas. */}
          {!collapsed && (
            <a
              href={item.to}
              aria-hidden="true"
              tabIndex={-1}
              // Le bloc conteneur est le <button>, qui porte `relative` :
              // le lien recouvre donc la ligne entière, pas seulement le
              // libellé — et le `truncate` du span ne le rogne pas.
              className="absolute inset-0"
              // Sans stopPropagation, le clic remonte au onClick du bouton
              // et le hub ouvre une seconde navigation.
              //
              // Le clic simple est confié au routeur : laisser le lien agir
              // rechargerait toute l'application. Les clics modifiés, eux,
              // passent au navigateur — c'est tout l'intérêt d'un vrai <a>.
              onClick={(e) => {
                e.stopPropagation();
                onPlainClick(item.to, e);
              }}
            />
          )}
        </>
      ),
    })),
  }));
}

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

  /**
   * Clic simple sur le lien glissé dans le libellé : navigation côté client.
   *
   * Un clic modifié (Ctrl, Cmd, Maj, molette) n'entre pas ici — le navigateur
   * l'a déjà pris en charge et ouvre son onglet, ce qui est le but.
   */
  const handleLinkClick = (path: string, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path);
  };

  const remoteSections = federatedSections(sidebarCollapsed, handleLinkClick);
  // Le menu mobile n'est jamais replié : ses libellés portent donc toujours
  // le lien.
  const mobileSections = federatedSections(false, handleLinkClick);

  /**
   * Repli pour la barre repliée, où le lien du libellé est inerte.
   *
   * Le lien de `federatedSections` couvre le cas courant et apporte les
   * gestes natifs. Il ne peut pas être posé quand la barre est repliée : le
   * libellé vit alors dans une infobulle positionnée, et le lien s'y calerait.
   * Cette interception rétablit alors Ctrl+clic et clic molette, sans le menu
   * contextuel — qu'aucun JavaScript ne peut produire.
   */
  /** Horodatage du dernier onglet ouvert, pour ne pas en ouvrir trois. */
  const lastOpenRef = useRef(0);

  const interceptModifiedClick = (e: MouseEvent) => {
    const modified = e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1;
    if (!modified) return;

    // Une vraie ancre gère déjà le cas : ne pas s'en mêler.
    const anchor = (e.target as HTMLElement).closest('a[href]');
    if (anchor) return;

    // Le hub peut rendre l'entrée comme un <button>, un <div> ou un <li> :
    // plutôt que de deviner sa structure, on remonte les ancêtres jusqu'à
    // en trouver un dont le texte correspond exactement à une entrée du menu.
    const items = SIDEBAR_SECTIONS.flatMap((s) => s.items);
    const normalize = (v: string) => v.trim().toLowerCase();

    let node: HTMLElement | null = e.target as HTMLElement;
    let item: (typeof items)[number] | undefined;

    // 5 niveaux : au-delà, on remonterait jusqu'à la section entière et le
    // texte engloberait plusieurs entrées.
    for (let depth = 0; node && depth < 5 && !item; depth += 1) {
      const text = normalize(node.textContent ?? '');
      if (text) item = items.find((i) => normalize(i.label) === text);
      node = node.parentElement;
    }

    if (!item) return;

    e.preventDefault();
    // stopImmediatePropagation et non stopPropagation : le hub peut avoir
    // posé son écouteur sur le même élément, et il s'exécuterait quand même.
    e.stopImmediatePropagation();
    e.stopPropagation();

    // mousedown, click et auxclick se suivent sur un même geste : sans cette
    // garde, un seul clic ouvrirait deux ou trois onglets.
    const now = Date.now();
    if (now - lastOpenRef.current < 500) return;
    lastOpenRef.current = now;

    window.open(item.to, '_blank', 'noopener');
  };

  /**
   * Pose l'interception en DOM natif, en phase de capture.
   *
   * `onClickCapture` de React ne suffit pas : React délègue ses événements à
   * la racine du document, donc un gestionnaire natif posé par le hub sur
   * l'entrée elle-même s'exécute avant. Ici l'écouteur est sur le conteneur
   * et en capture, donc bien avant tout ce que le hub aura pu attacher.
   */
  const sidebarRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;

    el.addEventListener('click', interceptModifiedClick, true);
    // auxclick porte le clic molette, absent de l'événement click.
    el.addEventListener('auxclick', interceptModifiedClick, true);
    // mousedown : certains menus naviguent dès l'appui, sans attendre le clic.
    el.addEventListener('mousedown', interceptModifiedClick, true);

    return () => {
      el.removeEventListener('click', interceptModifiedClick, true);
      el.removeEventListener('auxclick', interceptModifiedClick, true);
      el.removeEventListener('mousedown', interceptModifiedClick, true);
    };
    // Le gestionnaire ne capture que SIDEBAR_SECTIONS, une constante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        {/* L'écouteur est posé en DOM natif (voir l'effet plus haut) et non
            via onClickCapture : React délègue ses événements à la racine, si
            bien qu'un gestionnaire natif du hub s'exécuterait avant lui. */}
        <div className="hidden md:block" ref={sidebarRef}>
          <RemoteErrorBoundary fallback={localSidebar}>
            <Suspense fallback={<SidebarFallback />}>
              <RemoteSidebar
                sections={remoteSections}
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
                    sections={mobileSections}
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
