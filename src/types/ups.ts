/** Structures renvoyées par le backend UPS (déjà normalisées côté serveur). */

export interface Address {
  name?: string;
  attentionName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  residential?: boolean;
}

export interface PackageInput {
  weight: string;
  length?: string;
  width?: string;
  height?: string;
  reference?: string;
  // Renseignes depuis le catalogue de types de colis. Le backend les lit
  // deja (buildPackage) : ils n'etaient simplement jamais envoyes.
  description?: string;
  packagingType?: string;
  /**
   * Nom d'un type du catalogue, resolu par le backend en poids et dimensions
   * (envoi groupe). Le champ ne part jamais chez UPS.
   */
  packageType?: string;
}

export interface TrackActivity {
  date: string | null;
  status: string;
  statusCode: string;
  statusType: string;
  location: string;
}

export interface TrackedPackage {
  trackingNumber: string;
  currentStatus: string;
  currentStatusCode: string;
  service: string;
  weight: string | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
  deliveredTo: string | null;
  deliveryLocation: string | null;
  referenceNumbers: string[];
  activities: TrackActivity[];
}

export interface TrackingResult {
  packages: TrackedPackage[];
  /** Numéro interrogé, renvoyé tel quel par le backend. */
  queriedNumber?: string;
  /**
   * Faux quand UPS a répondu pour un autre numéro (colis de démonstration
   * renvoyé pour un numéro inexistant). Calculé côté backend.
   */
  matched?: boolean;
}

export interface ServiceOption {
  code: string;
  name: string;
}

export interface Rate {
  serviceCode: string;
  serviceName: string;
  totalCharges: number;
  currency: string;
  publishedCharges: number | null;
  isNegotiated: boolean;
  billingWeight: string | null;
  guaranteedDays: string | null;
  deliveryTime: string | null;
}

export interface RatingResult {
  rates: Rate[];
  /** Services écartés par UPS (ex. Access Point sans point relais). */
  warnings?: Array<{ code: string; message: string }>;
}

export interface AccessPointLocation {
  locationId: string;
  name: string;
  addressLines: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  distance: { value: number; unit: string } | null;
  latitude: number | null;
  longitude: number | null;
  isAccessPoint: boolean;
  accessPointStatus: string | null;
  openingHours: Array<{ day: string; closed: boolean; hours: string }>;
  /** Photo de la façade du commerce. */
  imageUrl: string | null;
  /** Identifiant à communiquer au destinataire. */
  publicAccessPointId: string | null;
  /** Horaires en texte libre, repli quand la grille est absente. */
  hoursText: string[];
  services: string[];
  /** Indications d'accès (étage, entrée…). */
  comments: string | null;
  promotions: string[];
}

export interface LocatorResult {
  locations: AccessPointLocation[];
}

export interface ShipmentLabel {
  base64: string;
  mime: string;
  ext: string;
}

export interface ShipmentResult {
  shipmentIdentificationNumber: string;
  totalCharges: number;
  currency: string;
  billingWeight: string | null;
  packages: Array<{ trackingNumber: string; label: ShipmentLabel | null }>;
}

export interface VoidResult {
  success: boolean;
  message: string;
}

export interface TransitService {
  serviceCode: string;
  serviceName: string;
  businessDaysInTransit: number | null;
  deliveryDate: string | null;
  deliveryTime: string | null;
  guaranteed: boolean;
  pickupDate: string | null;
  totalTransitDays: number | null;
}

export interface TransitResult {
  services: TransitService[];
}

export interface LandedCostItem {
  commodityId: string;
  description: string;
  quantity: number;
  duties: number;
  taxes: number;
  totalCharges: number;
}

export interface LandedCostResult {
  currency: string;
  totalDuties: number;
  totalTaxes: number;
  totalFees: number;
  grandTotal: number;
  items: LandedCostItem[];
}

export interface LandedCostItemInput {
  description?: string;
  priceEach: string;
  quantity: string;
  hsCode?: string;
  originCountryCode?: string;
  weight?: string;
}

export interface PickupPiece {
  serviceCode?: string;
  quantity: string;
  destinationCountry?: string;
  containerCode?: string;
}

export interface PickupResult {
  confirmationNumber: string;
  charge: number | null;
  currency: string | null;
  readyTime: string | null;
  /** Colis effectivement rattachés, après déduplication. */
  trackingNumbers?: string[];
}

export interface ContainerOption {
  code: string;
  name: string;
}

export interface DocumentTypesResult {
  documentTypes: Array<{ code: string; name: string }>;
  fileFormats: string[];
}

export interface UploadResult {
  documentId: string;
  status: string;
}

export type ShipmentStatus = 'created' | 'in_transit' | 'delivered' | 'exception' | 'voided';

export interface StoredShipment {
  id: number;
  shipmentId: string;
  trackingNumber: string | null;
  serviceCode: string | null;
  serviceName: string | null;
  recipient: {
    name: string | null;
    company: string | null;
    address: string | null;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  };
  reference: string | null;
  description: string | null;
  totalCharges: number | null;
  currency: string | null;
  billingWeight: string | null;
  labelFormat: string | null;
  hasLabel: boolean;
  accessPointId: string | null;
  status: ShipmentStatus;
  statusDescription: string | null;
  statusCheckedAt: string | null;
  voidedAt: string | null;
  batchId: string | null;
  createdAt: string;
  expectedDelivery: string | null;
  transitDays: number | null;
  lastEventAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  anomalies?: Anomaly[];
  hasAnomaly?: boolean;
  primaryAnomaly?: Anomaly | null;
  /** Auteur de la création, lu dans le journal : absent avant Keycloak. */
  creator?: ShipmentActor | null;
  commentCount?: number;
}

