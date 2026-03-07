import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { FirstLoginPage } from '@/pages/auth/FirstLoginPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { MfaSetupPage } from '@/pages/auth/MfaSetupPage';
import { DashboardPage } from '@/pages/admin/DashboardPage';
import { SpacesPage } from '@/pages/admin/SpacesPage';
import { SpaceDetailPage } from '@/pages/admin/SpaceDetailPage';
import { UsersPage } from '@/pages/admin/UsersPage';
import { AnalyticsPage } from '@/pages/admin/AnalyticsPage';
import { AuditLogPage } from '@/pages/admin/AuditLogPage';
import { FeedbackInboxPage } from '@/pages/admin/FeedbackInboxPage';
import { SettingsPage } from '@/pages/admin/SettingsPage';
import { ReportViewPage as AdminReportViewPage } from '@/pages/admin/ReportViewPage';
import { MySpacesPage } from '@/pages/customer/MySpacesPage';
import { ReportsPage } from '@/pages/customer/ReportsPage';
import { ReportViewPage as CustomerReportViewPage } from '@/pages/customer/ReportViewPage';
import { FullTabReportPage } from '@/pages/FullTabReportPage';
import { Role } from '@/types';

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/first-login" element={<FirstLoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/mfa-setup" element={<MfaSetupPage />} />

      {/* Full-tab report view (shared route, auth checked inside) */}
      <Route
        path="/report/:spaceId/:reportId"
        element={
          <ProtectedRoute allowedRoles={[Role.SUPER_ADMIN, Role.ADMIN, Role.CUSTOMER]}>
            <FullTabReportPage />
          </ProtectedRoute>
        }
      />

      {/* Admin routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[Role.SUPER_ADMIN, Role.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="spaces" element={<SpacesPage />} />
        <Route path="spaces/:spaceId" element={<SpaceDetailPage />} />
        <Route path="spaces/:spaceId/reports/:reportId" element={<AdminReportViewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="audit-log" element={<AuditLogPage />} />
        <Route path="feedback" element={<FeedbackInboxPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Customer routes */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={[Role.CUSTOMER]}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<MySpacesPage />} />
        <Route path="spaces/:spaceId" element={<ReportsPage />} />
        <Route path="spaces/:spaceId/reports/:reportId" element={<CustomerReportViewPage />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={
          user ? (
            user.role === Role.CUSTOMER ? (
              <Navigate to="/customer" replace />
            ) : (
              <Navigate to="/admin" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
