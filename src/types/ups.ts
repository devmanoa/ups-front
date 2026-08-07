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
}

export interface LocatorResult {
  locations: AccessPointLocation[];
}

export interface AddressCandidate {
  addressLines: string[];
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface AddressValidationResult {
  valid: boolean;
  ambiguous: boolean;
  noCandidates: boolean;
  classification: { code: string; description: string } | null;
  candidates: AddressCandidate[];
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

export interface HealthResult {
  status: string;
  environment: string;
  baseUrl: string;
  credentialsConfigured: boolean;
  accountConfigured: boolean;
  apiVersions: Record<string, string>;
  token: { cached: boolean; expiresAt: string | null; valid: boolean };
}
