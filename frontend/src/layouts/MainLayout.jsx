import { useState, useEffect } from "react";
import { useAuth } from "../auth.jsx";
import { AlertCircle, X } from "lucide-react";
import Sidebar from "../components/Sidebar.jsx";
import Navbar from "../components/Navbar.jsx";
import { useNavigate } from "react-router-dom";

export default function MainLayout({ children }) {
  const { currentUser } = useAuth();
  const [showProfileAlert, setShowProfileAlert] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if profile is complete (has email)
    if (currentUser && !currentUser.email) {
      setShowProfileAlert(true);
    }
  }, [currentUser]);

  const handleCompleteProfile = () => {
    navigate("/settings");
  };

  return (
    <div className="flex h-screen w-full bg-sky-50 transition-colors duration-300">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />

        {/* Profile Completion Alert */}
        {showProfileAlert && (
          <div className="bg-yellow-50 border-b-2 border-yellow-400 px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-yellow-800">
                  Complete Your Profile
                </p>
                <p className="text-xs text-yellow-700">
                  Please add your email address to complete your profile
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCompleteProfile}
                className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded transition"
              >
                Complete Now
              </button>
              <button
                onClick={() => setShowProfileAlert(false)}
                className="p-1 hover:bg-yellow-200 rounded transition"
              >
                <X className="w-5 h-5 text-yellow-600" />
              </button>
            </div>
          </div>
        )}

        {/* Render children directly instead of using Outlet */}
        <main className="p-6 overflow-y-auto flex-1">
          <div className="bg-white rounded-xl shadow p-6 min-h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}