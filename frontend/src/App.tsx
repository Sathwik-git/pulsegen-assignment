import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useAuth } from "./context/AuthContext";
import { usePermissions } from "./rbac";
import type { Permission } from "./rbac";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import UploadPage from "./pages/UploadPage";
import VideoLibraryPage from "./pages/VideoLibraryPage";
import VideoPlayerPage from "./pages/VideoPlayerPage";
import AdminPage from "./pages/AdminPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import type { ReactNode } from "react";
import type { UserRole } from "./types";

/**
 * Protected route wrapper with RBAC support.
 * Supports both role-based and permission-based guards.
 */
interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
  permission?: Permission;
}

function ProtectedRoute({ children, roles, permission }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const { can, isAnyRole } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Check permission-based access
  if (permission && !can(permission)) return <UnauthorizedPage />;

  // Check role-based access
  if (roles && !isAnyRole(roles)) return <UnauthorizedPage />;

  return <>{children}</>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: "8px", background: "#333", color: "#fff" },
        }}
      />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={user ? <Navigate to="/dashboard" /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/dashboard" /> : <RegisterPage />}
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route
            path="upload"
            element={
              <ProtectedRoute permission="video:upload">
                <UploadPage />
              </ProtectedRoute>
            }
          />
          <Route path="library" element={<VideoLibraryPage />} />
          <Route path="video/:id" element={<VideoPlayerPage />} />
          <Route
            path="admin"
            element={
              <ProtectedRoute permission="admin:access">
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route path="unauthorized" element={<UnauthorizedPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
