import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import MainLayout from "../layouts/MainLayout";

// Pages
import Dashboard from "../pages/Dashboard";
import Inventory from "../pages/Inventory";
import Vouchers from "../pages/Vouchers";
import Vendors from "../pages/Vendors";
import Orders from "../pages/Orders";
import Users from "../pages/Users";
import Employees from "../pages/Employees";
import Logs from "../pages/Logs";
import Todos from "../pages/Todos";
import Reports from "../pages/Reports";
import Profile from "../pages/Profile";
import Settings from "../pages/Settings";
import Login from "../pages/Login";
import ChangePasswordOnFirstLogin from "../pages/ChangePasswordOnFirstLogin";

// Protected Route Wrapper
function ProtectedLayout({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white dark:bg-[#0f172a]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect new users to change password page (except for the password change page itself)
  if (user.isNewUser && window.location.pathname !== "/change-password-first-login") {
    return <Navigate to="/change-password-first-login" replace />;
  }

  return <MainLayout>{children}</MainLayout>;
}

export default function AppRouter() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route 
          path="/login" 
          element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
        />

        {/* First Login Password Change */}
        <Route
          path="/change-password-first-login"
          element={
            user ? (
              <ChangePasswordOnFirstLogin />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/vouchers"
          element={
            <ProtectedLayout>
              <Vouchers />
            </ProtectedLayout>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedLayout>
              <Orders />
            </ProtectedLayout>
          }
        />
        <Route
          path="/vendors"
          element={
            <ProtectedLayout>
              <Vendors />
            </ProtectedLayout>
          }
        />
        <Route
          path="/inventory"
          element={
            <ProtectedLayout>
              <Inventory />
            </ProtectedLayout>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedLayout>
              <Employees />
            </ProtectedLayout>
          }
        />
        <Route
          path="/todos"
          element={
            <ProtectedLayout>
              <Todos />
            </ProtectedLayout>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedLayout>
              <Users />
            </ProtectedLayout>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedLayout>
              <Reports />
            </ProtectedLayout>
          }
        />
        <Route
          path="/logs"
          element={
            <ProtectedLayout>
              <Logs />
            </ProtectedLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedLayout>
              <Profile />
            </ProtectedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedLayout>
              <Settings />
            </ProtectedLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
