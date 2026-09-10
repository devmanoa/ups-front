import { useQuery } from '@tanstack/react-query';
import { loadPermissions, hasPermission } from '../config/permissions';

/**
 * Droits Konitys de l'utilisateur, pour masquer ce qu'il ne peut pas faire.
 *
 * Confort d'affichage seulement : le serveur revérifie chaque action. Cacher
 * un bouton évite un refus après coup, ça ne protège rien — un bouton masqué
 * reste appelable à la main.
 */
export function usePermissions() {
  const query = useQuery({
    queryKey: ['permissions'],
    queryFn: () => loadPermissions(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  return {
    /** Vrai tant que les droits ne sont pas connus : l'interface reste entière. */
    can: (key: string) => hasPermission(query.data ?? null, key),
    isLoading: query.isLoading,
  };
}
