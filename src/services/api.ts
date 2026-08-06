import keycloak from '../config/keycloak';
import { isAuthConfigured, runtimeConfig } from '../config/runtime';
import type {
  AddressValidationResult,
  HealthResult,
  LocatorResult,
  PackageInput,
  RatingResult,
  ServiceOption,
  ShipmentResult,
  TrackingResult,
  VoidResult,
  Address,
} from '../types/ups';

const API_URL = runtimeConfig.apiUrl;

export class ApiError extends Error {
  code?: string;
  upsCodes?: string[];

  constructor(message: string, code?: string, upsCodes?: string[]) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.upsCodes = upsCodes;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
}

/**
 * Appelle le backend UPS en joignant le jeton Keycloak courant.
 * Le jeton est rafraîchi juste avant l'appel pour éviter d'envoyer un
 * jeton expiré sur les requêtes longues.
 */
async function request<T>(path: string, { method = 'GET', body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (isAuthConfigured && keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch {
      // Échec du rafraîchissement : on tente avec le jeton existant.
    }
    if (keycloak.token) headers.Authorization = `Bearer ${keycloak.token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Impossible de joindre le backend (${API_URL}). Est-il démarré ?`);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.success === false) {
    const upsCodes: string[] = data?.error?.upsCodes || [];
    const base = data?.error?.message || `Erreur HTTP ${res.status}`;
    // Le code UPS identifie la cause exacte (250002 = jeton refusé,
    // 250003 = API non autorisée pour l'application…).
    const message = upsCodes.length ? `${base} [UPS ${upsCodes.join(', ')}]` : base;
    throw new ApiError(message, data?.error?.code, upsCodes);
  }

  return data.data as T;
}

export interface RatePayload {
  shipTo: Address;
  shipFrom?: Address;
  packages: PackageInput[];
  requestOption: string;
  serviceCode?: string;
}

export interface ShipmentPayload {
  shipTo: Address;
  shipFrom?: Address;
  packages: PackageInput[];
  serviceCode?: string;
  description?: string;
  labelFormat?: string;
  accessPointLocationId?: string;
}

export interface LocatorPayload {
  address: Address;
  radius?: number;
  unit?: string;
  maxResults?: number;
}

export interface AddressPayload {
  address: Address;
  requestOption?: number;
}

export const api = {
  health: () => request<HealthResult>('/health'),
  testAuth: () => request<unknown>('/api/auth/test'),

  track: (trackingNumber: string) =>
    request<TrackingResult>(`/api/tracking/${encodeURIComponent(trackingNumber)}`),

  getServices: () => request<ServiceOption[]>('/api/rating/services'),
  getRates: (payload: RatePayload) => request<RatingResult>('/api/rating', { method: 'POST', body: payload }),

  createShipment: (payload: ShipmentPayload) =>
    request<ShipmentResult>('/api/shipping', { method: 'POST', body: payload }),
  voidShipment: (shipmentId: string) =>
    request<VoidResult>(`/api/shipping/${encodeURIComponent(shipmentId)}`, { method: 'DELETE' }),

  validateAddress: (payload: AddressPayload) =>
    request<AddressValidationResult>('/api/address/validate', { method: 'POST', body: payload }),

  findAccessPoints: (payload: LocatorPayload) =>
    request<LocatorResult>('/api/locator/access-points', { method: 'POST', body: payload }),
};

export { API_URL };
