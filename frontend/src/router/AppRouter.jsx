import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "../auth.jsx";
import MainLayout from "../layouts/MainLayout";

// Pages
import Dashboard from "../pages/Dashboard";
import Inventory from "../pages/Inventory";
import RateList from "../pages/RateList";
import Vouchers from "../pages/Vouchers";
import Ledgers from "../pages/Ledgers";
import BlacklistedLedgers from "../pages/BlacklistedLedgers";
import Communication from "../pages/Communication";
import Orders from "../pages/Orders";
import Delivery from "../pages/Delivery";
import Users from "../pages/Users";
import Employees from "../pages/Employees.jsx";
import EmployeeAttendance from "../pages/EmployeeAttendance";
import EmployeeManagement from "../pages/EmployeeManagement";
import Logs from "../pages/Logs";
import Todos from "../pages/Todos";
import Reports from "../pages/Reports";
import Profile from "../pages/Profile";
import Settings from "../pages/Settings";
import ThemeSettings from "../pages/ThemeSettings";
import Login from "../pages/Login";
import ChangePasswordOnFirstLogin from "../pages/ChangePasswordOnFirstLogin";
import SystemConfig from "../pages/SystemConfig";
import QueueManagement from "../pages/QueueManagement";
import BackupManagement from "../pages/BackupManagement";
import ApiConfiguration from "../pages/ApiConfiguration";
import Roles from "../pages/Roles";
import Features from "../pages/Features";

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
          path="/delivery"
          element={
            <ProtectedLayout>
              <Delivery />
            </ProtectedLayout>
          }
        />
        <Route
          path="/ledgers"
          element={
            <ProtectedLayout>
              <Ledgers />
            </ProtectedLayout>
          }
        />
        <Route
          path="/ledgers/:group"
          element={
            <ProtectedLayout>
              <Ledgers />
            </ProtectedLayout>
          }
        />
        <Route
          path="/ledgers/blacklisted"
          element={
            <ProtectedLayout>
              <BlacklistedLedgers />
            </ProtectedLayout>
          }
        />
        <Route
          path="/communication"
          element={
            <ProtectedLayout>
              <Communication />
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
          path="/rate-list"
          element={
            <ProtectedLayout>
              <RateList />
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
          path="/employees/attendance"
          element={
            <ProtectedLayout>
              <EmployeeAttendance />
            </ProtectedLayout>
          }
        />
        <Route
          path="/employees/management"
          element={
            <ProtectedLayout>
              <EmployeeManagement />
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
        <Route
          path="/settings/theme"
          element={
            <ProtectedLayout>
              <ThemeSettings />
            </ProtectedLayout>
          }
        />
        {/* ROOT-only System Configuration Route */}
        <Route
          path="/system-config"
          element={
            <ProtectedLayout>
              <SystemConfig />
            </ProtectedLayout>
          }
        />
        {/* ROOT-only Queue Management Route */}
        <Route
          path="/queue"
          element={
            <ProtectedLayout>
              <QueueManagement />
            </ProtectedLayout>
          }
        />
        {/* ROOT-only Backup Management Route */}
        <Route
          path="/backup"
          element={
            <ProtectedLayout>
              <BackupManagement />
            </ProtectedLayout>
          }
        />
        {/* ROOT-only API Configuration Route */}
        <Route
          path="/api-config"
          element={
            <ProtectedLayout>
              <ApiConfiguration />
            </ProtectedLayout>
          }
        />
        {/* Roles & Permissions Route */}
        <Route
          path="/roles"
          element={
            <ProtectedLayout>
              <Roles />
            </ProtectedLayout>
          }
        />
        {/* ROOT-only Feature Management Route */}
        <Route
          path="/features"
          element={
            <ProtectedLayout>
              <Features />
            </ProtectedLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