/** Auteur d'une action ou d'un commentaire, recopié depuis Keycloak. */
export interface ShipmentActor {
  id: string | null;
  name: string;
  email: string | null;
}

export interface ShipmentComment {
  id: number;
  trackingNumber: string;
  body: string;
  createdAt: string;
  actor: ShipmentActor | null;
}

/** Réponse de GET /api/shipments/:trackingNumber — tout ce qu'affiche la page dédiée. */
export interface ShipmentDetail {
  shipment: StoredShipment;
  creator: (ShipmentActor & { at: string }) | null;
  activity: ActivityEntry[];
  comments: ShipmentComment[];
  /** Tous les colis de l'expédition : une ligne par colis en base. */
  packages: StoredShipment[];
}

export type AnomalyType = 'delayed' | 'exception' | 'stalled' | 'never_picked_up';

export interface Anomaly {
  type: AnomalyType;
  label: string;
  detail: string;
}

export interface AnomaliesResult {
  summary: {
    counts: Record<AnomalyType, number>;
    affected: number;
    total: number;
  };
  shipments: StoredShipment[];
  thresholds: {
    stalledDays: number;
    neverPickedUpDays: number;
    fallbackDelayDays: number;
  };
}

export interface ShipmentsListResult {
  total: number;
  shipments: StoredShipment[];
  limit: number;
  offset: number;
}

export interface RefreshStatusResult {
  results: Array<{
    trackingNumber: string;
    ok: boolean;
    status?: ShipmentStatus;
    description?: string;
    error?: string;
  }>;
}

export interface SyncResult {
  /**
   * 'quantumview' : un seul appel UPS pour tous les colis récents.
   * 'tracking' : QuantumView indisponible (QVD inactif ou API non
   * souscrite), le backend a basculé sur le suivi colis par colis.
   * Absent avec un backend antérieur (comportement QuantumView).
   */
  mode?: 'quantumview' | 'tracking';
  eventsRead: number;
  pagesRead: number;
  hasMore: boolean;
  updated: number;
  ignored: number;
  details: Array<{ trackingNumber: string; status: ShipmentStatus; description: string }>;
  /** Mode 'tracking' uniquement. */
  fallbackReason?: string;
  checked?: number;
  failed?: number;
  failures?: Array<{ trackingNumber: string; error: string }>;
}

export interface StoredLabel {
  base64: string;
  format: string;
  trackingNumber: string;
}

export interface BulkEntry {
  shipTo: Address;
  packages: PackageInput[];
  serviceCode?: string;
  description?: string;
}

export interface BulkResult {
  batchId: string;
  created: number;
  failed: number;
  results: Array<{
    index: number;
    ok: boolean;
    recipient?: string;
    error?: string;
    shipment?: ShipmentResult;
  }>;
}

export interface HealthResult {
  status: string;
  environment: string;
  baseUrl: string;
  credentialsConfigured: boolean;
  accountConfigured: boolean;
  apiVersions: Record<string, string>;
  token: { cached: boolean; expiresAt: string | null; valid: boolean };
}

/** Entrée du carnet d'adresses : une Address enrichie de ses métadonnées. */
export interface SavedAddress extends Address {
  id: number;
  label: string;
  groupId: number | null;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddressGroup {
  id: number;
  name: string;
  position: number;
  addressCount?: number;
  createdAt: string;
}

export interface AddressesResult {
  addresses: SavedAddress[];
  count: number;
}

/** Entrée du journal d'activité applicative (qui a fait quoi). */
export interface ActivityEntry {
  id: number;
  occurredAt: string;
  actor: { id: string | null; name: string; email: string | null };
  action: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
}

export interface ActivityResult {
  entries: ActivityEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface ActivityActor {
  id: string;
  name: string;
  actionCount: number;
}

/** Lot d'envoi groupé, présenté comme « commande ». */
export interface Batch {
  batchId: string;
  createdAt: string;
  shipmentCount: number;
  counts: {
    created: number;
    inTransit: number;
    delivered: number;
    exception: number;
    voided: number;
  };
  completed: boolean;
  totalCharges: number | null;
  currency: string | null;
}

export interface BatchesResult {
  batches: Batch[];
  total: number;
  limit: number;
  offset: number;
}

export interface BatchDetail extends Batch {
  shipments: StoredShipment[];
}

/** Type de colis pré-enregistré : matériel expédié régulièrement. */
export interface PackageType {
  id: number;
  label: string;
  weight: string;
  length: string;
  width: string;
  height: string;
  description: string | null;
  packagingType: string;
  reference: string | null;
  isDefault: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PackageTypesResult {
  types: PackageType[];
  count: number;
}

export interface PackagingCode {
  code: string;
  name: string;
}

/** Indicateurs chiffrés sur les envois, pour le tableau de bord. */
export interface ShipmentStats {
  shipmentCount: number;
  packageCount: number;
  totalCost: number;
  averageCost: number | null;
  currency: string;
  averageDeliveryDays: number | null;
  deliveredCount: number;
  byStatus: Record<string, number>;
  byService: Array<{ service: string; shipmentCount: number; totalCost: number }>;
  byDay: Array<{ day: string; shipmentCount: number; totalCost: number }>;
}

export interface StatsResult {
  counts: Record<string, number>;
  stats?: ShipmentStats;
  dbEnabled: boolean;
}
