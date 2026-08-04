import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { runtimeConfig } from './config/runtime';

/**
 * Chargement des remotes Module Federation, même mécanisme que bornes_factory.
 *
 * La plateforme Konitys (VITE_PLATEFORM_URL) expose un `remoteEntry.js`
 * fournissant les composants partagés HeaderBar / Sidebar. On enregistre nos
 * instances React / ReactDOM dans le scope partagé pour que les remotes
 * réutilisent la même copie — sinon les hooks lèvent une erreur.
 *
 * Si l'URL est absente ou injoignable, `loadRemoteComponent` rejette :
 * le RemoteErrorBoundary d'AppLayout bascule alors sur les composants locaux.
 */

const PLATEFORM_URL = runtimeConfig.plateformUrl;

interface RemoteContainer {
  init: (shareScope: Record<string, unknown>) => void;
  get: (module: string) => Promise<() => unknown>;
}

function ensureSharedScope() {
  const g = globalThis as unknown as Record<string, any>;
  g.__federation_shared__ = g.__federation_shared__ || {};
  g.__federation_shared__['default'] = g.__federation_shared__['default'] || {};

  const shared = g.__federation_shared__['default'];

  if (!shared['react']) {
    shared['react'] = {
      '18.3.1': { get: () => () => React, scope: 'default' },
    };
  }

  if (!shared['react-dom']) {
    shared['react-dom'] = {
      '18.3.1': { get: () => () => ReactDOM, scope: 'default' },
    };
  }
}

let containerPromise: Promise<RemoteContainer> | null = null;

function loadRemoteEntry(): Promise<RemoteContainer> {
  if (containerPromise) return containerPromise;

  if (!PLATEFORM_URL) {
    return Promise.reject(new Error('VITE_PLATEFORM_URL non configurée'));
  }

  ensureSharedScope();

  containerPromise = import(/* @vite-ignore */ `${PLATEFORM_URL}/assets/remoteEntry.js`)
    .then((container: RemoteContainer) => {
      container.init({});
      return container;
    })
    .catch((err) => {
      // Réinitialisé pour permettre une nouvelle tentative au prochain montage.
      containerPromise = null;
      throw err;
    });

  return containerPromise;
}

export async function loadRemoteComponent(
  moduleName: string
): Promise<{ default: React.ComponentType<any> }> {
  const container = await loadRemoteEntry();
  const factory = await container.get(moduleName);
  const result = factory();

  if (result && typeof result === 'object' && 'default' in result) {
    return result as { default: React.ComponentType<any> };
  }
  return { default: result as React.ComponentType<any> };
}
