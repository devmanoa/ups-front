import keycloak from '../config/keycloak';
import { isAuthConfigured, runtimeConfig } from '../config/runtime';
import type {
  HealthResult,
  LocatorResult,
  PackageInput,
  RatingResult,
  ServiceOption,
  ShipmentResult,
  TrackingResult,
  VoidResult,
  Address,
  TransitResult,
  LandedCostResult,
  LandedCostItemInput,
  PickupPiece,
  PickupResult,
  ContainerOption,
  DocumentTypesResult,
  UploadResult,
  ShipmentsListResult,
  StoredLabel,
  RefreshStatusResult,
  SyncResult,
  AnomaliesResult,
  BulkEntry,
  BulkResult,
  SavedAddress,
  AddressGroup,
  AddressesResult,
} from '../types/ups';

const API_URL = runtimeConfig.apiUrl;

export class ApiError extends Error {
  code?: string;
  upsCodes?: string[];

  constructor(message: string, code?: string, upsCodes?: string[], cause?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.upsCodes = upsCodes;
    // Conserve l'erreur d'origine pour l'inspection en console.
    if (cause !== undefined) this.cause = cause;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
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
  } catch (cause) {
    // fetch ne distingue pas les causes pour raison de sécurité : blocage CORS,
    // contenu mixte, DNS, serveur éteint ou requête annulée donnent la même
    // erreur. On signale les pistes plutôt que d'accuser le backend à tort.
    const mixedContent =
      window.location.protocol === 'https:' && API_URL.startsWith('http:');

    const detail = mixedContent
      ? "la page est en HTTPS et le backend en HTTP : le navigateur bloque l'appel"
      : 'vérifiez la console du navigateur (CORS, DNS ou serveur indisponible)';

    throw new ApiError(`Appel vers ${API_URL} impossible — ${detail}.`, 'NETWORK_ERROR', [], cause);
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

  // Les routes /api/* renvoient { success, data }, mais /health répond
  // directement à la racine : sans ce repli, data.data vaudrait undefined.
  return (data && typeof data === 'object' && 'data' in data ? data.data : data) as T;
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

export interface TransitPayload {
  shipFrom?: Address;
  shipTo: Address;
  weight: number;
  weightUnit?: string;
  shipDate?: string;
  numberOfPackages?: number;
  residential?: boolean;
}

export interface LandedCostPayload {
  importCountryCode: string;
  exportCountryCode: string;
  items: LandedCostItemInput[];
  currency?: string;
}

export interface PickupPayload {
  address: Address;
  pickupDate: string;
  readyTime?: string;
  closeTime?: string;
  pieces: PickupPiece[];
  contactName?: string;
  companyName?: string;
  phone?: string;
  residential?: boolean;
}

export interface UploadPayload {
  fileName: string;
  fileFormat: string;
  documentType?: string;
  fileBase64: string;
}

export interface ShipmentsQuery {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}


export interface AddressPayload {
  label: string;
  groupId?: number | null;
  name: string;
  attentionName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  residential?: boolean;
  isDefault?: boolean;
}

export interface AddressesQuery {
  search?: string;
  groupId?: string | number;
  includeArchived?: boolean;
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

  findAccessPoints: (payload: LocatorPayload) =>
    request<LocatorResult>('/api/locator/access-points', { method: 'POST', body: payload }),

  getTransitTimes: (payload: TransitPayload) =>
    request<TransitResult>('/api/transit-times', { method: 'POST', body: payload }),

  getLandedCost: (payload: LandedCostPayload) =>
    request<LandedCostResult>('/api/landed-cost', { method: 'POST', body: payload }),

  getContainers: () => request<ContainerOption[]>('/api/pickup/containers'),
  createPickup: (payload: PickupPayload) =>
    request<PickupResult>('/api/pickup', { method: 'POST', body: payload }),
  cancelPickup: (prn: string) =>
    request<{ success: boolean; message: string }>(`/api/pickup/${encodeURIComponent(prn)}`, {
      method: 'DELETE',
    }),

  getDocumentTypes: () => request<DocumentTypesResult>('/api/paperless/document-types'),
  uploadDocument: (payload: UploadPayload) =>
    request<UploadResult>('/api/paperless/upload', { method: 'POST', body: payload }),

  listShipments: (params: ShipmentsQuery = {}) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<ShipmentsListResult>(`/api/shipments${suffix}`);
  },
  getShipmentLabel: (trackingNumber: string) =>
    request<StoredLabel>(`/api/shipments/${encodeURIComponent(trackingNumber)}/label`),
  refreshShipmentStatus: (trackingNumbers: string[]) =>
    request<RefreshStatusResult>('/api/shipments/refresh-status', {
      method: 'POST',
      body: { trackingNumbers },
    }),
  syncShipments: () =>
    request<SyncResult>('/api/shipments/sync', { method: 'POST', body: {} }),
  getAnomalies: (type?: string) =>
    request<AnomaliesResult>(`/api/shipments/anomalies${type ? `?type=${type}` : ''}`),

  createBulkShipments: (payload: { shipments: BulkEntry[]; labelFormat?: string }) =>
    request<BulkResult>('/api/shipping/bulk', { method: 'POST', body: payload }),

  // Carnet d'adresses partagé : mêmes entrées pour tous les utilisateurs.
  listAddresses: (params: AddressesQuery = {}) => {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    }
    const suffix = qs.toString() ? `?${qs}` : '';
    return request<AddressesResult>(`/api/addresses${suffix}`);
  },
  createAddress: (payload: AddressPayload) =>
    request<SavedAddress>('/api/addresses', { method: 'POST', body: payload }),
  updateAddress: (id: number, payload: Partial<AddressPayload>) =>
    request<SavedAddress>(`/api/addresses/${id}`, { method: 'PUT', body: payload }),
  archiveAddress: (id: number, hard = false) =>
    request<SavedAddress>(`/api/addresses/${id}${hard ? '?hard=true' : ''}`, { method: 'DELETE' }),
  restoreAddress: (id: number) =>
    request<SavedAddress>(`/api/addresses/${id}/restore`, { method: 'POST', body: {} }),
  markAddressUsed: (id: number) =>
    request<SavedAddress>(`/api/addresses/${id}/use`, { method: 'POST', body: {} }),

  listAddressGroups: () => request<AddressGroup[]>('/api/addresses/groups'),
  createAddressGroup: (name: string) =>
    request<AddressGroup>('/api/addresses/groups', { method: 'POST', body: { name } }),
  updateAddressGroup: (id: number, patch: { name?: string; position?: number }) =>
    request<AddressGroup>(`/api/addresses/groups/${id}`, { method: 'PUT', body: patch }),
  deleteAddressGroup: (id: number) =>
    request<AddressGroup>(`/api/addresses/groups/${id}`, { method: 'DELETE' }),
};

export { API_URL };
