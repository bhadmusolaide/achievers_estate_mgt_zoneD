import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LandlordsPage from './pages/LandlordsPage';
import OnboardingPage from './pages/OnboardingPage';
import BulkImportPage from './pages/BulkImportPage';
import PaymentsPage from './pages/PaymentsPage';
import ReceiptsPage from './pages/ReceiptsPage';
import FinancialOverviewPage from './pages/FinancialOverviewPage';
import TransactionsPage from './pages/TransactionsPage';
import CelebrationsPage from './pages/CelebrationsPage';
import AuditLogPage from './pages/AuditLogPage';
import SettingsPage from './pages/SettingsPage';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="landlords" element={<LandlordsPage />} />
                <Route path="onboarding" element={<OnboardingPage />} />
                <Route path="bulk-import" element={<BulkImportPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="receipts" element={<ReceiptsPage />} />
                <Route path="financial-overview" element={<FinancialOverviewPage />} />
                <Route path="transactions" element={<TransactionsPage />} />
                <Route path="celebrations" element={<CelebrationsPage />} />
                <Route path="audit-log" element={<AuditLogPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
