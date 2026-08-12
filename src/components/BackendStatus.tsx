import { useQuery } from '@tanstack/react-query';
import { api, API_URL } from '../services/api';
import { cn } from './ui/cn';

/**
 * Indicateur de connexion au backend et d'authentification UPS.
 * Vérifie d'abord /health, puis la validité réelle des identifiants UPS.
 */
export function BackendStatus() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['backend-status'],
    queryFn: async () => {
      const health = await api.health();
      if (!health.credentialsConfigured) {
        return { tone: 'warning' as const, label: 'Identifiants UPS manquants' };
      }
      await api.testAuth();
      return { tone: 'ok' as const, label: `Connecté — ${health.environment}` };
    },
    // Le statut peut changer sans action de l'utilisateur (backend redémarré).
    refetchInterval: 60_000,
    retry: false,
  });

  let tone: 'ok' | 'warning' | 'error' | 'loading' = 'loading';
  let label = 'Vérification…';

  if (isError) {
    tone = 'error';
    const message = error instanceof Error ? error.message : '';
    // NETWORK_ERROR : le navigateur n'a pas pu émettre la requête ; toute
    // autre erreur signifie que le backend a répondu, donc qu'il est joignable.
    const isNetwork =
      (error as { code?: string })?.code === 'NETWORK_ERROR' || message.includes('impossible —');
    label = isNetwork ? `Appel bloqué (${API_URL})` : 'Authentification UPS échouée';
  } else if (data) {
    tone = data.tone;
    label = data.label;
  }

  const TONES = {
    ok: 'bg-green-50 text-green-700',
    warning: 'bg-orange-50 text-orange-700',
    error: 'bg-red-50 text-red-700',
    loading: 'bg-[--k-surface-2] text-[--k-muted]',
  };

  const DOTS = {
    ok: 'bg-[--k-success]',
    warning: 'bg-[--k-warning]',
    error: 'bg-[--k-danger]',
    loading: 'bg-[--k-muted]',
  };

  return (
    <span
      className={cn(
        'hidden md:inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold',
        TONES[tone]
      )}
      title={label}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOTS[tone], isLoading && 'animate-pulse')} />
      {label}
    </span>
  );
}
