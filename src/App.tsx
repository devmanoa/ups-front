import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import Tracking from './pages/Tracking';
import Rating from './pages/Rating';
import Shipping from './pages/Shipping';
import Shipments from './pages/Shipments';
import ShipmentDetail from './pages/ShipmentDetail';
import Anomalies from './pages/Anomalies';
import BulkShipping from './pages/BulkShipping';
import Locator from './pages/Locator';
import TransitTimes from './pages/TransitTimes';
import LandedCost from './pages/LandedCost';
import Pickup from './pages/Pickup';
import Paperless from './pages/Paperless';
import AddressBook from './pages/AddressBook';
import Timeline from './pages/Timeline';
import Batches, { BatchDetailPage } from './pages/Batches';
import PackageTypes from './pages/PackageTypes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

function Guard({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, authConfigured } = useAuth();

  if (isLoading) {
    return <div className="p-6 text-[--k-muted]">Connexion en cours…</div>;
  }
  // Sans Keycloak configuré, l'app reste utilisable (développement local).
  if (authConfigured && !isAuthenticated) {
    return <div className="p-6 text-[--k-muted]">Authentification requise.</div>;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Guard>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="tracking" element={<Tracking />} />
                <Route path="rating" element={<Rating />} />
                <Route path="transit-times" element={<TransitTimes />} />
                <Route path="shipping" element={<Shipping />} />
                <Route path="shipping/bulk" element={<BulkShipping />} />
                <Route path="shipments" element={<Shipments />} />
                <Route path="shipments/:trackingNumber" element={<ShipmentDetail />} />
                <Route path="anomalies" element={<Anomalies />} />
                <Route path="pickup" element={<Pickup />} />
                <Route path="locator" element={<Locator />} />
                <Route path="landed-cost" element={<LandedCost />} />
                <Route path="paperless" element={<Paperless />} />
                <Route path="addresses" element={<AddressBook />} />
                <Route path="package-types" element={<PackageTypes />} />
                <Route path="activity" element={<Timeline />} />
                <Route path="batches" element={<Batches />} />
                <Route path="batches/:batchId" element={<BatchDetailPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Guard>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  );
}
